# category_colors.py

CATEGORY_COLORS = {
    "abarrotes secos": "#FFA500",
    "enlatados y conservas": "#DAA520",
    "botanas, dulces y snacks": "#FF69B4",
    "bebidas no alcohólicas": "#1E90FF",
    "bebidas alcohólicas": "#800080",
    "panadería y repostería": "#D2B48C",
    "lácteos y huevos": "#F5DEB3",
    "carnes frías y embutidos": "#B22222",
    "congelados y refrigerados": "#00CED1",
    "frutas y verduras frescas": "#32CD32",
    "productos de limpieza y hogar": "#87CEFA",
    "cuidado personal e higiene": "#FFC0CB",
    "medicamentos de mostrador (otc)": "#FF6347",
    "productos para bebés": "#FFB6C1",
    "productos para mascotas": "#8FBC8F",
    "artículos de papelería": "#9370DB",
    "ferretería básica": "#708090",
    "artesanías y manualidades": "#DDA0DD",
    "productos a granel": "#BDB76B",
    "productos orgánicos": "#6B8E23",
    "productos gourmet": "#CD853F",
    "suplementos alimenticios": "#DA70D6",
    "otros (miscelánea)": "#A9A9A9"
}

def get_category_color(category):
    """
    Obtiene el color asociado a una categoría.
    Normaliza la categoría a minúsculas para facilitar la comparación.
    Devuelve un color predeterminado si la categoría no existe.
    """
    if not category:
        return "#A9A9A9"  # Color gris predeterminado para categorías vacías
    
    category = category.lower()
    return CATEGORY_COLORS.get(category, "#A9A9A9")  # Gris por defecto si no se encuentra

def normalize_category(category):
    """
    Normaliza el nombre de la categoría a minúsculas.
    Útil para garantizar consistencia al almacenar categorías en la base de datos.
    """
    if not category:
        return ""
    
    return category.lower().strip()