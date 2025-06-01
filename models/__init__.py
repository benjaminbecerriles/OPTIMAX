# models/__init__.py

# Importar la instancia de db desde database.py en lugar de crear una nueva
from database import db

print("=== LOADED NEW MODELS WITH USELIST=FALSE ===")

# No importes aquí, importa después de que la aplicación esté configurada
def init_models():
    from .models import Empresa, CodigoDisponible, CodigoAsignado
    return Empresa, CodigoDisponible, CodigoAsignado