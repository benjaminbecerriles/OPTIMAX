import os
import random
import string
import unicodedata
import uuid  # <--- NUEVO para generar nombres únicos
import time
import threading
import sys
import shutil  # Para operaciones de archivos

from flask import Flask, request, render_template, session, redirect, url_for, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from functools import wraps

# 1) IMPORTA Flask-Migrate
from flask_migrate import Migrate

from models import db
# IMPORTAMOS TAMBIÉN CatalogoGlobal, sin tocar el resto
from models.models import Empresa, CodigoDisponible, CodigoAsignado, Producto, CatalogoGlobal

# (NUEVO) IMPORTA la función para leer Google Sheets
from sheets import leer_hoja  # Asegúrate de tener 'sheets.py' con leer_hoja()

# Integración OPENAI (si la usas para otros fines)
import openai
openai.api_key = "sk-proj-KXZSGDJ6bGMjVUZXzGp1r3ZYfvUvpkVFbUVqPyWeJc1sxsEjeyodfaLEZOuq5Nc6RYV1f1JvyT3BlbkFJQo22FAJuvP6bF7Z4BQ3nsuEA"

# Integración SERPAPI
import requests
SERPAPI_API_KEY = "84d269bfa51876a1a092ace371d89f7dc2500d8c5a61b420c08d96e5351f5c79"

from sqlalchemy import or_
from datetime import datetime

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
    "otros (miscelánea)"
}

# Configuración de subida de archivos
BASE_DIR = os.path.dirname(os.path.realpath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

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
def normalizar_categoria(cat: str) -> str:
    """Elimina acentos, pone en minúscula y quita espacios extras."""
    cat = cat.strip().lower()
    import unicodedata
    cat = unicodedata.normalize("NFKD", cat)
    cat = cat.encode("ascii", "ignore").decode("ascii")
    return cat

def generar_color_aleatorio() -> str:
    r = lambda: random.randint(0, 255)
    return f"#{r():02X}{r():02X}{r():02X}"

def obtener_o_generar_color_categoria(cat_norm):
    if not cat_norm:
        return None
    existente = Producto.query.filter_by(categoria=cat_norm).first()
    if existente and existente.categoria_color:
        return existente.categoria_color
    return generar_color_aleatorio()

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

    try:
        response = requests.get("https://serpapi.com/search", params=params)
        data = response.json()
        images = data.get("images_results", [])
        if images:
            first_image = images[0]
            image_url = first_image.get("thumbnail") or first_image.get("original")
            if image_url:
                # Usar la función mejorada para descargar
                ext = image_url.rsplit('.', 1)[-1].split('?')[0]
                if ext not in ALLOWED_EXTENSIONS:
                    ext = "jpg"
                filename = secure_filename(f"{random.randint(100000,999999)}.{ext}")
                if not os.path.exists(UPLOAD_FOLDER):
                    os.makedirs(UPLOAD_FOLDER)
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                
                if download_image_with_headers(image_url, filepath):
                    print("Imagen descargada y guardada como:", filename)
                    return filename
    except Exception as e:
        print("Error al buscar imagen con google_images:", e)

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

##############################
# Desactivar caché globalmente
##############################
@app.after_request
def no_cache(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private, max-age=0"
    response.headers["Expires"] = 0
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

        if emp.is_admin:
            return f"Bienvenido Admin, {emp.nombre}!"

        cod_asig = CodigoAsignado.query.filter_by(empresa_id=emp.id, esta_activo=True).first()
        if not cod_asig:
            return redirect(url_for('ingresar_codigo'))

        return f"Bienvenido, {emp.nombre}!"
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

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
                Producto.codigo_barras.ilike(f"%{termino_busqueda}%")
            )
        )
    productos = query.all()
    total_productos = Producto.query.filter_by(empresa_id=empresa_id).count()

    return render_template(
        'productos.html',
        productos=productos,
        filtro_aprobacion=filtro_aprobacion,
        termino_busqueda=termino_busqueda,
        total_productos=total_productos
    )

@app.route('/agregar-producto', methods=['GET','POST'])
@login_requerido
def agregar_producto():
    if request.method == 'POST':
        # =======================================
        # 1) Recoger campos del formulario
        # =======================================
        codigo_barras_externo = request.form.get("codigo_barras_externo", "").strip()
        nombre = request.form.get("nombre", "").strip()
        stock_str = request.form.get("stock", "0").strip()
        costo_str = request.form.get("costo", "$0").strip()
        precio_str = request.form.get("precio_venta", "$0").strip()
        marca = request.form.get("marca", "").strip()

        print("\n=== DEBUG COMIENZA ===")
        print("DEBUG: codigo_barras_externo =>", codigo_barras_externo)
        print("DEBUG: nombre =>", nombre)
        print("DEBUG: stock_str =>", stock_str)
        print("DEBUG: costo_str =>", costo_str)
        print("DEBUG: precio_str =>", precio_str)
        print("DEBUG: marca =>", marca)

        # Obtener ia_foto_filename para debugging
        ia_foto_filename = request.form.get("ia_foto_filename", "").strip()
        print("DEBUG: ia_foto_filename =>", ia_foto_filename)

        # Obtener displayed_image_url
        displayed_url = request.form.get("displayed_image_url", "").strip()
        print("DEBUG: displayed_image_url =>", displayed_url)

        # Categoría
        cat_option = request.form.get('categoria_option', 'existente')
        if cat_option == 'existente':
            categoria = request.form.get('categoria_existente', '').strip()
        else:
            categoria = request.form.get('categoria_nueva', '').strip()
        categoria_normalizada = normalizar_categoria(categoria)
        print("DEBUG: categoria_normalizada =>", categoria_normalizada)

        # Favorito
        es_favorito_val = request.form.get("es_favorito", "0")
        es_favorito_bool = (es_favorito_val == "1")
        print("DEBUG: es_favorito_val =>", es_favorito_val, "| bool =>", es_favorito_bool)

        # A la venta
        esta_a_la_venta_val = request.form.get("esta_a_la_venta", "1")
        esta_a_la_venta_bool = (esta_a_la_venta_val == "1")
        print("DEBUG: esta_a_la_venta_val =>", esta_a_la_venta_val, "| bool =>", esta_a_la_venta_bool)

        # Caducidad
        toggle_caducidad = request.form.get("toggle_caducidad_estado", "DESACTIVADO")
        has_caducidad = (toggle_caducidad == "ACTIVADO")
        print("DEBUG: toggle_caducidad =>", toggle_caducidad, "| has_caducidad =>", has_caducidad)

        caducidad_lapso = None
        if has_caducidad:
            caducidad_lapso = request.form.get("caducidad_lapso", None)
        print("DEBUG: caducidad_lapso =>", caducidad_lapso)

        # Parse numéricos
        try:
            stock_int = int(stock_str)
        except:
            stock_int = 0
        print("DEBUG: stock_int =>", stock_int)

        def parse_money(value_str):
            if value_str.startswith("$"):
                value_str = value_str[1:]
            value_str = value_str.replace(",", "")
            try:
                return float(value_str)
            except:
                return 0.0

        costo_val = parse_money(costo_str)
        precio_val = parse_money(precio_str)
        print("DEBUG: costo_val =>", costo_val)
        print("DEBUG: precio_val =>", precio_val)

        # =======================================
        # 3) Procesar foto - VERSIÓN MEJORADA
        # =======================================
        foto_final = None
        
        # A. Primero verificamos si hay un archivo subido directamente
        file = request.files.get('foto')
        print("DEBUG: file =>", file)
        if file and file.filename:
            print("DEBUG: file.filename =>", file.filename)
            if allowed_file(file.filename):
                print("DEBUG: allowed_file => True")
                original_name = secure_filename(file.filename)
                print("DEBUG: secure_filename =>", original_name)

                ext = original_name.rsplit('.', 1)[1].lower()
                unique_name = f"{uuid.uuid4().hex}.{ext}"
                print("DEBUG: unique_name =>", unique_name)

                if not os.path.exists(app.config['UPLOAD_FOLDER']):
                    os.makedirs(app.config['UPLOAD_FOLDER'])
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
                file.save(filepath)
                foto_final = unique_name
                print("DEBUG: Se guardó foto_local =>", foto_final)
            else:
                print("DEBUG: allowed_file => False (formato no permitido)")
        else:
            print("DEBUG: No se subió archivo en 'foto'")
            
        # B. Si no hay archivo subido, verificamos si ia_foto_filename existe físicamente
        if not foto_final and ia_foto_filename:
            ia_filepath = os.path.join(app.config['UPLOAD_FOLDER'], ia_foto_filename)
            if os.path.exists(ia_filepath):
                foto_final = ia_foto_filename
                print(f"DEBUG: Usando ia_foto_filename existente => {ia_foto_filename}")
            else:
                print(f"DEBUG: El archivo IA referenciado no existe: {ia_filepath}")
                # No limpiamos ia_foto_filename aquí
        
        # C. Si no tenemos foto aún, intentamos con displayed_image_url
        if not foto_final and displayed_url:
            # Caso 1: Es una URL local completa (/static/uploads/...)
            if displayed_url.startswith("/static/uploads/"):
                img_filename = displayed_url.split("/uploads/")[1]
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], img_filename)
                if os.path.exists(filepath):
                    foto_final = img_filename
                    print(f"DEBUG: Usando imagen de ruta local completa => {img_filename}")
                else:
                    print(f"DEBUG: La imagen en ruta local no existe => {filepath}")
            
            # Caso 2: Es solo un nombre de archivo
            elif "/" not in displayed_url:
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], displayed_url)
                if os.path.exists(filepath):
                    foto_final = displayed_url
                    print(f"DEBUG: Usando displayed_image_url como nombre de archivo => {displayed_url}")
                else:
                    print(f"DEBUG: El archivo no existe en uploads => {filepath}")
            
            # Caso 3: Es una URL externa (http/https)
            elif displayed_url.startswith(("http://", "https://")):
                try:
                    print(f"DEBUG: Descargando imagen de URL externa => {displayed_url}")
                    
                    # Extraer extensión de la URL o usar jpg por defecto
                    ext = displayed_url.rsplit('.', 1)[-1].split('?')[0].lower()
                    if ext not in ALLOWED_EXTENSIONS:
                        ext = "jpg"
                    
                    # Genera nombre único
                    unique_name = f"{uuid.uuid4().hex}.{ext}"
                    filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
                    
                    # Intenta descargar con cabeceras personalizadas
                    if download_image_with_headers(displayed_url, filepath):
                        foto_final = unique_name
                        print(f"DEBUG: Imagen descargada y guardada => {foto_final}")
                    else:
                        print(f"DEBUG: No se pudo descargar la imagen con cabeceras personalizadas")
                except Exception as e:
                    print(f"DEBUG: Error al procesar URL externa: {e}")
        
        # D. Como último recurso, buscar con SerpAPI - SIEMPRE intentamos esto si aún no tenemos foto
        if not foto_final and nombre:
            print(f"DEBUG: Intentando buscar imagen con SerpAPI para: {nombre} {codigo_barras_externo}")
            search_filename = buscar_imagen_google_images(nombre, codigo_barras_externo)
            if search_filename:
                foto_final = search_filename
                print(f"DEBUG: Imagen generada por SerpAPI => {search_filename}")
            else:
                print(f"DEBUG: No se pudo generar imagen con SerpAPI")
                
                # E. Usar imagen predeterminada según categoría
                categoria_norm = categoria_normalizada.lower() if categoria_normalizada else "otros"
                if "botanas" in categoria_norm or "dulces" in categoria_norm or "snacks" in categoria_norm:
                    default_img = "default_snack.jpg"
                elif "bebidas" in categoria_norm:
                    default_img = "default_drink.jpg"
                elif "frutas" in categoria_norm or "verduras" in categoria_norm:
                    default_img = "default_fruit.jpg"
                else:
                    default_img = "default_product.jpg"
                    
                # Verificar que existe o copiar desde static/img a uploads
                default_path = os.path.join(BASE_DIR, 'static', 'img', default_img)
                if os.path.exists(default_path):
                    dest_path = os.path.join(UPLOAD_FOLDER, default_img)
                    if not os.path.exists(dest_path):
                        shutil.copy2(default_path, dest_path)
                    foto_final = default_img
                    print(f"DEBUG: Usando imagen predeterminada: {default_img}")
        
        print("DEBUG: foto_final final =>", foto_final)
        
        # =======================================
        # 4) Crear el producto
        # =======================================
        nuevo = Producto(
            nombre=nombre,
            stock=stock_int,
            costo=costo_val,
            precio_venta=precio_val,
            categoria=categoria_normalizada,
            foto=foto_final,  # Ahora tenemos la foto correcta
            url_imagen=displayed_url,  # Guardamos también la URL
            is_approved=True,
            empresa_id=session['user_id'],
            codigo_barras_externo=codigo_barras_externo,
            marca=marca,
            es_favorito=es_favorito_bool,
            esta_a_la_venta=esta_a_la_venta_bool,
            has_caducidad=has_caducidad,
            metodo_caducidad=caducidad_lapso if has_caducidad else None
        )
        print("DEBUG: Creando producto =>", nuevo)

        db.session.add(nuevo)
        db.session.commit()

        print("DEBUG: Producto creado con ID =>", nuevo.id)
        print("DEBUG: FIN COMIENZA ===\n")
        return redirect(url_for('ver_productos'))

    else:
        categorias_db = (
            db.session.query(Producto.categoria, Producto.categoria_color)
            .filter(Producto.categoria.isnot(None))
            .filter(Producto.categoria != '')
            .filter(Producto.url_imagen != '')
            .distinct()
            .all()
        )
        categories_list = [
            {"nombre": c[0], "color": c[1] if c[1] else "#000000"}
            for c in categorias_db
        ]
        return render_template('agregar_producto.html', categories=categories_list)

@app.route('/editar-producto/<int:prod_id>', methods=['GET','POST'])
@login_requerido
def editar_producto(prod_id):
    # (Mantén inalterado o implementa si gustas)
    pass

@app.route('/eliminar-producto/<int:prod_id>')
@login_requerido
def eliminar_producto(prod_id):
    # (Mantén inalterado o implementa si gustas)
    pass

##############################
# ESCÁNER / CAPTURA RÁPIDA
##############################
@app.route('/inventario-escaner', methods=['GET','POST'])
@login_requerido
def inventario_escaner():
    pass

@app.route('/pendientes_aprobacion')
@login_requerido
def pendientes_aprobacion():
    pass

@app.route('/completar-datos/<int:prod_id>', methods=['GET','POST'])
@login_requerido
def completar_datos(prod_id):
    pass

@app.route('/nuevo-producto')
@login_requerido
def nuevo_producto():
    return render_template('nuevo_producto.html')

##############################
# REABASTECER
##############################
@app.route('/reabastecer', methods=['GET'])
@login_requerido
def reabastecer_listado():
    pass

@app.route('/reabastecer-producto/<int:prod_id>', methods=['GET','POST'])
@login_requerido
def reabastecer_producto(prod_id):
    pass

##############################
# AUTOCOMPLETE CON CatalogoGlobal
##############################
@app.route('/api/autocomplete', methods=['GET'])
@login_requerido
def api_autocomplete():
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({"results": []})

    referencias = (
        CatalogoGlobal.query
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
# ENDPOINT /api/find-by-code
##############################
@app.route('/api/find_by_code', methods=['GET'])
@login_requerido
def api_find_by_code():
    code = request.args.get("codigo", "").strip()
    if not code:
        return jsonify({"found": False})

    ref = CatalogoGlobal.query.filter_by(codigo_barras=code).first()
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

##############################
# NUEVO ENDPOINT: /api/buscar-imagen
##############################
@app.route('/api/buscar-imagen', methods=['POST'])
@login_requerido
def api_buscar_imagen():
    data = request.get_json() or {}
    nombre = data.get("nombre", "").strip()
    codigo = data.get("codigo", "").strip()

    if not nombre or not codigo:
        return jsonify({
            "status": "error",
            "message": "Debes proporcionar 'nombre' y 'codigo' para generar la imagen."
        })

    imagen_filename = buscar_imagen_google_images(nombre, codigo)
    if not imagen_filename:
        return jsonify({
            "status": "error",
            "message": "No se pudo obtener la imagen de SerpAPI."
        })

    image_url = url_for('static', filename=f'uploads/{imagen_filename}', _external=False)
    return jsonify({
        "status": "success",
        "image_url": image_url,
        "filename": imagen_filename
    })

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