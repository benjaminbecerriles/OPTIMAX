"""Manual add inventory tables

Revision ID: manual_add_inventory
Create Date: 2025-04-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'manual_add_inventory'
down_revision = '9e40d6e8d87a'  # Usa el ID de tu última migración exitosa
branch_labels = None
depends_on = None


def upgrade():
    # Crear tabla movimiento_inventario
    op.create_table('movimiento_inventario',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('tipo_movimiento', sa.String(length=20), nullable=False),
    sa.Column('cantidad', sa.Float(), nullable=False),
    sa.Column('motivo', sa.String(length=100), nullable=True),
    sa.Column('fecha_movimiento', sa.DateTime(), nullable=False),
    sa.Column('costo_unitario', sa.Float(), nullable=True),
    sa.Column('numero_lote', sa.String(length=50), nullable=True),
    sa.Column('fecha_caducidad', sa.Date(), nullable=True),
    sa.Column('metodo_descuento', sa.String(length=20), nullable=True),
    sa.Column('impacto_financiero', sa.Boolean(), nullable=True),
    sa.Column('notas', sa.Text(), nullable=True),
    sa.Column('comprobante', sa.String(length=255), nullable=True),
    sa.Column('producto_id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['producto_id'], ['producto.id'], ),
    sa.ForeignKeyConstraint(['usuario_id'], ['empresa.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # Crear tabla lote_inventario
    op.create_table('lote_inventario',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('numero_lote', sa.String(length=50), nullable=False),
    sa.Column('costo_unitario', sa.Float(), nullable=False),
    sa.Column('stock', sa.Float(), nullable=False),
    sa.Column('fecha_entrada', sa.DateTime(), nullable=False),
    sa.Column('fecha_caducidad', sa.Date(), nullable=True),
    sa.Column('esta_activo', sa.Boolean(), nullable=True),
    sa.Column('producto_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['producto_id'], ['producto.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # Crear tabla lote_movimiento_relacion
    op.create_table('lote_movimiento_relacion',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('cantidad', sa.Float(), nullable=False),
    sa.Column('movimiento_id', sa.Integer(), nullable=False),
    sa.Column('lote_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['lote_id'], ['lote_inventario.id'], ),
    sa.ForeignKeyConstraint(['movimiento_id'], ['movimiento_inventario.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('lote_movimiento_relacion')
    op.drop_table('lote_inventario')
    op.drop_table('movimiento_inventario')