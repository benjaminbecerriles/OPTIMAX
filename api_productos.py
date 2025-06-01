# api_productos.py
import os
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, session, url_for, redirect
from sqlalchemy import or_

from database import db
from models.models import Producto, CatalogoGlobal
from auth import login_requerido
from utils import find_similar_product_image, find_similar_catalog_image, async_download_image
from config import UPLOAD_FOLDER
from external_services import buscar_imagen_google_images

# Crear el blueprint
api_productos_bp = Blueprint('api_productos', __name__)

# ==============================
# APIs DE PRODUCTOS
# ==============================
@api_productos_bp.route('/api/autocomplete', methods=['GET'])
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

@api_productos_bp.route('/api/autocomplete_by_name', methods=['GET'])
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

@api_productos_bp.route('/api/find_by_code', methods=['GET'])
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

@api_productos_bp.route('/api/buscar-imagen', methods=['POST'])
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

@api_productos_bp.route('/api/check_barcode_exists', methods=['GET'])
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

@api_productos_bp.route('/api/product/<int:product_id>')
@login_requerido
def api_product_detail(product_id):
    """
    API endpoint para obtener detalles de un producto (usado por el modal del dashboard)
    """
    empresa_id = session.get('user_id')
    
    producto = Producto.query.filter_by(
        id=product_id,
        empresa_id=empresa_id
    ).first()
    
    if not producto:
        return jsonify({'success': False, 'error': 'Producto no encontrado'}), 404
    
    # Obtener lotes activos
    from models.modelos_inventario import LoteInventario
    lotes = LoteInventario.query.filter_by(
        producto_id=product_id,
        esta_activo=True
    ).filter(LoteInventario.stock > 0).all()
    
    lotes_data = []
    for lote in lotes:
        lotes_data.append({
            'numero_lote': lote.numero_lote,
            'stock': float(lote.stock),
            'costo': float(lote.costo_unitario) if lote.costo_unitario else 0,
            'fecha_entrada': lote.fecha_entrada.strftime('%Y-%m-%d') if lote.fecha_entrada else None,
            'fecha_caducidad': lote.fecha_caducidad.strftime('%Y-%m-%d') if lote.fecha_caducidad else None
        })
    
    return jsonify({
        'success': True,
        'producto': {
            'id': producto.id,
            'nombre': producto.nombre,
            'codigo_barras': producto.codigo_barras_externo,
            'categoria': producto.categoria,
            'marca': producto.marca,
            'stock': float(producto.stock) if producto.stock else 0,
            'precio_venta': float(producto.precio_venta) if producto.precio_venta else 0,
            'costo': float(producto.costo) if producto.costo else 0,
            'ubicacion': producto.ubicacion,
            'descripcion': producto.descripcion,
            'foto': producto.foto,
            'lotes': lotes_data
        }
    })

@api_productos_bp.route('/api/product/<int:product_id>/quick-update', methods=['POST'])
@login_requerido
def api_quick_update_product(product_id):
    """
    API endpoint para actualización rápida de productos desde el dashboard
    """
    empresa_id = session.get('user_id')
    
    producto = Producto.query.filter_by(
        id=product_id,
        empresa_id=empresa_id
    ).first()
    
    if not producto:
        return jsonify({'success': False, 'error': 'Producto no encontrado'}), 404
    
    try:
        data = request.get_json()
        
        # Actualizar solo los campos permitidos
        if 'precio_venta' in data:
            producto.precio_venta = float(data['precio_venta'])
        
        if 'ubicacion' in data:
            producto.ubicacion = data['ubicacion']
        
        if 'esta_a_la_venta' in data:
            producto.esta_a_la_venta = bool(data['esta_a_la_venta'])
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Producto actualizado correctamente'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@api_productos_bp.route('/api/toggle_favorite/<int:product_id>', methods=['POST'])
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

@api_productos_bp.route('/api/toggle_visibility/<int:product_id>', methods=['POST'])
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

@api_productos_bp.route('/api/update_price/<int:product_id>', methods=['POST'])
@login_requerido
def update_price(product_id):
    try:
        producto = Producto.query.get_or_404(product_id)
        
        if producto.empresa_id != session.get('user_id'):
            return jsonify({"success": False, "message": "No tienes permiso para modificar este producto"}), 403
        
        data = request.get_json()
        try:
            nuevo_precio = float(data.get('price', 0))
            if nuevo_precio < 0:
                return jsonify({"success": False, "message": "El precio no puede ser negativo"}), 400
        except ValueError:
            return jsonify({"success": False, "message": "El precio debe ser un número válido"}), 400
        
        precio_anterior = producto.precio_venta
        producto.precio_venta = nuevo_precio
        
        # CALCULAR PRECIO FINAL DINÁMICAMENTE
        precio_final = nuevo_precio
        tiene_descuento = False
        tipo_descuento = None
        valor_descuento = 0.0
        
        # Verificar descuento activo
        if (hasattr(producto, 'tiene_descuento') and producto.tiene_descuento and 
            hasattr(producto, 'valor_descuento') and producto.valor_descuento > 0):
            
            tiene_descuento = True
            tipo_descuento = getattr(producto, 'tipo_descuento', None)
            valor_descuento = getattr(producto, 'valor_descuento', 0.0)
            
            if tipo_descuento == 'percentage':
                precio_final = nuevo_precio * (1 - valor_descuento / 100)
            elif tipo_descuento == 'fixed':
                precio_final = max(0, nuevo_precio - valor_descuento)
        
        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": "Precio actualizado correctamente", 
            "precio": nuevo_precio,
            "precio_base": nuevo_precio,
            "precio_final": precio_final,
            "precio_anterior": precio_anterior,
            "tiene_descuento": tiene_descuento,
            "tipo_descuento": tipo_descuento,
            "valor_descuento": valor_descuento
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False, 
            "message": f"Error al actualizar: {str(e)}",
            "precio": 0,
            "precio_base": 0,
            "precio_final": 0,
            "precio_anterior": 0,
            "tiene_descuento": False,
            "tipo_descuento": None,
            "valor_descuento": 0
        }), 500

@api_productos_bp.route('/api/toggle_cost_type', methods=['POST'])
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

@api_productos_bp.route('/api/search_products', methods=['GET'])
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

# ==============================
# FUNCIONES PARA EXPORTAR
# ==============================
__all__ = ['api_productos_bp']