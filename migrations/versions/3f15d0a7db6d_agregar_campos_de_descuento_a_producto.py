"""Agregar campos de descuento a producto

Revision ID: 3f15d0a7db6d
Revises: 64f6e1b535b6
Create Date: 2025-05-10 15:08:25.869933

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3f15d0a7db6d'
down_revision = '64f6e1b535b6'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('producto', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tiene_descuento', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('tipo_descuento', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('valor_descuento', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('fecha_inicio_descuento', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('fecha_fin_descuento', sa.DateTime(), nullable=True))
        batch_op.alter_column('stock',
               existing_type=sa.NUMERIC(precision=10, scale=3),
               type_=sa.Float(),
               existing_nullable=True)

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('producto', schema=None) as batch_op:
        batch_op.alter_column('stock',
               existing_type=sa.Float(),
               type_=sa.NUMERIC(precision=10, scale=3),
               existing_nullable=True)
        batch_op.drop_column('fecha_fin_descuento')
        batch_op.drop_column('fecha_inicio_descuento')
        batch_op.drop_column('valor_descuento')
        batch_op.drop_column('tipo_descuento')
        batch_op.drop_column('tiene_descuento')

    # ### end Alembic commands ###
