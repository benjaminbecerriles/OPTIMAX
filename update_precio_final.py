# update_precio_final.py
from app import app, db
from models.models import Producto

def actualizar_precios_finales():
    with app.app_context():
        productos = Producto.query.all()
        productos_actualizados = 0
        
        print(f"Actualizando precio_final para {len(productos)} productos...")
        
        for producto in productos:
            try:
                # Calcular precio_final basado en precio_venta y descuentos
                precio_final = producto.precio_venta or 0.0
                
                # Verificar si tiene descuento activo
                if (hasattr(producto, 'tiene_descuento') and producto.tiene_descuento and 
                    hasattr(producto, 'valor_descuento') and producto.valor_descuento and producto.valor_descuento > 0):
                    
                    if hasattr(producto, 'tipo_descuento') and producto.tipo_descuento == 'percentage':
                        # Aplicar descuento porcentual
                        precio_final = producto.precio_venta * (1 - producto.valor_descuento / 100)
                    elif hasattr(producto, 'tipo_descuento') and producto.tipo_descuento == 'fixed':
                        # Aplicar descuento fijo
                        precio_final = max(0, producto.precio_venta - producto.valor_descuento)
                
                # Asignar el precio_final calculado
                producto.precio_final = precio_final
                productos_actualizados += 1
                
                print(f"Producto {producto.id}: {producto.nombre} - Precio base: ${producto.precio_venta:.2f}, Precio final: ${precio_final:.2f}")
                
            except Exception as e:
                print(f"Error actualizando producto {producto.id}: {e}")
                # En caso de error, usar precio_venta como precio_final
                producto.precio_final = producto.precio_venta or 0.0
        
        # Confirmar cambios
        db.session.commit()
        print(f"\n✅ Actualización completada: {productos_actualizados} productos actualizados")

if __name__ == '__main__':
    actualizar_precios_finales()