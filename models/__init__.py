# models/__init__.py

from flask_sqlalchemy import SQLAlchemy

# Aquí creamos LA instancia única de SQLAlchemy
db = SQLAlchemy()

print("=== LOADED NEW MODELS WITH USELIST=FALSE ===")

# Luego importamos los modelos, que usarán 'db' desde aquí
from .models import Empresa, CodigoDisponible, CodigoAsignado
