# precios.py
from flask import Blueprint, request, render_template, session, redirect, url_for, flash

from database import db
from models.models import Producto
from models.modelos_inventario import MovimientoInventario, LoteInventario
from auth import login_requerido

# Crear el blueprint
precios_bp = Blueprint('precios', __name__)

# ==============================
# RUTAS DE PRECIOS Y COSTOS
# ==============================
@precios_bp.route('/cambiar-precios')
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

@precios_bp.route('/cambiar-costos')
@login_requerido
def cambiar_costos_general():
    """
    Vista general para cambiar precios de productos
    """
    # Redirigir a la lista de productos para seleccionar uno
    flash('Seleccione un producto para ver y gestionar sus costos', 'info')
    return redirect(url_for('productos.ver_productos'))

@precios_bp.route('/cambiar-costos/<int:producto_id>')
@login_requerido
def cambiar_costos(producto_id):
    """
    Vista para ver y cambiar los costos de un producto específico.
    Muestra el costo actual y el historial de lotes.
    """
    # Obtener información del usuario
    empresa_id = session.get('user_id')
    
    # Obtener el producto específico
    producto = Producto.query.filter_by(
        id=producto_id,
        empresa_id=empresa_id,
        is_approved=True
    ).first_or_404()
    
    # Calcular costo promedio
    lotes_activos = LoteInventario.query.filter(
        LoteInventario.producto_id == producto_id,
        LoteInventario.esta_activo == True,
        LoteInventario.stock > 0
    ).all()
    
    # Calcular costo promedio ponderado por cantidad en stock
    if lotes_activos:
        costo_total = 0
        stock_total = 0
        
        for lote in lotes_activos:
            costo_total += lote.costo_unitario * lote.stock
            stock_total += lote.stock
        
        if stock_total > 0:
            producto.costo_promedio = costo_total / stock_total
        else:
            producto.costo_promedio = producto.costo
    else:
        producto.costo_promedio = producto.costo
    
    # Obtener todos los lotes del producto ordenados por fecha (más reciente primero)
    lotes = LoteInventario.query.filter_by(
        producto_id=producto_id
    ).order_by(LoteInventario.fecha_entrada.desc()).all()
    
    return render_template(
        'cambiar_costos.html',
        producto=producto,
        lotes=lotes
    )

@precios_bp.route('/costo-confirmacion/<int:producto_id>')
@login_requerido
def costo_confirmacion(producto_id):
    """Muestra la confirmación después de actualizar el costo de un producto."""
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('auth.login'))
    
    empresa_id = session.get('user_id')
    
    # Obtener el producto
    producto = Producto.query.get_or_404(producto_id)
    
    # Verificar que el producto pertenezca a la empresa del usuario actual
    if producto.empresa_id != empresa_id:
        flash('No tienes permiso para ver este producto.', 'danger')
        return redirect(url_for('productos.ver_productos'))
    
    # Obtener el ID del movimiento de la URL
    movimiento_id = request.args.get('movimiento_id')
    
    # Obtener el movimiento
    movimiento = MovimientoInventario.query.get_or_404(movimiento_id)
    
    # Obtener el costo anterior de la URL 
    costo_anterior = float(request.args.get('costo_anterior', 0))
    costo_nuevo = float(movimiento.costo_unitario)
    
    # Calcular costo promedio
    lotes_activos = LoteInventario.query.filter(
        LoteInventario.producto_id == producto_id,
        LoteInventario.esta_activo == True,
        LoteInventario.stock > 0
    ).all()
    
    costo_promedio = costo_nuevo  # Valor por defecto
    
    if lotes_activos:
        costo_total = 0
        stock_total = 0
        
        for lote in lotes_activos:
            costo_total += lote.costo_unitario * lote.stock
            stock_total += lote.stock
        
        if stock_total > 0:
            costo_promedio = costo_total / stock_total
    
    return render_template(
        'cambiar_costo_confirmacion.html',
        producto=producto,
        movimiento=movimiento,
        costo_anterior=costo_anterior,
        costo_nuevo=costo_nuevo,
        costo_promedio=costo_promedio
    )

# Nota: En el app.py original había dos funciones con nombres similares
# costo_confirmacion y mostrar_costo_confirmacion que parecen hacer lo mismo
# Mantendré solo una para evitar duplicación, pero la exportaré con ambos nombres
mostrar_costo_confirmacion = costo_confirmacion

# ==============================
# FUNCIONES PARA EXPORTAR
# ==============================
__all__ = ['precios_bp', 'mostrar_costo_confirmacion']