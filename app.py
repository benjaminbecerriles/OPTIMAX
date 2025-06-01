# app.py
import pprint
from flask import Flask

# Crear la aplicación Flask PRIMERO
app = Flask(__name__)

# Configurar la aplicación
from config import configure_app, init_extensions
configure_app(app)

# Inicializar la base de datos con la app
from database import db, migrate
db.init_app(app)
migrate.init_app(app, db)

# Inicializar otras extensiones (compress, cache)
init_extensions(app)

# AHORA importar todos los blueprints (después de que db esté inicializado)
from auth import auth_bp
from productos import productos_bp
from inventario import inventario_bp
from dashboard import dashboard_bp
from precios import precios_bp
from descuentos import descuentos_bp
from ubicaciones import ubicaciones_bp
from admin import admin_bp
from api_productos import api_productos_bp
from api_inventario import api_inventario_bp
from api_descuentos import api_descuentos_bp

# Registrar todos los blueprints SIN prefijos para mantener las URLs originales
app.register_blueprint(auth_bp)
app.register_blueprint(productos_bp)
app.register_blueprint(inventario_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(precios_bp)
app.register_blueprint(descuentos_bp)
app.register_blueprint(ubicaciones_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(api_productos_bp)
app.register_blueprint(api_inventario_bp)
app.register_blueprint(api_descuentos_bp)

# Importar el módulo de ajuste_stock existente
from ajuste_stock import init_app as init_ajuste_stock
init_ajuste_stock(app)

# ==============================
# CREAR ALIAS PARA MANTENER COMPATIBILIDAD CON TEMPLATES
# ==============================
# Esto permite que los templates sigan usando los nombres originales sin prefijos
def create_endpoint_alias(blueprint_endpoint, alias):
    """Crea un alias para un endpoint de blueprint"""
    endpoint_func = app.view_functions.get(blueprint_endpoint)
    if endpoint_func:
        app.view_functions[alias] = endpoint_func
        # Copiar la regla de URL
        for rule in app.url_map.iter_rules():
            if rule.endpoint == blueprint_endpoint:
                app.add_url_rule(
                    rule.rule,
                    endpoint=alias,
                    view_func=endpoint_func,
                    methods=rule.methods
                )
                break

# Crear todos los alias necesarios
with app.app_context():
    # Dashboard
    create_endpoint_alias('dashboard.index', 'index')
    create_endpoint_alias('dashboard.dashboard_home', 'dashboard_home')
    create_endpoint_alias('dashboard.dashboard_inventario', 'dashboard_inventario')
    
    # Auth
    create_endpoint_alias('auth.login', 'login')
    create_endpoint_alias('auth.logout', 'logout')
    create_endpoint_alias('auth.registro', 'registro')
    create_endpoint_alias('auth.ingresar_codigo', 'ingresar_codigo')
    
    # Productos
    create_endpoint_alias('productos.ver_productos', 'ver_productos')
    create_endpoint_alias('productos.nuevo_producto', 'nuevo_producto')
    create_endpoint_alias('productos.agregar_producto', 'agregar_producto')
    create_endpoint_alias('productos.agregar_sin_codigo', 'agregar_sin_codigo')
    create_endpoint_alias('productos.agregar_a_granel', 'agregar_a_granel')
    create_endpoint_alias('productos.editar_producto', 'editar_producto')
    create_endpoint_alias('productos.eliminar_producto', 'eliminar_producto')
    create_endpoint_alias('productos.producto_confirmacion', 'producto_confirmacion')
    create_endpoint_alias('productos.pendientes_aprobacion', 'pendientes_aprobacion')
    create_endpoint_alias('productos.completar_datos', 'completar_datos')
    create_endpoint_alias('productos.etiquetas_producto', 'etiquetas_producto')
    create_endpoint_alias('productos.exportar_productos_excel', 'exportar_productos_excel')
    create_endpoint_alias('productos.actualizar_lotes_caducidad', 'actualizar_lotes_caducidad')
    
    # Inventario
    create_endpoint_alias('inventario.historial_movimientos', 'historial_movimientos')
    create_endpoint_alias('inventario.reabastecer_listado', 'reabastecer_listado')
    create_endpoint_alias('inventario.reabastecer_producto', 'reabastecer_producto')
    create_endpoint_alias('inventario.inventario_escaner', 'inventario_escaner')
    
    # Precios
    create_endpoint_alias('precios.cambiar_precios', 'cambiar_precios')
    create_endpoint_alias('precios.cambiar_costos_general', 'cambiar_costos_general')
    create_endpoint_alias('precios.cambiar_costos', 'cambiar_costos')
    create_endpoint_alias('precios.costo_confirmacion', 'costo_confirmacion')
    
    # Descuentos
    create_endpoint_alias('descuentos.descuentos', 'descuentos')
    create_endpoint_alias('descuentos.descuentos_detalle', 'descuentos_detalle')
    create_endpoint_alias('descuentos.corregir_descuentos_vista', 'corregir_descuentos_vista')
    
    # Ubicaciones
    create_endpoint_alias('ubicaciones.ubicacion_productos', 'ubicacion_productos')
    create_endpoint_alias('ubicaciones.ubicacion_detalle', 'ubicacion_detalle')
    
    # Admin
    create_endpoint_alias('admin.admin_panel', 'admin_panel')
    create_endpoint_alias('admin.admin_empresas', 'admin_empresas')
    create_endpoint_alias('admin.admin_disponibles', 'admin_disponibles')
    create_endpoint_alias('admin.admin_asignados', 'admin_asignados')
    create_endpoint_alias('admin.generar_disponible', 'generar_disponible')
    create_endpoint_alias('admin.eliminar_disponible', 'eliminar_disponible')
    create_endpoint_alias('admin.toggle_asignado', 'toggle_asignado')

# ==============================
# RUTA DE DEBUG
# ==============================
@app.route('/debug-endpoint')
def debug_endpoint():
    """Muestra todos los endpoints registrados"""
    endpoints = []
    for rule in app.url_map.iter_rules():
        endpoints.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'rule': str(rule)
        })
    
    # Filtrar solo los relacionados con ajuste
    ajuste_endpoints = [e for e in endpoints if 'ajuste' in e['endpoint'].lower() or 'new' in e['endpoint'].lower()]
    
    return f"""
    <h2>Endpoints relacionados con ajuste:</h2>
    <pre>{pprint.pformat(ajuste_endpoints, indent=2)}</pre>
    
    <h2>Todos los endpoints:</h2>
    <pre>{pprint.pformat(endpoints, indent=2)}</pre>
    """

# ==============================
# MAIN
# ==============================
if __name__ == '__main__':
    with app.app_context():
        # Inicializar la base de datos y verificaciones
        from database import init_database
        init_database(app)
    
    app.run(debug=True)