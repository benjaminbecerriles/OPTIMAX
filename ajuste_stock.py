import os
import uuid
from datetime import datetime, timedelta, date, time
from decimal import Decimal, InvalidOperation
from flask import (
    Blueprint, render_template, request, redirect, 
    url_for, flash, session, jsonify, send_file
)
from werkzeug.utils import secure_filename
from sqlalchemy import desc, and_, func
from models import db
from models.models import Producto
# Usar solo las funciones que existen en tu utils.py
from utils import normalizar_categoria, obtener_o_generar_color_categoria

# Importamos modelos adicionales desde models.modelos_inventario
from models.modelos_inventario import MovimientoInventario, LoteInventario, LoteMovimientoRelacion

# Crear un blueprint para las rutas de ajuste de stock
ajuste_stock_bp = Blueprint('ajuste_stock', __name__)

# Crear un blueprint adicional para las nuevas rutas
new_ajuste_stock_bp = Blueprint('new_ajuste_stock', __name__)

# Constantes
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.realpath(__file__))), 
                           'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip', 'rar'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def safe_decimal(value, default='0.00'):
    """
    Convierte un valor a Decimal de forma segura, manejando casos especiales.
    """
    if value is None or value == '':
        return Decimal(default)
    
    # Si ya es un Decimal, devolverlo
    if isinstance(value, Decimal):
        return value.quantize(Decimal('0.01'))
    
    # Convertir a string para procesamiento
    str_value = str(value).strip()
    
    # Casos especiales
    if str_value == '':
        return Decimal(default)
    
    # Remover comas de miles (1,234.56 → 1234.56)
    str_value = str_value.replace(',', '')
    
    # Normalizar punto final (10. → 10.00)
    if str_value.endswith('.'):
        str_value += '00'
    
    try:
        decimal_value = Decimal(str_value)
        # Redondear a 2 decimales
        return decimal_value.quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        # Si no se puede convertir, usar valor por defecto
        return Decimal(default)

# Funciones auxiliares para gestión de lotes
def obtener_proximo_numero_lote(producto_id):
    """
    Obtiene el siguiente número de lote para un producto.
    El primer lote siempre es 'Lote de Registro', los siguientes son 'Lote #X'
    """
    # Verificar si ya existe un lote de registro
    lote_registro = LoteInventario.query.filter_by(
        producto_id=producto_id,
        numero_lote="Lote de Registro"
    ).first()
    
    # Si no hay lote de registro, este debería ser el primero
    if not lote_registro:
        return "Lote de Registro"
    
    # Si ya existe lote de registro, obtener todos los lotes numerados
    lotes_numerados = LoteInventario.query.filter_by(
        producto_id=producto_id
    ).filter(
        LoteInventario.numero_lote != "Lote de Registro"
    ).all()
    
    if lotes_numerados:
        # Extraer número de cada lote y encontrar el máximo
        numeros_lotes = []
        for lote in lotes_numerados:
            try:
                # Extraer el número después de '#'
                if '#' in lote.numero_lote:
                    numero = int(lote.numero_lote.split('#')[1])
                    numeros_lotes.append(numero)
            except (ValueError, IndexError):
                continue
        
        # Si encontramos números de lotes válidos, obtener el máximo
        if numeros_lotes:
            proximo_numero = max(numeros_lotes) + 1
            return f"Lote #{proximo_numero}"
        else:
            return "Lote #2"  # Si no hay números válidos
    
    # Si solo existe lote de registro, el siguiente es Lote #2
    return "Lote #2"

def obtener_lotes_activos(producto_id):
    """Obtiene todos los lotes activos (con stock > 0) de un producto."""
    return LoteInventario.query.filter_by(
        producto_id=producto_id,
        esta_activo=True
    ).filter(LoteInventario.stock > 0).order_by(LoteInventario.fecha_entrada).all()

def aplicar_salida_lotes(producto_id, cantidad, metodo='auto'):
    """
    Aplica una salida de stock a los lotes correspondientes.
    
    Args:
        producto_id: ID del producto
        cantidad: Cantidad a reducir (Decimal)
        metodo: 'auto' (selección inteligente), 'fifo' o 'lifo'
        
    Returns:
        lista de diccionarios con lotes afectados y cantidades
    """
    # Asegurar que cantidad sea un Decimal
    cantidad = safe_decimal(cantidad)
    
    lotes = obtener_lotes_activos(producto_id)
    
    # Si no hay lotes, no se puede aplicar la salida
    if not lotes:
        return []
    
    # Ordenar lotes según el método
    if metodo == 'auto':
        # Método inteligente:
        # 1. Primero ordenar por los que tienen fecha de caducidad (más cercana primero)
        # 2. Luego ordenar por fecha de entrada (más antigua primero)
        lotes_con_caducidad = [lote for lote in lotes if lote.fecha_caducidad is not None]
        lotes_sin_caducidad = [lote for lote in lotes if lote.fecha_caducidad is None]
        
        # Ordenar lotes con caducidad por fecha de caducidad
        lotes_con_caducidad.sort(key=lambda x: x.fecha_caducidad)
        
        # Ordenar lotes sin caducidad por fecha de entrada (FIFO)
        lotes_sin_caducidad.sort(key=lambda x: x.fecha_entrada)
        
        # Combinar listas: primero los que caducan, luego el resto
        lotes_ordenados = lotes_con_caducidad + lotes_sin_caducidad
    elif metodo == 'fifo':
        # FIFO: ordenar por fecha de entrada (más antigua primero)
        lotes_ordenados = sorted(lotes, key=lambda x: x.fecha_entrada)
    elif metodo == 'lifo':
        # LIFO: ordenar por fecha de entrada (más reciente primero)
        lotes_ordenados = sorted(lotes, key=lambda x: x.fecha_entrada, reverse=True)
    else:
        # Por defecto usar el método inteligente
        lotes_con_caducidad = [lote for lote in lotes if lote.fecha_caducidad is not None]
        lotes_sin_caducidad = [lote for lote in lotes if lote.fecha_caducidad is None]
        lotes_con_caducidad.sort(key=lambda x: x.fecha_caducidad)
        lotes_sin_caducidad.sort(key=lambda x: x.fecha_entrada)
        lotes_ordenados = lotes_con_caducidad + lotes_sin_caducidad
    
    cantidad_restante = cantidad
    lotes_afectados = []
    
    # Aplicar la salida a los lotes
    for lote in lotes_ordenados:
        if cantidad_restante <= 0:
            break
        
        # Cantidad a reducir de este lote (usando Decimal)
        stock_lote = safe_decimal(lote.stock)
        reduccion = min(stock_lote, cantidad_restante)
        cantidad_restante -= reduccion
        
        # Registrar lote afectado
        lotes_afectados.append({
            'id': lote.id,
            'numero_lote': lote.numero_lote,
            'cantidad_afectada': float(reduccion),  # Convertir a float para compatibilidad
            'stock_actual': float(stock_lote - reduccion),
            'costo_unitario': float(safe_decimal(lote.costo_unitario)),
            'fecha_caducidad': lote.fecha_caducidad
        })
        
        # Actualizar stock del lote (convertir a float para BD)
        nuevo_stock = stock_lote - reduccion
        lote.stock = float(nuevo_stock)
        if nuevo_stock <= 0:
            lote.esta_activo = False
    
    # Guardar cambios
    db.session.commit()
    
    return lotes_afectados

# Ruta de prueba para verificar que el blueprint nuevo funciona
@new_ajuste_stock_bp.route('/test', methods=['GET'])
def test_route():
    """Ruta de prueba simple para verificar que el blueprint funciona."""
    return "Esta es una ruta de prueba del nuevo blueprint. Si puedes ver este mensaje, el blueprint está funcionando."

# Rutas
@ajuste_stock_bp.route('/ajuste-inventario', methods=['GET'])
def ajuste_stock():
    """Vista principal de ajuste de inventario."""
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    
    empresa_id = session.get('user_id')
    
    # ===== CALCULAR SALIDAS DE HOY =====
    # Obtener el inicio del día de hoy (00:00:00)
    hoy_inicio = datetime.combine(datetime.now().date(), time.min)
    
    # Contar las salidas del día
    salidas_hoy = MovimientoInventario.query.join(Producto).filter(
        and_(
            MovimientoInventario.tipo_movimiento == 'SALIDA',
            MovimientoInventario.fecha_movimiento >= hoy_inicio,
            Producto.empresa_id == empresa_id,
            MovimientoInventario.motivo != 'corrección de costo'  # Excluir correcciones
        )
    ).count()
    
    # ===== OPCIONAL: CALCULAR MÁS ESTADÍSTICAS =====
    # Entradas de hoy
    entradas_hoy = MovimientoInventario.query.join(Producto).filter(
        and_(
            MovimientoInventario.tipo_movimiento == 'ENTRADA',
            MovimientoInventario.fecha_movimiento >= hoy_inicio,
            Producto.empresa_id == empresa_id,
            MovimientoInventario.motivo != 'corrección de costo'
        )
    ).count()
    
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
        categorias=categorias_lista,
        salidas_hoy=salidas_hoy,  # IMPORTANTE: Pasar el valor real
        entradas_hoy=entradas_hoy  # Opcional
    )

@new_ajuste_stock_bp.route('/new-ajuste-inventario', methods=['GET'])
def new_ajuste_stock():
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

@ajuste_stock_bp.route('/fix-existing-lots', methods=['GET'])
def fix_existing_lots():
    """Ruta temporal para arreglar lotes existentes sin fecha de caducidad."""
    # Esta ruta solo debe ser accesible por un administrador
    if not session.get('logged_in') or not session.get('user_id'):
        return "Acceso denegado", 403
    
    try:
        # Obtener todos los productos con has_caducidad=True y metodo_caducidad no nulo
        productos = Producto.query.filter(
            Producto.has_caducidad == True,
            Producto.metodo_caducidad.isnot(None)
        ).all()
        
        fixed_count = 0
        for producto in productos:
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
                    
        # Guardar cambios
        db.session.commit()
        return f"Se actualizaron {fixed_count} lotes con fechas de caducidad"
        
    except Exception as e:
        db.session.rollback()
        return f"Error: {str(e)}"

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
    
    # Buscar el lote de registro para este producto
    lote_registro = LoteInventario.query.filter_by(
        producto_id=producto_id,
        numero_lote="Lote de Registro"
    ).first()
    
    # Si no existe lote de registro, crearlo
    if not lote_registro and safe_decimal(producto.stock) > 0:
        # Crear lote de registro y movimiento inicial
        try:
            movimiento, lote = crear_lote_registro(
                producto=producto,
                cantidad=safe_decimal(producto.stock),
                costo=safe_decimal(producto.costo),
                fecha_caducidad=producto.fecha_caducidad if producto.has_caducidad else None,
                usuario_id=empresa_id
            )
            db.session.commit()
            lote_registro = lote
            print(f"Lote de registro creado para producto {producto_id}")
        except Exception as e:
            db.session.rollback()
            print(f"Error al crear lote de registro: {str(e)}")
    
    # Obtener información de lotes y último movimiento
    proximo_lote = obtener_proximo_numero_lote(producto_id)
    
    # Obtener el último lote (que podría ser el lote de registro si no hay otros)
    ultimo_lote = LoteInventario.query.filter_by(
        producto_id=producto_id
    ).order_by(desc(LoteInventario.fecha_entrada)).first()
    
    # Obtener la última entrada (incluido el lote de registro)
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
            # Obtener datos del formulario usando safe_decimal
            cantidad = safe_decimal(request.form.get('cantidad', '1'))
            motivo = request.form.get('motivo', 'compra')
            mantener_costo_anterior = request.form.get('mantener_costo_anterior') == 'on'
            
            # Determinar el costo unitario
            if mantener_costo_anterior and ultima_entrada and ultima_entrada.costo_unitario:
                costo_unitario = safe_decimal(ultima_entrada.costo_unitario)
            else:
                # MODIFICADO: Intenta obtener el valor del campo oculto primero
                costo_unitario_real = request.form.get('costo_unitario_real')
                if costo_unitario_real:
                    costo_unitario = safe_decimal(costo_unitario_real)
                else:
                    # Fallback al campo original
                    costo_unitario = safe_decimal(request.form.get('costo_unitario', str(producto.costo)))
            
            actualizar_costo = request.form.get('actualizar_costo') == 'on'
            notas = request.form.get('notas', '')
            
            # Procesar fecha de caducidad
            fecha_caducidad = None
            caducidad_activada = request.form.get('toggle_caducidad_estado') == 'ACTIVADO'
            
            if caducidad_activada:
                caducidad_lapso = request.form.get('caducidad_lapso')
                if caducidad_lapso:
                    fecha_actual = datetime.now()
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
                         
                    # Extraer solo la fecha (sin hora) para evitar problemas de comparación
                    fecha_caducidad = fecha_caducidad.date()
                    print(f"DEBUG: Fecha de caducidad calculada: {fecha_caducidad} (tipo: {type(fecha_caducidad)})")
                elif request.form.get('fecha_caducidad'):
                    try:
                        fecha_caducidad = datetime.strptime(
                            request.form.get('fecha_caducidad'), '%Y-%m-%d'
                        ).date() # Convertir a tipo date
                        print(f"DEBUG: Fecha de caducidad manual: {fecha_caducidad}")
                    except Exception as e:
                        print(f"ERROR: No se pudo procesar la fecha manual: {e}")
                        pass
            
            # Guardar comprobante si existe y si está activado
            comprobante_filename = None
            if request.form.get('toggle_comprobante_estado') == 'ACTIVADO' and 'comprobante' in request.files and request.files['comprobante'].filename:
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
                cantidad=float(cantidad),  # Convertir a float para la base de datos
                motivo=motivo,
                fecha_movimiento=datetime.now(),
                costo_unitario=float(costo_unitario),  # Convertir a float para la base de datos
                numero_lote=proximo_lote,
                fecha_caducidad=fecha_caducidad,
                notas=notas if request.form.get('toggle_notas_estado') == 'ACTIVADO' else None,
                comprobante=comprobante_filename,
                usuario_id=empresa_id
            )
            db.session.add(nuevo_movimiento)
            
            # 2. Crear o actualizar el lote
            nuevo_lote = LoteInventario(
                producto_id=producto_id,
                numero_lote=proximo_lote,
                costo_unitario=float(costo_unitario),  # Convertir a float para la base de datos
                stock=float(cantidad),  # Convertir a float para la base de datos
                fecha_entrada=datetime.now(),
                fecha_caducidad=fecha_caducidad,
                esta_activo=True
            )
            db.session.add(nuevo_lote)
            
            # 3. Actualizar stock del producto usando operaciones seguras con Decimal
            stock_anterior = safe_decimal(producto.stock)
            nuevo_stock = stock_anterior + cantidad
            producto.stock = float(nuevo_stock)  # Convertir a float para la base de datos
            
            # 4. Actualizar costo general si se marcó la opción
            if actualizar_costo:
                producto.costo = float(costo_unitario)  # Convertir a float para la base de datos
            
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
        ultima_entrada=ultima_entrada,
        costo_anterior=float(ultima_entrada.costo_unitario) if ultima_entrada else float(producto.costo),
        historial=historial
    )

@new_ajuste_stock_bp.route('/new-ajuste-entrada/<int:producto_id>', methods=['GET', 'POST'])
def new_ajuste_entrada(producto_id):
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
    
    # Buscar el lote de registro para este producto
    lote_registro = LoteInventario.query.filter_by(
        producto_id=producto_id,
        numero_lote="Lote de Registro"
    ).first()
    
    # Si no existe lote de registro, crearlo
    if not lote_registro and safe_decimal(producto.stock) > 0:
        # Crear lote de registro y movimiento inicial
        try:
            movimiento, lote = crear_lote_registro(
                producto=producto,
                cantidad=safe_decimal(producto.stock),
                costo=safe_decimal(producto.costo),
                fecha_caducidad=producto.fecha_caducidad if producto.has_caducidad else None,
                usuario_id=empresa_id
            )
            db.session.commit()
            lote_registro = lote
            print(f"Lote de registro creado para producto {producto_id}")
        except Exception as e:
            db.session.rollback()
            print(f"Error al crear lote de registro: {str(e)}")
    
    # Obtener información de lotes y último movimiento
    proximo_lote = obtener_proximo_numero_lote(producto_id)
    
    # Obtener el último lote (que podría ser el lote de registro si no hay otros)
    ultimo_lote = LoteInventario.query.filter_by(
        producto_id=producto_id
    ).order_by(desc(LoteInventario.fecha_entrada)).first()
    
    # Obtener la última entrada (incluido el lote de registro)
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
            # Obtener datos del formulario usando safe_decimal
            cantidad = safe_decimal(request.form.get('cantidad', '1'))
            motivo = request.form.get('motivo', 'compra')
            mantener_costo_anterior = request.form.get('mantener_costo_anterior') == 'on'
            
            # Determinar el costo unitario
            if mantener_costo_anterior and ultima_entrada and ultima_entrada.costo_unitario:
                costo_unitario = safe_decimal(ultima_entrada.costo_unitario)
            else:
                # MODIFICADO: Intenta obtener el valor del campo oculto primero
                costo_unitario_real = request.form.get('costo_unitario_real')
                if costo_unitario_real:
                    costo_unitario = safe_decimal(costo_unitario_real)
                else:
                    # Fallback al campo original
                    costo_unitario = safe_decimal(request.form.get('costo_unitario', str(producto.costo)))
            
            actualizar_costo = request.form.get('actualizar_costo') == 'on'
            notas = request.form.get('notas', '')
            
            # Procesar fecha de caducidad
            fecha_caducidad = None
            caducidad_activada = request.form.get('toggle_caducidad_estado') == 'ACTIVADO'
            
            if caducidad_activada:
                caducidad_lapso = request.form.get('caducidad_lapso')
                if caducidad_lapso:
                    fecha_actual = datetime.now()
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
                         
                    # Extraer solo la fecha (sin hora) para evitar problemas de comparación
                    fecha_caducidad = fecha_caducidad.date()
                    print(f"DEBUG: Fecha de caducidad calculada: {fecha_caducidad} (tipo: {type(fecha_caducidad)})")
                elif request.form.get('fecha_caducidad'):
                    try:
                        fecha_caducidad = datetime.strptime(
                            request.form.get('fecha_caducidad'), '%Y-%m-%d'
                        ).date() # Convertir a tipo date
                        print(f"DEBUG: Fecha de caducidad manual: {fecha_caducidad}")
                    except Exception as e:
                        print(f"ERROR: No se pudo procesar la fecha manual: {e}")
                        pass
            
            # Guardar comprobante si existe y si está activado
            comprobante_filename = None
            if request.form.get('toggle_comprobante_estado') == 'ACTIVADO' and 'comprobante' in request.files and request.files['comprobante'].filename:
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
                return redirect(url_for('new_ajuste_stock.new_ajuste_entrada', producto_id=producto_id))
            
            # 1. Crear el movimiento de inventario
            nuevo_movimiento = MovimientoInventario(
                producto_id=producto_id,
                tipo_movimiento='ENTRADA',
                cantidad=float(cantidad),  # Convertir a float para la base de datos
                motivo=motivo,
                fecha_movimiento=datetime.now(),
                costo_unitario=float(costo_unitario),  # Convertir a float para la base de datos
                numero_lote=proximo_lote,
                fecha_caducidad=fecha_caducidad,
                notas=notas if request.form.get('toggle_notas_estado') == 'ACTIVADO' else None,
                comprobante=comprobante_filename,
                usuario_id=empresa_id
            )
            db.session.add(nuevo_movimiento)
            
            # 2. Crear o actualizar el lote
            nuevo_lote = LoteInventario(
                producto_id=producto_id,
                numero_lote=proximo_lote,
                costo_unitario=float(costo_unitario),  # Convertir a float para la base de datos
                stock=float(cantidad),  # Convertir a float para la base de datos
                fecha_entrada=datetime.now(),
                fecha_caducidad=fecha_caducidad,
                esta_activo=True
            )
            db.session.add(nuevo_lote)
            
            # 3. Actualizar stock del producto usando operaciones seguras con Decimal
            stock_anterior = safe_decimal(producto.stock)
            nuevo_stock = stock_anterior + cantidad
            producto.stock = float(nuevo_stock)  # Convertir a float para la base de datos
            
            # 4. Actualizar costo general si se marcó la opción
            if actualizar_costo:
                producto.costo = float(costo_unitario)  # Convertir a float para la base de datos
            
            # Guardar todos los cambios
            db.session.commit()
            
            # Redireccionar a la página de confirmación
            return redirect(url_for(
                'new_ajuste_stock.new_ajuste_confirmacion',
                movimiento_id=nuevo_movimiento.id,
                tipo='entrada'
            ))
            
        except Exception as e:
            db.session.rollback()
            flash(f'Error al procesar la entrada: {str(e)}', 'danger')
            return redirect(url_for('new_ajuste_stock.new_ajuste_entrada', producto_id=producto_id))
    
    # Renderizar la plantilla para GET
    return render_template(
        'new_ajuste_entrada.html',
        producto=producto,
        proximo_lote=proximo_lote,
        ultimo_lote=ultimo_lote.numero_lote if ultimo_lote else None,
        ultima_entrada=ultima_entrada,
        costo_anterior=float(ultima_entrada.costo_unitario) if ultima_entrada else float(producto.costo),
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
    
    # Verificar y crear lote de registro si no existe y hay stock
    lote_registro = LoteInventario.query.filter_by(
        producto_id=producto_id,
        numero_lote="Lote de Registro"
    ).first()
    
    if not lote_registro and safe_decimal(producto.stock) > 0:
        # Crear lote de registro y movimiento inicial
        try:
            movimiento, lote = crear_lote_registro(
                producto=producto,
                cantidad=safe_decimal(producto.stock),
                costo=safe_decimal(producto.costo),
                fecha_caducidad=producto.fecha_caducidad if producto.has_caducidad else None,
                usuario_id=empresa_id
            )
            db.session.commit()
            print(f"Lote de registro creado para producto {producto_id}")
        except Exception as e:
            db.session.rollback()
            print(f"Error al crear lote de registro: {str(e)}")
    
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
            # Obtener datos del formulario usando safe_decimal
            cantidad = safe_decimal(request.form.get('cantidad', '1'))
            motivo = request.form.get('motivo', 'ajuste')
            # Usar método auto por defecto (ya no depende del formulario)
            metodo_descuento = 'auto'
            impacto_financiero = request.form.get('impacto_financiero') == '1'
            notas = request.form.get('notas', '')
            
            # Validar datos
            if cantidad <= 0:
                flash('La cantidad debe ser mayor que cero.', 'danger')
                return redirect(url_for('ajuste_salida', producto_id=producto_id))
            
            stock_actual = safe_decimal(producto.stock)
            if cantidad > stock_actual:
                flash(f'No hay suficiente stock disponible. Stock actual: {stock_actual}', 'danger')
                return redirect(url_for('ajuste_salida', producto_id=producto_id))
            
            # 1. Aplicar la salida a los lotes correspondientes usando el método inteligente
            lotes_afectados = aplicar_salida_lotes(producto_id, cantidad, metodo_descuento)
            
            # 2. Crear el movimiento de inventario
            nuevo_movimiento = MovimientoInventario(
                producto_id=producto_id,
                tipo_movimiento='SALIDA',
                cantidad=float(cantidad),  # Convertir a float para la base de datos
                motivo=motivo,
                fecha_movimiento=datetime.now(),
                metodo_descuento=metodo_descuento,
                impacto_financiero=impacto_financiero,
                notas=notas if request.form.get('toggle_notas_estado') == 'ACTIVADO' else None,
                usuario_id=empresa_id
            )
            db.session.add(nuevo_movimiento)
            
            # 3. Actualizar stock del producto usando operaciones seguras con Decimal
            nuevo_stock = stock_actual - cantidad
            producto.stock = float(nuevo_stock)  # Convertir a float para la base de datos
            
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

@new_ajuste_stock_bp.route('/new-ajuste-salida/<int:producto_id>', methods=['GET', 'POST'])
def new_ajuste_salida(producto_id):
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
    
    # Verificar y crear lote de registro si no existe y hay stock
    lote_registro = LoteInventario.query.filter_by(
        producto_id=producto_id,
        numero_lote="Lote de Registro"
    ).first()
    
    if not lote_registro and safe_decimal(producto.stock) > 0:
        # Crear lote de registro y movimiento inicial
        try:
            movimiento, lote = crear_lote_registro(
                producto=producto,
                cantidad=safe_decimal(producto.stock),
                costo=safe_decimal(producto.costo),
                fecha_caducidad=producto.fecha_caducidad if producto.has_caducidad else None,
                usuario_id=empresa_id
            )
            db.session.commit()
            print(f"Lote de registro creado para producto {producto_id}")
        except Exception as e:
            db.session.rollback()
            print(f"Error al crear lote de registro: {str(e)}")
    
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
            # Obtener datos del formulario usando safe_decimal
            cantidad = safe_decimal(request.form.get('cantidad', '1'))
            motivo = request.form.get('motivo', 'ajuste')
            # Usar método auto por defecto (ya no depende del formulario)
            metodo_descuento = 'auto'
            impacto_financiero = request.form.get('impacto_financiero') == '1'
            notas = request.form.get('notas', '')
            
            # Validar datos
            if cantidad <= 0:
                flash('La cantidad debe ser mayor que cero.', 'danger')
                return redirect(url_for('new_ajuste_stock.new_ajuste_salida', producto_id=producto_id))
            
            stock_actual = safe_decimal(producto.stock)
            if cantidad > stock_actual:
                flash(f'No hay suficiente stock disponible. Stock actual: {stock_actual}', 'danger')
                return redirect(url_for('new_ajuste_stock.new_ajuste_salida', producto_id=producto_id))
            
            # 1. Aplicar la salida a los lotes correspondientes usando el método inteligente
            lotes_afectados = aplicar_salida_lotes(producto_id, cantidad, metodo_descuento)
            
            # 2. Crear el movimiento de inventario
            nuevo_movimiento = MovimientoInventario(
                producto_id=producto_id,
                tipo_movimiento='SALIDA',
                cantidad=float(cantidad),  # Convertir a float para la base de datos
                motivo=motivo,
                fecha_movimiento=datetime.now(),
                metodo_descuento=metodo_descuento,
                impacto_financiero=impacto_financiero,
                notas=notas if request.form.get('toggle_notas_estado') == 'ACTIVADO' else None,
                usuario_id=empresa_id
            )
            db.session.add(nuevo_movimiento)
            
            # 3. Actualizar stock del producto usando operaciones seguras con Decimal
            nuevo_stock = stock_actual - cantidad
            producto.stock = float(nuevo_stock)  # Convertir a float para la base de datos
            
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
                'new_ajuste_stock.new_ajuste_confirmacion',
                movimiento_id=nuevo_movimiento.id,
                tipo='salida'
            ))
            
        except Exception as e:
            db.session.rollback()
            flash(f'Error al procesar la salida: {str(e)}', 'danger')
            return redirect(url_for('new_ajuste_stock.new_ajuste_salida', producto_id=producto_id))
    
    # Renderizar la plantilla para GET
    return render_template(
        'new_ajuste_salida.html',
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
        # Calcular el costo total usando Decimal para precisión
        cantidad_decimal = safe_decimal(movimiento.cantidad)
        costo_decimal = safe_decimal(movimiento.costo_unitario)
        costo_total = float(cantidad_decimal * costo_decimal)  # Convertir a float para la plantilla
        
        # Obtener el lote creado
        lotes_afectados = [
            LoteInventario.query.filter_by(
                producto_id=producto.id,
                numero_lote=movimiento.numero_lote
            ).first()
        ]
        
        # Stock anterior usando operaciones seguras con Decimal
        stock_anterior = float(safe_decimal(producto.stock) - safe_decimal(movimiento.cantidad))
        
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
        
        # Stock anterior usando operaciones seguras con Decimal
        stock_anterior = float(safe_decimal(producto.stock) + safe_decimal(movimiento.cantidad))
    
    return render_template(
        'ajuste_confirmacion.html',
        movimiento=movimiento,
        producto=producto,
        costo_total=costo_total,
        lotes_afectados=lotes_afectados,
        stock_anterior=stock_anterior
    )

@new_ajuste_stock_bp.route('/new-ajuste-confirmacion/<int:movimiento_id>', methods=['GET'])
def new_ajuste_confirmacion(movimiento_id):
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
        # Calcular el costo total usando Decimal para precisión
        cantidad_decimal = safe_decimal(movimiento.cantidad)
        costo_decimal = safe_decimal(movimiento.costo_unitario)
        costo_total = float(cantidad_decimal * costo_decimal)  # Convertir a float para la plantilla
        
        # Obtener el lote creado
        lotes_afectados = [
            LoteInventario.query.filter_by(
                producto_id=producto.id,
                numero_lote=movimiento.numero_lote
            ).first()
        ]
        
        # Stock anterior usando operaciones seguras con Decimal
        stock_anterior = float(safe_decimal(producto.stock) - safe_decimal(movimiento.cantidad))
        
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
        
        # Stock anterior usando operaciones seguras con Decimal
        stock_anterior = float(safe_decimal(producto.stock) + safe_decimal(movimiento.cantidad))
    
    return render_template(
        'new_ajuste_confirmacion.html',
        movimiento=movimiento,
        producto=producto,
        costo_total=costo_total,
        lotes_afectados=lotes_afectados,
        stock_anterior=stock_anterior
    )

@ajuste_stock_bp.route('/descargar-comprobante/<int:movimiento_id>')
def descargar_comprobante(movimiento_id):
    """Permite descargar el comprobante adjunto a un movimiento de inventario."""
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    
    # Obtener el usuario actual
    empresa_id = session.get('user_id')
    
    # Buscar el movimiento
    movimiento = MovimientoInventario.query.get_or_404(movimiento_id)
    
    # Verificar que el movimiento pertenece a un producto de la empresa
    producto = Producto.query.filter_by(
        id=movimiento.producto_id, 
        empresa_id=empresa_id
    ).first_or_404()
    
    # Verificar que el movimiento tiene un comprobante
    if not movimiento.comprobante:
        flash('Este movimiento no tiene comprobante adjunto.', 'warning')
        return redirect(url_for('historial_movimientos'))
    
    # Ruta completa al archivo
    filepath = os.path.join(UPLOAD_FOLDER, movimiento.comprobante)
    
    # Verificar que el archivo existe
    if not os.path.exists(filepath):
        flash('El archivo no se encuentra en el servidor.', 'danger')
        return redirect(url_for('historial_movimientos'))
    
    # Obtener el nombre original del archivo (sin el prefijo UUID)
    filename_parts = movimiento.comprobante.split('_', 1)
    original_filename = filename_parts[1] if len(filename_parts) > 1 else movimiento.comprobante
    
    # Devolver el archivo como descarga
    return send_file(
        filepath,
        as_attachment=True,
        download_name=original_filename,
        mimetype='application/octet-stream'
    )

def init_app(app):
    """Inicializa la aplicación con este blueprint."""
    # Registrar el blueprint original
    app.register_blueprint(ajuste_stock_bp, url_prefix='')
    
    # Registrar el nuevo blueprint con su propio prefijo
    app.register_blueprint(new_ajuste_stock_bp, url_prefix='/new')
    
    # Registrar las rutas principales para el blueprint original
    app.add_url_rule('/ajuste-inventario', 'ajuste_stock', ajuste_stock)
    app.add_url_rule('/ajuste-entrada/<int:producto_id>', 'ajuste_entrada', ajuste_entrada, methods=['GET', 'POST'])
    app.add_url_rule('/ajuste-salida/<int:producto_id>', 'ajuste_salida', ajuste_salida, methods=['GET', 'POST'])
    app.add_url_rule('/ajuste-confirmacion/<int:movimiento_id>', 'ajuste_confirmacion', ajuste_confirmacion)
    app.add_url_rule('/descargar-comprobante/<int:movimiento_id>', 'descargar_comprobante', descargar_comprobante)
    
    # No es necesario registrar las rutas del nuevo blueprint ya que tiene su propio prefijo URL '/new'

# Método para crear el lote inicial (Lote de Registro) al crear un producto
def crear_lote_registro(producto, cantidad, costo, fecha_caducidad=None, usuario_id=None):
    """
    Crea el lote de registro inicial para un producto recién creado.
    
    Args:
        producto: Instancia del producto
        cantidad: Cantidad inicial (Decimal)
        costo: Costo unitario (Decimal)
        fecha_caducidad: Fecha de caducidad (opcional)
        usuario_id: ID del usuario que realiza la acción
    """
    try:
        # Asegurar que cantidad y costo sean Decimal
        cantidad = safe_decimal(cantidad)
        costo = safe_decimal(costo)
        
        # Procesar la fecha de caducidad si el producto tiene activada la opción
        if producto.has_caducidad and producto.metodo_caducidad and not fecha_caducidad:
            caducidad_lapso = producto.metodo_caducidad
            fecha_actual = datetime.now()
            
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
            
            # Extraer solo la fecha (sin hora)
            if fecha_caducidad:
                fecha_caducidad = fecha_caducidad.date()
                print(f"DEBUG CREAR LOTE REGISTRO: Fecha caducidad calculada: {fecha_caducidad}")
        
        # Crear movimiento de inventario para el registro inicial
        movimiento = MovimientoInventario(
            producto_id=producto.id,
            tipo_movimiento='ENTRADA',
            cantidad=float(cantidad),  # Convertir a float para la base de datos
            motivo='Registro inicial',
            fecha_movimiento=datetime.now(),
            costo_unitario=float(costo),  # Convertir a float para la base de datos
            numero_lote="Lote de Registro",
            fecha_caducidad=fecha_caducidad,
            usuario_id=usuario_id or producto.empresa_id
        )
        db.session.add(movimiento)
        
        # Crear lote inicial
        lote = LoteInventario(
            producto_id=producto.id,
            numero_lote="Lote de Registro",
            costo_unitario=float(costo),  # Convertir a float para la base de datos
            stock=float(cantidad),  # Convertir a float para la base de datos
            fecha_entrada=datetime.now(),
            fecha_caducidad=fecha_caducidad,
            esta_activo=True
        )
        db.session.add(lote)
        
        print(f"LOTE REGISTRO CREADO: producto_id={producto.id}, fecha_caducidad={fecha_caducidad}")
        
        # Commit es responsabilidad del método que llama a esta función
        
        return movimiento, lote
    except Exception as e:
        db.session.rollback()
        print(f"ERROR al crear lote de registro: {str(e)}")
        raise e