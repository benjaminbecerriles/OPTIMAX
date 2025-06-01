# ubicaciones.py
from flask import Blueprint, request, render_template, session, redirect, url_for, flash

from database import db
from models.models import Producto
from auth import login_requerido

# Crear el blueprint
ubicaciones_bp = Blueprint('ubicaciones', __name__)

# ==============================
# RUTAS DE UBICACIONES
# ==============================
@ubicaciones_bp.route('/ubicacion-productos', methods=['GET'])
@login_requerido
def ubicacion_productos():
    """
    Vista para gestionar la ubicación física de los productos.
    Permite asignar y ver dónde se encuentran los productos físicamente.
    """
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('auth.login'))
    
    # Obtener información del usuario
    empresa_id = session.get('user_id')
    
    # Parámetros de filtrado
    categoria_filtro = request.args.get('categoria')
    marca_filtro = request.args.get('marca')
    global_view = request.args.get('global') == '1'
    
    # Consulta base
    productos_query = Producto.query.filter_by(
        empresa_id=empresa_id,
        is_approved=True
    )
    
    # Aplicar filtros si existen
    if categoria_filtro:
        productos_query = productos_query.filter_by(categoria=categoria_filtro)
    elif marca_filtro:
        productos_query = productos_query.filter_by(marca=marca_filtro)
    
    # Para vista de detalle no usamos paginación
    if categoria_filtro or marca_filtro or global_view:
        productos = productos_query.all()
        page = 1
        total_pages = 1
    else:
        # Parámetros de paginación para vista general
        page = request.args.get('page', 1, type=int)
        per_page = 100  # Ampliado para mostrar más productos
        productos_paginados = productos_query.paginate(page=page, per_page=per_page, error_out=False)
        productos = productos_paginados.items
        total_pages = productos_paginados.pages
    
    # Obtener categorías únicas para filtros (corregido para evitar duplicados)
    categorias_db = (
        db.session.query(Producto.categoria, Producto.categoria_color)
        .filter_by(empresa_id=empresa_id)
        .filter(Producto.categoria.isnot(None))
        .filter(Producto.categoria != '')
        .distinct()
        .all()
    )
    
    # Usar un conjunto para garantizar que no hay duplicados
    categorias_set = set()
    categorias = []
    for cat in categorias_db:
        if cat[0] not in categorias_set:
            categorias_set.add(cat[0])
            categorias.append({
                "nombre": cat[0], 
                "color": cat[1] if cat[1] else "#6B7280"
            })
    
    # Obtener marcas únicas (también evitando duplicados)
    marcas_db = (
        db.session.query(Producto.marca)
        .filter_by(empresa_id=empresa_id)
        .filter(Producto.marca.isnot(None))
        .filter(Producto.marca != '')
        .distinct()
        .all()
    )
    
    marcas = list(set([marca[0] for marca in marcas_db if marca[0]]))
    
    # Obtener ubicaciones únicas existentes para filtros
    ubicaciones_db = (
        db.session.query(Producto.ubicacion)
        .filter_by(empresa_id=empresa_id)
        .filter(Producto.ubicacion.isnot(None))
        .filter(Producto.ubicacion != '')
        .distinct()
        .all()
    )
    
    ubicaciones = list(set([ub[0] for ub in ubicaciones_db if ub[0]]))
    
    # Convertir a diccionarios para JSON en JavaScript
    productos_dict = []
    for p in productos:
        productos_dict.append({
            'id': p.id,
            'nombre': p.nombre,
            'stock': p.stock if hasattr(p, 'stock') else 0,
            'precio_venta': p.precio_venta if hasattr(p, 'precio_venta') else None,
            'categoria': p.categoria,
            'categoria_color': p.categoria_color,
            'foto': p.foto,
            'codigo_barras_externo': p.codigo_barras_externo,
            'marca': p.marca if hasattr(p, 'marca') else None,
            'ubicacion': p.ubicacion if hasattr(p, 'ubicacion') else None,
            'es_favorito': p.es_favorito if hasattr(p, 'es_favorito') else False,
            'esta_a_la_venta': p.esta_a_la_venta if hasattr(p, 'esta_a_la_venta') else True
        })
    
    return render_template(
        'ubicacion_productos.html',
        productos=productos_dict,
        page=page,
        total_pages=total_pages,
        categorias=categorias,
        marcas=marcas,
        ubicaciones=ubicaciones,
        filtro_categoria=categoria_filtro,
        filtro_marca=marca_filtro,
        vista_global=global_view
    )

@ubicaciones_bp.route('/ubicacion-detalle/<string:tipo>/<path:valor>', methods=['GET'])
@login_requerido
def ubicacion_detalle(tipo, valor):
    """
    Vista para mostrar detalles de ubicaciones por tipo (global, categoría, marca, individual)
    """
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('auth.login'))
    
    # Obtener información del usuario
    empresa_id = session.get('user_id')
    
    # Inicializar variables
    productos = []
    titulo = "Ubicaciones"
    ubicacion_valor = ""
    
    # Consulta base
    productos_query = Producto.query.filter_by(
        empresa_id=empresa_id,
        is_approved=True
    )
    
    # Filtrar según el tipo
    if tipo == 'global':
        # Si es 'all', mostrar todos con ubicación
        if valor == 'all':
            productos_query = productos_query.filter(Producto.ubicacion.isnot(None))
            titulo = "Ubicación Global"
            
            # Obtener la ubicación más común como "global"
            ubicaciones = (
                db.session.query(Producto.ubicacion, db.func.count(Producto.id).label('total'))
                .filter(Producto.empresa_id == empresa_id)
                .filter(Producto.ubicacion.isnot(None))
                .group_by(Producto.ubicacion)
                .order_by(db.text('total DESC'))
                .first()
            )
            
            if ubicaciones:
                ubicacion_valor = ubicaciones[0]
        
    elif tipo == 'categoria':
        # Verificar si es 'all' para mostrar todas las categorías
        if valor == 'all':
            # Seleccionar productos con ubicación agrupados por categoría
            categorias_con_ubicacion = (
                db.session.query(Producto.categoria)
                .filter(Producto.empresa_id == empresa_id)
                .filter(Producto.ubicacion.isnot(None))
                .group_by(Producto.categoria)
                .all()
            )
            
            # Obtener todos los productos que tienen una ubicación y pertenecen a alguna de estas categorías
            productos_query = productos_query.filter(
                Producto.categoria.in_([cat[0] for cat in categorias_con_ubicacion if cat[0]])
            )
            
            titulo = "Ubicaciones por Categoría"
        else:
            # Filtrar por la categoría específica
            productos_query = productos_query.filter_by(categoria=valor)
            
            # Obtener la ubicación más común para esta categoría
            ubicaciones = (
                db.session.query(Producto.ubicacion, db.func.count(Producto.id).label('total'))
                .filter(Producto.empresa_id == empresa_id)
                .filter(Producto.categoria == valor)
                .filter(Producto.ubicacion.isnot(None))
                .group_by(Producto.ubicacion)
                .order_by(db.text('total DESC'))
                .first()
            )
            
            if ubicaciones:
                ubicacion_valor = ubicaciones[0]
                
            titulo = f"Categoría: {valor}"
    
    elif tipo == 'marca':
        # Verificar si es 'all' para mostrar todas las marcas
        if valor == 'all':
            # Seleccionar productos con ubicación agrupados por marca
            marcas_con_ubicacion = (
                db.session.query(Producto.marca)
                .filter(Producto.empresa_id == empresa_id)
                .filter(Producto.ubicacion.isnot(None))
                .group_by(Producto.marca)
                .all()
            )
            
            # Obtener todos los productos que tienen una ubicación y pertenecen a alguna de estas marcas
            productos_query = productos_query.filter(
                Producto.marca.in_([marca[0] for marca in marcas_con_ubicacion if marca[0]])
            )
            
            titulo = "Ubicaciones por Marca"
        else:
            # Filtrar por la marca específica
            productos_query = productos_query.filter_by(marca=valor)
            
            # Obtener la ubicación más común para esta marca
            ubicaciones = (
                db.session.query(Producto.ubicacion, db.func.count(Producto.id).label('total'))
                .filter(Producto.empresa_id == empresa_id)
                .filter(Producto.marca == valor)
                .filter(Producto.ubicacion.isnot(None))
                .group_by(Producto.ubicacion)
                .order_by(db.text('total DESC'))
                .first()
            )
            
            if ubicaciones:
                ubicacion_valor = ubicaciones[0]
                
            titulo = f"Marca: {valor}"
    
    elif tipo == 'individual':
        # Si es 'all', filtrar productos que tienen ubicación pero no están categorizados
        if valor == 'all':
            # Obtener productos con ubicación que no pertenecen a una categoría o marca dominante
            # Esto es aproximado - una implementación más precisa requeriría análisis adicional
            productos_query = productos_query.filter(Producto.ubicacion.isnot(None))
            titulo = "Ubicaciones Individuales"
        else:
            # Acá sería por producto individual (usando ID)
            try:
                prod_id = int(valor)
                productos_query = productos_query.filter_by(id=prod_id)
                titulo = "Producto Individual"
            except:
                # Si el valor no es un ID válido, mostrar todos
                pass
    
    # Obtener productos finales
    productos_db = productos_query.all()
    
    # Convertir a diccionarios para JSON
    productos = []
    for p in productos_db:
        productos.append({
            'id': p.id,
            'nombre': p.nombre,
            'stock': p.stock if hasattr(p, 'stock') else 0,
            'precio_venta': p.precio_venta if hasattr(p, 'precio_venta') else None,
            'categoria': p.categoria,
            'categoria_color': p.categoria_color,
            'foto': p.foto,
            'codigo_barras_externo': p.codigo_barras_externo,
            'marca': p.marca if hasattr(p, 'marca') else None,
            'ubicacion': p.ubicacion if hasattr(p, 'ubicacion') else None,
            'es_favorito': p.es_favorito if hasattr(p, 'es_favorito') else False,
            'esta_a_la_venta': p.esta_a_la_venta if hasattr(p, 'esta_a_la_venta') else True
        })
    
    return render_template(
        'ubicacion_detalle.html',
        productos=productos,
        titulo=titulo,
        tipo=tipo,
        valor=valor,
        ubicacion_valor=ubicacion_valor
    )

@ubicaciones_bp.route('/ubicacion/migrar-datos-existentes', methods=['GET'])
@login_requerido
def migrar_datos_ubicacion():
    """
    Ruta para migrar datos existentes de ubicaciones al nuevo esquema con tipo y grupo.
    Esta ruta debe ejecutarse una sola vez después de aplicar la migración de base de datos.
    """
    try:
        empresa_id = session.get('user_id')
        if not empresa_id:
            return "Usuario no autenticado", 401
        
        # 1. Obtener todos los productos con ubicación
        productos_con_ubicacion = Producto.query.filter(
            Producto.empresa_id == empresa_id,
            Producto.is_approved == True,
            Producto.ubicacion.isnot(None),
            Producto.ubicacion != ''
        ).all()
        
        if not productos_con_ubicacion:
            return "No hay productos con ubicación para migrar."
        
        # Contadores para el informe
        migrados_global = 0
        migrados_categoria = 0
        migrados_marca = 0
        migrados_individual = 0
        
        # Estructura para análisis
        total_productos = len(productos_con_ubicacion)
        ubicaciones_conteo = {}
        
        for producto in productos_con_ubicacion:
            if producto.ubicacion not in ubicaciones_conteo:
                ubicaciones_conteo[producto.ubicacion] = 0
            ubicaciones_conteo[producto.ubicacion] += 1
        
        # 2. Verificar ubicación global
        global_ubicacion = None
        for ubicacion, count in ubicaciones_conteo.items():
            if count / total_productos >= 0.8:
                global_ubicacion = ubicacion
                break
        
        # Si hay ubicación global, migrar todos los productos con esa ubicación
        if global_ubicacion:
            for producto in productos_con_ubicacion:
                if producto.ubicacion == global_ubicacion:
                    producto.ubicacion_tipo = 'global'
                    producto.ubicacion_grupo = None
                    migrados_global += 1
            
            # Guardar cambios y retornar resultado
            db.session.commit()
            return f"Migrados {migrados_global} productos a ubicación global."
        
        # Si no hay global, continuar con categorías y marcas
        # Crear estructuras para análisis
        productos_por_categoria = {}
        productos_por_marca = {}
        productos_asignados = set()
        
        # Agrupar por categoría y marca
        for producto in productos_con_ubicacion:
            # Por categoría
            if producto.categoria:
                if producto.categoria not in productos_por_categoria:
                    productos_por_categoria[producto.categoria] = []
                productos_por_categoria[producto.categoria].append(producto)
            
            # Por marca
            if producto.marca:
                if producto.marca not in productos_por_marca:
                    productos_por_marca[producto.marca] = []
                productos_por_marca[producto.marca].append(producto)
        
        # 3. Procesar categorías
        for categoria, productos in productos_por_categoria.items():
            # Contar ubicaciones por categoría
            ubicaciones = {}
            for producto in productos:
                if producto.ubicacion not in ubicaciones:
                    ubicaciones[producto.ubicacion] = 0
                ubicaciones[producto.ubicacion] += 1
            
            # Verificar ubicación dominante
            ubicacion_dominante = None
            total_productos_categoria = len(productos)
            
            for ubicacion, count in ubicaciones.items():
                if count / total_productos_categoria >= 0.8:
                    ubicacion_dominante = ubicacion
                    break
            
            # Si hay ubicación dominante, migrar
            if ubicacion_dominante:
                for producto in productos:
                    if producto.ubicacion == ubicacion_dominante:
                        producto.ubicacion_tipo = 'categoria'
                        producto.ubicacion_grupo = categoria
                        migrados_categoria += 1
                        productos_asignados.add(producto.id)
        
        # 4. Procesar marcas
        for marca, productos in productos_por_marca.items():
            # Filtrar productos ya asignados
            productos_no_asignados = [p for p in productos if p.id not in productos_asignados]
            
            if not productos_no_asignados:
                continue
            
            # Contar ubicaciones por marca
            ubicaciones = {}
            for producto in productos_no_asignados:
                if producto.ubicacion not in ubicaciones:
                    ubicaciones[producto.ubicacion] = 0
                ubicaciones[producto.ubicacion] += 1
            
            # Verificar ubicación dominante
            ubicacion_dominante = None
            total_productos_marca = len(productos_no_asignados)
            
            for ubicacion, count in ubicaciones.items():
                if count / total_productos_marca >= 0.8:
                    ubicacion_dominante = ubicacion
                    break
            
            # Si hay ubicación dominante, migrar
            if ubicacion_dominante:
                for producto in productos_no_asignados:
                    if producto.ubicacion == ubicacion_dominante:
                        producto.ubicacion_tipo = 'marca'
                        producto.ubicacion_grupo = marca
                        migrados_marca += 1
                        productos_asignados.add(producto.id)
        
        # 5. Productos individuales (los que quedan)
        for producto in productos_con_ubicacion:
            if producto.id not in productos_asignados:
                producto.ubicacion_tipo = 'individual'
                producto.ubicacion_grupo = None
                migrados_individual += 1
        
        # Guardar cambios
        db.session.commit()
        
        # Construir mensaje de resultado
        mensaje = f"""
        <h2>Migración de ubicaciones completada</h2>
        <ul>
            <li>Productos en ubicación global: {migrados_global}</li>
            <li>Productos en ubicación por categoría: {migrados_categoria}</li>
            <li>Productos en ubicación por marca: {migrados_marca}</li>
            <li>Productos en ubicación individual: {migrados_individual}</li>
            <li>Total de productos migrados: {migrados_global + migrados_categoria + migrados_marca + migrados_individual}</li>
        </ul>
        <p><a href="/ubicacion-productos">Volver a Ubicaciones</a></p>
        """
        
        return mensaje
        
    except Exception as e:
        db.session.rollback()
        return f"""
        <h2>Error en la migración de datos</h2>
        <p>Se produjo un error: {str(e)}</p>
        <p><a href="/ubicacion-productos">Volver a Ubicaciones</a></p>
        """

# ==============================
# FUNCIONES PARA EXPORTAR
# ==============================
__all__ = ['ubicaciones_bp']