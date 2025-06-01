# inventario.py
from datetime import datetime, date, timedelta
from flask import Blueprint, request, render_template, session, redirect, url_for, flash
from sqlalchemy import or_

from database import db
from models.models import Producto
from models.modelos_inventario import MovimientoInventario, LoteInventario
from auth import login_requerido

# Crear el blueprint
inventario_bp = Blueprint('inventario', __name__)

# ==============================
# RUTAS DE INVENTARIO
# ==============================
@inventario_bp.route('/historial-movimientos')
@login_requerido
def historial_movimientos():
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('auth.login'))
    
    # Obtener ID de empresa del usuario actual
    empresa_id = session.get('user_id')
    
    # Obtener parámetros de filtro
    tipo = request.args.get('tipo', 'todos')
    periodo = int(request.args.get('periodo', 30))
    busqueda = request.args.get('q', '')
    page = int(request.args.get('page', 1))
    per_page = 30  # Movimientos por página
    
    # Calcular fecha límite según el período seleccionado
    fecha_limite = datetime.now() - timedelta(days=periodo)
    
    # Consulta base CON FILTRO POR EMPRESA_ID
    # Modificación aquí: Excluir movimientos de corrección de costo
    query = MovimientoInventario.query.join(Producto).filter(
        MovimientoInventario.fecha_movimiento >= fecha_limite,
        Producto.empresa_id == empresa_id,  # Filtro importante por empresa_id
        MovimientoInventario.motivo != 'corrección de costo'  # NUEVA LÍNEA: filtrar correcciones de costo
    )
    
    # Aplicar filtro de tipo
    if tipo == 'entrada':
        query = query.filter(MovimientoInventario.tipo_movimiento == 'ENTRADA')
    elif tipo == 'salida':
        query = query.filter(MovimientoInventario.tipo_movimiento == 'SALIDA')
    
    # Aplicar búsqueda
    if busqueda:
        query = query.filter(
            or_(
                Producto.nombre.ilike(f'%{busqueda}%'),
                Producto.codigo_barras_externo.ilike(f'%{busqueda}%')
            )
        )
    
    # Ordenar por fecha descendente (más reciente primero)
    query = query.order_by(MovimientoInventario.fecha_movimiento.desc())
    
    # Contar total de resultados
    total_movimientos = query.count()
    
    # Aplicar paginación
    movimientos = query.paginate(page=page, per_page=per_page, error_out=False)
    
    # Determinar si hay página siguiente
    has_next = page * per_page < total_movimientos
    
    return render_template(
        'historial_movimientos.html',
        movimientos=movimientos.items,
        current_page=page,
        has_next=has_next,
        total_movimientos=total_movimientos
    )

@inventario_bp.route('/reabastecer', methods=['GET'])
@login_requerido
def reabastecer_listado():
    # Obtener productos aprobados de la empresa
    empresa_id = session['user_id']
    productos = Producto.query.filter_by(empresa_id=empresa_id, is_approved=True).all()
    return render_template('reabastecer_listado.html', productos=productos)

@inventario_bp.route('/reabastecer-producto/<int:prod_id>', methods=['GET','POST'])
@login_requerido
def reabastecer_producto(prod_id):
    producto = Producto.query.get_or_404(prod_id)
    
    # Verificar que el producto pertenece a la empresa actual
    if producto.empresa_id != session.get('user_id'):
        return "No tienes permiso para reabastecer este producto."
    
    if request.method == 'POST':
        try:
            stock_to_add = int(request.form.get('stock_to_add', 0))
            producto.stock += stock_to_add
            db.session.commit()
            flash(f'Se han añadido {stock_to_add} unidades al stock de {producto.nombre}.', 'success')
            return redirect(url_for('inventario.reabastecer_listado'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error al reabastecer: {str(e)}', 'danger')
    
    return render_template('reabastecer_producto.html', producto=producto)

@inventario_bp.route('/inventario-escaner', methods=['GET','POST'])
@login_requerido
def inventario_escaner():
    return render_template('inventario_escaner.html')

@inventario_bp.route('/generar-movimientos-iniciales-debug')
@login_requerido
def generar_movimientos_iniciales_debug():
    """
    Versión depurada para generar movimientos iniciales para productos sin movimiento inicial.
    """
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('auth.login'))
    
    # Obtener ID de empresa del usuario actual
    empresa_id = session.get('user_id')
    
    # Iniciar registro HTML para visualizar resultados
    resultado_html = "<h2>Diagnóstico de Movimientos Iniciales</h2>"
    resultado_html += "<style>.success{color:green;} .error{color:red;} .warning{color:orange;}</style>"
    resultado_html += "<ul>"
    
    try:
        # Obtener todos los productos aprobados con stock positivo
        productos = Producto.query.filter_by(
            empresa_id=empresa_id,
            is_approved=True
        ).filter(Producto.stock > 0).all()
        
        resultado_html += f"<li>Encontrados {len(productos)} productos con stock positivo</li>"
        
        productos_procesados = 0
        movimientos_creados = 0
        lotes_creados = 0
        productos_con_errores = 0
        
        for producto in productos:
            try:
                productos_procesados += 1
                resultado_html += f"<li>Procesando producto ID {producto.id}: {producto.nombre} (Stock: {producto.stock})</li>"
                
                # 1. Verificar si ya existe movimiento inicial
                movimientos = MovimientoInventario.query.filter_by(
                    producto_id=producto.id
                ).all()
                
                movimiento_inicial_existe = False
                for m in movimientos:
                    if m.motivo == 'Registro inicial' or (m.motivo and 'registro' in m.motivo.lower()):
                        movimiento_inicial_existe = True
                        resultado_html += f"<li class='warning'>- Ya tiene movimiento inicial (ID: {m.id})</li>"
                        break
                
                # 2. Verificar si ya existe lote de registro
                lotes = LoteInventario.query.filter_by(
                    producto_id=producto.id
                ).all()
                
                lote_registro_existe = False
                for l in lotes:
                    if l.numero_lote == "Lote de Registro":
                        lote_registro_existe = True
                        resultado_html += f"<li class='warning'>- Ya tiene Lote de Registro (ID: {l.id}, Stock: {l.stock})</li>"
                        break
                
                # 3. Crear movimiento y lote si no existen
                if not movimiento_inicial_existe or not lote_registro_existe:
                    # Determinar fecha_caducidad si aplica
                    fecha_caducidad = None
                    if hasattr(producto, 'has_caducidad') and producto.has_caducidad and producto.metodo_caducidad:
                        try:
                            fecha_actual = datetime.now()
                            
                            if producto.metodo_caducidad == '1 día':
                                fecha_caducidad = fecha_actual + timedelta(days=1)
                            elif producto.metodo_caducidad == '3 días':
                                fecha_caducidad = fecha_actual + timedelta(days=3)
                            elif producto.metodo_caducidad == '1 semana':
                                fecha_caducidad = fecha_actual + timedelta(days=7)
                            elif producto.metodo_caducidad == '2 semanas':
                                fecha_caducidad = fecha_actual + timedelta(days=14)
                            elif producto.metodo_caducidad == '1 mes':
                                fecha_caducidad = fecha_actual + timedelta(days=30)
                            elif producto.metodo_caducidad == '3 meses':
                                fecha_caducidad = fecha_actual + timedelta(days=90)
                            elif producto.metodo_caducidad == '6 meses':
                                fecha_caducidad = fecha_actual + timedelta(days=180)
                            elif producto.metodo_caducidad == '1 año':
                                fecha_caducidad = fecha_actual + timedelta(days=365)
                            elif producto.metodo_caducidad == '2 años':
                                fecha_caducidad = fecha_actual + timedelta(days=730)
                            elif producto.metodo_caducidad == '3 años':
                                fecha_caducidad = fecha_actual + timedelta(days=1460)
                            
                            # Convertir a date
                            if fecha_caducidad:
                                fecha_caducidad = fecha_caducidad.date()
                        except Exception as e:
                            resultado_html += f"<li class='error'>- Error al calcular fecha de caducidad: {str(e)}</li>"
                    
                    # Crear movimiento si no existe
                    if not movimiento_inicial_existe:
                        try:
                            costo = producto.costo if hasattr(producto, 'costo') and producto.costo is not None else 0
                            nuevo_movimiento = MovimientoInventario(
                                producto_id=producto.id,
                                tipo_movimiento='ENTRADA',
                                cantidad=float(producto.stock),
                                motivo='Registro inicial',
                                fecha_movimiento=datetime.now(),
                                costo_unitario=float(costo),
                                numero_lote="Lote de Registro",
                                fecha_caducidad=fecha_caducidad,
                                usuario_id=empresa_id
                            )
                            db.session.add(nuevo_movimiento)
                            db.session.flush()  # Para obtener el ID asignado
                            
                            movimientos_creados += 1
                            resultado_html += f"<li class='success'>- Creado movimiento inicial ID: {nuevo_movimiento.id}</li>"
                        except Exception as e:
                            resultado_html += f"<li class='error'>- Error al crear movimiento: {str(e)}</li>"
                            import traceback
                            resultado_html += f"<li class='error'>- Trace: {traceback.format_exc()}</li>"
                    
                    # Crear lote si no existe
                    if not lote_registro_existe:
                        try:
                            costo = producto.costo if hasattr(producto, 'costo') and producto.costo is not None else 0
                            nuevo_lote = LoteInventario(
                                producto_id=producto.id,
                                numero_lote="Lote de Registro",
                                costo_unitario=float(costo),
                                stock=float(producto.stock),
                                fecha_entrada=datetime.now(),
                                fecha_caducidad=fecha_caducidad,
                                esta_activo=True
                            )
                            db.session.add(nuevo_lote)
                            db.session.flush()  # Para obtener el ID asignado
                            
                            lotes_creados += 1
                            resultado_html += f"<li class='success'>- Creado lote de registro ID: {nuevo_lote.id}</li>"
                        except Exception as e:
                            resultado_html += f"<li class='error'>- Error al crear lote: {str(e)}</li>"
                            import traceback
                            resultado_html += f"<li class='error'>- Trace: {traceback.format_exc()}</li>"
                
                # Actualizar todo el producto cada vez (commit por producto)
                db.session.commit()
                resultado_html += "<li class='success'>- Commit exitoso para este producto</li>"
                
            except Exception as e:
                db.session.rollback()
                productos_con_errores += 1
                resultado_html += f"<li class='error'>Error general para producto {producto.id}: {str(e)}</li>"
                import traceback
                resultado_html += f"<li class='error'>Trace: {traceback.format_exc()}</li>"
        
        # Resumen final
        resultado_html += "</ul>"
        resultado_html += f"""
        <h3>Resumen del Proceso</h3>
        <ul>
            <li>Productos procesados: {productos_procesados}</li>
            <li>Movimientos iniciales creados: {movimientos_creados}</li>
            <li>Lotes de registro creados: {lotes_creados}</li>
            <li>Productos con errores: {productos_con_errores}</li>
        </ul>
        
        <p>
            <a href="{url_for('inventario.historial_movimientos')}?periodo=365" 
               style="display:inline-block; padding:10px 20px; background-color:#e52e2e; 
                      color:white; text-decoration:none; border-radius:5px;">
                Ver Historial de Movimientos (Último año)
            </a>
        </p>
        """
        
        return resultado_html
        
    except Exception as e:
        db.session.rollback()
        import traceback
        return f"""
        <h2>Error General en el Proceso</h2>
        <p style="color:red;">Se produjo un error: {str(e)}</p>
        <pre>{traceback.format_exc()}</pre>
        <p>
            <a href="{url_for('dashboard.dashboard_home')}" style="color:#0066cc;">Volver al Dashboard</a>
        </p>
        """

# ==============================
# FUNCIONES PARA EXPORTAR
# ==============================
__all__ = ['inventario_bp']