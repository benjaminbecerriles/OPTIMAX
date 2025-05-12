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
# MODELO 'PRODUCTO'
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
    ubicacion = db.Column(db.String(100), nullable=True)
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
                f"precio_venta={self.precio_venta}, aprobado={self.is_approved}>")
    
    # Método para obtener el precio con descuento aplicado
    def get_precio_con_descuento(self):
        """Calcula el precio final con el descuento aplicado."""
        if not self.tiene_descuento or self.valor_descuento <= 0:
            return self.precio_venta
            
        if self.tipo_descuento == 'percentage':
            # Aplicar porcentaje (asegurar que no exceda 100%)
            porcentaje = min(self.valor_descuento, 100.0) / 100.0
            return self.precio_venta * (1 - porcentaje)
        else:
            # Aplicar monto fijo (asegurar que no sea negativo)
            return max(0, self.precio_venta - self.valor_descuento)
    
    # Método para aplicar un descuento
    def aplicar_descuento(self, valor, tipo='percentage', origen='individual', grupo_id=None):
        """
        Aplica un descuento al producto con todos los campos de rastreo.
        
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
    
    # Método para quitar el descuento
    def quitar_descuento(self):
        """Elimina completamente el descuento del producto."""
        self.tiene_descuento = False
        self.tipo_descuento = None
        self.valor_descuento = 0.0
        self.origen_descuento = None
        self.descuento_grupo_id = None
        self.fecha_inicio_descuento = None
        self.fecha_fin_descuento = None
        self.fecha_aplicacion_descuento = None

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