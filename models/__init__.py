# models/__init__.py

from flask_sqlalchemy import SQLAlchemy

# Aquí creamos LA instancia única de SQLAlchemy
db = SQLAlchemy()

print("=== LOADED NEW MODELS WITH USELIST=FALSE ===")

# No importes aquí, importa después de que la aplicación esté configurada
def init_models():
    from .models import Empresa, CodigoDisponible, CodigoAsignado
    return Empresa, CodigoDisponible, CodigoAsignado