# dashboard.py
from datetime import datetime, timedelta
from flask import Blueprint, render_template, session, redirect, url_for

# No importar db directamente, obtenerla cuando se necesite
from database import db
from models.models import Producto
from models.modelos_inventario import MovimientoInventario, LoteInventario
from auth import login_requerido

# Crear el blueprint
dashboard_bp = Blueprint('dashboard', __name__)

# ==============================
# RUTAS DEL DASHBOARD
# ==============================
@dashboard_bp.route('/')
def index():
    return render_template('index.html')

@dashboard_bp.route('/dashboard')
@login_requerido
def dashboard_home():
    """
    Vista del dashboard principal
    """
    # Obtener información del usuario y datos para el dashboard
    empresa_id = session['user_id']
    empresa = db.session.query(db.Model).filter_by(id=empresa_id).first()
    
    # Obtener lista de productos para estadísticas
    productos = Producto.query.filter_by(empresa_id=empresa_id).all()
    total_productos = len(productos)
    
    return render_template(
        'dashboard_home.html',
        productos=productos,
        total_productos=total_productos
    )

@dashboard_bp.route('/dashboard/inventario')
@login_requerido
def dashboard_inventario():
    """
    Vista del dashboard de inventario con valoración híbrida (lotes o producto directo)
    """
    # Verificar si el usuario está logueado
    if not session.get('logged_in'):
        return redirect(url_for('auth.login'))
    
    # Obtener información del usuario
    empresa_id = session.get('user_id')
    
    # Obtener lista de productos para mostrar (solo los aprobados)
    productos_query = Producto.query.filter_by(
        empresa_id=empresa_id,
        is_approved=True
    ).order_by(Producto.id.desc())
    
    # Ejecutar query y obtener resultados
    productos_raw = productos_query.all()
    
    # Crear una lista simplificada con solo los datos necesarios
    productos = []
    total_unidades = 0
    valor_inventario = 0
    
    print("\n\n==== DIAGNÓSTICO DE PRODUCTOS Y LOTES ====")
    
    for p in productos_raw:
        try:
            p_id = p.id
            p_nombre = p.nombre
            
            # Obtener todos los lotes activos con stock positivo para este producto
            lotes_activos = LoteInventario.query.filter_by(
                producto_id=p_id,
                esta_activo=True
            ).filter(LoteInventario.stock > 0).all()
            
            # Verificar stock y costo directos del producto
            try:
                p_stock_directo = float(p.stock) if p.stock is not None else 0
                p_costo_directo = float(p.costo) if p.costo is not None else 0
            except (TypeError, ValueError):
                p_stock_directo = 0
                p_costo_directo = 0
            
            print(f"Producto [{p_id}]: {p_nombre}")
            print(f"  - Stock directo: {p_stock_directo}, Costo directo: {p_costo_directo}")
            print(f"  - Lotes activos encontrados: {len(lotes_activos)}")
            
            # CASO 1: Si hay lotes activos, usar sus valores
            if lotes_activos:
                # Calcular stock total y valor total para este producto basado en lotes
                p_stock_total = 0
                p_valor_total = 0
                
                # Procesar cada lote del producto
                for lote in lotes_activos:
                    try:
                        # Convertir a float
                        lote_stock = float(lote.stock) if lote.stock is not None else 0
                        lote_costo = float(lote.costo_unitario) if lote.costo_unitario is not None else 0
                        
                        # Calcular valor de este lote
                        lote_valor = lote_stock * lote_costo
                        
                        # Sumar al total del producto
                        p_stock_total += lote_stock
                        p_valor_total += lote_valor
                        
                        print(f"    > Lote {lote.numero_lote}: stock={lote_stock}, costo={lote_costo}, valor={lote_valor}")
                    except Exception as e:
                        print(f"    > ERROR procesando lote {lote.id}: {e}")
                
                # Verificar si el stock del producto coincide con la suma de lotes
                if abs(p_stock_directo - p_stock_total) > 0.001:  # Pequeña tolerancia para errores de redondeo
                    print(f"  ⚠️ ADVERTENCIA: Stock en producto ({p_stock_directo}) NO coincide con suma de lotes ({p_stock_total})")
                
                # Usar los valores calculados de lotes
                p_stock_final = p_stock_total
                p_valor_final = p_valor_total
                print(f"  ✅ Usando valores de lotes: stock={p_stock_final}, valor={p_valor_final}")
            
            # CASO 2: Si no hay lotes activos pero el producto tiene stock, usar valores directos
            elif p_stock_directo > 0:
                p_stock_final = p_stock_directo
                p_valor_final = p_stock_directo * p_costo_directo
                print(f"  ⚠️ No hay lotes activos, usando valores directos: stock={p_stock_final}, valor={p_valor_final}")
            
            # CASO 3: Producto sin stock
            else:
                p_stock_final = 0
                p_valor_final = 0
                print(f"  ℹ️ Producto sin stock")
            
            # Acumular totales globales
            total_unidades += p_stock_final
            valor_inventario += p_valor_final
            
            # Intentar obtener precio_venta para el diccionario
            try:
                p_precio = float(p.precio_venta) if p.precio_venta is not None else 0
            except (TypeError, ValueError):
                p_precio = 0
            
            # Agregar a la lista simplificada
            productos.append({
                'id': p_id,
                'nombre': p_nombre,
                'stock': p_stock_final,  # Usamos el stock calculado
                'precio_venta': p_precio,
                'categoria': p.categoria,
                'categoria_color': p.categoria_color,
                'foto': p.foto,
                'codigo_barras_externo': p.codigo_barras_externo,
                'marca': p.marca or '',
                'es_favorito': p.es_favorito,
                'esta_a_la_venta': p.esta_a_la_venta
            })
            
        except Exception as e:
            print(f"ERROR procesando producto: {e}")
            import traceback
            traceback.print_exc()
    
    # Calcular estadísticas
    total_productos = len(productos)
    
    # Productos con poco stock (por agotarse)
    productos_por_agotarse = sum(1 for p in productos if p['stock'] > 0 and p['stock'] <= 5)
    
    # ========== NUEVOS DATOS PARA EL DASHBOARD PROFESIONAL ==========
    
    # Calcular crecimiento mensual (comparar con mes anterior)
    from datetime import datetime, timedelta
    fecha_mes_anterior = datetime.now() - timedelta(days=30)
    
    try:
        # Contar movimientos del último mes
        movimientos_mes = MovimientoInventario.query.filter(
            MovimientoInventario.empresa_id == empresa_id,
            MovimientoInventario.fecha >= fecha_mes_anterior
        ).count()
        
        # Calcular crecimiento (simulado si no tienes datos históricos)
        if movimientos_mes > 0:
            crecimiento = 15.3  # Porcentaje positivo si hay movimiento
        else:
            crecimiento = -5.2  # Negativo si no hay actividad
    except:
        crecimiento = 0.0
    
    # Contar pedidos pendientes (órdenes de compra activas)
    try:
        # Como no tenemos modelo OrdenCompra, simulamos
        pedidos_pendientes = 0
    except:
        pedidos_pendientes = 0
    
    # Contar alertas activas
    alertas_activas = 0
    
    # Alerta 1: Productos por agotarse
    if productos_por_agotarse > 0:
        alertas_activas += 1
    
    # Alerta 2: Productos sin stock pero con ventas recientes
    productos_sin_stock = sum(1 for p in productos if p['stock'] == 0)
    if productos_sin_stock > 0:
        alertas_activas += 1
    
    # Alerta 3: Productos con caducidad próxima (si manejas caducidades)
    try:
        from datetime import datetime, timedelta
        fecha_limite = datetime.now() + timedelta(days=30)
        
        productos_por_caducar = LoteInventario.query.filter(
            LoteInventario.producto_id.in_([p['id'] for p in productos]),
            LoteInventario.fecha_caducidad <= fecha_limite,
            LoteInventario.stock > 0,
            LoteInventario.esta_activo == True
        ).count()
        
        if productos_por_caducar > 0:
            alertas_activas += 1
    except:
        pass
    
    print(f"\nRESUMEN GLOBAL:")
    print(f"TOTAL UNIDADES: {total_unidades}")
    print(f"VALOR INVENTARIO: {valor_inventario}")
    print(f"TOTAL PRODUCTOS: {total_productos}")
    print(f"PRODUCTOS POR AGOTARSE: {productos_por_agotarse}")
    print(f"CRECIMIENTO MENSUAL: {crecimiento}%")
    print(f"PEDIDOS PENDIENTES: {pedidos_pendientes}")
    print(f"ALERTAS ACTIVAS: {alertas_activas}")
    print("==== FIN DIAGNÓSTICO ====\n\n")
    
    # Redondear valores para mostrarlo correctamente
    valor_inventario_redondeado = int(round(valor_inventario))
    total_unidades_redondeado = int(round(total_unidades))
    
    # Renderizar template con todos los datos necesarios
    return render_template(
        'dashboard_inventario.html',
        productos=productos,
        total_productos=total_productos,
        total_unidades=total_unidades_redondeado,
        valor_inventario=valor_inventario_redondeado,
        productos_por_agotarse=productos_por_agotarse,
        # Nuevos datos para el dashboard profesional
        crecimiento=crecimiento,
        pedidos_pendientes=pedidos_pendientes,
        alertas_activas=alertas_activas,
        productos_agotarse=productos_por_agotarse  # Para el sidebar
    )

# ==============================
# FUNCIONES PARA EXPORTAR
# ==============================
__all__ = ['dashboard_bp']