# config.py
import os
from flask import request, url_for, session
from flask_compress import Compress
from flask_caching import Cache

# ==============================
# CONFIGURACIÓN BASE
# ==============================
BASE_DIR = os.path.dirname(os.path.realpath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar'}

# APIs Keys
SERPAPI_API_KEY = "84d269bfa51876a1a092ace371d89f7dc2500d8c5a61b420c08d96e5351f5c79"
OPENAI_API_KEY = "sk-proj-KXZSGDJ6bGMjVUZXzGp1r3ZYfvUvpkVFbUVqPyWeJc1sxsEjeyodfaLEZOuq5Nc6RYV1f1JvyT3BlbkFJQo22FAJuvP6bF7Z4BQ3nsuEA"

# ==============================
# CATEGORÍAS VÁLIDAS
# ==============================
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

# ==============================
# MAPA DE NAVEGACIÓN
# ==============================
MAPA_NAVEGACION = {
    # Grupo 1: Vuelven a dashboard/inventario
    'nuevo_producto': 'dashboard_inventario',
    'productos.nuevo_producto': 'dashboard_inventario',
    'ajuste_stock': 'dashboard_inventario',
    'ajuste_stock.index': 'dashboard_inventario',
    'ajuste_stock.ajuste_stock': 'dashboard_inventario',
    'cambiar_precios': 'dashboard_inventario',
    'precios.cambiar_precios': 'dashboard_inventario',
    'descuentos': 'dashboard_inventario',
    'descuentos.descuentos': 'dashboard_inventario',
    'ubicacion_productos': 'dashboard_inventario',
    'ubicaciones.ubicacion_productos': 'dashboard_inventario',
    'ver_productos': 'dashboard_inventario',
    'productos.ver_productos': 'dashboard_inventario',
    
    # Grupo 2: Vuelven a nuevo-producto
    'agregar_producto': 'nuevo_producto',
    'productos.agregar_producto': 'nuevo_producto',
    'agregar_sin_codigo': 'nuevo_producto',
    'productos.agregar_sin_codigo': 'nuevo_producto',
    'agregar_a_granel': 'nuevo_producto',
    'productos.agregar_a_granel': 'nuevo_producto',
    
    # Grupo 3: Vuelven a ajuste-inventario
    'historial_movimientos': 'ajuste_stock',
    'inventario.historial_movimientos': 'ajuste_stock',
    'ajuste_stock.ajuste_entrada': 'ajuste_stock',
    'ajuste_stock.ajuste_salida': 'ajuste_stock',
    'ajuste_stock.ajuste_confirmacion': 'ajuste_stock',
    
    # Grupo 4: Vuelven a productos (CON LOS PREFIJOS CORRECTOS)
    'new_ajuste_stock.new_ajuste_entrada': 'ver_productos',
    'new_ajuste_stock.new_ajuste_salida': 'ver_productos',
    'new_ajuste_stock.new_ajuste_confirmacion': 'ver_productos',
    'cambiar_costos': 'ver_productos',
    'precios.cambiar_costos': 'ver_productos',
    'cambiar_costos_general': 'ver_productos',
    'precios.cambiar_costos_general': 'ver_productos',
    'editar_producto': 'ver_productos',
    'productos.editar_producto': 'ver_productos',
    'etiquetas_producto': 'ver_productos',
    'productos.etiquetas_producto': 'ver_productos',
    
    # Grupo 5: Otros
    'inventario.reabastecer_producto': 'reabastecer_listado',
    'reabastecer_producto': 'reabastecer_listado',
    'productos.completar_datos': 'pendientes_aprobacion',
    'completar_datos': 'pendientes_aprobacion',
    'precios.costo_confirmacion': 'ver_productos',
    'costo_confirmacion': 'ver_productos',
    'ubicaciones.ubicacion_detalle': 'ubicacion_productos',
    'ubicacion_detalle': 'ubicacion_productos',
    'descuentos.descuentos_detalle': 'descuentos',
    'descuentos_detalle': 'descuentos',
}

# ==============================
# FUNCIONES DE CONFIGURACIÓN
# ==============================
def configure_app(app):
    """Configura la aplicación Flask con todas las configuraciones necesarias"""
    app.config['SECRET_KEY'] = "super_secreto"
    app.config['SQLALCHEMY_DATABASE_URI'] = (
        "postgresql://benjaminbecerriles:HammeredEnd872@localhost:5432/inventario_db"
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    
    # Configuración de cache
    app.config['CACHE_TYPE'] = 'simple'
    app.config['CACHE_DEFAULT_TIMEOUT'] = 300
    
    # Configurar context processors
    app.context_processor(inject_navigation)
    
    # Configurar filtros de Jinja2
    app.add_template_filter(category_color_filter, 'category_color')
    
    # Configurar headers de seguridad
    app.after_request(add_security_headers)
    
    # Verificar disponibilidad de SerpAPI (opcional)
    try:
        import requests
        requests.get('https://serpapi.com', timeout=2)
        app.config['SERPAPI_AVAILABLE'] = True
    except Exception as e:
        app.config['SERPAPI_AVAILABLE'] = False
        print(f"AVISO: SerpAPI no disponible, usando imágenes predeterminadas: {e}")

def init_extensions(app):
    """Inicializa las extensiones de Flask"""
    # Configurar compresión GZIP
    Compress(app)
    
    # Configurar cache
    Cache(app)

# ==============================
# CONTEXT PROCESSORS
# ==============================
def inject_navigation():
    """Inyecta la información de navegación predefinida en todos los templates"""
    current_endpoint = request.endpoint
    
    # DEBUG - Imprimir el endpoint actual
    print(f"DEBUG - Endpoint actual: {current_endpoint}")
    
    # Buscar si el endpoint actual tiene una ruta de retorno definida
    back_route = None
    show_button = False
    
    # Primero intentar con el endpoint completo (con blueprint)
    if current_endpoint in MAPA_NAVEGACION:
        endpoint_destino = MAPA_NAVEGACION[current_endpoint]
    else:
        # Si no está, intentar sin el prefijo del blueprint
        endpoint_sin_prefijo = current_endpoint.split('.')[-1] if '.' in current_endpoint else current_endpoint
        endpoint_destino = MAPA_NAVEGACION.get(endpoint_sin_prefijo)
    
    if endpoint_destino:
        try:
            # Intentar primero sin prefijo (gracias a los alias)
            back_route = url_for(endpoint_destino)
            show_button = True
            print(f"DEBUG - Ruta de retorno encontrada: {back_route}")
        except:
            # Si falla, intentar con prefijos de blueprint
            endpoint_mapping = {
                'dashboard_inventario': 'dashboard.dashboard_inventario',
                'nuevo_producto': 'productos.nuevo_producto',
                'ajuste_stock': 'ajuste_stock.index',
                'ver_productos': 'productos.ver_productos',
                'historial_movimientos': 'inventario.historial_movimientos'
            }
            
            endpoint_final = endpoint_mapping.get(endpoint_destino, endpoint_destino)
            
            try:
                back_route = url_for(endpoint_final)
                show_button = True
                print(f"DEBUG - Ruta de retorno encontrada (con blueprint): {back_route}")
            except:
                print(f"DEBUG - No se pudo generar URL para: {endpoint_final}")
    else:
        print(f"DEBUG - No se encontró ruta de retorno para: {current_endpoint}")
    
    # No mostrar en login, registro o index
    if current_endpoint in ['login', 'registro', 'index', 'auth.login', 'auth.registro', 'dashboard.index']:
        show_button = False
    
    return {
        'previous_page': back_route,
        'show_back_button': show_button
    }

# ==============================
# FILTROS DE JINJA2
# ==============================
def category_color_filter(category):
    """Filtro Jinja2 para obtener el color de categoría"""
    from category_colors import get_category_color
    return get_category_color(category)

# ==============================
# HEADERS DE SEGURIDAD
# ==============================
def add_security_headers(response):
    """Añade headers de seguridad y caché a las respuestas"""
    # Headers anti-cache para contenido dinámico
    if response.mimetype == 'text/html':
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private, max-age=0"
        response.headers["Expires"] = "0"
        response.headers["Pragma"] = "no-cache"
    
    # Headers de seguridad
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # Cache agresivo para assets estáticos
    if response.mimetype in ['text/css', 'application/javascript', 'image/png', 'image/jpeg', 'image/webp']:
        response.headers['Cache-Control'] = 'public, max-age=31536000'
    
    return response