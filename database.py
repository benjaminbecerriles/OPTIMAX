# database.py
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from utils import ensure_default_images
from config import BASE_DIR, UPLOAD_FOLDER

# Inicializar extensiones de base de datos
db = SQLAlchemy()
migrate = Migrate()

def init_database(app):
    """Inicializa la base de datos y realiza configuraciones iniciales"""
    # Crear todas las tablas si no existen
    with app.app_context():
        db.create_all()
        
        # Asegurar que existan las imágenes predeterminadas
        ensure_default_images(BASE_DIR, UPLOAD_FOLDER)