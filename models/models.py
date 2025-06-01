print("=== LOADED NEW MODELS WITH USELIST=FALSE ===")

from . import db
from datetime import datetime, date

class Empresa(db.Model):
    __tablename__ = 'empresa'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

    is_admin = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return f"<Empresa {self.nombre} (ID={self.id})>"

class CodigoDisponible(db.Model):
    __tablename__ = 'codigos_disponibles'
    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(50), unique=True, nullable=False)
    esta_activo = db.Column(db.Boolean, default=True)

    def __repr__(self):
        return f"<CodigoDisponible {self.codigo} (ID={self.id}), activo={self.esta_activo}>"

class CodigoAsignado(db.Model):
    __tablename__ = 'codigos_asignados'
    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(50), unique=True, nullable=False)
    esta_activo = db.Column(db.Boolean, default=True)

    # Relación UNO-A-UNO con Empresa
    empresa_id = db.Column(db.Integer, db.ForeignKey('empresa.id'), unique=True)
    empresa = db.relationship(
        'Empresa',
        backref=db.backref('codigo_asignado', uselist=False),
        uselist=False
    )

    def __repr__(self):
        return (f"<CodigoAsignado {self.codigo} (ID={self.id}), "
                f"activo={self.esta_activo}, empresa_id={self.empresa_id}>")

# ===============================
# MODELO 'PRODUCTO' - OPTIMIZADO PARA PUNTO DE VENTA
# ===============================
class Producto(db.Model):
    __tablename__ = 'producto'
    id = db.Column(db.Integer, primary_key=True)

    # Campos básicos
    # AHORA: Se cambió de nullable=False a nullable=True
    nombre = db.Column(db.String(100), nullable=True)
    # MODIFICADO: Cambiado de Integer a Float para permitir cantidades decimales
    stock = db.Column(db.Float, default=0.0)
    costo = db.Column(db.Float, default=0.0)
    precio_venta = db.Column(db.Float, default=0.0)
    
    # ===== NUEVO CAMPO CRÍTICO PARA PUNTO DE VENTA =====
    # Este campo se actualiza automáticamente y siempre contiene el precio real que debe cobrarse
    precio_final = db.Column(db.Float, default=0.0, nullable=False)
    
    categoria = db.Column(db.String(100), nullable=True)

    # Código de barras principal
    codigo_barras = db.Column(db.String(100), nullable=True)

    # Aprobación
    is_approved = db.Column(db.Boolean, default=False)

    # Fecha de creación
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)

    # Relación multi-tenant con Empresa
    empresa_id = db.Column(db.Integer, db.ForeignKey('empresa.id'))
    empresa = db.relationship('Empresa', backref='productos')

    # Lógica de Lotes
    viene_en_lotes = db.Column(db.Boolean, default=False)
    num_lotes = db.Column(db.Integer, default=1)
    mismo_stock_lotes = db.Column(db.Boolean, default=False)
    stock_por_lote = db.Column(db.Integer, default=0)
    unidad_lote = db.Column(db.String(50), default='piezas')

    # Campos de Código de Barras
    usa_codigo_barras = db.Column(db.Boolean, default=False)
    codigo_barras_externo = db.Column(db.String(100), nullable=True)
    codigo_interno = db.Column(db.String(100), nullable=True)

    # Configuración Avanzada
    proveedor = db.Column(db.String(100), nullable=True)
    ubicacion = db.Column(db.String(100), nullable=True)  # NUEVO CAMPO
    # NUEVOS CAMPOS PARA SOLUCIONAR PROBLEMA DE UBICACIONES
    ubicacion_tipo = db.Column(db.String(20), nullable=True)  # 'global', 'categoria', 'marca', 'individual'
    ubicacion_grupo = db.Column(db.String(100), nullable=True)  # Nombre de la categoría o marca si aplica
    
    tasa_impuesto = db.Column(db.Float, default=0.0)
    descuento = db.Column(db.Float, default=0.0)

    # Lógica de Caducidad
    has_caducidad = db.Column(db.Boolean, default=False)
    metodo_caducidad = db.Column(db.String(20), default='producto')
    fecha_caducidad = db.Column(db.Date, nullable=True)
    caducidad_lotes = db.Column(db.JSON, nullable=True)
    caducidad_unidades = db.Column(db.JSON, nullable=True)

    # Campo para foto (subida por el usuario)
    foto = db.Column(db.String(100), nullable=True)

    # NUEVO: color asociado a la categoría
    categoria_color = db.Column(db.String(7), nullable=True)

    # =========================================================================
    # NUEVOS CAMPOS para gestionar info proveniente de Excel sin romper lo anterior
    # =========================================================================

    # 1) url_imagen (para la columna "URL IMAGEN" de Excel)
    url_imagen = db.Column(db.String(300), nullable=True)

    # 2) unidad (para la columna "Unidad" de Excel)
    unidad = db.Column(db.String(50), nullable=True)

    # ¿Es favorito? => Se refleja cuando el corazón está en rojo
    es_favorito = db.Column(db.Boolean, default=False)

    # ¿Está a la venta? => Se refleja con la imagen 1.png (sí) o 2.png (no)
    esta_a_la_venta = db.Column(db.Boolean, default=True)

    # ¿Cambia frecuentemente su precio?
    precio_cambia_frecuentemente = db.Column(db.Boolean, default=False)

    # Marca
    marca = db.Column(db.String(100), nullable=True)

    # Material (campo extra)
    material = db.Column(db.String(100), nullable=True)

    # Alerta cuando queden X (stock bajo)
    alerta_stock = db.Column(db.Integer, default=0)

    # Divisa (mxn, usd, etc.)
    divisa = db.Column(db.String(3), default='mxn')

    # =========================================================================
    # SISTEMA DE DESCUENTOS MEJORADO Y CORREGIDO
    # =========================================================================
    # Indica si el producto tiene un descuento activo 
    tiene_descuento = db.Column(db.Boolean, default=False, nullable=False)
    
    # Tipo de descuento: 'percentage' (porcentaje) o 'fixed' (cantidad fija)
    tipo_descuento = db.Column(db.String(20), nullable=True)
    
    # Valor del descuento (porcentaje o cantidad) - Debe ser positivo
    valor_descuento = db.Column(db.Float, default=0.0, nullable=False)
    
    # Fecha de inicio del descuento (opcional)
    fecha_inicio_descuento = db.Column(db.DateTime, nullable=True)
    
    # Fecha de fin del descuento (opcional)
    fecha_fin_descuento = db.Column(db.DateTime, nullable=True)
    
    # =========================================================================
    # CAMPOS DE RASTREO DE DESCUENTOS (OBLIGATORIOS PARA LA VISUALIZACIÓN CORRECTA)
    # =========================================================================
    
    # Origen del descuento: 'global', 'categoria', 'marca', 'individual'
    # IMPORTANTE: Este campo debe estar siempre presente cuando tiene_descuento=True
    origen_descuento = db.Column(db.String(20), nullable=True)
    
    # ID del grupo que aplica el descuento (nombre de marca o categoría) 
    # IMPORTANTE: Debe contener el nombre de categoría/marca para descuentos por grupo
    descuento_grupo_id = db.Column(db.String(100), nullable=True)
    
    # Fecha cuando se aplicó el descuento (para saber cuál fue el último)
    fecha_aplicacion_descuento = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return (f"<Producto {self.nombre} (ID={self.id}), "
                f"stock={self.stock}, costo={self.costo}, "
                f"precio_venta={self.precio_venta}, precio_final={self.precio_final}, aprobado={self.is_approved}>")
    
    # =========================================================================
    # MÉTODOS OPTIMIZADOS PARA PUNTO DE VENTA
    # =========================================================================
    
    def get_precio_con_descuento(self):
        """
        Calcula el precio final con el descuento aplicado.
        NOTA: Este método ahora es principalmente para validación, 
        ya que precio_final se mantiene actualizado automáticamente.
        """
        if not self.tiene_descuento or self.valor_descuento <= 0:
            return self.precio_venta
            
        if self.tipo_descuento == 'percentage':
            # Aplicar porcentaje (asegurar que no exceda 100%)
            porcentaje = min(self.valor_descuento, 100.0) / 100.0
            return self.precio_venta * (1 - porcentaje)
        else:
            # Aplicar monto fijo (asegurar que no sea negativo)
            return max(0, self.precio_venta - self.valor_descuento)
    
    def actualizar_precio_final(self):
        """
        MÉTODO CRÍTICO: Actualiza el campo precio_final basado en precio_venta y descuentos.
        Este método debe llamarse SIEMPRE que cambien precio_venta o descuentos.
        """
        self.precio_final = self.get_precio_con_descuento()
        return self.precio_final
    
    def cambiar_precio_venta(self, nuevo_precio):
        """
        Método seguro para cambiar el precio de venta.
        Actualiza automáticamente el precio_final.
        """
        self.precio_venta = float(nuevo_precio)
        self.actualizar_precio_final()
        return self.precio_final
    
    def aplicar_descuento(self, valor, tipo='percentage', origen='individual', grupo_id=None):
        """
        Aplica un descuento al producto con todos los campos de rastreo.
        ACTUALIZA AUTOMÁTICAMENTE precio_final.
        
        Args:
            valor (float): Valor del descuento (porcentaje o cantidad fija)
            tipo (str): 'percentage' o 'fixed'
            origen (str): 'global', 'categoria', 'marca', 'individual'
            grupo_id (str): Para descuentos de categoría o marca, el nombre del grupo
        """
        self.tiene_descuento = True
        self.tipo_descuento = tipo
        self.valor_descuento = float(valor)
        self.origen_descuento = origen
        self.descuento_grupo_id = grupo_id
        self.fecha_aplicacion_descuento = datetime.utcnow()
        
        # CRÍTICO: Actualizar precio_final inmediatamente
        self.actualizar_precio_final()
        
        return self.precio_final
    
    def quitar_descuento(self):
        """
        Elimina completamente el descuento del producto.
        ACTUALIZA AUTOMÁTICAMENTE precio_final.
        """
        self.tiene_descuento = False
        self.tipo_descuento = None
        self.valor_descuento = 0.0
        self.origen_descuento = None
        self.descuento_grupo_id = None
        self.fecha_inicio_descuento = None
        self.fecha_fin_descuento = None
        self.fecha_aplicacion_descuento = None
        
        # CRÍTICO: Actualizar precio_final inmediatamente
        self.actualizar_precio_final()
        
        return self.precio_final
    
    # =========================================================================
    # MÉTODOS ÚTILES PARA PUNTO DE VENTA Y TERMINAL
    # =========================================================================
    
    def get_precio_para_terminal(self):
        """
        Método específico para terminales de punto de venta.
        Siempre retorna el precio que debe cobrarse (precio_final).
        """
        return self.precio_final
    
    def get_info_descuento_para_ticket(self):
        """
        Retorna información del descuento formateada para imprimir en tickets.
        """
        if not self.tiene_descuento:
            return None
            
        info = {
            'precio_original': self.precio_venta,
            'precio_final': self.precio_final,
            'ahorro': self.precio_venta - self.precio_final,
            'tipo': self.tipo_descuento,
            'valor': self.valor_descuento
        }
        
        if self.tipo_descuento == 'percentage':
            info['descripcion'] = f"Descuento {self.valor_descuento}%"
        else:
            info['descripcion'] = f"Descuento $-{self.valor_descuento}"
            
        return info
    
    def validar_precio_final(self):
        """
        Valida que precio_final esté sincronizado con precio_venta y descuentos.
        Útil para auditorías y depuración.
        """
        precio_calculado = self.get_precio_con_descuento()
        esta_sincronizado = abs(self.precio_final - precio_calculado) < 0.01  # Tolerancia de 1 centavo
        
        if not esta_sincronizado:
            print(f"⚠️ ADVERTENCIA: Producto {self.id} tiene precio_final desincronizado")
            print(f"   precio_final actual: {self.precio_final}")
            print(f"   precio_final esperado: {precio_calculado}")
            
        return esta_sincronizado
    
    def sincronizar_precio_final(self):
        """
        Fuerza la sincronización del precio_final.
        Útil para corregir inconsistencias.
        """
        precio_anterior = self.precio_final
        self.actualizar_precio_final()
        
        if abs(precio_anterior - self.precio_final) > 0.01:
            print(f"✅ Producto {self.id} sincronizado: {precio_anterior} → {self.precio_final}")
            return True
        return False

    # =========================================================================
    # MÉTODOS PARA MANTENER COMPATIBILIDAD CON CÓDIGO EXISTENTE
    # =========================================================================
    
    @property
    def precio_para_mostrar(self):
        """Alias para compatibilidad - siempre retorna precio_final"""
        return self.precio_final
    
    @property
    def tiene_descuento_activo(self):
        """Verificación rápida si tiene descuento activo"""
        return self.tiene_descuento and self.valor_descuento > 0

# ===============================
# EVENTO AUTOMÁTICO PARA MANTENER precio_final SINCRONIZADO
# ===============================
from sqlalchemy import event

@event.listens_for(Producto.precio_venta, 'set')
def actualizar_precio_final_on_precio_change(target, value, oldvalue, initiator):
    """
    Event listener que actualiza automáticamente precio_final cuando cambia precio_venta.
    Esto asegura que precio_final SIEMPRE esté sincronizado.
    """
    if value != oldvalue:  # Solo actualizar si realmente cambió
        # Usar un callback para actualizar después de que se confirme el cambio
        def callback():
            target.actualizar_precio_final()
        
        # Programar callback para después del commit
        if hasattr(target, '_precio_final_callbacks'):
            target._precio_final_callbacks.append(callback)
        else:
            target._precio_final_callbacks = [callback]
            
@event.listens_for(Producto, 'after_insert')
@event.listens_for(Producto, 'after_update')
def ejecutar_callbacks_precio_final(mapper, connection, target):
    """
    Ejecuta los callbacks de actualización de precio_final después de insert/update.
    """
    if hasattr(target, '_precio_final_callbacks'):
        for callback in target._precio_final_callbacks:
            callback()
        target._precio_final_callbacks = []

# ===============================
# MODELO 'CATÁLOGO GLOBAL'
# ===============================
class CatalogoGlobal(db.Model):
    __tablename__ = 'catalogo_global'
    id = db.Column(db.Integer, primary_key=True)

    codigo_barras = db.Column(db.String(100), unique=True)
    nombre = db.Column(db.String(200))
    marca = db.Column(db.String(100))
    categoria = db.Column(db.String(100))
    url_imagen = db.Column(db.String(300))

    def __repr__(self):
        return f"<CatalogoGlobal {self.codigo_barras} - {self.nombre}>"