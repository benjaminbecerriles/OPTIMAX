# check_product.py
from app import app
from models.models import Producto
from models import db

# Usar contexto de aplicación
with app.app_context():
    # Buscar el producto específico
    producto = Producto.query.filter_by(codigo_barras_externo='GRA-0JIPIXQ4').first()
    
    if producto:
        print("\n=== Detalles del Producto ===")
        print(f"ID: {producto.id}")
        print(f"Nombre: {producto.nombre}")
        print(f"Código: {producto.codigo_barras_externo}")
        print(f"Marca: {producto.marca}")
        
        # Valores numéricos con sus representaciones exactas
        print("\n=== Valores Numéricos ===")
        print(f"Costo: {producto.costo}")
        print(f"Precio: {producto.precio_venta}")
        print(f"Stock: {producto.stock}")
        
        # Tipos de datos
        print("\n=== Tipos de Datos ===")
        print(f"Tipo de costo: {type(producto.costo).__name__}")
        print(f"Tipo de precio: {type(producto.precio_venta).__name__}")
        print(f"Tipo de stock: {type(producto.stock).__name__}")
        
        # Representación como cadenas
        print("\n=== Representación como Cadenas ===")
        print(f"Costo como str: '{str(producto.costo)}'")
        print(f"Precio como str: '{str(producto.precio_venta)}'")
        print(f"Stock como str: '{str(producto.stock)}'")
        
        # Formato específico
        print("\n=== Formato con 2 Decimales ===")
        print(f"Costo con 2 decimales: '${producto.costo:.2f}'")
        print(f"Precio con 2 decimales: '${producto.precio_venta:.2f}'")
    else:
        print("Producto no encontrado")