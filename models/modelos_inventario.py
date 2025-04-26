from datetime import datetime
from models import db

class MovimientoInventario(db.Model):
    """
    Modelo para registrar todos los movimientos de inventario.
    Cada entrada o salida se registra como un movimiento.
    """
    __tablename__ = 'movimiento_inventario'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Tipo de movimiento: ENTRADA o SALIDA
    tipo_movimiento = db.Column(db.String(20), nullable=False)
    
    # Cantidad de unidades
    cantidad = db.Column(db.Float, nullable=False, default=0)
    
    # Motivo del movimiento (compra, venta, merma, etc.)
    motivo = db.Column(db.String(100), nullable=True)
    
    # Fecha del movimiento
    fecha_movimiento = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # Costo unitario (solo para ENTRADA)
    costo_unitario = db.Column(db.Float, nullable=True)
    
    # Número de lote (solo para ENTRADA)
    numero_lote = db.Column(db.String(50), nullable=True)
    
    # Fecha de caducidad (opcional)
    fecha_caducidad = db.Column(db.Date, nullable=True)
    
    # Método de descuento (FIFO, LIFO, etc.) (solo para SALIDA)
    metodo_descuento = db.Column(db.String(20), nullable=True)
    
    # Impacto financiero (solo para SALIDA)
    # True: Se registra como pérdida, False: No afecta finanzas
    impacto_financiero = db.Column(db.Boolean, default=True)
    
    # Notas adicionales
    notas = db.Column(db.Text, nullable=True)
    
    # Comprobante (ruta al archivo)
    comprobante = db.Column(db.String(255), nullable=True)
    
    # Relaciones con otras tablas
    producto_id = db.Column(db.Integer, db.ForeignKey('producto.id'), nullable=False)
    producto = db.relationship('Producto', backref=db.backref('movimientos_inv', lazy=True))
    
    usuario_id = db.Column(db.Integer, db.ForeignKey('empresa.id'), nullable=False)
    usuario = db.relationship('Empresa', backref=db.backref('movimientos_inv', lazy=True))
    
    def __repr__(self):
        return f"<MovimientoInventario {self.id}: {self.tipo_movimiento} de {self.cantidad} unidades>"


class LoteInventario(db.Model):
    """
    Modelo para gestionar lotes de inventario.
    Cada lote tiene su propio stock, costo y fecha de caducidad.
    """
    __tablename__ = 'lote_inventario'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Número de lote (formato: "Lote #X")
    numero_lote = db.Column(db.String(50), nullable=False)
    
    # Costo unitario del lote
    costo_unitario = db.Column(db.Float, nullable=False, default=0)
    
    # Stock actual del lote
    stock = db.Column(db.Float, nullable=False, default=0)
    
    # Fecha de entrada
    fecha_entrada = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # Fecha de caducidad (opcional)
    fecha_caducidad = db.Column(db.Date, nullable=True)
    
    # Estado del lote (activo/inactivo)
    esta_activo = db.Column(db.Boolean, default=True)
    
    # Relación con producto
    producto_id = db.Column(db.Integer, db.ForeignKey('producto.id'), nullable=False)
    producto = db.relationship('Producto', backref=db.backref('lotes_inv', lazy=True))
    
    def __repr__(self):
        return f"<LoteInventario {self.numero_lote}: {self.stock} unidades>"


class LoteMovimientoRelacion(db.Model):
    """
    Modelo para relacionar movimientos con lotes afectados.
    Permite registrar qué lotes fueron afectados por cada movimiento.
    """
    __tablename__ = 'lote_movimiento_relacion'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Cantidad afectada del lote
    cantidad = db.Column(db.Float, nullable=False, default=0)
    
    # Relaciones
    movimiento_id = db.Column(db.Integer, db.ForeignKey('movimiento_inventario.id'), nullable=False)
    movimiento = db.relationship('MovimientoInventario', backref=db.backref('lotes_afectados_rel', lazy=True))
    
    lote_id = db.Column(db.Integer, db.ForeignKey('lote_inventario.id'), nullable=False)
    lote = db.relationship('LoteInventario', backref=db.backref('movimientos_relacionados_rel', lazy=True))
    
    def __repr__(self):
        return f"<LoteMovimientoRelacion: {self.cantidad} unidades del lote {self.lote_id}>"