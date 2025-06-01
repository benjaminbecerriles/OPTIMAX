# auth.py
from flask import Blueprint, request, render_template, session, redirect, url_for, flash
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from models import db
from models.models import Empresa, CodigoDisponible, CodigoAsignado

# Crear el blueprint
auth_bp = Blueprint('auth', __name__)

# ==============================
# DECORADORES DE AUTENTICACIÓN
# ==============================
def login_requerido(f):
    @wraps(f)
    def wrap(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return wrap

def admin_requerido(f):
    @wraps(f)
    def wrap(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('auth.login'))
        empresa_id = session.get('user_id')
        emp = Empresa.query.get(empresa_id)
        if not emp or not emp.is_admin:
            return "No tienes permisos de administrador."
        return f(*args, **kwargs)
    return wrap

# ==============================
# RUTAS DE AUTENTICACIÓN
# ==============================
@auth_bp.route('/registro', methods=['GET','POST'])
def registro():
    if request.method == 'POST':
        nombre = request.form['nombre']
        email = request.form['email']
        password = request.form['password']
        codigo_ingresado = request.form.get('codigo', '')

        hashed_pw = generate_password_hash(password)
        nueva_empresa = Empresa(nombre=nombre, email=email, password=hashed_pw)
        db.session.add(nueva_empresa)
        db.session.commit()

        if codigo_ingresado:
            cod_disp = CodigoDisponible.query.filter_by(codigo=codigo_ingresado, esta_activo=True).first()
            if cod_disp:
                db.session.delete(cod_disp)
                nuevo_asig = CodigoAsignado(codigo=codigo_ingresado, esta_activo=True, empresa_id=nueva_empresa.id)
                db.session.add(nuevo_asig)
                db.session.commit()
        return redirect(url_for('auth.login'))
    return render_template('registro.html')

@auth_bp.route('/login', methods=['GET','POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        pw = request.form['password']
        emp = Empresa.query.filter_by(email=email).first()
        if not emp:
            return "Email no encontrado."
        if not check_password_hash(emp.password, pw):
            return "Contraseña incorrecta."

        session['logged_in'] = True
        session['user_id'] = emp.id
        session['user_name'] = emp.nombre

        if emp.is_admin:
            return redirect(url_for('admin_panel'))

        cod_asig = CodigoAsignado.query.filter_by(empresa_id=emp.id, esta_activo=True).first()
        if not cod_asig:
            return redirect(url_for('ingresar_codigo'))

        return redirect(url_for('dashboard_home'))
    return render_template('login.html')

@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@auth_bp.route('/ingresar-codigo', methods=['GET','POST'])
def ingresar_codigo():
    if not session.get('user_id'):
        return "Debes iniciar sesión primero para asignar tu código."
    emp = Empresa.query.get(session['user_id'])
    if not emp:
        return "No se encontró la empresa en la BD."

    if request.method == 'POST':
        codigo_ingresado = request.form['codigo']
        cod_disp = CodigoDisponible.query.filter_by(codigo=codigo_ingresado, esta_activo=True).first()
        if not cod_disp:
            return "Código inválido o inactivo."
        db.session.delete(cod_disp)
        nuevo_asig = CodigoAsignado(codigo=codigo_ingresado, esta_activo=True, empresa_id=emp.id)
        db.session.add(nuevo_asig)
        db.session.commit()
        return "¡Código asignado exitosamente! Ahora ya puedes usar el sistema."

    return render_template('ingresar_codigo.html')

# ==============================
# FUNCIONES PARA EXPORTAR
# ==============================
# Estas funciones se exportan para ser usadas por otros módulos
__all__ = ['auth_bp', 'login_requerido', 'admin_requerido']