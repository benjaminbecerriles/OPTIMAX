# check_product.py
from app import app
from models.models import Producto
from models import db

# Usar contexto de aplicación
with app.app_context():
    # Buscar el producto específico
    producto = Producto.query.filter_by(codigo_barras_externo='190135189929').first()
    
    if producto:
        print("\n=== Detalles del Producto ===")
        print(f"ID: {producto.id}")
        print(f"Nombre: {producto.nombre}")
        print(f"Código: {producto.codigo_barras_externo}")
        print(f"Marca: {producto.marca}")
        
        # Valores numéricos con sus representaciones exactas
        print("\n=== Valores Numéricos ===")
        print(f"Costo: {producto.costo}")
        print(f"Precio almacenado en BD: {producto.precio_venta}")
        print(f"Stock: {producto.stock}")
        
        # NUEVO: Información de descuento
        print("\n=== Información de Descuento ===")
        print(f"Tiene descuento: {producto.tiene_descuento}")
        print(f"Tipo de descuento: {producto.tipo_descuento}")
        print(f"Valor del descuento: {producto.valor_descuento}")
        
        # Cálculo del precio según el descuento
        if producto.tiene_descuento:
            if producto.tipo_descuento == 'percentage':
                precio_con_descuento = producto.precio_venta * (1 - producto.valor_descuento / 100)
                print(f"\nSi el precio BD es BASE:")
                print(f"  Precio base: ${producto.precio_venta:.2f}")
                print(f"  Descuento: {producto.valor_descuento}%")
                print(f"  Precio con descuento: ${precio_con_descuento:.2f}")
                
                precio_sin_descuento = producto.precio_venta / (1 - producto.valor_descuento / 100)
                print(f"\nSi el precio BD es CON DESCUENTO:")
                print(f"  Precio almacenado (con desc): ${producto.precio_venta:.2f}")
                print(f"  Precio base original: ${precio_sin_descuento:.2f}")
                print(f"  Descuento: {producto.valor_descuento}%")
            else:
                precio_con_descuento = max(0, producto.precio_venta - producto.valor_descuento)
                print(f"\nSi el precio BD es BASE:")
                print(f"  Precio base: ${producto.precio_venta:.2f}")
                print(f"  Descuento: ${producto.valor_descuento}")
                print(f"  Precio con descuento: ${precio_con_descuento:.2f}")
                
                precio_sin_descuento = producto.precio_venta + producto.valor_descuento
                print(f"\nSi el precio BD es CON DESCUENTO:")
                print(f"  Precio almacenado (con desc): ${producto.precio_venta:.2f}")
                print(f"  Precio base original: ${precio_sin_descuento:.2f}")
                print(f"  Descuento: ${producto.valor_descuento}")
        else:
            print(f"\nNo hay descuento activo")
            print(f"El precio ${producto.precio_venta:.2f} es el precio final")
        
        # Verificación matemática
        print("\n=== Verificación Matemática ===")
        print(f"Tu dijiste que aplicaste:")
        print(f"  - Precio inicial: $12.00")
        print(f"  - Descuento: 10%")
        print(f"  - Debería ser: $10.80")
        print(f"  - Pero ves: $9.72")
        print(f"  - En BD está: ${producto.precio_venta:.2f}")
        
        if producto.precio_venta == 10.80:
            print("\n✓ El precio en BD es $10.80 (precio con descuento)")
            print("✗ ERROR: El sistema está aplicando el descuento dos veces")
            print("  $10.80 - 10% = $9.72 (lo que ves)")
        elif producto.precio_venta == 12.00:
            print("\n✓ El precio en BD es $12.00 (precio base)")
            print("✓ El sistema está funcionando correctamente")
            print("  $12.00 - 10% = $10.80 (debería ser lo que ves)")
        else:
            print(f"\n⚠️ El precio en BD es ${producto.precio_venta:.2f}")
            print("  Esto no coincide con ninguno de los valores esperados")
        
        # Tipos de datos
        print("\n=== Tipos de Datos ===")
        print(f"Tipo de costo: {type(producto.costo).__name__}")
        print(f"Tipo de precio: {type(producto.precio_venta).__name__}")
        print(f"Tipo de stock: {type(producto.stock).__name__}")
        print(f"Tipo de tiene_descuento: {type(producto.tiene_descuento).__name__}")
        print(f"Tipo de valor_descuento: {type(producto.valor_descuento).__name__}")
        
        # Formato con 2 decimales
        print("\n=== Formato con 2 Decimales ===")
        print(f"Costo con 2 decimales: '${producto.costo:.2f}'")
        print(f"Precio con 2 decimales: '${producto.precio_venta:.2f}'")
    else:
        print("Producto no encontrado")