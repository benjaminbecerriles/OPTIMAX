# admin.py
import random
import string
from flask import Blueprint, render_template, redirect, url_for

from database import db
from models.models import Empresa, CodigoDisponible, CodigoAsignado
from auth import admin_requerido

# Crear el blueprint
admin_bp = Blueprint('admin', __name__)

# ==============================
# FUNCIONES AUXILIARES
# ==============================
def generar_codigo():
    letras = string.ascii_uppercase + string.digits
    return ''.join(random.choice(letras) for _ in range(8))

# ==============================
# RUTAS DE ADMINISTRACIÓN
# ==============================
@admin_bp.route('/admin')
@admin_requerido
def admin_panel():
    return render_template('admin.html')

@admin_bp.route('/admin/empresas')
@admin_requerido
def admin_empresas():
    empresas = Empresa.query.all()
    return render_template('admin_empresas.html', empresas=empresas)

@admin_bp.route('/admin/codigos-disponibles')
@admin_requerido
def admin_disponibles():
    codigos = CodigoDisponible.query.all()
    return render_template('admin_disponibles.html', codigos=codigos)

@admin_bp.route('/admin/generar-disponible')
@admin_requerido
def generar_disponible():
    nuevo = CodigoDisponible(codigo=generar_codigo(), esta_activo=True)
    db.session.add(nuevo)
    db.session.commit()
    return redirect(url_for('admin.admin_disponibles'))

@admin_bp.route('/admin/eliminar-disponible/<int:cod_id>')
@admin_requerido
def eliminar_disponible(cod_id):
    cod = CodigoDisponible.query.get_or_404(cod_id)
    db.session.delete(cod)
    db.session.commit()
    return redirect(url_for('admin.admin_disponibles'))

@admin_bp.route('/admin/codigos-asignados')
@admin_requerido
def admin_asignados():
    codigos = CodigoAsignado.query.all()
    return render_template('admin_asignados.html', codigos=codigos)

@admin_bp.route('/admin/toggle-asignado/<int:cod_id>')
@admin_requerido
def toggle_asignado(cod_id):
    cod = CodigoAsignado.query.get_or_404(cod_id)
    cod.esta_activo = not cod.esta_activo
    db.session.commit()
    return redirect(url_for('admin.admin_asignados'))

# ==============================
# FUNCIONES PARA EXPORTAR
# ==============================
__all__ = ['admin_bp', 'generar_codigo']