# IMPORTANTE: Este archivo YA usa Numeric(10,2) correctamente
# Todos los campos monetarios tienen precisión de 2 decimales
# Compatible con Mercado Pago y otras terminales de pago

from datetime import datetime, date, timedelta
from models import db
from sqlalchemy import Numeric

class MovimientoInventario(db.Model):
    """
    Modelo para registrar todos los movimientos de inventario.
    Cada entrada o salida se registra como un movimiento.
    """
    __tablename__ = 'movimiento_inventario'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Tipo de movimiento: ENTRADA o SALIDA
    tipo_movimiento = db.Column(db.String(20), nullable=False)
    
    # Cantidad de unidades - NUMERIC para precisión
    cantidad = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    
    # Motivo del movimiento (compra, venta, merma, etc.)
    motivo = db.Column(db.String(100), nullable=True)
    
    # Fecha del movimiento
    fecha_movimiento = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # Costo unitario (solo para ENTRADA) - NUMERIC para precisión
    costo_unitario = db.Column(db.Numeric(10, 2), nullable=True)
    
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

    # Método para formatear la fecha en un formato legible
    def fecha_formateada(self):
        if self.fecha_movimiento:
            return self.fecha_movimiento.strftime('%d/%m/%Y')
        return "Sin fecha"

    # Método para formatear el costo unitario con formato de moneda
    def costo_formateado(self):
        if self.costo_unitario:
            return f"${self.costo_unitario:.2f}"
        return "No aplica"


class LoteInventario(db.Model):
    """
    Modelo para gestionar lotes de inventario.
    Cada lote tiene su propio stock, costo y fecha de caducidad.
    """
    __tablename__ = 'lote_inventario'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Número de lote (formato: "Lote #X" o "Lote de Registro" para el inicial)
    numero_lote = db.Column(db.String(50), nullable=False)
    
    # Costo unitario del lote - NUMERIC para precisión
    costo_unitario = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    
    # Stock actual del lote - NUMERIC para precisión
    stock = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    
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

    # Método para formatear la fecha de entrada
    def fecha_entrada_formateada(self):
        if self.fecha_entrada:
            return self.fecha_entrada.strftime('%d/%m/%Y')
        return "Sin fecha"

    # Método para formatear la fecha de caducidad
    def fecha_caducidad_formateada(self):
        if self.fecha_caducidad:
            return self.fecha_caducidad.strftime('%d/%m/%Y')
        return "No caduca"
        
    # Método para calcular días hasta caducidad
    def dias_hasta_caducidad(self):
        """
        Calcula los días restantes hasta la caducidad del lote.
        
        Returns:
            int: Número de días hasta la caducidad (negativo si ya caducó)
            None: Si no tiene fecha de caducidad
        """
        if not self.fecha_caducidad:
            return None
            
        hoy = date.today()
        if self.fecha_caducidad < hoy:
            return -1 * (hoy - self.fecha_caducidad).days  # Retorna número negativo si ya caducó
            
        delta = self.fecha_caducidad - hoy
        return delta.days
        
    # Método para verificar si el lote está caducado
    def esta_caducado(self):
        """
        Determina si el lote está caducado según su fecha de caducidad.
        
        Returns:
            bool: True si está caducado, False si no lo está o no tiene fecha
        """
        if not self.fecha_caducidad:
            return False
            
        return self.fecha_caducidad < date.today()

    # Método para formatear el costo unitario con formato de moneda
    def costo_formateado(self):
        return f"${self.costo_unitario:.2f}"

    # Método para determinar si es el lote de registro
    def es_lote_registro(self):
        return self.numero_lote == "Lote de Registro"
        
    # Método para obtener un estado de caducidad categorizado
    def estado_caducidad(self):
        """
        Devuelve un estado de caducidad categorizado para usar en la interfaz.
        
        Returns:
            str: 'caducado', 'pronto', 'medio', 'lejano' o 'nocaduca'
        """
        dias = self.dias_hasta_caducidad()
        
        if dias is None:
            return 'nocaduca'
        elif dias < 0:
            return 'caducado'
        elif dias <= 7:
            return 'pronto'
        elif dias <= 30:
            return 'medio'
        else:
            return 'lejano'


class LoteMovimientoRelacion(db.Model):
    """
    Modelo para relacionar movimientos con lotes afectados.
    Permite registrar qué lotes fueron afectados por cada movimiento.
    """
    __tablename__ = 'lote_movimiento_relacion'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Cantidad afectada del lote - NUMERIC para precisión
    cantidad = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    
    # Relaciones
    movimiento_id = db.Column(db.Integer, db.ForeignKey('movimiento_inventario.id'), nullable=False)
    movimiento = db.relationship('MovimientoInventario', backref=db.backref('lotes_afectados_rel', lazy=True))
    
    lote_id = db.Column(db.Integer, db.ForeignKey('lote_inventario.id'), nullable=False)
    lote = db.relationship('LoteInventario', backref=db.backref('movimientos_relacionados_rel', lazy=True))
    
    def __repr__(self):
        return f"<LoteMovimientoRelacion: {self.cantidad} unidades del lote {self.lote_id}>"