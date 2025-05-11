import os
import random
import string
import unicodedata
import uuid
import time
import threading
import sys
import shutil
import urllib.parse

from flask import Flask, request, render_template, session, redirect, url_for, jsonify, flash, send_file, make_response
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from functools import wraps

# 1) IMPORTA Flask-Migrate
from flask_migrate import Migrate

from models import db
# Importamos los modelos necesarios directamente
from models.models import Empresa, CodigoDisponible, CodigoAsignado, Producto, CatalogoGlobal
# Importamos los modelos de inventario
from models.modelos_inventario import MovimientoInventario, LoteInventario, LoteMovimientoRelacion

# (NUEVO) IMPORTA la función para leer Google Sheets
from sheets import leer_hoja  # Asegúrate de tener 'sheets.py' con leer_hoja()

# Importar funciones de utils
from utils import (
    process_image, async_download_image, parse_money, normalize_categoria_if_needed,
    optimize_db_session, cleanup_db_session, ensure_default_images,
    find_similar_product_image, find_similar_catalog_image, normalizar_categoria,
    obtener_o_generar_color_categoria
)

# NUEVO: Importar las funciones del nuevo archivo category_colors.py
from category_colors import get_category_color, normalize_category

# Importamos el blueprint de ajuste_stock
from ajuste_stock import init_app as init_ajuste_stock, crear_lote_registro

# Integración OPENAI (si la usas para otros fines)
import openai
openai.api_key = "sk-proj-KXZSGDJ6bGMjVUZXzGp1r3ZYfvUvpkVFbUVqPyWeJc1sxsEjeyodfaLEZOuq5Nc6RYV1f1JvyT3BlbkFJQo22FAJuvP6bF7Z4BQ3nsuEA"

# Integración SERPAPI
import requests
SERPAPI_API_KEY = "84d269bfa51876a1a092ace371d89f7dc2500d8c5a61b420c08d96e5351f5c79"

from sqlalchemy import or_
from datetime import datetime, date, timedelta

# =========================================
# NUEVO: Conjunto de Categorías con Emojis
# =========================================
VALID_CATEGORIES = {
    "abarrotes secos",
    "enlatados y conservas",
    "botanas, dulces y snacks",
    "bebidas no alcohólicas",
    "bebidas alcohólicas",
    "panadería y repostería",
    "lácteos y huevos",
    "carnes frías y embutidos",
    "congelados y refrigerados",
    "frutas y verduras frescas",
    "productos de limpieza y hogar",
    "cuidado personal e higiene",
    "medicamentos de mostrador (otc)",
    "productos para bebés",
    "productos para mascotas",
    "artículos de papelería",
    "ferretería básica",
    "artesanías y manualidades",
    "productos a granel",
    "productos orgánicos",
    "productos gourmet",
    "suplementos alimenticios",
    "otros (miscelánea)"
}

# Configuración de subida de archivos
BASE_DIR = os.path.dirname(os.path.realpath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def download_image_with_headers(url, filepath):
    """
    Intenta descargar una imagen con diferentes cabeceras y agentes de usuario.
    Algunas páginas bloquean descargas sin un User-Agent adecuado.
    """
    headers_list = [
        # Firefox en Windows
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
            "Accept": "image/jpeg, image/png, image/*;q=0.8",
            "Referer": url
        },
        # Chrome en Mac
        {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        },
        # Safari en iPhone
        {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
        }
    ]
    
    for headers in headers_list:
        try:
            print(f"DEBUG: Intentando descargar {url} con cabeceras: {headers}")
            response = requests.get(url, headers=headers, stream=True, timeout=10)
            if response.status_code == 200:
                if not os.path.exists(os.path.dirname(filepath)):
                    os.makedirs(os.path.dirname(filepath))
                
                with open(filepath, "wb") as f:
                    for chunk in response.iter_content(1024):
                        f.write(chunk)
                print(f"DEBUG: Descarga exitosa para {url}")
                return True
            print(f"DEBUG: Error al descargar {url}, código {response.status_code}")
        except Exception as e:
            print(f"DEBUG: Excepción al descargar {url}: {e}")
    
    return False

##############################################
# FUNCIONES AUXILIARES
##############################################
def generar_color_aleatorio() -> str:
    r = lambda: random.randint(0, 255)
    return f"#{r():02X}{r():02X}{r():02X}"

def buscar_imagen_google_images(nombre_producto, codigo_barras_externo=None):
    """
    Uso de SerpAPI (engine=google_images) para buscar imagen y guardarla localmente.
    """
    query = nombre_producto
    if codigo_barras_externo and not codigo_barras_externo.startswith("INT-"):
        query += f" {codigo_barras_externo}"

    params = {
        "engine": "google_images",
        "q": query,
        "api_key": SERPAPI_API_KEY,
        "ijn": "0",
        "num": "9"
    }
    print(f"Buscando imagen en Google Images para: {query}")
    print(f"URL SerpAPI: https://serpapi.com/search?{urllib.parse.urlencode(params)}")
    
    try:
        response = requests.get("https://serpapi.com/search", params=params)
        # Verificar el código de estado HTTP
        if response.status_code != 200:
            print(f"Error: SerpAPI devolvió código {response.status_code}")
            print(f"Respuesta: {response.text}")
            return None
            
        data = response.json()
        
        # Verificar si hay un error en la respuesta JSON
        if "error" in data:
            print(f"Error de SerpAPI: {data['error']}")
            return None
            
        # Verificar si hay resultados de imágenes
        images = data.get("images_results", [])
        if not images:
            print("No se encontraron imágenes para esta consulta")
            return None
            
        # Usar la primera imagen encontrada
        first_image = images[0]
        image_url = first_image.get("thumbnail") or first_image.get("original")
        
        if not image_url:
            print("URL de imagen no encontrada en la respuesta")
            return None
            
        # Descargar la imagen
        print(f"Intentando descargar imagen desde: {image_url}")
        ext = image_url.rsplit('.', 1)[-1].split('?')[0]
        if ext not in ALLOWED_EXTENSIONS:
            ext = "jpg"
        filename = secure_filename(f"{random.randint(100000,999999)}.{ext}")
        
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        # Intentar descargar con diferentes cabeceras
        if download_image_with_headers(image_url, filepath):
            print("Imagen descargada y guardada como:", filename)
            return filename
        else:
            print(f"No se pudo descargar la imagen desde {image_url}")
            return None
    except Exception as e:
        print(f"Error completo al buscar imagen con google_images: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

##############################################
# GPT (opcional) - sin cambios
##############################################
def buscar_titulos_serpapi(codigo_barras):
    """(Opcional) Búsqueda en Google con SerpAPI para extraer títulos de resultados orgánicos."""
    params = {
        "engine": "google",
        "q": codigo_barras,
        "api_key": SERPAPI_API_KEY,
        "hl": "es",
        "num": "10"
    }
    resp = requests.get("https://serpapi.com/search", params=params)
    data = resp.json()
    titles = []
    if "organic_results" in data:
        for item in data["organic_results"]:
            t = item.get("title")
            if t:
                titles.append(t)
    print(f"\n=== DEBUG SERPAPI TITLES PARA: {codigo_barras} ===")
    for t in titles:
        print(" -", t)
    print("=== FIN LISTADO TITULOS ===\n")
    return titles

def gpt_extraer_nombre_categoria(titulos):
    """
    (Opcional) Usa GPT para determinar nombre y categoría a partir de títulos de Google.
    """
    if not titulos:
        return {"nombre": "Producto IA", "categoria": "General"}
    prompt = f"""
Los siguientes títulos provienen de una búsqueda en Google sobre un código de barras:

{titulos}

Por favor, deduce un posible nombre de producto y una categoría.
Si no hay información clara, inventa algo genérico.
Devuélveme un JSON con claves "nombre" y "categoria".
Ejemplo: {{"nombre": "Coca Cola 600 ml", "categoria": "Bebidas"}}
"""
    try:
        print("\n=== Llamando a GPT con estos títulos: ===")
        for t in titulos:
            print(" -", t)
        print("=== FIN LISTADO TITULOS ===\n")
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.3
        )
        content = response.choices[0].message.content.strip()
        import json
        data = json.loads(content)
        nombre = data.get("nombre", "Producto IA")
        categoria = data.get("categoria", "General")
        return {"nombre": nombre, "categoria": categoria}
    except Exception as e:
        print("Error GPT:", e)
        return {"nombre": "Producto IA", "categoria": "General"}

def buscar_nombre_categoria_por_barcode(codigo_barras):
    titulos = buscar_titulos_serpapi(codigo_barras)
    return gpt_extraer_nombre_categoria(titulos)

# Función para truncar URLs largas de manera segura
def truncar_url(url, max_length=95):
    """
    Trunca una URL para que quepa en un campo de longitud limitada.
    Preserva el protocolo y dominio para URLs externas.
    """
    if not url or len(url) <= max_length:
        return url
    
    # Verificar si es una URL externa
    if url.startswith(('http://', 'https://')):
        try:
            # Dividir la URL en partes
            from urllib.parse import urlparse
            parsed_url = urlparse(url)
            base = f"{parsed_url.scheme}://{parsed_url.netloc}"
            path = parsed_url.path
            query = parsed_url.query
            
            # Si solo la base ya es demasiado larga
            if len(base) >= max_length - 5:
                return base[:max_length-5] + "..."
            
            # Calcular cuánto espacio queda para el path y query
            remaining = max_length - len(base) - 4  # -4 para "/..."
            
            # Extraer el nombre del archivo
            filename = path.split('/')[-1] if '/' in path else path
            
            # Si hay espacio para el nombre completo y no hay query
            if len(filename) <= remaining and not query:
                return f"{base}/.../{filename}"
            
            # Si hay query, incluirla parcialmente si hay espacio
            if query and len(filename) + len(query) + 1 <= remaining:  # +1 por el "?"
                return f"{base}/.../{filename}?{query}"
            
            # Si no hay espacio suficiente para todo, truncar adecuadamente
            if len(filename) <= remaining:
                return f"{base}/.../{filename}"
            
            # Si el nombre es demasiado largo, truncarlo
            return f"{base}/.../{filename[:remaining]}"
        except:
            # Si hay algún error, caer al método original pero preservando el dominio
            pass
    
    # Método original para URLs que no son externas o en caso de error
    try:
        # Intentar preservar al menos el dominio para URLs externas
        if url.startswith(('http://', 'https://')):
            from urllib.parse import urlparse
            parsed = urlparse(url)
            domain = parsed.netloc
            if domain and len(domain) + 8 <= max_length:  # 8 caracteres para "https://" y "..."
                return f"{parsed.scheme}://{domain}/..."
            
    except:
        pass
    
    # Si todo falla, usar el método original
    nombre_archivo = url.split('/')[-1]
    if len(nombre_archivo) > max_length:
        return nombre_archivo[-max_length:]
    return nombre_archivo

##############################################
# FUNCIÓN PARA GENERAR CÓDIGO ÚNICO PARA PRODUCTOS A GRANEL
##############################################
def generar_codigo_a_granel():
    """
    Genera un código único para productos a granel con formato GRA-XXXXXXXX.
    """
    prefix = "GRA-"
    caracteres = string.ascii_uppercase + string.digits
    codigo_aleatorio = ''.join(random.choice(caracteres) for _ in range(8))
    return prefix + codigo_aleatorio

##############################################
# FUNCIÓN PARA GENERAR CÓDIGO ÚNICO PARA PRODUCTOS SIN CÓDIGO DE BARRAS
##############################################
def generar_codigo_unico():
    """
    Genera un código único para productos sin código de barras con formato 1901XXXXXXXX.
    """
    # MODIFICADO: Ahora genera códigos empezando con "1901" seguido de 8 dígitos en lugar de "INT-"
    prefix = "1901"
    # MODIFICADO: Ahora usa solo dígitos para los 8 caracteres siguientes
    caracteres = string.digits
    codigo_aleatorio = ''.join(random.choice(caracteres) for _ in range(8))
    return prefix + codigo_aleatorio

##############################################
# FLASK APP
##############################################
app = Flask(__name__)
app.config['SECRET_KEY'] = "super_secreto"
BASE_DIR = os.path.dirname(os.path.realpath(__file__))

app.config['SQLALCHEMY_DATABASE_URI'] = (
    "postgresql://benjaminbecerriles:HammeredEnd872@localhost:5432/inventario_db"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

db.init_app(app)
migrate = Migrate(app, db)

# Inicializar el módulo de ajuste de stock
init_ajuste_stock(app)

# NUEVO: Filtro Jinja2 para obtener el color de categoría
@app.template_filter('category_color')
def category_color_filter(category):
    return get_category_color(category)

# MODIFICADO: Sobrescribir la función existente para usar la nueva lógica
def obtener_o_generar_color_categoria(categoria):
    """
    Función sobrescrita que ahora utiliza get_category_color de category_colors.py
    """
    return get_category_color(categoria)

# MODIFICADO: Actualizar la función normalizar_categoria para usar la nueva
def normalizar_categoria(categoria):
    """
    Función sobrescrita que ahora utiliza normalize_category de category_colors.py
    """
    return normalize_category(categoria)

# Inicialización antes de la primera solicitud
# Inicialización en la creación de la aplicación
with app.app_context():
    # Asegurar que existan las imágenes predeterminadas
    ensure_default_images(BASE_DIR, UPLOAD_FOLDER)
    
    # Verificar si SerpAPI está disponible (opcional)
    try:
        requests.get('https://serpapi.com', timeout=2)
        app.config['SERPAPI_AVAILABLE'] = True
    except Exception as e:
        app.config['SERPAPI_AVAILABLE'] = False
        print(f"AVISO: SerpAPI no disponible, usando imágenes predeterminadas: {e}")

##############################
# Desactivar caché globalmente
##############################
@app.after_request
def no_cache(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private, max-age=0"
    response.headers["Expires"] = "0"
    response.headers["Pragma"] = "no-cache"
    return response

##############################
# Decoradores de Autenticación
##############################
def login_requerido(f):
    @wraps(f)
    def wrap(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return wrap

def admin_requerido(f):
    @wraps(f)
    def wrap(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('login'))
        empresa_id = session.get('user_id')
        emp = Empresa.query.get(empresa_id)
        if not emp or not emp.is_admin:
            return "No tienes permisos de administrador."
        return f(*args, **kwargs)
    return wrap

##############################
# RUTAS BÁSICAS
##############################
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/registro', methods=['GET','POST'])
def registro():
    if request.method == 'POST':
        nombre = request.form['nombre']
        email = request.form['email']
        password = request.form['password']
        codigo_ingresado = request.form.get('codigo', '')

        hashed_pw = generate_password_hash(password)
        nueva_empresa = Empresa(nombre=nombre, email=email, password=hashed_pw)
        db.session.add(nueva_empresa)
        db.session.commit()

        if codigo_ingresado:
            cod_disp = CodigoDisponible.query.filter_by(codigo=codigo_ingresado, esta_activo=True).first()
            if cod_disp:
                db.session.delete(cod_disp)
                nuevo_asig = CodigoAsignado(codigo=codigo_ingresado, esta_activo=True, empresa_id=nueva_empresa.id)
                db.session.add(nuevo_asig)
                db.session.commit()
        return redirect(url_for('login'))
    return render_template('registro.html')

@app.route('/ingresar-codigo', methods=['GET','POST'])
def ingresar_codigo():
    if not session.get('user_id'):
        return "Debes iniciar sesión primero para asignar tu código."
    emp = Empresa.query.get(session['user_id'])
    if not emp:
        return "No se encontró la empresa en la BD."

    if request.method == 'POST':
        codigo_ingresado = request.form['codigo']
        cod_disp = CodigoDisponible.query.filter_by(codigo=codigo_ingresado, esta_activo=True).first()
        if not cod_disp:
            return "Código inválido o inactivo."
        db.session.delete(cod_disp)
        nuevo_asig = CodigoAsignado(codigo=codigo_ingresado, esta_activo=True, empresa_id=emp.id)
        db.session.add(nuevo_asig)
        db.session.commit()
        return "¡Código asignado exitosamente! Ahora ya puedes usar el sistema."

    return render_template('ingresar_codigo.html')

@app.route('/login', methods=['GET','POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        pw = request.form['password']
        emp = Empresa.query.filter_by(email=email).first()
        if not emp:
            return "Email no encontrado."
        if not check_password_hash(emp.password, pw):
            return "Contraseña incorrecta."

        session['logged_in'] = True
        session['user_id'] = emp.id
        session['user_name'] = emp.nombre

        if emp.is_admin:
            return redirect(url_for('admin_panel'))

        cod_asig = CodigoAsignado.query.filter_by(empresa_id=emp.id, esta_activo=True).first()
        if not cod_asig:
            return redirect(url_for('ingresar_codigo'))

        return redirect(url_for('dashboard_home'))
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

##############################
# NUEVO DASHBOARD
##############################
@app.route('/dashboard')
@login_requerido
def dashboard_home():
    """
    Vista del dashboard principal
    """
    # Obtener información del usuario y datos para el dashboard
    empresa_id = session['user_id']
    empresa = Empresa.query.get(empresa_id)
    
    # Obtener lista de productos para estadísticas
    productos = Producto.query.filter_by(empresa_id=empresa_id).all()
    total_productos = len(productos)
    
    return render_template(
        'dashboard_home.html',
        productos=productos,
        total_productos=total_productos
    )

@app.route('/dashboard/inventario')
@login_requerido
def dashboard_inventario():
    """
    Vista del dashboard de inventario con valoración híbrida (lotes o producto directo)
    """
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    
    # Obtener información del usuario
    empresa_id = session.get('user_id')
    
    # Obtener lista de productos para mostrar (solo los aprobados)
    productos_query = Producto.query.filter_by(
        empresa_id=empresa_id,
        is_approved=True
    ).order_by(Producto.id.desc())
    
    # Ejecutar query y obtener resultados
    productos_raw = productos_query.all()
    
    # Crear una lista simplificada con solo los datos necesarios
    productos = []
    total_unidades = 0
    valor_inventario = 0
    
    print("\n\n==== DIAGNÓSTICO DE PRODUCTOS Y LOTES ====")
    
    for p in productos_raw:
        try:
            p_id = p.id
            p_nombre = p.nombre
            
            # Obtener todos los lotes activos con stock positivo para este producto
            lotes_activos = LoteInventario.query.filter_by(
                producto_id=p_id,
                esta_activo=True
            ).filter(LoteInventario.stock > 0).all()
            
            # Verificar stock y costo directos del producto
            try:
                p_stock_directo = float(p.stock) if p.stock is not None else 0
                p_costo_directo = float(p.costo) if p.costo is not None else 0
            except (TypeError, ValueError):
                p_stock_directo = 0
                p_costo_directo = 0
            
            print(f"Producto [{p_id}]: {p_nombre}")
            print(f"  - Stock directo: {p_stock_directo}, Costo directo: {p_costo_directo}")
            print(f"  - Lotes activos encontrados: {len(lotes_activos)}")
            
            # CASO 1: Si hay lotes activos, usar sus valores
            if lotes_activos:
                # Calcular stock total y valor total para este producto basado en lotes
                p_stock_total = 0
                p_valor_total = 0
                
                # Procesar cada lote del producto
                for lote in lotes_activos:
                    try:
                        # Convertir a float
                        lote_stock = float(lote.stock) if lote.stock is not None else 0
                        lote_costo = float(lote.costo_unitario) if lote.costo_unitario is not None else 0
                        
                        # Calcular valor de este lote
                        lote_valor = lote_stock * lote_costo
                        
                        # Sumar al total del producto
                        p_stock_total += lote_stock
                        p_valor_total += lote_valor
                        
                        print(f"    > Lote {lote.numero_lote}: stock={lote_stock}, costo={lote_costo}, valor={lote_valor}")
                    except Exception as e:
                        print(f"    > ERROR procesando lote {lote.id}: {e}")
                
                # Verificar si el stock del producto coincide con la suma de lotes
                if abs(p_stock_directo - p_stock_total) > 0.001:  # Pequeña tolerancia para errores de redondeo
                    print(f"  ⚠️ ADVERTENCIA: Stock en producto ({p_stock_directo}) NO coincide con suma de lotes ({p_stock_total})")
                
                # Usar los valores calculados de lotes
                p_stock_final = p_stock_total
                p_valor_final = p_valor_total
                print(f"  ✅ Usando valores de lotes: stock={p_stock_final}, valor={p_valor_final}")
            
            # CASO 2: Si no hay lotes activos pero el producto tiene stock, usar valores directos
            elif p_stock_directo > 0:
                p_stock_final = p_stock_directo
                p_valor_final = p_stock_directo * p_costo_directo
                print(f"  ⚠️ No hay lotes activos, usando valores directos: stock={p_stock_final}, valor={p_valor_final}")
                
                # OPCIONAL: Crear lote automáticamente (descomenta si deseas esta funcionalidad)
                # try:
                #     movimiento, lote = crear_lote_registro(
                #         producto=p,
                #         cantidad=p_stock_directo,
                #         costo=p_costo_directo,
                #         fecha_caducidad=p.fecha_caducidad if hasattr(p, 'has_caducidad') and p.has_caducidad else None,
                #         usuario_id=empresa_id
                #     )
                #     db.session.commit()
                #     print(f"  ✅ Lote de registro creado automáticamente para producto {p_id}")
                # except Exception as e:
                #     db.session.rollback()
                #     print(f"  ❌ Error al crear lote de registro: {str(e)}")
            
            # CASO 3: Producto sin stock
            else:
                p_stock_final = 0
                p_valor_final = 0
                print(f"  ℹ️ Producto sin stock")
            
            # Acumular totales globales
            total_unidades += p_stock_final
            valor_inventario += p_valor_final
            
            # Intentar obtener precio_venta para el diccionario
            try:
                p_precio = float(p.precio_venta) if p.precio_venta is not None else 0
            except (TypeError, ValueError):
                p_precio = 0
            
            # Agregar a la lista simplificada
            productos.append({
                'id': p_id,
                'nombre': p_nombre,
                'stock': p_stock_final,  # Usamos el stock calculado
                'precio_venta': p_precio,
                'categoria': p.categoria,
                'categoria_color': p.categoria_color,
                'foto': p.foto,
                'codigo_barras_externo': p.codigo_barras_externo,
                'marca': p.marca or '',
                'es_favorito': p.es_favorito,
                'esta_a_la_venta': p.esta_a_la_venta
            })
            
        except Exception as e:
            print(f"ERROR procesando producto: {e}")
            import traceback
            traceback.print_exc()
    
    # Calcular estadísticas
    total_productos = len(productos)
    
    # Productos con poco stock (por agotarse)
    productos_por_agotarse = sum(1 for p in productos if p['stock'] > 0 and p['stock'] <= 5)
    
    print(f"\nRESUMEN GLOBAL:")
    print(f"TOTAL UNIDADES: {total_unidades}")
    print(f"VALOR INVENTARIO: {valor_inventario}")
    print(f"TOTAL PRODUCTOS: {total_productos}")
    print(f"PRODUCTOS POR AGOTARSE: {productos_por_agotarse}")
    print("==== FIN DIAGNÓSTICO ====\n\n")
    
    # Redondear el valor del inventario para mostrarlo correctamente
    valor_inventario_redondeado = int(round(valor_inventario))
    total_unidades_redondeado = int(round(total_unidades))
    
    # Renderizar template con datos simplificados
    return render_template(
        'dashboard_inventario.html',
        productos=productos,
        total_productos=total_productos,
        total_unidades=total_unidades_redondeado,
        valor_inventario=valor_inventario_redondeado,
        productos_por_agotarse=productos_por_agotarse
    )

@app.route('/cambiar-precios')
@login_requerido
def cambiar_precios():
    """
    Vista para cambiar precios de productos organizados por categorías.
    Permite búsqueda y modificación rápida de precios.
    """
    # Obtener información del usuario y datos para el dashboard
    empresa_id = session['user_id']
    
    # Obtener lista de productos aprobados
    productos_db = Producto.query.filter_by(
        empresa_id=empresa_id,
        is_approved=True
    ).order_by(Producto.categoria).all()
    
    # Convertir a diccionarios con todos los campos
    productos = []
    for p in productos_db:
        producto_dict = {
            'id': p.id,
            'nombre': p.nombre,
            'stock': p.stock or 0,
            'precio_venta': p.precio_venta or 0,
            'categoria': p.categoria or '',
            'categoria_color': p.categoria_color or '#6B7280',
            'foto': p.foto or 'default_product.jpg',
            'codigo_barras_externo': p.codigo_barras_externo or '',
            'marca': p.marca or '',
            'es_favorito': p.es_favorito or False,
            'esta_a_la_venta': p.esta_a_la_venta or True,
            'unidad': getattr(p, 'unidad', 'pieza'),
            'tiene_descuento': getattr(p, 'tiene_descuento', False),
            'tipo_descuento': getattr(p, 'tipo_descuento', None),
            'valor_descuento': getattr(p, 'valor_descuento', 0.0),
            # NUEVOS CAMPOS DE RASTREO
            'origen_descuento': getattr(p, 'origen_descuento', None),
            'descuento_grupo_id': getattr(p, 'descuento_grupo_id', None),
            'fecha_aplicacion_descuento': getattr(p, 'fecha_aplicacion_descuento', None)
        }
        productos.append(producto_dict)
    
    # Obtener categorías únicas y sus colores
    categorias = []
    categorias_set = set()
    
    for producto in productos_db:
        if producto.categoria and producto.categoria not in categorias_set:
            categorias_set.add(producto.categoria)
            categorias.append({
                'nombre': producto.categoria,
                'color': producto.categoria_color or '#6B7280' # Color por defecto si no tiene
            })
    
    # Ordenar categorías alfabéticamente
    categorias.sort(key=lambda x: x['nombre'])
    
    return render_template(
        'cambiar_precios.html',
        productos=productos,
        categorias=categorias
    )


##############################
# ADMIN
##############################
@app.route('/admin')
@admin_requerido
def admin_panel():
    return render_template('admin.html')

@app.route('/admin/empresas')
@admin_requerido
def admin_empresas():
    empresas = Empresa.query.all()
    return render_template('admin_empresas.html', empresas=empresas)

@app.route('/admin/codigos-disponibles')
@admin_requerido
def admin_disponibles():
    codigos = CodigoDisponible.query.all()
    return render_template('admin_disponibles.html', codigos=codigos)

def generar_codigo():
    letras = string.ascii_uppercase + string.digits
    return ''.join(random.choice(letras) for _ in range(8))

@app.route('/admin/generar-disponible')
@admin_requerido
def generar_disponible():
    nuevo = CodigoDisponible(codigo=generar_codigo(), esta_activo=True)
    db.session.add(nuevo)
    db.session.commit()
    return redirect(url_for('admin_disponibles'))

@app.route('/admin/eliminar-disponible/<int:cod_id>')
@admin_requerido
def eliminar_disponible(cod_id):
    cod = CodigoDisponible.query.get_or_404(cod_id)
    db.session.delete(cod)
    db.session.commit()
    return redirect(url_for('admin_disponibles'))

@app.route('/admin/codigos-asignados')
@admin_requerido
def admin_asignados():
    codigos = CodigoAsignado.query.all()
    return render_template('admin_asignados.html', codigos=codigos)

@app.route('/admin/toggle-asignado/<int:cod_id>')
@admin_requerido
def toggle_asignado(cod_id):
    cod = CodigoAsignado.query.get_or_404(cod_id)
    cod.esta_activo = not cod.esta_activo
    db.session.commit()
    return redirect(url_for('admin_asignados'))

##############################
# CRUD DE PRODUCTOS
##############################
@app.route('/productos', methods=['GET'])
@login_requerido
def ver_productos():
    empresa_id = session['user_id']
    filtro_aprobacion = request.args.get('filtroAprobacion', 'aprobados')
    termino_busqueda = request.args.get('q', '').strip()

    # Actualizamos automáticamente los lotes sin fecha de caducidad
    try:
        # Obtener productos con caducidad activada
        productos_caducidad = Producto.query.filter(
            Producto.empresa_id == empresa_id,
            Producto.has_caducidad == True,
            Producto.metodo_caducidad.isnot(None)
        ).all()
        
        fixed_count = 0
        for producto in productos_caducidad:
            # Obtener lotes activos sin fecha de caducidad
            lotes = LoteInventario.query.filter(
                LoteInventario.producto_id == producto.id,
                LoteInventario.esta_activo == True,
                LoteInventario.stock > 0,
                LoteInventario.fecha_caducidad.is_(None)
            ).all()
            
            if not lotes:
                continue
                
            # Calcular fecha de caducidad basada en metodo_caducidad
            caducidad_lapso = producto.metodo_caducidad
            fecha_actual = datetime.now()
            fecha_caducidad = None
            
            if caducidad_lapso == '1 día':
                fecha_caducidad = fecha_actual + timedelta(days=1)
            elif caducidad_lapso == '3 días':
                fecha_caducidad = fecha_actual + timedelta(days=3)
            elif caducidad_lapso == '1 semana':
                fecha_caducidad = fecha_actual + timedelta(days=7)
            elif caducidad_lapso == '2 semanas':
                fecha_caducidad = fecha_actual + timedelta(days=14)
            elif caducidad_lapso == '1 mes':
                fecha_caducidad = fecha_actual + timedelta(days=30)
            elif caducidad_lapso == '3 meses':
                fecha_caducidad = fecha_actual + timedelta(days=90)
            elif caducidad_lapso == '6 meses':
                fecha_caducidad = fecha_actual + timedelta(days=180)
            elif caducidad_lapso == '1 año':
                fecha_caducidad = fecha_actual + timedelta(days=365)
            elif caducidad_lapso == '2 años':
                fecha_caducidad = fecha_actual + timedelta(days=730)
            elif caducidad_lapso == '3 años':
                fecha_caducidad = fecha_actual + timedelta(days=1460)  # 4 años (considerados como +3 años)
            
            # Convertir a date
            if fecha_caducidad:
                fecha_caducidad = fecha_caducidad.date()
                
                # Actualizar los lotes
                for lote in lotes:
                    lote.fecha_caducidad = fecha_caducidad
                    fixed_count += 1
                    
        # Guardar cambios si se hicieron modificaciones
        if fixed_count > 0:
            db.session.commit()
    except Exception as e:
        db.session.rollback()

    query = Producto.query.filter_by(empresa_id=empresa_id)
    if filtro_aprobacion == 'aprobados':
        query = query.filter(Producto.is_approved == True)
    elif filtro_aprobacion == 'pendientes':
        query = query.filter(Producto.is_approved == False)
    elif filtro_aprobacion == 'todos':
        pass
    else:
        query = query.filter(Producto.is_approved == True)

    if termino_busqueda:
        query = query.filter(
            or_(
                Producto.nombre.ilike(f"%{termino_busqueda}%"),
                Producto.categoria.ilike(f"%{termino_busqueda}%"),
                Producto.codigo_barras_externo.ilike(f"%{termino_busqueda}%")
            )
        )
    productos = query.all()
    total_productos = Producto.query.filter_by(empresa_id=empresa_id).count()

    # Calcular costo promedio y días hasta caducidad para cada producto
    for producto in productos:
        # Inicializar los atributos temporales
        producto.costo_promedio = producto.costo  # Valor predeterminado
        producto.proximo_lote_dias = None  # Valor predeterminado
        
        try:
            # Buscar lotes activos con stock positivo
            lotes_activos = LoteInventario.query.filter(
                LoteInventario.producto_id == producto.id,
                LoteInventario.esta_activo == True,
                LoteInventario.stock > 0
            ).all()
            
            if lotes_activos:
                # Cálculo del costo promedio ponderado por cantidad en stock
                costo_total = 0
                stock_total = 0
                
                for lote in lotes_activos:
                    costo_total += lote.costo_unitario * lote.stock
                    stock_total += lote.stock
                
                if stock_total > 0:
                    producto.costo_promedio = costo_total / stock_total
                
                # Buscar el próximo lote a caducar entre los que tienen fecha
                lotes_con_caducidad = []
                for lote in lotes_activos:
                    if lote.fecha_caducidad is not None:
                        lotes_con_caducidad.append(lote)
                
                if lotes_con_caducidad:
                    # Ordenar por fecha de caducidad (más cercana primero)
                    lotes_con_caducidad.sort(key=lambda x: x.fecha_caducidad)
                    
                    # MODIFICACIÓN: Buscar el primer lote que no haya caducado aún
                    hoy = date.today()
                    proximo_lote = None
                    lote_caducado = None
                    
                    # Primero intentamos encontrar un lote que no haya caducado
                    for lote in lotes_con_caducidad:
                        if lote.fecha_caducidad >= hoy:
                            proximo_lote = lote
                            break
                        elif lote_caducado is None or lote.fecha_caducidad > lote_caducado.fecha_caducidad:
                            lote_caducado = lote  # Guardamos el lote caducado más reciente
                    
                    # Si no encontramos ningún lote sin caducar, usamos el más recientemente caducado
                    if proximo_lote is None and lote_caducado is not None:
                        proximo_lote = lote_caducado
                    elif proximo_lote is None and len(lotes_con_caducidad) > 0:
                        proximo_lote = lotes_con_caducidad[0]  # Último recurso
                    
                    # Si encontramos un lote para mostrar, calculamos los días
                    if proximo_lote:
                        # Calcular días hasta caducidad directamente
                        if proximo_lote.fecha_caducidad < hoy:
                            dias_calculados = -1 * (hoy - proximo_lote.fecha_caducidad).days
                        else:
                            dias_calculados = (proximo_lote.fecha_caducidad - hoy).days
                        
                        # Asignar el valor a la propiedad del producto
                        producto.proximo_lote_dias = dias_calculados

        except Exception as e:
            # No interrumpir el proceso por un error en un producto
            continue
    
    # Crear diccionarios con todos los campos necesarios
    productos_dict = []
    for p in productos:
        # Calcular días hasta caducidad directamente
        dias_calculados = None
        hoy = date.today()
        
        lotes_activos = LoteInventario.query.filter(
            LoteInventario.producto_id == p.id,
            LoteInventario.esta_activo == True,
            LoteInventario.stock > 0
        ).all()
        
        # Buscar lotes con fecha de caducidad
        proximo_lote = None
        lote_caducado = None

        # Primero buscamos un lote que NO haya caducado
        for lote in lotes_activos:
            if lote.fecha_caducidad is not None:
                # Primero buscamos lotes que no hayan caducado
                if lote.fecha_caducidad >= hoy:
                    if proximo_lote is None or lote.fecha_caducidad < proximo_lote.fecha_caducidad:
                        proximo_lote = lote
                # También guardamos el lote caducado más reciente como respaldo
                elif lote_caducado is None or lote.fecha_caducidad > lote_caducado.fecha_caducidad:
                    lote_caducado = lote

        # Si no encontramos lote sin caducar, usamos el caducado más reciente
        if proximo_lote is None and lote_caducado is not None:
            proximo_lote = lote_caducado
        
        # Calcular días si hay lote con fecha
        if proximo_lote and proximo_lote.fecha_caducidad:
            if proximo_lote.fecha_caducidad < hoy:
                dias_calculados = -1 * (hoy - proximo_lote.fecha_caducidad).days
            else:
                dias_calculados = (proximo_lote.fecha_caducidad - hoy).days
        
        # Crear diccionario con datos seguros - INCLUYENDO NUEVOS CAMPOS
        p_dict = {
            'id': p.id,
            'nombre': p.nombre,
            'stock': p.stock,
            'costo': p.costo,
            'precio_venta': p.precio_venta,
            'categoria': p.categoria,
            'categoria_color': p.categoria_color,
            'foto': p.foto,
            'codigo_barras_externo': p.codigo_barras_externo,
            'marca': p.marca,
            'es_favorito': p.es_favorito,
            'esta_a_la_venta': p.esta_a_la_venta,
            'unidad': getattr(p, 'unidad', None),
            'costo_promedio': getattr(p, 'costo_promedio', p.costo),
            'proximo_lote_dias': dias_calculados,  # Usar valor calculado directamente
            'tiene_descuento': getattr(p, 'tiene_descuento', False),
            'tipo_descuento': getattr(p, 'tipo_descuento', None),
            'valor_descuento': getattr(p, 'valor_descuento', 0.0),
            # NUEVOS CAMPOS DE RASTREO
            'origen_descuento': getattr(p, 'origen_descuento', None),
            'descuento_grupo_id': getattr(p, 'descuento_grupo_id', None),
            'fecha_aplicacion_descuento': getattr(p, 'fecha_aplicacion_descuento', None)
        }
        
        productos_dict.append(p_dict)

    return render_template(
        'productos.html',
        productos=productos_dict,
        filtro_aprobacion=filtro_aprobacion,
        termino_busqueda=termino_busqueda,
        total_productos=total_productos
    )

@app.route('/actualizar-lotes-caducidad', methods=['GET'])
@login_requerido
def actualizar_lotes_caducidad():
    """
    Ruta para actualizar la lógica de próximo lote a caducar en productos existentes.
    Esta función recorre todos los productos con lotes y actualiza la información de caducidad.
    """
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    
    empresa_id = session.get('user_id')
    
    try:
        # Obtener todos los productos de la empresa
        productos = Producto.query.filter_by(empresa_id=empresa_id).all()
        
        productos_actualizados = 0
        lotes_procesados = 0
        
        for producto in productos:
            # Buscar lotes activos con stock positivo
            lotes_activos = LoteInventario.query.filter(
                LoteInventario.producto_id == producto.id,
                LoteInventario.esta_activo == True,
                LoteInventario.stock > 0
            ).all()
            
            if not lotes_activos:
                continue
                
            # Filtrar lotes con fecha de caducidad
            lotes_con_caducidad = [lote for lote in lotes_activos if lote.fecha_caducidad is not None]
            
            if not lotes_con_caducidad:
                continue
                
            # Ordenar por fecha de caducidad (más cercana primero)
            lotes_con_caducidad.sort(key=lambda x: x.fecha_caducidad)
            
            # Buscar el primer lote que no haya caducado aún
            hoy = date.today()
            lote_no_caducado = None
            
            for lote in lotes_con_caducidad:
                if lote.fecha_caducidad >= hoy:
                    lote_no_caducado = lote
                    break
            
            # Si no hay lote sin caducar, usar el que caducó más recientemente
            if not lote_no_caducado and lotes_con_caducidad:
                lote_no_caducado = lotes_con_caducidad[0]
            
            # Si encontramos un lote para mostrar, lo marcamos como "proximo_lote"
            if lote_no_caducado:
                # Opcional: Actualizar algún campo en el producto o lote si es necesario
                lotes_procesados += 1
            
            productos_actualizados += 1
                
        return f"""
        <h2>Actualización de Lotes Completada</h2>
        <p>Se procesaron {productos_actualizados} productos y {lotes_procesados} lotes con fechas de caducidad.</p>
        <p>Los cambios en la lógica de caducidad ahora están activos.</p>
        <p><a href="{url_for('ver_productos')}">Volver a la lista de productos</a></p>
        """
        
    except Exception as e:
        return f"""
        <h2>Error al Actualizar Lotes</h2>
        <p>Se produjo un error: {str(e)}</p>
        <p><a href="{url_for('ver_productos')}">Volver a la lista de productos</a></p>
        """

@app.route('/api/toggle_cost_type', methods=['POST'])
@login_requerido
def toggle_cost_type():
    try:
        data = request.get_json()
        cost_type = data.get('type', 'last')  # 'last' o 'average'
        
        # Guardar la preferencia en la sesión (opcional)
        session['cost_display_type'] = cost_type
        
        return jsonify({
            "success": True,
            "message": f"Tipo de costo cambiado a: {cost_type}",
            "type": cost_type
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error al cambiar tipo de costo: {str(e)}"
        }), 500

# NUEVO: Endpoint para cambiar el estado de favorito
@app.route('/api/toggle_favorite/<int:product_id>', methods=['POST'])
@login_requerido
def toggle_favorite(product_id):
    try:
        # Obtener el producto y verificar que pertenezca a la empresa del usuario
        producto = Producto.query.get_or_404(product_id)
        
        if producto.empresa_id != session.get('user_id'):
            return jsonify({"success": False, "message": "No tienes permiso para modificar este producto"}), 403
        
        # Obtener el nuevo estado desde la solicitud JSON
        data = request.get_json()
        nuevo_estado = data.get('status') == '1'
        
        # Actualizar el estado
        producto.es_favorito = nuevo_estado
        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": "Estado de favorito actualizado correctamente", 
            "estado": "1" if nuevo_estado else "0"
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Error al actualizar: {str(e)}"}), 500

# NUEVO: Endpoint para cambiar el estado de visibilidad
@app.route('/api/toggle_visibility/<int:product_id>', methods=['POST'])
@login_requerido
def toggle_visibility(product_id):
    try:
        # Obtener el producto y verificar que pertenezca a la empresa del usuario
        producto = Producto.query.get_or_404(product_id)
        
        if producto.empresa_id != session.get('user_id'):
            return jsonify({"success": False, "message": "No tienes permiso para modificar este producto"}), 403
        
        # Obtener el nuevo estado desde la solicitud JSON
        data = request.get_json()
        nuevo_estado = data.get('status') == '1'
        
        # Actualizar el estado
        producto.esta_a_la_venta = nuevo_estado
        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": "Visibilidad actualizada correctamente", 
            "estado": "1" if nuevo_estado else "0"
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"Error al actualizar: {str(e)}"}), 500

# NUEVO: Endpoint para actualizar el precio
@app.route('/api/update_price/<int:product_id>', methods=['POST'])
@login_requerido
def update_price(product_id):
    try:
        # Obtener el producto y verificar que pertenezca a la empresa del usuario
        producto = Producto.query.get_or_404(product_id)
        
        if producto.empresa_id != session.get('user_id'):
            return jsonify({"success": False, "message": "No tienes permiso para modificar este producto"}), 403
        
        # Obtener el nuevo precio desde la solicitud JSON
        data = request.get_json()
        try:
            nuevo_precio = float(data.get('price', 0))
            if nuevo_precio < 0:
                return jsonify({"success": False, "message": "El precio no puede ser negativo"}), 400
        except ValueError:
            return jsonify({"success": False, "message": "El precio debe ser un número válido"}), 400
        
        # Guardar el precio anterior para referencia
        precio_anterior = producto.precio_venta
        
        # Actualizar el precio base
        producto.precio_venta = nuevo_precio
        
        # Calcular precio final SIEMPRE (incluso sin descuento)
        precio_final = nuevo_precio
        tiene_descuento = False
        tipo_descuento = None
        valor_descuento = 0.0
        
        # Verificar descuento activo
        if producto.tiene_descuento and producto.valor_descuento > 0:
            tiene_descuento = True
            tipo_descuento = producto.tipo_descuento
            valor_descuento = producto.valor_descuento
            
            if tipo_descuento == 'percentage':
                precio_final = nuevo_precio * (1 - valor_descuento / 100)
            else:  # fixed amount
                precio_final = max(0, nuevo_precio - valor_descuento)
        
        # Commit los cambios
        db.session.commit()
        
        # Respuesta SIEMPRE con la misma estructura
        return jsonify({
            "success": True, 
            "message": "Precio actualizado correctamente", 
            "precio": nuevo_precio,  # Para compatibilidad con código existente
            "precio_base": nuevo_precio,
            "precio_final": precio_final,  # SIEMPRE presente
            "precio_anterior": precio_anterior,  # Información adicional útil
            "tiene_descuento": tiene_descuento,  # SIEMPRE boolean
            "tipo_descuento": tipo_descuento,  # SIEMPRE string o null
            "valor_descuento": valor_descuento  # SIEMPRE número
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False, 
            "message": f"Error al actualizar: {str(e)}",
            # En caso de error, también enviar estructura consistente
            "precio": 0,
            "precio_base": 0,
            "precio_final": 0,
            "precio_anterior": 0,
            "tiene_descuento": False,
            "tipo_descuento": None,
            "valor_descuento": 0
        }), 500

@app.route('/agregar-producto', methods=['GET','POST'])
@login_requerido
def agregar_producto():
    if request.method == 'POST':
        try:
            # Recoger campos del formulario
            codigo_barras_externo = request.form.get("codigo_barras_externo", "").strip()
            nombre = request.form.get("nombre", "").strip()
            stock_str = request.form.get("stock", "0").strip() 
            costo_str = request.form.get("costo", "$0").strip()
            precio_str = request.form.get("precio_venta", "$0").strip()
            marca = request.form.get("marca", "").strip()
            
            # NUEVO: Verificar duplicados si hay código de barras
            if codigo_barras_externo:
                # Buscar productos con el mismo código (solo en los productos de esta empresa)
                producto_existente = Producto.query.filter_by(
                    empresa_id=session['user_id'],
                    codigo_barras_externo=codigo_barras_externo
                ).first()
                
                if producto_existente:
                    # Si existe, devolver mensaje de error
                    flash(f'Error: Ya existe un producto con el código de barras {codigo_barras_externo}', 'danger')
                    return redirect(url_for('agregar_producto'))
            
            # Categoría
            cat_option = request.form.get('categoria_option', 'existente')
            if cat_option == 'existente':
                categoria = request.form.get('categoria_existente', '').strip()
            else:
                categoria = request.form.get('categoria_nueva', '').strip()
            
            # MODIFICADO: Usar la nueva función de normalización
            categoria_normalizada = normalize_category(categoria)
            
            # Favorito y a la venta
            es_favorito_bool = (request.form.get("es_favorito", "0") == "1")
            esta_a_la_venta_bool = (request.form.get("esta_a_la_venta", "1") == "1")
            
            # Caducidad
            has_caducidad = (request.form.get("toggle_caducidad_estado", "DESACTIVADO") == "ACTIVADO")
            caducidad_lapso = request.form.get("caducidad_lapso", None) if has_caducidad else None
            
            # Parse numéricos
            try:
                stock_int = int(stock_str)
            except:
                stock_int = 0
            
            costo_val = parse_money(costo_str)
            precio_val = parse_money(precio_str)
            
            # ===== MANEJO SIMPLIFICADO DE IMÁGENES =====
            foto_final = None
            
            # 1. Primero intentar usar el archivo subido
            if request.files.get('foto') and request.files['foto'].filename:
                file = request.files['foto']
                if allowed_file(file.filename):
                    # Generar nombre único
                    ext = file.filename.rsplit('.', 1)[1].lower()
                    filename = f"{uuid.uuid4().hex}.{ext}"
                    
                    # Guardar archivo
                    if not os.path.exists(UPLOAD_FOLDER):
                        os.makedirs(UPLOAD_FOLDER)
                    
                    file.save(os.path.join(UPLOAD_FOLDER, filename))
                    foto_final = filename
            
            # 2. Si no hay archivo, usar displayed_image_url o ia_foto_filename
            if not foto_final:
                displayed_url = request.form.get("displayed_image_url", "").strip()
                ia_filename = request.form.get("ia_foto_filename", "").strip()
                
                if ia_filename and os.path.exists(os.path.join(UPLOAD_FOLDER, ia_filename)):
                    # Usar el archivo IA que ya existe
                    foto_final = ia_filename
                elif displayed_url:
                    # Es una URL - intentar descargar o usar nombre de archivo
                    if "/uploads/" in displayed_url:
                        # Es local, extraer nombre
                        foto_final = displayed_url.split("/uploads/")[-1]
                    elif displayed_url.startswith(("http://", "https://")):
                        # Es externa, descargar
                        try:
                            ext = "jpg"  # Default
                            filename = f"{uuid.uuid4().hex}.{ext}"
                            filepath = os.path.join(UPLOAD_FOLDER, filename)
                            
                            # Descarga síncrona para asegurar que se complete
                            response = requests.get(displayed_url, timeout=10)
                            if response.status_code == 200:
                                if not os.path.exists(os.path.dirname(filepath)):
                                    os.makedirs(os.path.dirname(filepath))
                                
                                with open(filepath, "wb") as f:
                                    f.write(response.content)
                                
                                foto_final = filename
                        except Exception as e:
                            print(f"Error descargando imagen: {e}")
            
            # 3. Si todo falla, usar imagen predeterminada
            if not foto_final:
                foto_final = "default_product.jpg"
            
            # Usar la nueva función para truncar la URL para asegurar que quepa en la columna
            url_imagen_truncada = truncar_url(request.form.get("displayed_image_url", "").strip(), 95)
                
            # Crear el producto
            nuevo = Producto(
                nombre=nombre,
                stock=stock_int,
                costo=costo_val, 
                precio_venta=precio_val,
                categoria=categoria_normalizada,
                # MODIFICADO: Usar la nueva función de color de categoría
                categoria_color=get_category_color(categoria_normalizada),
                foto=foto_final,
                url_imagen=url_imagen_truncada,  # Usando la URL truncada
                is_approved=True,
                empresa_id=session['user_id'],
                codigo_barras_externo=codigo_barras_externo,
                marca=marca,
                es_favorito=es_favorito_bool,
                esta_a_la_venta=esta_a_la_venta_bool,
                has_caducidad=has_caducidad,
                metodo_caducidad=caducidad_lapso
            )
            
            # Guardar en la base de datos
            db.session.add(nuevo)
            db.session.commit()
            
            # ===== MODIFICADO: Crear siempre un lote y movimiento inicial si hay stock positivo =====
            if nuevo.stock > 0:
                try:
                    # Determinar la fecha de caducidad según el método
                    fecha_caducidad = None
                    if nuevo.has_caducidad and nuevo.metodo_caducidad:
                        fecha_actual = datetime.now()

                        if nuevo.metodo_caducidad == '1 día':
                            fecha_caducidad = fecha_actual + timedelta(days=1)
                        elif nuevo.metodo_caducidad == '3 días':
                            fecha_caducidad = fecha_actual + timedelta(days=3)
                        elif nuevo.metodo_caducidad == '1 semana':
                            fecha_caducidad = fecha_actual + timedelta(days=7)
                        elif nuevo.metodo_caducidad == '2 semanas':
                            fecha_caducidad = fecha_actual + timedelta(days=14)
                        elif nuevo.metodo_caducidad == '1 mes':
                            fecha_caducidad = fecha_actual + timedelta(days=30)
                        elif nuevo.metodo_caducidad == '3 meses':
                            fecha_caducidad = fecha_actual + timedelta(days=90)
                        elif nuevo.metodo_caducidad == '6 meses':
                            fecha_caducidad = fecha_actual + timedelta(days=180)
                        elif nuevo.metodo_caducidad == '1 año':
                            fecha_caducidad = fecha_actual + timedelta(days=365)
                        elif nuevo.metodo_caducidad == '2 años':
                            fecha_caducidad = fecha_actual + timedelta(days=730)
                        elif nuevo.metodo_caducidad == '3 años' or nuevo.metodo_caducidad == 'más de 3 años':
                            fecha_caducidad = fecha_actual + timedelta(days=1460)

                        # Convertir a date
                        if fecha_caducidad:
                            fecha_caducidad = fecha_caducidad.date()
                    
                    # Crear el lote inicial y el movimiento inicial
                    # Usamos la función crear_lote_registro existente
                    movimiento, lote = crear_lote_registro(
                        producto=nuevo,
                        cantidad=nuevo.stock,
                        costo=nuevo.costo,
                        fecha_caducidad=fecha_caducidad,
                        usuario_id=session['user_id']
                    )
                    
                    db.session.commit()
                    print(f"Lote inicial y movimiento creados para producto {nuevo.id}")

                except Exception as e:
                    db.session.rollback()
                    print(f"Error al crear lote inicial y movimiento: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    # Continuamos aunque haya error en la creación del lote
            
            flash('Producto guardado exitosamente', 'success')
            
            # MODIFICADO: Redireccionar a la página de confirmación
            response = make_response(redirect(url_for('producto_confirmacion', producto_id=nuevo.id)))
            response.set_cookie('pagina_origen', 'agregar_producto', max_age=300)  # Cookie válida por 5 minutos
            return response
            
        except Exception as e:
            db.session.rollback()
            flash(f'Error al guardar el producto: {str(e)}', 'danger')
            print(f"ERROR al guardar producto: {str(e)}")
        
        return redirect(url_for('ver_productos'))
        
    else:
        # GET - Cargar página de agregar producto
        categorias_db = (
            db.session.query(Producto.categoria, Producto.categoria_color)
            .filter(Producto.categoria.isnot(None))
            .filter(Producto.categoria != '')
            .distinct()
            .limit(50)  # Limitar cantidad para que sea más rápido
            .all()
        )
        categories_list = [
            {"nombre": c[0], "color": c[1] if c[1] else "#000000"}
            for c in categorias_db
        ]
        return render_template('agregar_producto.html', categories=categories_list)

@app.route('/agregar-sin-codigo', methods=['GET','POST'])
@login_requerido
def agregar_sin_codigo():
    if request.method == 'POST':
        try:
            # Recoger campos del formulario
            nombre = request.form.get("nombre", "").strip()
            stock_str = request.form.get("stock", "0").strip() 
            costo_str = request.form.get("costo", "$0").strip()
            precio_str = request.form.get("precio_venta", "$0").strip()
            marca = request.form.get("marca", "").strip()
            
            # Obtener el código de barras externo del formulario
            codigo_barras_externo = request.form.get("codigo_barras_externo", "").strip()
            
            # Verificar si el código está presente, si no, generar uno nuevo
            if not codigo_barras_externo:
                codigo_barras_externo = generar_codigo_unico()
                
            print(f"DEBUG: Usando código de barras: {codigo_barras_externo}")
            
            # Categoría
            cat_option = request.form.get('categoria_option', 'existente')
            if cat_option == 'existente':
                categoria = request.form.get('categoria_existente', '').strip()
            else:
                categoria = request.form.get('categoria_nueva', '').strip()
                
            # MODIFICADO: Usar la nueva función de normalización
            categoria_normalizada = normalize_category(categoria)
            
            # Favorito y a la venta
            es_favorito_bool = (request.form.get("es_favorito", "0") == "1")
            esta_a_la_venta_bool = (request.form.get("esta_a_la_venta", "1") == "1")
            
            # Caducidad
            has_caducidad = (request.form.get("toggle_caducidad_estado", "DESACTIVADO") == "ACTIVADO")
            caducidad_lapso = request.form.get("caducidad_lapso", None) if has_caducidad else None
            
            # Parse numéricos
            try:
                stock_int = int(stock_str)
            except:
                stock_int = 0
            
            costo_val = parse_money(costo_str)
            precio_val = parse_money(precio_str)
            
            # Manejo de imagen
            foto_final = process_image(request, UPLOAD_FOLDER, BASE_DIR)
            if not foto_final:
                foto_final = "default_product.jpg"
            
            # Usar la función para truncar la URL para asegurar que quepa en la columna
            url_imagen_truncada = truncar_url(request.form.get("displayed_image_url", "").strip(), 95)
                
            # Crear el producto con solo los campos válidos
            nuevo = Producto(
                nombre=nombre,
                stock=stock_int,
                costo=costo_val, 
                precio_venta=precio_val,
                categoria=categoria_normalizada,
                # MODIFICADO: Usar la nueva función de color de categoría
                categoria_color=get_category_color(categoria_normalizada),
                foto=foto_final,
                url_imagen=url_imagen_truncada,
                is_approved=True,
                empresa_id=session['user_id'],
                codigo_barras_externo=codigo_barras_externo,
                marca=marca,
                es_favorito=es_favorito_bool,
                esta_a_la_venta=esta_a_la_venta_bool,
                has_caducidad=has_caducidad,
                metodo_caducidad=caducidad_lapso
                # Eliminados los campos que no existen en el modelo
                # tipo_medida, unidad_medida, fabricacion, origen
            )
            
            # Guardar en la base de datos
            db.session.add(nuevo)
            db.session.commit()
            
            # ===== MODIFICADO: Crear siempre un lote y movimiento inicial si hay stock positivo =====
            if nuevo.stock > 0:
                try:
                    # Determinar la fecha de caducidad según el método
                    fecha_caducidad = None
                    if nuevo.has_caducidad and nuevo.metodo_caducidad:
                        fecha_actual = datetime.now()

                        if nuevo.metodo_caducidad == '1 día':
                            fecha_caducidad = fecha_actual + timedelta(days=1)
                        elif nuevo.metodo_caducidad == '3 días':
                            fecha_caducidad = fecha_actual + timedelta(days=3)
                        elif nuevo.metodo_caducidad == '1 semana':
                            fecha_caducidad = fecha_actual + timedelta(days=7)
                        elif nuevo.metodo_caducidad == '2 semanas':
                            fecha_caducidad = fecha_actual + timedelta(days=14)
                        elif nuevo.metodo_caducidad == '1 mes':
                            fecha_caducidad = fecha_actual + timedelta(days=30)
                        elif nuevo.metodo_caducidad == '3 meses':
                            fecha_caducidad = fecha_actual + timedelta(days=90)
                        elif nuevo.metodo_caducidad == '6 meses':
                            fecha_caducidad = fecha_actual + timedelta(days=180)
                        elif nuevo.metodo_caducidad == '1 año':
                            fecha_caducidad = fecha_actual + timedelta(days=365)
                        elif nuevo.metodo_caducidad == '2 años':
                            fecha_caducidad = fecha_actual + timedelta(days=730)
                        elif nuevo.metodo_caducidad == '3 años' or nuevo.metodo_caducidad == 'más de 3 años':
                            fecha_caducidad = fecha_actual + timedelta(days=1460)

                        # Convertir a date
                        if fecha_caducidad:
                            fecha_caducidad = fecha_caducidad.date()
                    
                    # Crear el lote inicial y el movimiento inicial
                    movimiento, lote = crear_lote_registro(
                        producto=nuevo,
                        cantidad=nuevo.stock,
                        costo=nuevo.costo,
                        fecha_caducidad=fecha_caducidad,
                        usuario_id=session['user_id']
                    )
                    
                    db.session.commit()
                    print(f"Lote inicial y movimiento creados para producto {nuevo.id}")

                except Exception as e:
                    db.session.rollback()
                    print(f"Error al crear lote inicial y movimiento: {str(e)}")
                    import traceback
                    traceback.print_exc()
                        
            flash('Producto sin código de barras guardado exitosamente', 'success')
            
            # MODIFICADO: Redireccionar a la página de confirmación
            response = make_response(redirect(url_for('producto_confirmacion', producto_id=nuevo.id)))
            response.set_cookie('pagina_origen', 'agregar_sin_codigo', max_age=300)  # Cookie válida por 5 minutos
            return response
            
        except Exception as e:
            db.session.rollback()
            flash(f'Error al guardar el producto: {str(e)}', 'danger')
            print(f"ERROR al guardar producto sin código: {str(e)}")
        
        return redirect(url_for('ver_productos'))
        
    else:
        # GET - Cargar página de agregar producto sin código
        categorias_db = (
            db.session.query(Producto.categoria, Producto.categoria_color)
            .filter(Producto.categoria.isnot(None))
            .filter(Producto.categoria != '')
            .distinct()
            .limit(50)
            .all()
        )
        categories_list = [
            {"nombre": c[0], "color": c[1] if c[1] else "#000000"}
            for c in categorias_db
        ]
        return render_template('agregar_sin_codigo.html', categories=categories_list)

@app.route('/agregar-a-granel', methods=['GET', 'POST'])
@login_requerido
def agregar_a_granel():
    if request.method == 'POST':
        try:
            # Recoger campos del formulario
            nombre = request.form.get("nombre", "").strip()
            stock_str = request.form.get("stock", "0").strip() 
            costo_str = request.form.get("costo", "$0").strip()
            precio_str = request.form.get("precio_venta", "$0").strip()
            marca = request.form.get("marca", "").strip()
            
            # Obtener unidad de medida (ya no usamos tipo_medida ni origen directamente)
            unidad_medida = request.form.get("unidad_medida", "").strip()
            
            # Generar código de barras único para productos a granel
            codigo_barras_externo = request.form.get("codigo_barras_externo", "").strip()
            if not codigo_barras_externo:
                codigo_barras_externo = generar_codigo_a_granel()
            
            # Categoría
            cat_option = request.form.get('categoria_option', 'existente')
            if cat_option == 'existente':
                categoria = request.form.get('categoria_existente', '').strip()
            else:
                categoria = request.form.get('categoria_nueva', '').strip()
                
            # MODIFICADO: Usar la nueva función de normalización
            categoria_normalizada = normalize_category(categoria)
            
            # Favorito y a la venta
            es_favorito_bool = (request.form.get("es_favorito", "0") == "1")
            esta_a_la_venta_bool = (request.form.get("esta_a_la_venta", "1") == "1")
            
            # Caducidad
            has_caducidad = (request.form.get("toggle_caducidad_estado", "DESACTIVADO") == "ACTIVADO")
            caducidad_lapso = request.form.get("caducidad_lapso", None) if has_caducidad else None
            
            # Parse numéricos
            try:
                stock_int = float(stock_str)  # Cambiado a float para soportar decimales
            except:
                stock_int = 0
            
            costo_val = parse_money(costo_str)
            precio_val = parse_money(precio_str)
            
            # ===== MANEJO SIMPLIFICADO DE IMÁGENES =====
            foto_final = None
            
            # 1. Primero intentar usar el archivo subido
            if request.files.get('foto') and request.files['foto'].filename:
                file = request.files['foto']
                if allowed_file(file.filename):
                    # Generar nombre único
                    ext = file.filename.rsplit('.', 1)[1].lower()
                    filename = f"{uuid.uuid4().hex}.{ext}"
                    
                    # Guardar archivo
                    if not os.path.exists(UPLOAD_FOLDER):
                        os.makedirs(UPLOAD_FOLDER)
                    
                    file.save(os.path.join(UPLOAD_FOLDER, filename))
                    foto_final = filename
            
            # 2. Si no hay archivo, usar displayed_image_url o ia_foto_filename
            if not foto_final:
                displayed_url = request.form.get("displayed_image_url", "").strip()
                ia_filename = request.form.get("ia_foto_filename", "").strip()
                
                if ia_filename and os.path.exists(os.path.join(UPLOAD_FOLDER, ia_filename)):
                    # Usar el archivo IA que ya existe
                    foto_final = ia_filename
                elif displayed_url:
                    # Es una URL - intentar descargar o usar nombre de archivo
                    if "/uploads/" in displayed_url:
                        # Es local, extraer nombre
                        foto_final = displayed_url.split("/uploads/")[-1]
                    elif displayed_url.startswith(("http://", "https://")):
                        # Es externa, descargar
                        try:
                            ext = "jpg"  # Default
                            filename = f"{uuid.uuid4().hex}.{ext}"
                            filepath = os.path.join(UPLOAD_FOLDER, filename)
                            
                            # Descarga síncrona para asegurar que se complete
                            response = requests.get(displayed_url, timeout=10)
                            if response.status_code == 200:
                                if not os.path.exists(os.path.dirname(filepath)):
                                    os.makedirs(os.path.dirname(filepath))
                                
                                with open(filepath, "wb") as f:
                                    f.write(response.content)
                                
                                foto_final = filename
                        except Exception as e:
                            print(f"Error descargando imagen: {e}")
            
            # 3. Si todo falla, usar imagen predeterminada
            if not foto_final:
                foto_final = "default_product.jpg"
            
            # Usar la nueva función para truncar la URL para asegurar que quepa en la columna
            url_imagen_truncada = truncar_url(request.form.get("displayed_image_url", "").strip(), 95)
            
            # Crear el producto - Solo usar campos que existen en el modelo
            nuevo = Producto(
                nombre=nombre,
                stock=stock_int,
                costo=costo_val, 
                precio_venta=precio_val,
                categoria=categoria_normalizada,
                # MODIFICADO: Usar la nueva función de color de categoría
                categoria_color=get_category_color(categoria_normalizada),
                foto=foto_final,
                url_imagen=url_imagen_truncada,
                is_approved=True,
                empresa_id=session['user_id'],
                codigo_barras_externo=codigo_barras_externo,
                marca=marca,
                es_favorito=es_favorito_bool,
                esta_a_la_venta=esta_a_la_venta_bool,
                has_caducidad=has_caducidad,
                metodo_caducidad=caducidad_lapso,
                unidad=unidad_medida  # Usar unidad correctamente
                # Ya no usamos "origen" que no existe en el modelo
            )
            
            # Guardar en la base de datos
            db.session.add(nuevo)
            db.session.commit()
            
            # ===== MODIFICADO: Crear siempre un lote y movimiento inicial si hay stock positivo =====
            if nuevo.stock > 0:
                try:
                    # Determinar la fecha de caducidad según el método
                    fecha_caducidad = None
                    if nuevo.has_caducidad and nuevo.metodo_caducidad:
                        fecha_actual = datetime.now()

                        if nuevo.metodo_caducidad == '1 día':
                            fecha_caducidad = fecha_actual + timedelta(days=1)
                        elif nuevo.metodo_caducidad == '3 días':
                            fecha_caducidad = fecha_actual + timedelta(days=3)
                        elif nuevo.metodo_caducidad == '1 semana':
                            fecha_caducidad = fecha_actual + timedelta(days=7)
                        elif nuevo.metodo_caducidad == '2 semanas':
                            fecha_caducidad = fecha_actual + timedelta(days=14)
                        elif nuevo.metodo_caducidad == '1 mes':
                            fecha_caducidad = fecha_actual + timedelta(days=30)
                        elif nuevo.metodo_caducidad == '3 meses':
                            fecha_caducidad = fecha_actual + timedelta(days=90)
                        elif nuevo.metodo_caducidad == '6 meses':
                            fecha_caducidad = fecha_actual + timedelta(days=180)
                        elif nuevo.metodo_caducidad == '1 año':
                            fecha_caducidad = fecha_actual + timedelta(days=365)
                        elif nuevo.metodo_caducidad == '2 años':
                            fecha_caducidad = fecha_actual + timedelta(days=730)
                        elif nuevo.metodo_caducidad == '3 años' or nuevo.metodo_caducidad == 'más de 3 años':
                            fecha_caducidad = fecha_actual + timedelta(days=1460)

                        # Convertir a date
                        if fecha_caducidad:
                            fecha_caducidad = fecha_caducidad.date()
                    
                    # Crear el lote inicial y el movimiento inicial
                    movimiento, lote = crear_lote_registro(
                        producto=nuevo,
                        cantidad=nuevo.stock,
                        costo=nuevo.costo,
                        fecha_caducidad=fecha_caducidad,
                        usuario_id=session['user_id']
                    )
                    
                    db.session.commit()
                    print(f"Lote inicial y movimiento creados para producto a granel {nuevo.id}")

                except Exception as e:
                    db.session.rollback()
                    print(f"Error al crear lote inicial y movimiento: {str(e)}")
                    import traceback
                    traceback.print_exc()
                        
            flash('Producto a granel guardado exitosamente', 'success')
            
            # MODIFICADO: Redireccionar a la página de confirmación
            response = make_response(redirect(url_for('producto_confirmacion', producto_id=nuevo.id)))
            response.set_cookie('pagina_origen', 'agregar_a_granel', max_age=300)  # Cookie válida por 5 minutos
            return response
            
        except Exception as e:
            db.session.rollback()
            flash(f'Error al guardar el producto a granel: {str(e)}', 'danger')
            print(f"ERROR al guardar producto a granel: {str(e)}")
        
        return redirect(url_for('ver_productos'))
        
    else:
        # GET - Cargar página de agregar producto a granel
        categorias_db = (
            db.session.query(Producto.categoria, Producto.categoria_color)
            .filter(Producto.categoria.isnot(None))
            .filter(Producto.categoria != '')
            .distinct()
            .limit(50)
            .all()
        )
        categories_list = [
            {"nombre": c[0], "color": c[1] if c[1] else "#000000"}
            for c in categorias_db
        ]
        return render_template('agregar_a_granel.html', categories=categories_list)

@app.route('/editar-producto/<int:prod_id>', methods=['GET','POST'])
@login_requerido
def editar_producto(prod_id):
    """Edita un producto existente."""
    producto = Producto.query.get_or_404(prod_id)
    
    # Verificar que el producto pertenece a la empresa actual
    if producto.empresa_id != session.get('user_id'):
        flash('No tienes permiso para editar este producto.', 'danger')
        return redirect(url_for('ver_productos'))
    
    if request.method == 'POST':
        try:
            # Recoger datos del formulario
            nombre = request.form.get("nombre", "").strip()
            stock_str = request.form.get("stock", "0").strip() 
            costo_str = request.form.get("costo", "$0").strip()
            precio_str = request.form.get("precio_venta", "$0").strip()
            marca = request.form.get("marca", "").strip()
            
            # Categoría
            cat_option = request.form.get('categoria_option', 'existente')
            if cat_option == 'existente':
                categoria = request.form.get('categoria_existente', '').strip()
            else:
                categoria = request.form.get('categoria_nueva', '').strip()
                
            # MODIFICADO: Usar la nueva función de normalización
            categoria_normalizada = normalize_category(categoria)
            
            # Favorito y a la venta
            es_favorito_bool = (request.form.get("es_favorito", "0") == "1")
            esta_a_la_venta_bool = (request.form.get("esta_a_la_venta", "1") == "1")
            
            # Caducidad
            has_caducidad = (request.form.get("toggle_caducidad_estado", "DESACTIVADO") == "ACTIVADO")
            caducidad_lapso = request.form.get("caducidad_lapso", None) if has_caducidad else None
            
            # Parse numéricos
            try:
                stock_int = int(stock_str)
            except:
                stock_int = 0
            
            costo_val = parse_money(costo_str)
            precio_val = parse_money(precio_str)
            
            # ===== MANEJO SIMPLIFICADO DE IMÁGENES =====
            nueva_foto = None
            
            # 1. Intentar usar el archivo subido
            if request.files.get('foto') and request.files['foto'].filename:
                file = request.files['foto']
                if allowed_file(file.filename):
                    # Generar nombre único
                    ext = file.filename.rsplit('.', 1)[1].lower()
                    filename = f"{uuid.uuid4().hex}.{ext}"
                    
                    # Guardar archivo
                    if not os.path.exists(UPLOAD_FOLDER):
                        os.makedirs(UPLOAD_FOLDER)
                    
                    file.save(os.path.join(UPLOAD_FOLDER, filename))
                    nueva_foto = filename
            
            # 2. Si no hay archivo, usar displayed_image_url o ia_foto_filename
            if not nueva_foto:
                displayed_url = request.form.get("displayed_image_url", "").strip()
                ia_filename = request.form.get("ia_foto_filename", "").strip()
                
                if ia_filename and os.path.exists(os.path.join(UPLOAD_FOLDER, ia_filename)):
                    # Usar el archivo IA que ya existe
                    nueva_foto = ia_filename
                elif displayed_url:
                    # Es una URL - intentar descargar o usar nombre de archivo
                    if "/uploads/" in displayed_url:
                        # Es local, extraer nombre
                        nueva_foto = displayed_url.split("/uploads/")[-1]
                    elif displayed_url.startswith(("http://", "https://")):
                        # Es externa, descargar
                        try:
                            ext = "jpg"  # Default
                            filename = f"{uuid.uuid4().hex}.{ext}"
                            filepath = os.path.join(UPLOAD_FOLDER, filename)
                            
                            # Descarga síncrona para asegurar que se complete
                            response = requests.get(displayed_url, timeout=10)
                            if response.status_code == 200:
                                if not os.path.exists(os.path.dirname(filepath)):
                                    os.makedirs(os.path.dirname(filepath))
                                
                                with open(filepath, "wb") as f:
                                    f.write(response.content)
                                
                                nueva_foto = filename
                        except Exception as e:
                            print(f"Error descargando imagen: {e}")
            
            # Usar la nueva función para truncar la URL para asegurar que quepa en la columna
            url_imagen_truncada = truncar_url(request.form.get("displayed_image_url", "").strip(), 95)
            
            # Actualizar el producto con los nuevos datos
            producto.nombre = nombre
            producto.stock = stock_int
            producto.costo = costo_val
            producto.precio_venta = precio_val
            producto.categoria = categoria_normalizada
            # MODIFICADO: Usar la nueva función de color de categoría
            producto.categoria_color = get_category_color(categoria_normalizada)
            
            # Actualizar foto solo si hay una nueva
            if nueva_foto:
                producto.foto = nueva_foto
                producto.url_imagen = url_imagen_truncada  # Usando la URL truncada
            
            # Actualizar otros campos
            producto.codigo_barras_externo = request.form.get("codigo_barras_externo", "").strip()
            producto.marca = marca
            producto.es_favorito = es_favorito_bool
            producto.esta_a_la_venta = esta_a_la_venta_bool
            producto.has_caducidad = has_caducidad
            producto.metodo_caducidad = caducidad_lapso
            
            # Actualizar campos específicos si existen
            if request.form.get("unidad_medida"):
                producto.unidad = request.form.get("unidad_medida")
            
            # Guardar en la base de datos
            db.session.commit()
            flash('Producto actualizado exitosamente', 'success')
            
        except Exception as e:
            db.session.rollback()
            flash(f'Error al actualizar el producto: {str(e)}', 'danger')
            print(f"ERROR al actualizar producto: {str(e)}")
        
        return redirect(url_for('ver_productos'))
    
    # GET - Cargar página de editar producto
    categorias_db = (
        db.session.query(Producto.categoria, Producto.categoria_color)
        .filter(Producto.categoria.isnot(None))
        .filter(Producto.categoria != '')
        .distinct()
        .limit(50)
        .all()
    )
    categories_list = [
        {"nombre": c[0], "color": c[1] if c[1] else "#000000"}
        for c in categorias_db
    ]
    
    # Verificar si la categoría del producto existe en la lista
    cat_encontrada = any(cat["nombre"] == producto.categoria for cat in categories_list)
    
    return render_template(
        'editar_producto.html', 
        producto=producto,
        categories=categories_list,
        cat_encontrada=cat_encontrada
    )

@app.route('/eliminar-producto/<int:prod_id>')
@login_requerido
def eliminar_producto(prod_id):
    """Elimina un producto del inventario y todos sus datos relacionados."""
    try:
        # Verificar que el producto existe y pertenece a la empresa actual
        producto = Producto.query.get_or_404(prod_id)
        
        if producto.empresa_id != session.get('user_id'):
            flash('No tienes permiso para eliminar este producto.', 'danger')
            return redirect(url_for('ver_productos'))
        
        # 1. Eliminar las relaciones entre lotes y movimientos
        LoteMovimientoRelacion.query.filter(
            LoteMovimientoRelacion.lote_id.in_(
                db.session.query(LoteInventario.id).filter_by(producto_id=prod_id)
            )
        ).delete(synchronize_session=False)
        
        # 2. Eliminar todos los movimientos de inventario del producto
        MovimientoInventario.query.filter_by(producto_id=prod_id).delete()
        
        # 3. Eliminar todos los lotes de inventario del producto
        LoteInventario.query.filter_by(producto_id=prod_id).delete()
        
        # 4. Finalmente, eliminar el producto
        db.session.delete(producto)
        
        # Confirmar todos los cambios
        db.session.commit()
        flash('Producto y todos sus datos relacionados eliminados correctamente', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error al eliminar el producto: {str(e)}', 'danger')
        print(f"ERROR al eliminar producto y datos relacionados: {str(e)}")
    
    # Esta línea es crucial - asegura que siempre se devuelva una respuesta
    return redirect(url_for('ver_productos'))

@app.route('/historial-movimientos')
@login_requerido
def historial_movimientos():
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    
    # Obtener ID de empresa del usuario actual
    empresa_id = session.get('user_id')
    
    # Obtener parámetros de filtro
    tipo = request.args.get('tipo', 'todos')
    periodo = int(request.args.get('periodo', 30))
    busqueda = request.args.get('q', '')
    page = int(request.args.get('page', 1))
    per_page = 30  # Movimientos por página
    
    # Calcular fecha límite según el período seleccionado
    fecha_limite = datetime.now() - timedelta(days=periodo)
    
    # Consulta base CON FILTRO POR EMPRESA_ID
    query = MovimientoInventario.query.join(Producto).filter(
        MovimientoInventario.fecha_movimiento >= fecha_limite,
        Producto.empresa_id == empresa_id  # Filtro importante por empresa_id
    )
    
    # Aplicar filtro de tipo
    if tipo == 'entrada':
        query = query.filter(MovimientoInventario.tipo_movimiento == 'ENTRADA')
    elif tipo == 'salida':
        query = query.filter(MovimientoInventario.tipo_movimiento == 'SALIDA')
    
    # Aplicar búsqueda
    if busqueda:
        query = query.filter(
            or_(
                Producto.nombre.ilike(f'%{busqueda}%'),
                Producto.codigo_barras_externo.ilike(f'%{busqueda}%')
            )
        )
    
    # Ordenar por fecha descendente (más reciente primero)
    query = query.order_by(MovimientoInventario.fecha_movimiento.desc())
    
    # Contar total de resultados
    total_movimientos = query.count()
    
    # Aplicar paginación
    movimientos = query.paginate(page=page, per_page=per_page, error_out=False)
    
    # Determinar si hay página siguiente
    has_next = page * per_page < total_movimientos
    
    return render_template(
        'historial_movimientos.html',
        movimientos=movimientos.items,
        current_page=page,
        has_next=has_next,
        total_movimientos=total_movimientos
    )

@app.route('/generar-movimientos-iniciales-debug')
@login_requerido
def generar_movimientos_iniciales_debug():
    """
    Versión depurada para generar movimientos iniciales para productos sin movimiento inicial.
    """
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    
    # Obtener ID de empresa del usuario actual
    empresa_id = session.get('user_id')
    
    # Iniciar registro HTML para visualizar resultados
    resultado_html = "<h2>Diagnóstico de Movimientos Iniciales</h2>"
    resultado_html += "<style>.success{color:green;} .error{color:red;} .warning{color:orange;}</style>"
    resultado_html += "<ul>"
    
    try:
        # Obtener todos los productos aprobados con stock positivo
        productos = Producto.query.filter_by(
            empresa_id=empresa_id,
            is_approved=True
        ).filter(Producto.stock > 0).all()
        
        resultado_html += f"<li>Encontrados {len(productos)} productos con stock positivo</li>"
        
        productos_procesados = 0
        movimientos_creados = 0
        lotes_creados = 0
        productos_con_errores = 0
        
        for producto in productos:
            try:
                productos_procesados += 1
                resultado_html += f"<li>Procesando producto ID {producto.id}: {producto.nombre} (Stock: {producto.stock})</li>"
                
                # 1. Verificar si ya existe movimiento inicial
                movimientos = MovimientoInventario.query.filter_by(
                    producto_id=producto.id
                ).all()
                
                movimiento_inicial_existe = False
                for m in movimientos:
                    if m.motivo == 'Registro inicial' or (m.motivo and 'registro' in m.motivo.lower()):
                        movimiento_inicial_existe = True
                        resultado_html += f"<li class='warning'>- Ya tiene movimiento inicial (ID: {m.id})</li>"
                        break
                
                # 2. Verificar si ya existe lote de registro
                lotes = LoteInventario.query.filter_by(
                    producto_id=producto.id
                ).all()
                
                lote_registro_existe = False
                for l in lotes:
                    if l.numero_lote == "Lote de Registro":
                        lote_registro_existe = True
                        resultado_html += f"<li class='warning'>- Ya tiene Lote de Registro (ID: {l.id}, Stock: {l.stock})</li>"
                        break
                
                # 3. Crear movimiento y lote si no existen
                if not movimiento_inicial_existe or not lote_registro_existe:
                    # Determinar fecha_caducidad si aplica
                    fecha_caducidad = None
                    if hasattr(producto, 'has_caducidad') and producto.has_caducidad and producto.metodo_caducidad:
                        try:
                            fecha_actual = datetime.now()
                            
                            if producto.metodo_caducidad == '1 día':
                                fecha_caducidad = fecha_actual + timedelta(days=1)
                            elif producto.metodo_caducidad == '3 días':
                                fecha_caducidad = fecha_actual + timedelta(days=3)
                            elif producto.metodo_caducidad == '1 semana':
                                fecha_caducidad = fecha_actual + timedelta(days=7)
                            elif producto.metodo_caducidad == '2 semanas':
                                fecha_caducidad = fecha_actual + timedelta(days=14)
                            elif producto.metodo_caducidad == '1 mes':
                                fecha_caducidad = fecha_actual + timedelta(days=30)
                            elif producto.metodo_caducidad == '3 meses':
                                fecha_caducidad = fecha_actual + timedelta(days=90)
                            elif producto.metodo_caducidad == '6 meses':
                                fecha_caducidad = fecha_actual + timedelta(days=180)
                            elif producto.metodo_caducidad == '1 año':
                                fecha_caducidad = fecha_actual + timedelta(days=365)
                            elif producto.metodo_caducidad == '2 años':
                                fecha_caducidad = fecha_actual + timedelta(days=730)
                            elif producto.metodo_caducidad == '3 años':
                                fecha_caducidad = fecha_actual + timedelta(days=1460)
                            
                            # Convertir a date
                            if fecha_caducidad:
                                fecha_caducidad = fecha_caducidad.date()
                        except Exception as e:
                            resultado_html += f"<li class='error'>- Error al calcular fecha de caducidad: {str(e)}</li>"
                    
                    # Crear movimiento si no existe
                    if not movimiento_inicial_existe:
                        try:
                            costo = producto.costo if hasattr(producto, 'costo') and producto.costo is not None else 0
                            nuevo_movimiento = MovimientoInventario(
                                producto_id=producto.id,
                                tipo_movimiento='ENTRADA',
                                cantidad=float(producto.stock),
                                motivo='Registro inicial',
                                fecha_movimiento=datetime.now(),
                                costo_unitario=float(costo),
                                numero_lote="Lote de Registro",
                                fecha_caducidad=fecha_caducidad,
                                usuario_id=empresa_id
                            )
                            db.session.add(nuevo_movimiento)
                            db.session.flush()  # Para obtener el ID asignado
                            
                            movimientos_creados += 1
                            resultado_html += f"<li class='success'>- Creado movimiento inicial ID: {nuevo_movimiento.id}</li>"
                        except Exception as e:
                            resultado_html += f"<li class='error'>- Error al crear movimiento: {str(e)}</li>"
                            import traceback
                            resultado_html += f"<li class='error'>- Trace: {traceback.format_exc()}</li>"
                    
                    # Crear lote si no existe
                    if not lote_registro_existe:
                        try:
                            costo = producto.costo if hasattr(producto, 'costo') and producto.costo is not None else 0
                            nuevo_lote = LoteInventario(
                                producto_id=producto.id,
                                numero_lote="Lote de Registro",
                                costo_unitario=float(costo),
                                stock=float(producto.stock),
                                fecha_entrada=datetime.now(),
                                fecha_caducidad=fecha_caducidad,
                                esta_activo=True
                            )
                            db.session.add(nuevo_lote)
                            db.session.flush()  # Para obtener el ID asignado
                            
                            lotes_creados += 1
                            resultado_html += f"<li class='success'>- Creado lote de registro ID: {nuevo_lote.id}</li>"
                        except Exception as e:
                            resultado_html += f"<li class='error'>- Error al crear lote: {str(e)}</li>"
                            import traceback
                            resultado_html += f"<li class='error'>- Trace: {traceback.format_exc()}</li>"
                
                # Actualizar todo el producto cada vez (commit por producto)
                db.session.commit()
                resultado_html += "<li class='success'>- Commit exitoso para este producto</li>"
                
            except Exception as e:
                db.session.rollback()
                productos_con_errores += 1
                resultado_html += f"<li class='error'>Error general para producto {producto.id}: {str(e)}</li>"
                import traceback
                resultado_html += f"<li class='error'>Trace: {traceback.format_exc()}</li>"
        
        # Resumen final
        resultado_html += "</ul>"
        resultado_html += f"""
        <h3>Resumen del Proceso</h3>
        <ul>
            <li>Productos procesados: {productos_procesados}</li>
            <li>Movimientos iniciales creados: {movimientos_creados}</li>
            <li>Lotes de registro creados: {lotes_creados}</li>
            <li>Productos con errores: {productos_con_errores}</li>
        </ul>
        
        <p>
            <a href="{url_for('historial_movimientos')}?periodo=365" 
               style="display:inline-block; padding:10px 20px; background-color:#e52e2e; 
                      color:white; text-decoration:none; border-radius:5px;">
                Ver Historial de Movimientos (Último año)
            </a>
        </p>
        """
        
        return resultado_html
        
    except Exception as e:
        db.session.rollback()
        import traceback
        return f"""
        <h2>Error General en el Proceso</h2>
        <p style="color:red;">Se produjo un error: {str(e)}</p>
        <pre>{traceback.format_exc()}</pre>
        <p>
            <a href="{url_for('dashboard_home')}" style="color:#0066cc;">Volver al Dashboard</a>
        </p>
        """

##############################
# ESCÁNER / CAPTURA RÁPIDA
##############################
@app.route('/inventario-escaner', methods=['GET','POST'])
@login_requerido
def inventario_escaner():
    return render_template('inventario_escaner.html')

@app.route('/pendientes_aprobacion')
@login_requerido
def pendientes_aprobacion():
    empresa_id = session['user_id']
    pendientes = Producto.query.filter_by(
        empresa_id=empresa_id, 
        is_approved=False
    ).all()
    return render_template('pendientes_aprobacion.html', pendientes=pendientes)

@app.route('/completar-datos/<int:prod_id>', methods=['GET','POST'])
@login_requerido
def completar_datos(prod_id):
    producto = Producto.query.get_or_404(prod_id)
    
    # Verificar que el producto pertenece a la empresa actual
    if producto.empresa_id != session.get('user_id'):
        flash('No tienes permiso para editar este producto.', 'danger')
        return redirect(url_for('pendientes_aprobacion'))
    
    if request.method == 'POST':
        try:
            # Actualizar campos...
            producto.nombre = request.form.get('nombre', '')
            producto.stock = int(request.form.get('stock', 0))
            producto.costo = float(request.form.get('costo', 0))
            producto.precio_venta = float(request.form.get('precio_venta', 0))
            
            # Categoría
            cat_option = request.form.get('categoria_option')
            if cat_option == 'existente':
                categoria = request.form.get('categoria_existente', '')
            else:
                categoria = request.form.get('categoria_nueva', '')
                
            # MODIFICADO: Usar la nueva función para normalizar la categoría
            categoria_normalizada = normalize_category(categoria)
            producto.categoria = categoria_normalizada
            
            # MODIFICADO: Usar la nueva función para obtener el color de la categoría
            producto.categoria_color = get_category_color(categoria_normalizada)
            
            # Aprobar el producto
            producto.is_approved = True
            
            db.session.commit()
            flash('Producto aprobado y actualizado con éxito.')
            return redirect(url_for('pendientes_aprobacion'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error al actualizar: {str(e)}')
    
    # Obtener lista de categorías
    categorias_db = (
        db.session.query(Producto.categoria, Producto.categoria_color)
        .filter(Producto.categoria.isnot(None))
        .filter(Producto.categoria != '')
        .distinct()
        .all()
    )
    categories_list = [
        {"nombre": c[0], "color": c[1] if c[1] else "#000000"}
        for c in categorias_db
    ]
    
    # Verificar si la categoría del producto existe en la lista
    cat_encontrada = any(cat["nombre"] == producto.categoria for cat in categories_list)
    
    return render_template(
        'completar_datos.html',
        producto=producto,
        categories=categories_list,
        cat_encontrada=cat_encontrada
    )

@app.route('/nuevo-producto')
@login_requerido
def nuevo_producto():
    return render_template('nuevo_producto.html')

@app.route('/producto-confirmacion/<int:producto_id>')
@login_requerido
def producto_confirmacion(producto_id):
    """Muestra la confirmación de un producto recién agregado."""
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    
    empresa_id = session.get('user_id')
    
    # Obtener el producto
    producto = Producto.query.get_or_404(producto_id)
    
    # Verificar que el producto pertenezca a la empresa del usuario actual
    if producto.empresa_id != empresa_id:
        flash('No tienes permiso para ver este producto.', 'danger')
        return redirect(url_for('ver_productos'))
    
    # Determinar la página de origen para el botón "Volver"
    # Lo almacenamos en una cookie temporal
    pagina_origen = request.cookies.get('pagina_origen', 'agregar_producto')
    
    return render_template(
        'producto_confirmacion.html',
        producto=producto,
        pagina_origen=pagina_origen
    )

##############################
# DESCUENTOS
##############################
@app.route('/api/apply_discount/<int:product_id>', methods=['POST'])
@login_requerido
def apply_discount(product_id):
    """Aplica un descuento a un producto específico con rastreo mejorado."""
    try:
        producto = Producto.query.get_or_404(product_id)
        
        # Verificar que el producto pertenezca a la empresa del usuario
        if producto.empresa_id != session.get('user_id'):
            return jsonify({"success": False, "message": "Sin permisos"}), 403
        
        data = request.get_json()
        discount_type = data.get('type')  # 'percentage' o 'fixed'
        discount_value = float(data.get('value', 0))
        discount_origin = data.get('origin', 'individual')  # NUEVO
        discount_group_id = data.get('group_id', None)  # NUEVO
        
        # Validar datos
        if discount_type not in ['percentage', 'fixed'] or discount_value <= 0:
            return jsonify({"success": False, "message": "Datos de descuento inválidos"}), 400
        
        # Validar porcentaje
        if discount_type == 'percentage' and discount_value > 100:
            return jsonify({"success": False, "message": "El porcentaje no puede ser mayor a 100"}), 400
        
        # NUEVOS CAMPOS DE RASTREO
        producto.tiene_descuento = True
        producto.tipo_descuento = discount_type
        producto.valor_descuento = discount_value
        producto.origen_descuento = discount_origin
        producto.descuento_grupo_id = discount_group_id
        producto.fecha_aplicacion_descuento = datetime.utcnow()
        
        # Calcular precio final SOLO para la respuesta
        if discount_type == 'percentage':
            precio_final = producto.precio_venta * (1 - discount_value / 100)
        else:
            precio_final = max(0, producto.precio_venta - discount_value)
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "precio_base": producto.precio_venta,
            "precio_final": precio_final,
            "tipo_descuento": discount_type,
            "valor_descuento": discount_value,
            "origen_descuento": discount_origin,
            "descuento_grupo_id": discount_group_id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/remove_discount/<int:product_id>', methods=['POST'])
@login_requerido
def remove_discount(product_id):
    """Remueve el descuento de un producto específico."""
    try:
        producto = Producto.query.get_or_404(product_id)
        
        # Verificar que el producto pertenezca a la empresa del usuario
        if producto.empresa_id != session.get('user_id'):
            return jsonify({"success": False, "message": "Sin permisos"}), 403
        
        # Remover descuento
        producto.tiene_descuento = False
        producto.tipo_descuento = None
        producto.valor_descuento = 0.0
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "precio_base": producto.precio_venta
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/descuentos/detalle/<tipo>/<grupo_id>')
@login_requerido
def descuentos_detalle(tipo, grupo_id):
    """Muestra los detalles de productos con descuento por tipo y grupo"""
    empresa_id = session['user_id']
    
    # Decodificar grupo_id (puede contener espacios)
    import urllib.parse
    grupo_id = urllib.parse.unquote(grupo_id)
    
    # Filtrar productos según el tipo de descuento
    if tipo == 'global':
        productos = Producto.query.filter_by(
            empresa_id=empresa_id,
            is_approved=True,
            tiene_descuento=True,
            origen_descuento='global'
        ).all()
        titulo = "Descuento Global"
    elif tipo == 'categoria':
        productos = Producto.query.filter_by(
            empresa_id=empresa_id,
            is_approved=True,
            tiene_descuento=True,
            origen_descuento='categoria',
            descuento_grupo_id=grupo_id
        ).all()
        titulo = f"Categoría: {grupo_id}"
    elif tipo == 'marca':
        productos = Producto.query.filter_by(
            empresa_id=empresa_id,
            is_approved=True,
            tiene_descuento=True,
            origen_descuento='marca',
            descuento_grupo_id=grupo_id
        ).all()
        titulo = f"Marca: {grupo_id}"
    else:
        # Por defecto, mostrar productos individuales
        productos = Producto.query.filter_by(
            empresa_id=empresa_id,
            is_approved=True,
            tiene_descuento=True,
            origen_descuento='individual'
        ).all()
        titulo = "Productos Individuales"
    
    return render_template(
        'descuentos_detalle.html',
        productos=productos,
        titulo=titulo,
        tipo=tipo,
        grupo_id=grupo_id
    )

@app.route('/descuentos')
@login_requerido
def descuentos():
    """Vista para aplicar descuentos a productos."""
    try:
        # Obtener información del usuario
        empresa_id = session.get('user_id')
        
        if not empresa_id:
            flash('Error: Usuario no identificado', 'error')
            return redirect(url_for('login'))
        
        # Obtener lista de productos aprobados
        productos_db = Producto.query.filter_by(
            empresa_id=empresa_id,
            is_approved=True
        ).order_by(Producto.categoria).all()
        
        # Convertir objetos Producto a diccionarios simples - INCLUYENDO NUEVOS CAMPOS
        productos = []
        for p in productos_db:
            try:
                producto_dict = {
                    'id': p.id,
                    'nombre': p.nombre or '',
                    'stock': p.stock or 0,
                    'precio_venta': p.precio_venta or 0,
                    'categoria': p.categoria or '',
                    'categoria_color': p.categoria_color or '#6B7280',
                    'foto': p.foto or 'default_product.jpg',
                    'codigo_barras_externo': p.codigo_barras_externo or '',
                    'marca': p.marca or '',
                    'es_favorito': p.es_favorito or False,
                    'esta_a_la_venta': p.esta_a_la_venta or True,
                    'tiene_descuento': getattr(p, 'tiene_descuento', False),
                    'tipo_descuento': getattr(p, 'tipo_descuento', None),
                    'valor_descuento': float(getattr(p, 'valor_descuento', 0.0)),
                    # NUEVOS CAMPOS DE RASTREO
                    'origen_descuento': getattr(p, 'origen_descuento', None),
                    'descuento_grupo_id': getattr(p, 'descuento_grupo_id', None),
                    'fecha_aplicacion_descuento': getattr(p, 'fecha_aplicacion_descuento', None)
                }
                productos.append(producto_dict)
            except Exception as e:
                print(f"Error procesando producto {p.id}: {str(e)}")
                continue
        
        # Obtener categorías únicas y sus colores
        categorias = []
        categorias_set = set()
        
        for producto in productos_db:
            if producto.categoria and producto.categoria not in categorias_set:
                categorias_set.add(producto.categoria)
                categorias.append({
                    'nombre': producto.categoria,
                    'color': producto.categoria_color or '#6B7280'  # Color por defecto si no tiene
                })
        
        # Ordenar categorías alfabéticamente
        categorias.sort(key=lambda x: x['nombre'])
        
        # Renderizar template con datos simplificados
        return render_template(
            'descuentos.html',
            productos=productos,
            categorias=categorias
        )
        
    except Exception as e:
        print(f"Error en ruta descuentos: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # En caso de error, mostrar mensaje amigable
        flash('Error al cargar la página de descuentos', 'error')
        return redirect(url_for('dashboard_inventario'))

@app.route('/api/search_products', methods=['GET'])
@login_requerido
def api_search_products():
    """
    Busca productos por nombre, marca o código para el selector de descuentos.
    """
    query = request.args.get('q', '').strip()
    empresa_id = session['user_id']
    
    if len(query) < 2:
        return jsonify({"results": []})
    
    # Buscar productos que coincidan
    productos = Producto.query.filter(
        Producto.empresa_id == empresa_id,
        Producto.is_approved == True,
        or_(
            Producto.nombre.ilike(f"%{query}%"),
            Producto.marca.ilike(f"%{query}%"),
            Producto.codigo_barras_externo.ilike(f"%{query}%")
        )
    ).limit(10).all()
    
    # Convertir a diccionarios
    results = []
    for p in productos:
        results.append({
            'id': p.id,
            'nombre': p.nombre,
            'marca': p.marca or 'Sin marca',
            'codigo_barras_externo': p.codigo_barras_externo or 'N/A',
            'foto': p.foto or 'default_product.jpg',
            'tiene_descuento': getattr(p, 'tiene_descuento', False),
            'valor_descuento': getattr(p, 'valor_descuento', 0.0)
        })
    
    return jsonify({"results": results})
    
##############################
# REABASTECER
##############################
@app.route('/reabastecer', methods=['GET'])
@login_requerido
def reabastecer_listado():
    # Obtener productos aprobados de la empresa
    empresa_id = session['user_id']
    productos = Producto.query.filter_by(empresa_id=empresa_id, is_approved=True).all()
    return render_template('reabastecer_listado.html', productos=productos)

@app.route('/reabastecer-producto/<int:prod_id>', methods=['GET','POST'])
@login_requerido
def reabastecer_producto(prod_id):
    producto = Producto.query.get_or_404(prod_id)
    
    # Verificar que el producto pertenece a la empresa actual
    if producto.empresa_id != session.get('user_id'):
        return "No tienes permiso para reabastecer este producto."
    
    if request.method == 'POST':
        try:
            stock_to_add = int(request.form.get('stock_to_add', 0))
            producto.stock += stock_to_add
            db.session.commit()
            flash(f'Se han añadido {stock_to_add} unidades al stock de {producto.nombre}.', 'success')
            return redirect(url_for('reabastecer_listado'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error al reabastecer: {str(e)}', 'danger')
    
    return render_template('reabastecer_producto.html', producto=producto)

##############################
# AUTOCOMPLETE CON CatalogoGlobal
##############################
@app.route('/api/autocomplete', methods=['GET'])
@login_requerido
def api_autocomplete():
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({"results": []})

    # Consulta optimizada con límite y selección específica de campos
    referencias = (
        CatalogoGlobal.query
        .with_entities(
            CatalogoGlobal.id,
            CatalogoGlobal.codigo_barras,
            CatalogoGlobal.nombre,
            CatalogoGlobal.marca,
            CatalogoGlobal.url_imagen,
            CatalogoGlobal.categoria
        )
        .filter(CatalogoGlobal.codigo_barras.ilike(f"%{q}%"))
        .limit(10)
        .all()
    )

    results = []
    for ref in referencias:
        results.append({
            "id": ref.id,
            "codigo_barras": ref.codigo_barras,
            "nombre": ref.nombre,
            "marca": ref.marca if ref.marca else "",
            "url_imagen": ref.url_imagen or "",
            "categoria": ref.categoria or ""
        })
    
    return jsonify({"results": results})

##############################
# ENDPOINT: /api/buscar-imagen
##############################
@app.route('/api/buscar-imagen', methods=['POST'])
@login_requerido
def api_buscar_imagen():
    data = request.get_json() or {}
    nombre = data.get("nombre", "").strip()
    codigo = data.get("codigo", "").strip()
    force_search = data.get("forceSearch", False)  # Nuevo parámetro

    if not nombre:
        return jsonify({
            "status": "error",
            "message": "Debes proporcionar al menos el nombre del producto para generar la imagen."
        })

    print(f"DEBUG API: Buscando imagen para nombre='{nombre}', codigo='{codigo}', force_search={force_search}")
    
    # Si force_search es True, saltamos directamente a buscar con SerpAPI
    if force_search:
        imagen_filename = buscar_imagen_google_images(nombre, codigo)
        if imagen_filename:
            image_url = url_for('static', filename=f'uploads/{imagen_filename}', _external=False)
            return jsonify({
                "status": "success",
                "image_url": image_url,
                "filename": imagen_filename,
                "message": "Imagen encontrada correctamente (búsqueda forzada)"
            })
        else:
            return jsonify({
                "status": "error",
                "message": "No se pudo obtener la imagen. Verifica tu conexión o intenta con otro nombre/código."
            })
    
    # Proceso normal si no es forzado
    # 1. Primero buscar en productos similares (rápido)
    producto_similar = find_similar_product_image(nombre, db.session, Producto)
    
    if producto_similar and producto_similar.foto:
        image_url = url_for('static', filename=f'uploads/{producto_similar.foto}', _external=False)
        return jsonify({
            "status": "success",
            "image_url": image_url,
            "filename": producto_similar.foto,
            "message": "Imagen encontrada en base de datos"
        })
    
    # 2. Segundo, buscar en catálogo global
    catalogo_similar = find_similar_catalog_image(nombre, db.session, CatalogoGlobal)
    
    if catalogo_similar and catalogo_similar.url_imagen:
        # Intentar obtener solo el nombre de archivo
        if "/uploads/" in catalogo_similar.url_imagen:
            filename = catalogo_similar.url_imagen.split("/uploads/")[-1]
        else:
            # Generar nombre aleatorio
            filename = f"{uuid.uuid4().hex}.jpg"
            
        # Descargar en segundo plano si es URL externa
        if catalogo_similar.url_imagen.startswith(("http://", "https://")):
            async_download_image(
                catalogo_similar.url_imagen, 
                os.path.join(UPLOAD_FOLDER, filename)
            )
            
        return jsonify({
            "status": "success",
            "image_url": catalogo_similar.url_imagen,
            "filename": filename,
            "message": "Imagen encontrada en catálogo global"
        })
    
    # 3. AQUÍ usamos SerpAPI - solo cuando el usuario hizo clic en "Generar con IA"
    # Esto es lo que consume recursos de SerpAPI, pero solo sucede cuando se solicita explícitamente
    imagen_filename = buscar_imagen_google_images(nombre, codigo)
    if imagen_filename:
        image_url = url_for('static', filename=f'uploads/{imagen_filename}', _external=False)
        return jsonify({
            "status": "success",
            "image_url": image_url,
            "filename": imagen_filename,
            "message": "Imagen encontrada correctamente"
        })
    
    # Si no se encontró imagen
    return jsonify({
        "status": "error",
        "message": "No se pudo obtener la imagen. Verifica tu conexión o intenta con otro nombre/código."
    })

##############################
# ENDPOINT: /api/check_barcode_exists
##############################
@app.route('/api/check_barcode_exists', methods=['GET'])
@login_requerido
def check_barcode_exists():
    codigo = request.args.get('codigo', '').strip()
    if not codigo:
        return jsonify({"exists": False})
    
    producto_existente = Producto.query.filter_by(
        empresa_id=session['user_id'],
        codigo_barras_externo=codigo
    ).first()
    
    return jsonify({"exists": producto_existente is not None})

##############################################
# FUNCIÓN DE SINCRONIZACIÓN
##############################################
def sync_gsheet_to_catalogo():
    data = leer_hoja("Hoja 1!A2:F")
    if not data:
        print("No hay filas en la hoja de Google.")
        return

    codigos_sheet = set()
    for row in data:
        if len(row) < 6:
            continue
        codigo = row[0].strip()
        nombre = row[1].strip()
        marca = row[2].strip()
        categoria = row[3].strip()
        unidad = row[4].strip()
        url_img = row[5].strip()

        # Truncar URL si es demasiado larga para evitar errores
        url_img = truncar_url(url_img, 295)  # Usar 295 para la columna de 300 caracteres

        codigos_sheet.add(codigo)

        ref = CatalogoGlobal.query.filter_by(codigo_barras=codigo).first()
        if ref:
            ref.nombre = nombre
            ref.marca = marca
            ref.categoria = categoria
            ref.url_imagen = url_img
            print(f"Actualizando {codigo} -> {nombre}")
        else:
            nuevo = CatalogoGlobal(
                codigo_barras=codigo,
                nombre=nombre,
                marca=marca,
                categoria=categoria,
                url_imagen=url_img
            )
            db.session.add(nuevo)
            print(f"Creando {codigo} -> {nombre}")

    db.session.commit()

    # Elimina lo que ya no existe en la Hoja
    todos = CatalogoGlobal.query.all()
    for ref in todos:
        if ref.codigo_barras not in codigos_sheet:
            db.session.delete(ref)
            print(f"Borrando {ref.codigo_barras}, ya no está en la hoja.")
    db.session.commit()

##############################################
# MAIN
##############################################
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)

##############################
# ENDPOINT: /api/autocomplete_by_name
##############################
@app.route('/api/autocomplete_by_name', methods=['GET'])
@login_requerido
def api_autocomplete_by_name():
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({"results": []})

    # Consulta optimizada con límite y selección específica de campos
    referencias = (
        CatalogoGlobal.query
        .with_entities(
            CatalogoGlobal.id,
            CatalogoGlobal.codigo_barras,
            CatalogoGlobal.nombre,
            CatalogoGlobal.marca,
            CatalogoGlobal.url_imagen,
            CatalogoGlobal.categoria
        )
        .filter(CatalogoGlobal.nombre.ilike(f"%{q}%"))
        .limit(10)
        .all()
    )

    results = []
    for ref in referencias:
        results.append({
            "id": ref.id,
            "codigo_barras": ref.codigo_barras,
            "nombre": ref.nombre,
            "marca": ref.marca if ref.marca else "",
            "url_imagen": ref.url_imagen or "",
            "categoria": ref.categoria or ""
        })
    return jsonify({"results": results})

##############################
# ENDPOINT /api/find-by-code
##############################
@app.route('/api/find_by_code', methods=['GET'])
@login_requerido
def api_find_by_code():
    code = request.args.get("codigo", "").strip()
    if not code:
        return jsonify({"found": False})

    # Optimizado: usar 'get' para búsqueda exacta por clave
    ref = CatalogoGlobal.query.filter_by(codigo_barras=code).first()
    
    # Búsqueda parcial si no encontramos coincidencia exacta y el código es suficientemente largo
    if not ref and len(code) > 7:
        ref = CatalogoGlobal.query.filter(
            CatalogoGlobal.codigo_barras.startswith(code[:7])
        ).first()
    
    if not ref:
        return jsonify({"found": False})

    return jsonify({
        "found": True,
        "codigo_barras": ref.codigo_barras,
        "nombre": ref.nombre,
        "marca": ref.marca if ref.marca else "",
        "url_imagen": ref.url_imagen or "",
        "categoria": ref.categoria or ""
    })