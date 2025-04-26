import os
import uuid
from datetime import datetime
from flask import (
    Blueprint, render_template, request, redirect, 
    url_for, flash, session, jsonify
)
from werkzeug.utils import secure_filename
from sqlalchemy import desc
from models import db
from models.models import Producto
# Usar solo las funciones que existen en tu utils.py
from utils import normalizar_categoria, obtener_o_generar_color_categoria

# Importamos modelos adicionales desde models.modelos_inventario
from models.modelos_inventario import MovimientoInventario, LoteInventario, LoteMovimientoRelacion

# Crear un blueprint para las rutas de ajuste de stock
ajuste_stock_bp = Blueprint('ajuste_stock', __name__)

# Constantes
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.realpath(__file__))), 
                           'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Funciones auxiliares para gestión de lotes
def obtener_proximo_numero_lote(producto_id):
    """Obtiene el siguiente número de lote para un producto."""
    ultimo_lote = LoteInventario.query.filter_by(
        producto_id=producto_id
    ).order_by(desc(LoteInventario.numero_lote)).first()
    
    if ultimo_lote:
        # Extraer el número del formato "Lote #X"
        try:
            numero = int(ultimo_lote.numero_lote.split('#')[1])
            return f"Lote #{numero + 1}"
        except:
            return "Lote #1"
    
    return "Lote #1"

def obtener_lotes_activos(producto_id):
    """Obtiene todos los lotes activos (con stock > 0) de un producto."""
    return LoteInventario.query.filter_by(
        producto_id=producto_id,
        esta_activo=True
    ).filter(LoteInventario.stock > 0).order_by(LoteInventario.fecha_entrada).all()

def aplicar_salida_lotes(producto_id, cantidad, metodo='fifo'):
    """
    Aplica una salida de stock a los lotes correspondientes.
    
    Args:
        producto_id: ID del producto
        cantidad: Cantidad a reducir
        metodo: 'fifo' (primero en caducar) o 'lifo' (último en entrar)
        
    Returns:
        lista de diccionarios con lotes afectados y cantidades
    """
    lotes = obtener_lotes_activos(producto_id)
    
    # Si no hay lotes, no se puede aplicar la salida
    if not lotes:
        return []
    
    # Ordenar lotes según el método
    if metodo == 'fifo':
        # Primero los que caducan antes, luego por fecha de entrada
        lotes.sort(key=lambda x: (
            x.fecha_caducidad or datetime(9999, 12, 31),
            x.fecha_entrada
        ))
    elif metodo == 'lifo':
        # Último en entrar primero
        lotes.sort(key=lambda x: x.fecha_entrada, reverse=True)
    
    cantidad_restante = cantidad
    lotes_afectados = []
    
    # Aplicar la salida a los lotes
    for lote in lotes:
        if cantidad_restante <= 0:
            break
        
        # Cantidad a reducir de este lote
        reduccion = min(lote.stock, cantidad_restante)
        cantidad_restante -= reduccion
        
        # Registrar lote afectado
        lotes_afectados.append({
            'id': lote.id,
            'numero_lote': lote.numero_lote,
            'cantidad_afectada': reduccion,
            'stock_actual': lote.stock - reduccion,
            'costo_unitario': lote.costo_unitario,
            'fecha_caducidad': lote.fecha_caducidad
        })
        
        # Actualizar stock del lote
        lote.stock -= reduccion
        if lote.stock <= 0:
            lote.esta_activo = False
    
    # Guardar cambios
    db.session.commit()
    
    return lotes_afectados

# Rutas
@ajuste_stock_bp.route('/ajuste-inventario', methods=['GET'])
def ajuste_stock():
    """Vista principal de ajuste de inventario."""
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    
    empresa_id = session.get('user_id')
    
    # Obtener todos los productos aprobados de la empresa
    productos = Producto.query.filter_by(
        empresa_id=empresa_id, 
        is_approved=True
    ).order_by(desc(Producto.id)).all()
    
    # Obtener categorías únicas para el filtro
    categorias = db.session.query(Producto.categoria).filter_by(
        empresa_id=empresa_id,
        is_approved=True
    ).filter(Producto.categoria.isnot(None)).distinct().all()
    
    categorias_lista = [cat[0] for cat in categorias if cat[0]]
    
    return render_template(
        'ajuste_stock.html',
        productos=productos,
        categorias=categorias_lista
    )

@ajuste_stock_bp.route('/ajuste-entrada/<int:producto_id>', methods=['GET', 'POST'])
def ajuste_entrada(producto_id):
    """Gestiona la entrada de mercancía de un producto."""
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    
    empresa_id = session.get('user_id')
    
    # Obtener el producto
    producto = Producto.query.filter_by(
        id=producto_id, 
        empresa_id=empresa_id,
        is_approved=True
    ).first_or_404()
    
    # Obtener información de lotes y último movimiento
    proximo_lote = obtener_proximo_numero_lote(producto_id)
    ultimo_lote = LoteInventario.query.filter_by(
        producto_id=producto_id
    ).order_by(desc(LoteInventario.fecha_entrada)).first()
    
    ultima_entrada = MovimientoInventario.query.filter_by(
        producto_id=producto_id,
        tipo_movimiento='ENTRADA'
    ).order_by(desc(MovimientoInventario.fecha_movimiento)).first()
    
    # Historial de movimientos recientes
    historial = MovimientoInventario.query.filter_by(
        producto_id=producto_id
    ).order_by(desc(MovimientoInventario.fecha_movimiento)).limit(10).all()
    
    if request.method == 'POST':
        try:
            # Obtener datos del formulario
            cantidad = int(request.form.get('cantidad', 1))
            motivo = request.form.get('motivo', 'compra')
            costo_unitario = float(request.form.get('costo_unitario', producto.costo))
            actualizar_costo = request.form.get('actualizar_costo') == 'on'
            notas = request.form.get('notas', '')
            
            # Procesar fecha de caducidad (opcional)
            fecha_caducidad = None
            if request.form.get('fecha_caducidad'):
                try:
                    fecha_caducidad = datetime.strptime(
                        request.form.get('fecha_caducidad'), '%Y-%m-%d'
                    )
                except:
                    pass
            
            # Guardar comprobante si existe
            comprobante_filename = None
            if 'comprobante' in request.files and request.files['comprobante'].filename:
                file = request.files['comprobante']
                if allowed_file(file.filename):
                    filename = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
                    if not os.path.exists(UPLOAD_FOLDER):
                        os.makedirs(UPLOAD_FOLDER)
                    file.save(os.path.join(UPLOAD_FOLDER, filename))
                    comprobante_filename = filename
            
            # Validar datos
            if cantidad <= 0:
                flash('La cantidad debe ser mayor que cero.', 'danger')
                return redirect(url_for('ajuste_entrada', producto_id=producto_id))
            
            # 1. Crear el movimiento de inventario
            nuevo_movimiento = MovimientoInventario(
                producto_id=producto_id,
                tipo_movimiento='ENTRADA',
                cantidad=cantidad,
                motivo=motivo,
                fecha_movimiento=datetime.now(),
                costo_unitario=costo_unitario,
                numero_lote=proximo_lote,
                fecha_caducidad=fecha_caducidad,
                notas=notas,
                comprobante=comprobante_filename,
                usuario_id=empresa_id
            )
            db.session.add(nuevo_movimiento)
            
            # 2. Crear o actualizar el lote
            nuevo_lote = LoteInventario(
                producto_id=producto_id,
                numero_lote=proximo_lote,
                costo_unitario=costo_unitario,
                stock=cantidad,
                fecha_entrada=datetime.now(),
                fecha_caducidad=fecha_caducidad,
                esta_activo=True
            )
            db.session.add(nuevo_lote)
            
            # 3. Actualizar stock del producto
            stock_anterior = producto.stock
            producto.stock += cantidad
            
            # 4. Actualizar costo general si se marcó la opción
            if actualizar_costo:
                producto.costo = costo_unitario
            
            # Guardar todos los cambios
            db.session.commit()
            
            # Redireccionar a la página de confirmación
            return redirect(url_for(
                'ajuste_confirmacion',
                movimiento_id=nuevo_movimiento.id,
                tipo='entrada'
            ))
            
        except Exception as e:
            db.session.rollback()
            flash(f'Error al procesar la entrada: {str(e)}', 'danger')
            return redirect(url_for('ajuste_entrada', producto_id=producto_id))
    
    # Renderizar la plantilla para GET
    return render_template(
        'ajuste_entrada.html',
        producto=producto,
        proximo_lote=proximo_lote,
        ultimo_lote=ultimo_lote.numero_lote if ultimo_lote else None,
        ultima_entrada=ultima_entrada.fecha_movimiento.strftime('%d/%m/%Y') if ultima_entrada else None,
        historial=historial
    )

@ajuste_stock_bp.route('/ajuste-salida/<int:producto_id>', methods=['GET', 'POST'])
def ajuste_salida(producto_id):
    """Gestiona la salida de mercancía de un producto."""
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    
    empresa_id = session.get('user_id')
    
    # Obtener el producto
    producto = Producto.query.filter_by(
        id=producto_id, 
        empresa_id=empresa_id,
        is_approved=True
    ).first_or_404()
    
    # Obtener lotes activos y último movimiento
    lotes_activos = obtener_lotes_activos(producto_id)
    
    ultima_salida = MovimientoInventario.query.filter_by(
        producto_id=producto_id,
        tipo_movimiento='SALIDA'
    ).order_by(desc(MovimientoInventario.fecha_movimiento)).first()
    
    # Historial de movimientos recientes
    historial = MovimientoInventario.query.filter_by(
        producto_id=producto_id
    ).order_by(desc(MovimientoInventario.fecha_movimiento)).limit(10).all()
    
    if request.method == 'POST':
        try:
            # Obtener datos del formulario
            cantidad = int(request.form.get('cantidad', 1))
            motivo = request.form.get('motivo', 'ajuste')
            metodo_descuento = request.form.get('metodo_descuento', 'fifo')
            impacto_financiero = request.form.get('impacto_financiero') == '1'
            notas = request.form.get('notas', '')
            
            # Validar datos
            if cantidad <= 0:
                flash('La cantidad debe ser mayor que cero.', 'danger')
                return redirect(url_for('ajuste_salida', producto_id=producto_id))
            
            if cantidad > producto.stock:
                flash(f'No hay suficiente stock disponible. Stock actual: {producto.stock}', 'danger')
                return redirect(url_for('ajuste_salida', producto_id=producto_id))
            
            # 1. Aplicar la salida a los lotes correspondientes
            lotes_afectados = aplicar_salida_lotes(producto_id, cantidad, metodo_descuento)
            
            # 2. Crear el movimiento de inventario
            nuevo_movimiento = MovimientoInventario(
                producto_id=producto_id,
                tipo_movimiento='SALIDA',
                cantidad=cantidad,
                motivo=motivo,
                fecha_movimiento=datetime.now(),
                metodo_descuento=metodo_descuento,
                impacto_financiero=impacto_financiero,
                notas=notas,
                usuario_id=empresa_id
            )
            db.session.add(nuevo_movimiento)
            
            # 3. Actualizar stock del producto
            stock_anterior = producto.stock
            producto.stock -= cantidad
            
            # 4. Registrar la relación entre el movimiento y los lotes afectados
            for lote_info in lotes_afectados:
                relacion = LoteMovimientoRelacion(
                    movimiento_id=nuevo_movimiento.id,
                    lote_id=lote_info['id'],
                    cantidad=lote_info['cantidad_afectada']
                )
                db.session.add(relacion)
            
            # Guardar todos los cambios
            db.session.commit()
            
            # Redireccionar a la página de confirmación
            return redirect(url_for(
                'ajuste_confirmacion',
                movimiento_id=nuevo_movimiento.id,
                tipo='salida'
            ))
            
        except Exception as e:
            db.session.rollback()
            flash(f'Error al procesar la salida: {str(e)}', 'danger')
            return redirect(url_for('ajuste_salida', producto_id=producto_id))
    
    # Renderizar la plantilla para GET
    return render_template(
        'ajuste_salida.html',
        producto=producto,
        lotes_activos=lotes_activos,
        ultima_salida=ultima_salida.fecha_movimiento.strftime('%d/%m/%Y') if ultima_salida else None,
        historial=historial
    )

@ajuste_stock_bp.route('/ajuste-confirmacion/<int:movimiento_id>', methods=['GET'])
def ajuste_confirmacion(movimiento_id):
    """Muestra la confirmación de un ajuste de inventario."""
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    
    empresa_id = session.get('user_id')
    
    # Obtener el movimiento
    movimiento = MovimientoInventario.query.get_or_404(movimiento_id)
    
    # Verificar que el movimiento pertenezca a un producto de la empresa
    producto = Producto.query.filter_by(
        id=movimiento.producto_id, 
        empresa_id=empresa_id
    ).first_or_404()
    
    # Obtener datos adicionales según el tipo de movimiento
    if movimiento.tipo_movimiento == 'ENTRADA':
        # Calcular el costo total
        costo_total = movimiento.cantidad * movimiento.costo_unitario
        
        # Obtener el lote creado
        lotes_afectados = [
            LoteInventario.query.filter_by(
                producto_id=producto.id,
                numero_lote=movimiento.numero_lote
            ).first()
        ]
        
        # Stock anterior
        stock_anterior = producto.stock - movimiento.cantidad
        
    else:  # SALIDA
        costo_total = None
        
        # Obtener lotes afectados desde la tabla de relación
        relaciones = LoteMovimientoRelacion.query.filter_by(
            movimiento_id=movimiento.id
        ).all()
        
        lotes_afectados = []
        for rel in relaciones:
            lote = LoteInventario.query.get(rel.lote_id)
            if lote:
                lotes_afectados.append({
                    'id': lote.id,
                    'numero_lote': lote.numero_lote,
                    'cantidad_afectada': rel.cantidad,
                    'stock_actual': lote.stock,
                    'costo_unitario': lote.costo_unitario,
                    'fecha_caducidad': lote.fecha_caducidad
                })
        
        if not lotes_afectados:
            # Fallback si no hay relaciones guardadas
            lotes_activos = LoteInventario.query.filter_by(
                producto_id=producto.id,
                esta_activo=True
            ).all()
            
            for lote in lotes_activos:
                lotes_afectados.append({
                    'id': lote.id,
                    'numero_lote': lote.numero_lote,
                    'cantidad_afectada': 0,  # Valor desconocido
                    'stock_actual': lote.stock,
                    'costo_unitario': lote.costo_unitario,
                    'fecha_caducidad': lote.fecha_caducidad
                })
        
        # Stock anterior
        stock_anterior = producto.stock + movimiento.cantidad
    
    return render_template(
        'ajuste_confirmacion.html',
        movimiento=movimiento,
        producto=producto,
        costo_total=costo_total,
        lotes_afectados=lotes_afectados,
        stock_anterior=stock_anterior
    )

def init_app(app):
    """Inicializa la aplicación con este blueprint."""
    app.register_blueprint(ajuste_stock_bp, url_prefix='')
    
    # Registrar las rutas principales
    app.add_url_rule('/ajuste-inventario', 'ajuste_stock', ajuste_stock)
    app.add_url_rule('/ajuste-entrada/<int:producto_id>', 'ajuste_entrada', ajuste_entrada, methods=['GET', 'POST'])
    app.add_url_rule('/ajuste-salida/<int:producto_id>', 'ajuste_salida', ajuste_salida, methods=['GET', 'POST'])
    app.add_url_rule('/ajuste-confirmacion/<int:movimiento_id>', 'ajuste_confirmacion', ajuste_confirmacion)