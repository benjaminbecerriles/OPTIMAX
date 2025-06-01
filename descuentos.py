# descuentos.py
import urllib.parse
from datetime import datetime
from flask import Blueprint, request, render_template, session, redirect, url_for, flash

from database import db
from models.models import Producto
from auth import login_requerido

# Crear el blueprint
descuentos_bp = Blueprint('descuentos', __name__)

# ==============================
# RUTAS DE DESCUENTOS
# ==============================
@descuentos_bp.route('/descuentos')
@login_requerido
def descuentos():
    """Vista para aplicar descuentos a productos."""
    try:
        # Obtener información del usuario
        empresa_id = session.get('user_id')
        
        if not empresa_id:
            flash('Error: Usuario no identificado', 'error')
            return redirect(url_for('auth.login'))
        
        # Obtener lista de productos aprobados
        productos_db = Producto.query.filter_by(
            empresa_id=empresa_id,
            is_approved=True
        ).order_by(Producto.categoria).all()
        
        # Convertir objetos Producto a diccionarios simples - INCLUYENDO NUEVOS CAMPOS
        productos = []
        for p in productos_db:
            try:
                producto_dict = {
                    'id': p.id,
                    'nombre': p.nombre or '',
                    'stock': p.stock or 0,
                    'precio_venta': p.precio_venta or 0,
                    'categoria': p.categoria or '',
                    'categoria_color': p.categoria_color or '#6B7280',
                    'foto': p.foto or 'default_product.jpg',
                    'codigo_barras_externo': p.codigo_barras_externo or '',
                    'marca': p.marca or '',
                    'es_favorito': p.es_favorito or False,
                    'esta_a_la_venta': p.esta_a_la_venta or True,
                    'tiene_descuento': getattr(p, 'tiene_descuento', False),
                    'tipo_descuento': getattr(p, 'tipo_descuento', None),
                    'valor_descuento': float(getattr(p, 'valor_descuento', 0.0)),
                    # NUEVOS CAMPOS DE RASTREO
                    'origen_descuento': getattr(p, 'origen_descuento', None),
                    'descuento_grupo_id': getattr(p, 'descuento_grupo_id', None),
                    'fecha_aplicacion_descuento': getattr(p, 'fecha_aplicacion_descuento', None)
                }
                productos.append(producto_dict)
            except Exception as e:
                print(f"Error procesando producto {p.id}: {str(e)}")
                continue
        
        # Obtener categorías únicas y sus colores
        categorias = []
        categorias_set = set()
        
        for producto in productos_db:
            if producto.categoria and producto.categoria not in categorias_set:
                categorias_set.add(producto.categoria)
                categorias.append({
                    'nombre': producto.categoria,
                    'color': producto.categoria_color or '#6B7280'  # Color por defecto si no tiene
                })
        
        # Ordenar categorías alfabéticamente
        categorias.sort(key=lambda x: x['nombre'])
        
        # Renderizar template con datos simplificados
        return render_template(
            'descuentos.html',
            productos=productos,
            categorias=categorias
        )
        
    except Exception as e:
        print(f"Error en ruta descuentos: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # En caso de error, mostrar mensaje amigable
        flash('Error al cargar la página de descuentos', 'error')
        return redirect(url_for('dashboard.dashboard_inventario'))

@descuentos_bp.route('/descuentos/detalle/<tipo>/<path:grupo_id>')
@login_requerido
def descuentos_detalle(tipo, grupo_id):
    """Muestra los detalles de productos con descuento por tipo y grupo"""
    empresa_id = session['user_id']
    
    # Decodificar grupo_id (puede contener espacios)
    grupo_id = urllib.parse.unquote(grupo_id)
    
    # Filtrar productos según el tipo de descuento
    if tipo == 'global':
        productos = Producto.query.filter_by(
            empresa_id=empresa_id,
            is_approved=True,
            tiene_descuento=True,
            origen_descuento='global'
        ).all()
        titulo = "Descuento Global"
    elif tipo == 'categoria':
        productos = Producto.query.filter_by(
            empresa_id=empresa_id,
            is_approved=True,
            tiene_descuento=True,
            origen_descuento='categoria',
            descuento_grupo_id=grupo_id
        ).all()
        titulo = f"Categoría: {grupo_id}"
    elif tipo == 'marca':
        productos = Producto.query.filter_by(
            empresa_id=empresa_id,
            is_approved=True,
            tiene_descuento=True,
            origen_descuento='marca',
            descuento_grupo_id=grupo_id
        ).all()
        titulo = f"Marca: {grupo_id}"
    else:
        # Por defecto, mostrar productos individuales
        productos = Producto.query.filter_by(
            empresa_id=empresa_id,
            is_approved=True,
            tiene_descuento=True,
            origen_descuento='individual'
        ).all()
        titulo = "Productos Individuales"
    
    return render_template(
        'descuentos_detalle.html',
        productos=productos,
        titulo=titulo,
        tipo=tipo,
        grupo_id=grupo_id
    )

@descuentos_bp.route('/corregir-descuentos', methods=['GET'])
@login_requerido
def corregir_descuentos_vista():
    """Página para corregir descuentos manualmente."""
    try:
        empresa_id = session.get('user_id')
        
        # Corregir productos con tiene_descuento=True pero sin origen_descuento
        productos_para_corregir = Producto.query.filter_by(
            empresa_id=empresa_id,
            tiene_descuento=True
        ).filter(
            (Producto.origen_descuento.is_(None)) | 
            (Producto.origen_descuento == '')
        ).all()
        
        productos_corregidos = 0
        
        for producto in productos_para_corregir:
            producto.origen_descuento = 'individual'
            productos_corregidos += 1
        
        # Obtener productos con descuentos globales
        productos_descuento_global = Producto.query.filter_by(
            empresa_id=empresa_id,
            tiene_descuento=True,
            origen_descuento='global'
        ).all()
        
        # Corregir productos con descuentos de categoría
        productos_categoria = db.session.query(Producto).filter(
            Producto.empresa_id == empresa_id,
            Producto.tiene_descuento == True,
            Producto.origen_descuento == 'categoria',
            Producto.descuento_grupo_id.is_(None)
        ).all()
        
        for producto in productos_categoria:
            producto.descuento_grupo_id = producto.categoria
        
        # Corregir productos con descuentos de marca
        productos_marca = db.session.query(Producto).filter(
            Producto.empresa_id == empresa_id,
            Producto.tiene_descuento == True,
            Producto.origen_descuento == 'marca',
            Producto.descuento_grupo_id.is_(None)
        ).all()
        
        for producto in productos_marca:
            producto.descuento_grupo_id = producto.marca
        
        db.session.commit()
        
        mensaje = f"""
        <html>
        <head>
            <title>Corrección de Descuentos</title>
            <style>
                body {{ font-family: Arial, sans-serif; padding: 20px; }}
                .result {{ margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }}
                .success {{ color: green; }}
                a {{ display: inline-block; margin-top: 20px; padding: 10px 15px; background: #e52e2e; color: white; text-decoration: none; border-radius: 5px; }}
            </style>
        </head>
        <body>
            <h1>Corrección de Descuentos</h1>
            <div class="result">
                <p class="success">✅ Se han corregido {productos_corregidos} productos con descuentos sin origen.</p>
                <p>Productos con descuento global: {len(productos_descuento_global)}</p>
                <p>Productos con descuento por categoría: {len(productos_categoria)}</p>
                <p>Productos con descuento por marca: {len(productos_marca)}</p>
            </div>
            <a href="/descuentos">Volver a Descuentos</a>
        </body>
        </html>
        """
        
        return mensaje
    
    except Exception as e:
        db.session.rollback()
        return f"""
        <h1>Error al corregir descuentos</h1>
        <p>Se produjo un error: {str(e)}</p>
        <p><a href="/descuentos">Volver a Descuentos</a></p>
        """

# ==============================
# FUNCIONES PARA EXPORTAR
# ==============================
__all__ = ['descuentos_bp']