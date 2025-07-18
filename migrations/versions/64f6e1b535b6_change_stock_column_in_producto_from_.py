"""Change stock column in Producto from Integer to Float

Revision ID: 64f6e1b535b6
Revises: manual_add_inventory
Create Date: 2025-04-28 13:31:49.883862

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '64f6e1b535b6'
down_revision = 'manual_add_inventory'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('movimiento_stock')
    op.drop_table('lote')
    with op.batch_alter_table('producto', schema=None) as batch_op:
        batch_op.alter_column('stock',
               existing_type=sa.INTEGER(),
               type_=sa.Float(),
               existing_nullable=True)
        batch_op.alter_column('foto',
               existing_type=sa.VARCHAR(length=300),
               type_=sa.String(length=100),
               existing_nullable=True)
        batch_op.alter_column('url_imagen',
               existing_type=sa.VARCHAR(length=500),
               type_=sa.String(length=300),
               existing_nullable=True)

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('producto', schema=None) as batch_op:
        batch_op.alter_column('url_imagen',
               existing_type=sa.String(length=300),
               type_=sa.VARCHAR(length=500),
               existing_nullable=True)
        batch_op.alter_column('foto',
               existing_type=sa.String(length=100),
               type_=sa.VARCHAR(length=300),
               existing_nullable=True)
        batch_op.alter_column('stock',
               existing_type=sa.Float(),
               type_=sa.INTEGER(),
               existing_nullable=True)

    op.create_table('lote',
    sa.Column('id', sa.INTEGER(), server_default=sa.text("nextval('lote_id_seq'::regclass)"), autoincrement=True, nullable=False),
    sa.Column('producto_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('numero_lote', sa.VARCHAR(length=20), autoincrement=False, nullable=False),
    sa.Column('cantidad_inicial', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('cantidad_actual', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('costo_unitario', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('fecha_caducidad', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('fecha_creacion', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
    sa.Column('proveedor', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('ubicacion', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('observaciones', sa.TEXT(), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['producto_id'], ['producto.id'], name='lote_producto_id_fkey'),
    sa.PrimaryKeyConstraint('id', name='lote_pkey'),
    postgresql_ignore_search_path=False
    )
    op.create_table('movimiento_stock',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('producto_id', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('lote_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('tipo_movimiento', sa.VARCHAR(length=20), autoincrement=False, nullable=False),
    sa.Column('cantidad', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('motivo', sa.VARCHAR(length=50), autoincrement=False, nullable=True),
    sa.Column('costo_unitario', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
    sa.Column('fecha_movimiento', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
    sa.Column('empresa_id', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('responsable', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.Column('observaciones', sa.TEXT(), autoincrement=False, nullable=True),
    sa.Column('referencia_externa', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['empresa_id'], ['empresa.id'], name='movimiento_stock_empresa_id_fkey'),
    sa.ForeignKeyConstraint(['lote_id'], ['lote.id'], name='movimiento_stock_lote_id_fkey'),
    sa.ForeignKeyConstraint(['producto_id'], ['producto.id'], name='movimiento_stock_producto_id_fkey'),
    sa.PrimaryKeyConstraint('id', name='movimiento_stock_pkey')
    )
    # ### end Alembic commands ###
