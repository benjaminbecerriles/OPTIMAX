# api_descuentos.py
from datetime import datetime
from flask import Blueprint, request, jsonify, session

from database import db
from models.models import Producto
from auth import login_requerido

# Crear el blueprint
api_descuentos_bp = Blueprint('api_descuentos', __name__)

# ==============================
# APIs DE DESCUENTOS
# ==============================
@api_descuentos_bp.route('/api/apply_discount/<int:product_id>', methods=['POST'])
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
        discount_origin = data.get('origin', 'individual')
        discount_group_id = data.get('group_id', None)
        
        # Validar datos
        if discount_type not in ['percentage', 'fixed'] or discount_value <= 0:
            return jsonify({"success": False, "message": "Datos de descuento inválidos"}), 400
        
        # Validar porcentaje
        if discount_type == 'percentage' and discount_value > 100:
            return jsonify({"success": False, "message": "El porcentaje no puede ser mayor a 100"}), 400
        
        # Usar el método del modelo que actualiza precio_final correctamente
        precio_final = producto.aplicar_descuento(
            valor=discount_value,
            tipo=discount_type,
            origen=discount_origin,
            grupo_id=discount_group_id
        )
        
        # Si es descuento global, aplicar a todos los productos
        if discount_origin == 'global':
            try:
                empresa_id = session.get('user_id')
                # Solo actualizar otros productos, no el actual que ya fue actualizado
                otros_productos = Producto.query.filter(
                    Producto.empresa_id == empresa_id,
                    Producto.id != product_id
                ).all()
                
                for otro_producto in otros_productos:
                    # Usar el método del modelo para cada producto
                    otro_producto.aplicar_descuento(
                        valor=discount_value,
                        tipo=discount_type,
                        origen='global',
                        grupo_id=None
                    )
            except Exception as e:
                print(f"Error al aplicar descuento global: {str(e)}")
        
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

@api_descuentos_bp.route('/api/remove_discount/<int:product_id>', methods=['POST'])
@login_requerido
def remove_discount(product_id):
    """Remueve el descuento de un producto específico."""
    try:
        producto = Producto.query.get_or_404(product_id)
        
        # Verificar que el producto pertenezca a la empresa del usuario
        if producto.empresa_id != session.get('user_id'):
            return jsonify({"success": False, "message": "Sin permisos"}), 403
        
        # Usar el método del modelo que actualiza precio_final correctamente
        precio_final_actualizado = producto.quitar_descuento()
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "precio_base": producto.precio_venta,
            "precio_final": precio_final_actualizado
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@api_descuentos_bp.route('/api/get_global_discount_status', methods=['GET'])
@login_requerido
def get_global_discount_status():
    """Obtiene el estado del descuento global"""
    try:
        empresa_id = session.get('user_id')
        if not empresa_id:
            return jsonify({"success": False, "message": "Usuario no autenticado"}), 401
        
        # Contar productos con descuento global
        productos_con_global = Producto.query.filter_by(
            empresa_id=empresa_id,
            origen_descuento='global',
            tiene_descuento=True
        ).count()
        
        # Contar total de productos
        total_productos = Producto.query.filter_by(
            empresa_id=empresa_id
        ).count()
        
        # Si hay al menos un producto con descuento global, consideramos que está activo
        is_global_active = productos_con_global > 0
        
        # Obtener valor del descuento global (tomando el primero que encontremos)
        valor_descuento = 0
        tipo_descuento = None
        primer_producto_global = Producto.query.filter_by(
            empresa_id=empresa_id,
            origen_descuento='global',
            tiene_descuento=True
        ).first()
        
        if primer_producto_global:
            valor_descuento = primer_producto_global.valor_descuento
            tipo_descuento = primer_producto_global.tipo_descuento
        
        return jsonify({
            "success": True,
            "is_global_active": is_global_active,
            "productos_con_global": productos_con_global,
            "total_productos": total_productos,
            "valor_descuento": valor_descuento,
            "tipo_descuento": tipo_descuento
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@api_descuentos_bp.route('/api/get_active_discounts', methods=['GET'])
@login_requerido
def get_active_discounts():
    """Obtiene todos los tipos de descuentos activos para facilitar visualización"""
    try:
        empresa_id = session.get('user_id')
        if not empresa_id:
            return jsonify({"success": False, "message": "Usuario no autenticado"}), 401
        
        # Estructura para almacenar los resultados
        active_discounts = {
            "global": False,
            "categorias": [],
            "marcas": [],
            "individuales": 0
        }
        
        # Verificar descuento global (basta 1 producto)
        active_discounts["global"] = Producto.query.filter_by(
            empresa_id=empresa_id,
            origen_descuento='global',
            tiene_descuento=True
        ).limit(1).count() > 0
        
        # Obtener categorías con descuentos
        categorias_con_descuento = db.session.query(Producto.descuento_grupo_id).filter(
            Producto.empresa_id == empresa_id,
            Producto.origen_descuento == 'categoria',
            Producto.tiene_descuento == True
        ).distinct().all()
        
        active_discounts["categorias"] = [cat[0] for cat in categorias_con_descuento if cat[0]]
        
        # Obtener marcas con descuentos
        marcas_con_descuento = db.session.query(Producto.descuento_grupo_id).filter(
            Producto.empresa_id == empresa_id,
            Producto.origen_descuento == 'marca',
            Producto.tiene_descuento == True
        ).distinct().all()
        
        active_discounts["marcas"] = [marca[0] for marca in marcas_con_descuento if marca[0]]
        
        # Contar productos con descuentos individuales
        active_discounts["individuales"] = Producto.query.filter_by(
            empresa_id=empresa_id,
            origen_descuento='individual',
            tiene_descuento=True
        ).count()
        
        return jsonify({
            "success": True,
            "active_discounts": active_discounts
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@api_descuentos_bp.route('/api/fix-existing-discounts', methods=['POST'])
@login_requerido
def fix_existing_discounts():
    """Corrige los descuentos existentes que no tienen origen_descuento o descuento_grupo_id."""
    try:
        empresa_id = session.get('user_id')
        if not empresa_id:
            return jsonify({"success": False, "message": "Usuario no autenticado"}), 401
        
        # Obtener todos los productos con descuento pero sin origen
        productos_descuento_sin_origen = Producto.query.filter_by(
            empresa_id=empresa_id,
            tiene_descuento=True,
            origen_descuento=None
        ).all()
        
        fixed_count = 0
        
        # Asumir que son descuentos individuales
        for producto in productos_descuento_sin_origen:
            producto.origen_descuento = 'individual'
            producto.fecha_aplicacion_descuento = datetime.now()
            fixed_count += 1
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Se han corregido {fixed_count} productos con descuentos",
            "count": fixed_count
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

# ==============================
# FUNCIONES PARA EXPORTAR
# ==============================
__all__ = ['api_descuentos_bp']