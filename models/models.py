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
    # NUEVO: CAMPOS PARA SISTEMA DE DESCUENTOS
    # =========================================================================
    # Indica si el producto tiene un descuento activo
    tiene_descuento = db.Column(db.Boolean, default=False)
    
    # Tipo de descuento: 'percentage' (porcentaje) o 'fixed' (cantidad fija)
    tipo_descuento = db.Column(db.String(20), nullable=True)
    
    # Valor del descuento (porcentaje o cantidad)
    valor_descuento = db.Column(db.Float, default=0.0)
    
    # Fecha de inicio del descuento (opcional)
    fecha_inicio_descuento = db.Column(db.DateTime, nullable=True)
    
    # Fecha de fin del descuento (opcional)
    fecha_fin_descuento = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return (f"<Producto {self.nombre} (ID={self.id}), "
                f"stock={self.stock}, costo={self.costo}, "
                f"precio_venta={self.precio_venta}, aprobado={self.is_approved}>")

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