# api_inventario.py
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, session
from sqlalchemy import text

from database import db
from models.models import Producto
from models.modelos_inventario import MovimientoInventario, LoteInventario
from auth import login_requerido

# Crear el blueprint
api_inventario_bp = Blueprint('api_inventario', __name__)

# ==============================
# APIs DE INVENTARIO
# ==============================
@api_inventario_bp.route('/api/dashboard/stats')
@login_requerido
def api_dashboard_stats():
    """
    API endpoint para obtener estadísticas en tiempo real del dashboard
    """
    empresa_id = session.get('user_id')
    
    try:
        # Estadísticas rápidas
        total_productos = Producto.query.filter_by(empresa_id=empresa_id, is_approved=True).count()
        productos_activos = Producto.query.filter_by(empresa_id=empresa_id, is_approved=True, esta_a_la_venta=True).count()
        
        # Movimientos recientes (últimos 7 días)
        fecha_limite = datetime.now() - timedelta(days=7)
        movimientos_recientes = MovimientoInventario.query.filter(
            MovimientoInventario.empresa_id == empresa_id,
            MovimientoInventario.fecha >= fecha_limite
        ).count()
        
        return jsonify({
            'success': True,
            'stats': {
                'total_productos': total_productos,
                'productos_activos': productos_activos,
                'movimientos_recientes': movimientos_recientes,
                'ultima_actualizacion': datetime.now().strftime('%H:%M:%S')
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api_inventario_bp.route('/api/lotes/<int:producto_id>')
@login_requerido
def api_lotes(producto_id):
    """
    API para obtener los lotes de un producto.
    """
    try:
        # Verificar que el producto pertenece a la empresa
        empresa_id = session.get('user_id')
        producto = Producto.query.filter_by(
            id=producto_id,
            empresa_id=empresa_id
        ).first()
        
        if not producto:
            return jsonify({
                "success": False,
                "message": "Producto no encontrado o sin permisos"
            }), 404
        
        # Obtener todos los lotes del producto
        lotes = LoteInventario.query.filter_by(
            producto_id=producto_id
        ).order_by(LoteInventario.fecha_entrada.desc()).all()
        
        # Convertir lotes a diccionarios
        lotes_dict = []
        for lote in lotes:
            lotes_dict.append({
                "id": lote.id,
                "numero_lote": lote.numero_lote,
                "costo_unitario": float(lote.costo_unitario),
                "stock": float(lote.stock),
                "fecha_entrada": lote.fecha_entrada.isoformat(),
                "fecha_caducidad": lote.fecha_caducidad.isoformat() if lote.fecha_caducidad else None,
                "esta_activo": lote.esta_activo
            })
        
        return jsonify({
            "success": True,
            "producto_nombre": producto.nombre,
            "lotes": lotes_dict
        })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500

@api_inventario_bp.route('/api/actualizar-costo', methods=['POST'])
@login_requerido
def api_actualizar_costo():
    """
    API para actualizar el costo del último lote activo, manteniendo trazabilidad.
    """
    # Importar módulos necesarios al inicio de la función
    from datetime import datetime
    
    try:
        # Obtener datos del request
        data = request.get_json()
        producto_id = data.get('producto_id')
        costo = float(data.get('costo', 0))
        afectar_precio = data.get('afectar_precio', False)
        
        # Validaciones básicas
        if not producto_id or costo < 0:
            return jsonify({
                "success": False,
                "message": "Datos inválidos"
            }), 400
        
        # Verificar que el producto pertenece a la empresa
        empresa_id = session.get('user_id')
        producto = Producto.query.filter_by(
            id=producto_id,
            empresa_id=empresa_id
        ).first()
        
        if not producto:
            return jsonify({
                "success": False,
                "message": "Producto no encontrado o sin permisos"
            }), 404
        
        # Buscar el último lote activo con stock > 0
        ultimo_lote = LoteInventario.query.filter(
            LoteInventario.producto_id == producto_id,
            LoteInventario.esta_activo == True,
            LoteInventario.stock > 0
        ).order_by(LoteInventario.fecha_entrada.desc()).first()
        
        if not ultimo_lote:
            return jsonify({
                "success": False,
                "message": "No se encontró un lote activo para actualizar"
            }), 400
        
        # Guardar valores antiguos para registro
        costo_anterior_lote = ultimo_lote.costo_unitario
        costo_anterior_producto = producto.costo
        
        # Actualizar el costo del lote 
        ultimo_lote.costo_unitario = costo
        
        # Actualizar el costo base del producto
        producto.costo = costo
        
        # Calcular proporciones antes de la actualización si se solicita
        if afectar_precio and costo_anterior_producto > 0:
            proporcion = producto.precio_venta / costo_anterior_producto
            # Actualizar el precio proporcionalmente
            nuevo_precio = costo * proporcion
            producto.precio_venta = nuevo_precio
        
        # Registrar el cambio en el historial (Movimiento de Inventario) como CORRECCIÓN
        nuevo_movimiento = MovimientoInventario(
            producto_id=producto_id,
            tipo_movimiento='ENTRADA',
            cantidad=0,  # No cambiamos stock, solo el costo
            motivo='corrección de costo',
            fecha_movimiento=datetime.now(),
            costo_unitario=costo,
            numero_lote=ultimo_lote.numero_lote,
            notas=f"Corrección de costo en lote '{ultimo_lote.numero_lote}': de ${costo_anterior_lote} a ${costo}",
            usuario_id=empresa_id
        )
        db.session.add(nuevo_movimiento)
        
        # Guardar cambios
        db.session.commit()
        
        # Recalcular costo promedio
        lotes_activos = LoteInventario.query.filter(
            LoteInventario.producto_id == producto_id,
            LoteInventario.esta_activo == True,
            LoteInventario.stock > 0
        ).all()
        
        costo_promedio = costo  # Valor por defecto
        
        if lotes_activos:
            costo_total = 0
            stock_total = 0
            
            for lote in lotes_activos:
                costo_total += lote.costo_unitario * lote.stock
                stock_total += lote.stock
            
            if stock_total > 0:
                costo_promedio = costo_total / stock_total
        
        return jsonify({
            "success": True,
            "message": f"Costo corregido en lote {ultimo_lote.numero_lote}",
            "costo": costo,
            "costo_promedio": costo_promedio,
            "precio_actualizado": afectar_precio,
            "lote_actualizado": ultimo_lote.numero_lote,
            "movimiento_id": nuevo_movimiento.id,
            "costo_anterior": costo_anterior_lote
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500

@api_inventario_bp.route('/api/actualizar-ubicacion/<int:product_id>', methods=['POST'])
@login_requerido
def actualizar_ubicacion(product_id):
    """
    API para actualizar la ubicación de un producto específico.
    """
    try:
        # Obtener el producto y verificar que pertenezca a la empresa del usuario
        producto = Producto.query.get_or_404(product_id)
        
        if producto.empresa_id != session.get('user_id'):
            return jsonify({"success": False, "message": "No tienes permiso para modificar este producto"}), 403
        
        # Obtener la nueva ubicación desde el request
        data = request.get_json()
        nueva_ubicacion = data.get('ubicacion', '').strip()
        
        print(f"DEBUG: Actualizando ubicación de producto {product_id} a '{nueva_ubicacion}'")
        print(f"DEBUG: Estado previo: tipo={producto.ubicacion_tipo}, grupo={producto.ubicacion_grupo}")
        
        # Limpiar ubicación anterior
        producto.ubicacion_tipo = None
        producto.ubicacion_grupo = None
        
        # Actualizar la ubicación
        producto.ubicacion = nueva_ubicacion
        
        # Si la ubicación es vacía, quitar el tipo y grupo
        if not nueva_ubicacion:
            producto.ubicacion_tipo = None
            producto.ubicacion_grupo = None
            print(f"DEBUG: Removiendo ubicación del producto {product_id}")
        else:
            # Por defecto, si se actualiza directamente un producto, es individual
            producto.ubicacion_tipo = 'individual'
            producto.ubicacion_grupo = None
            print(f"DEBUG: Estableciendo producto {product_id} como ubicación individual")
        
        db.session.commit()
        print(f"DEBUG: Ubicación actualizada exitosamente para producto {product_id}")
        
        return jsonify({
            "success": True, 
            "message": "Ubicación actualizada correctamente",
            "ubicacion": nueva_ubicacion,
            "ubicacion_tipo": producto.ubicacion_tipo,
            "ubicacion_grupo": producto.ubicacion_grupo
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"ERROR al actualizar ubicación de producto {product_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": f"Error al actualizar: {str(e)}"}), 500

@api_inventario_bp.route('/api/actualizar-ubicacion-masiva', methods=['POST'])
@login_requerido
def actualizar_ubicacion_masiva():
    """
    API para actualizar la ubicación de múltiples productos a la vez.
    Puede ser por categoría, marca, o lista de IDs.
    """
    try:
        # Obtener datos del request
        data = request.get_json()
        print(f"DEBUG: Datos recibidos en actualizar-ubicacion-masiva: {data}")
        
        ubicacion = data.get('ubicacion', '').strip()
        producto_ids = data.get('producto_ids', [])
        filtro_categoria = data.get('categoria')
        filtro_marca = data.get('marca')
        es_global = data.get('global', False)
        es_remover = data.get('remove', False)
        
        empresa_id = session.get('user_id')
        
        # Validar datos
        if not ubicacion and not es_remover:
            return jsonify({"success": False, "message": "La ubicación no puede estar vacía al asignar"}), 400
        
        productos_actualizados = 0
        
        # Si es una operación de remover, configuramos los valores
        if es_remover:
            ubicacion = ''
            ubicacion_tipo = None
            ubicacion_grupo = None
        
        # Caso 1: Actualizar todos (global)
        if es_global:
            # PRIMERO: Limpiar todas las ubicaciones existentes para evitar duplicación
            if not es_remover:
                Producto.query.filter_by(
                    empresa_id=empresa_id,
                    is_approved=True
                ).update({
                    "ubicacion_tipo": None,
                    "ubicacion_grupo": None
                }, synchronize_session="fetch")
                
                print(f"DEBUG: Se limpiaron ubicaciones previas antes de aplicar global")
            
            # Actualizar todos los productos con la nueva ubicación global
            data_update = {
                "ubicacion": ubicacion
            }
            
            # Si no es remover, establecer tipo de ubicación
            if not es_remover:
                data_update["ubicacion_tipo"] = "global"
                data_update["ubicacion_grupo"] = None
            else:
                data_update["ubicacion_tipo"] = None
                data_update["ubicacion_grupo"] = None
            
            count = Producto.query.filter_by(
                empresa_id=empresa_id,
                is_approved=True
            ).update(data_update, synchronize_session="fetch")
            
            productos_actualizados = count
            print(f"DEBUG: Actualización global completada. Productos actualizados: {count}")
        
        # Caso 2: Actualizar por IDs específicos (individual)
        elif producto_ids and len(producto_ids) > 0:
            # PRIMERO: Limpiar ubicaciones previas de estos productos
            if not es_remover:
                Producto.query.filter(
                    Producto.id.in_(producto_ids),
                    Producto.empresa_id == empresa_id
                ).update({
                    "ubicacion_tipo": None,
                    "ubicacion_grupo": None
                }, synchronize_session="fetch")
                
                print(f"DEBUG: Se limpiaron ubicaciones previas para {len(producto_ids)} productos individuales")
            
            # Filtrar para asegurar que solo se actualicen productos de la empresa actual
            data_update = {
                "ubicacion": ubicacion
            }
            
            # Si no es remover, establecer tipo individual
            if not es_remover:
                data_update["ubicacion_tipo"] = "individual"
                data_update["ubicacion_grupo"] = None
            else:
                data_update["ubicacion_tipo"] = None
                data_update["ubicacion_grupo"] = None
            
            count = Producto.query.filter(
                Producto.id.in_(producto_ids),
                Producto.empresa_id == empresa_id
            ).update(data_update, synchronize_session="fetch")
            
            productos_actualizados = count
            print(f"DEBUG: Actualización por IDs completada. Productos actualizados: {count}")
        
        # Caso 3: Actualizar por categoría
        elif filtro_categoria:
            # PRIMERO: Limpiar ubicaciones previas de estos productos
            if not es_remover:
                Producto.query.filter_by(
                    empresa_id=empresa_id,
                    categoria=filtro_categoria
                ).update({
                    "ubicacion_tipo": None,
                    "ubicacion_grupo": None
                }, synchronize_session="fetch")
                
                print(f"DEBUG: Se limpiaron ubicaciones previas para productos de categoría {filtro_categoria}")
            
            data_update = {
                "ubicacion": ubicacion
            }
            
            # Si no es remover, establecer tipo categoría
            if not es_remover:
                data_update["ubicacion_tipo"] = "categoria"
                data_update["ubicacion_grupo"] = filtro_categoria
            else:
                data_update["ubicacion_tipo"] = None
                data_update["ubicacion_grupo"] = None
            
            count = Producto.query.filter_by(
                empresa_id=empresa_id,
                categoria=filtro_categoria
            ).update(data_update, synchronize_session="fetch")
            
            productos_actualizados = count
            print(f"DEBUG: Actualización por categoría completada. Productos actualizados: {count}")
        
        # Caso 4: Actualizar por marca
        elif filtro_marca:
            # PRIMERO: Limpiar ubicaciones previas de estos productos
            if not es_remover:
                Producto.query.filter_by(
                    empresa_id=empresa_id,
                    marca=filtro_marca
                ).update({
                    "ubicacion_tipo": None,
                    "ubicacion_grupo": None
                }, synchronize_session="fetch")
                
                print(f"DEBUG: Se limpiaron ubicaciones previas para productos de marca {filtro_marca}")
            
            data_update = {
                "ubicacion": ubicacion
            }
            
            # Si no es remover, establecer tipo marca
            if not es_remover:
                data_update["ubicacion_tipo"] = "marca"
                data_update["ubicacion_grupo"] = filtro_marca
            else:
                data_update["ubicacion_tipo"] = None
                data_update["ubicacion_grupo"] = None
            
            count = Producto.query.filter_by(
                empresa_id=empresa_id,
                marca=filtro_marca
            ).update(data_update, synchronize_session="fetch")
            
            productos_actualizados = count
            print(f"DEBUG: Actualización por marca completada. Productos actualizados: {count}")
        
        # Guardar cambios
        if productos_actualizados > 0:
            db.session.commit()
            
            return jsonify({
                "success": True,
                "message": f"Se actualizaron {productos_actualizados} productos",
                "count": productos_actualizados
            })
        else:
            return jsonify({
                "success": False,
                "message": "No se encontraron productos para actualizar"
            }), 404
            
    except Exception as e:
        db.session.rollback()
        print(f"ERROR en actualizar-ubicacion-masiva: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500

@api_inventario_bp.route('/api/get_active_locations', methods=['GET'])
@login_requerido
def get_active_locations():
    """Obtiene todos los tipos de ubicaciones activas para facilitar visualización"""
    try:
        empresa_id = session.get('user_id')
        if not empresa_id:
            return jsonify({"success": False, "message": "Usuario no autenticado"}), 401
        
        # Estructura para almacenar los resultados
        active_locations = {
            "global": False,
            "categorias": [],
            "marcas": [],
            "individuales": 0,
            "location_values": {},
            "conteos": {}  # NUEVO: Diccionario para almacenar conteos
        }
        
        # Verificar si hay productos con ubicación
        hay_productos = Producto.query.filter(
            Producto.empresa_id == empresa_id,
            Producto.is_approved == True,
            Producto.ubicacion.isnot(None),
            Producto.ubicacion != ''
        ).first() is not None
        
        if not hay_productos:
            return jsonify({"success": True, "active_locations": active_locations})
        
        # PASO 1: Buscar ubicación global (tipo = 'global')
        global_products = Producto.query.filter(
            Producto.empresa_id == empresa_id,
            Producto.is_approved == True,
            Producto.ubicacion_tipo == 'global',
            Producto.ubicacion.isnot(None),
            Producto.ubicacion != ''
        ).first()
        
        if global_products:
            active_locations["global"] = True
            active_locations["location_values"]["global"] = global_products.ubicacion
            
            # Contar productos con ubicación global para el frontend
            count_global = Producto.query.filter(
                Producto.empresa_id == empresa_id,
                Producto.is_approved == True,
                Producto.ubicacion_tipo == 'global'
            ).count()
            
            # NUEVO: Guardar el conteo en el diccionario
            active_locations["conteos"]["global"] = count_global
            
            print(f"DEBUG: Encontrada ubicación global con {count_global} productos")
            
            # ELIMINADO: Ya no retornamos temprano, continuamos procesando otras ubicaciones
        
        # PASO 2: Buscar ubicaciones por categoría
        categorias_con_ubicacion = db.session.query(
            Producto.ubicacion_grupo, Producto.ubicacion
        ).filter(
            Producto.empresa_id == empresa_id,
            Producto.is_approved == True,
            Producto.ubicacion_tipo == 'categoria',
            Producto.ubicacion_grupo.isnot(None),
            Producto.ubicacion.isnot(None),
            Producto.ubicacion != ''
        ).distinct().all()
        
        # NUEVO: Inicializar conteos de categorías
        active_locations["conteos"]["categorias"] = {}
        
        # Procesar categorías
        for categoria_data in categorias_con_ubicacion:
            categoria = categoria_data[0]
            ubicacion = categoria_data[1]
            
            if categoria not in active_locations["categorias"]:
                active_locations["categorias"].append(categoria)
                active_locations["location_values"][categoria] = ubicacion
                
                # NUEVO: Contar productos de esta categoría
                count_categoria = Producto.query.filter(
                    Producto.empresa_id == empresa_id,
                    Producto.is_approved == True,
                    Producto.ubicacion_tipo == 'categoria',
                    Producto.ubicacion_grupo == categoria
                ).count()
                
                # NUEVO: Guardar conteo por categoría
                active_locations["conteos"]["categorias"][categoria] = count_categoria
        
        # Depuración
        print(f"DEBUG: Encontradas {len(active_locations['categorias'])} categorías con ubicación")
        
        # PASO 3: Buscar ubicaciones por marca
        marcas_con_ubicacion = db.session.query(
            Producto.ubicacion_grupo, Producto.ubicacion
        ).filter(
            Producto.empresa_id == empresa_id,
            Producto.is_approved == True,
            Producto.ubicacion_tipo == 'marca',
            Producto.ubicacion_grupo.isnot(None),
            Producto.ubicacion.isnot(None),
            Producto.ubicacion != ''
        ).distinct().all()
        
        # NUEVO: Inicializar conteos de marcas
        active_locations["conteos"]["marcas"] = {}
        
        # Procesar marcas
        for marca_data in marcas_con_ubicacion:
            marca = marca_data[0]
            ubicacion = marca_data[1]
            
            if marca not in active_locations["marcas"]:
                active_locations["marcas"].append(marca)
                active_locations["location_values"][marca] = ubicacion
                
                # NUEVO: Contar productos de esta marca
                count_marca = Producto.query.filter(
                    Producto.empresa_id == empresa_id,
                    Producto.is_approved == True,
                    Producto.ubicacion_tipo == 'marca',
                    Producto.ubicacion_grupo == marca
                ).count()
                
                # NUEVO: Guardar conteo por marca
                active_locations["conteos"]["marcas"][marca] = count_marca
        
        # Depuración
        print(f"DEBUG: Encontradas {len(active_locations['marcas'])} marcas con ubicación")
        
        # PASO 4: Contar productos individuales - SOLO contar los que realmente
        # tienen ubicacion_tipo='individual'
        productos_individuales = Producto.query.filter(
            Producto.empresa_id == empresa_id,
            Producto.is_approved == True,
            Producto.ubicacion_tipo == 'individual',
            Producto.ubicacion.isnot(None),
            Producto.ubicacion != ''
        ).count()
        
        active_locations["individuales"] = productos_individuales
        active_locations["conteos"]["individuales"] = productos_individuales
        
        # Depuración
        print(f"DEBUG: Encontrados {productos_individuales} productos con ubicación individual")
        
        return jsonify({
            "success": True,
            "active_locations": active_locations
        })
        
    except Exception as e:
        print(f"Error al obtener ubicaciones activas: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

@api_inventario_bp.route('/api/reset-product-locations', methods=['POST'])
@login_requerido
def reset_product_locations():
    """
    API para resetear todas las ubicaciones de productos para la empresa actual.
    Útil cuando hay inconsistencias y se quiere empezar de cero.
    """
    try:
        empresa_id = session.get('user_id')
        if not empresa_id:
            return jsonify({"success": False, "message": "Usuario no autenticado"}), 401
        
        # Actualizar todos los productos para quitar ubicaciones
        data_update = {
            "ubicacion": '',
            "ubicacion_tipo": None,
            "ubicacion_grupo": None
        }
        
        count = Producto.query.filter_by(
            empresa_id=empresa_id,
            is_approved=True
        ).update(data_update, synchronize_session="fetch")
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Se han reseteado las ubicaciones de {count} productos",
            "count": count
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"ERROR al resetear ubicaciones: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": f"Error: {str(e)}"}), 500

# ==============================
# FUNCIONES PARA EXPORTAR
# ==============================
__all__ = ['api_inventario_bp']