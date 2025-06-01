# utils.py
import os
import uuid
import shutil
import threading
import requests
from werkzeug.utils import secure_filename
from decimal import Decimal, InvalidOperation

def normalizar_categoria(cat):
    """Elimina acentos, pone en minúscula y quita espacios extras."""
    if not cat:
        return ""
    cat = cat.strip().lower()
    import unicodedata
    cat = unicodedata.normalize("NFKD", cat)
    cat = cat.encode("ascii", "ignore").decode("ascii")
    return cat

def normalize_categoria_if_needed(categoria):
    """
    Normaliza la categoría solo si es necesaria (si no es None).
    Similar a normalizar_categoria pero verifica si es None primero.
    """
    if categoria is None:
        return None
    return normalizar_categoria(categoria)

def generar_color_aleatorio():
    """Genera un color hexadecimal aleatorio."""
    import random
    r = lambda: random.randint(0, 255)
    return f"#{r():02X}{r():02X}{r():02X}"

def obtener_o_generar_color_categoria(cat_norm, db_session=None, Producto=None):
    """Busca un color existente para la categoría o genera uno nuevo."""
    if not cat_norm:
        return None
    
    if db_session and Producto:
        existente = Producto.query.filter_by(categoria=cat_norm).first()
        if existente and existente.categoria_color:
            return existente.categoria_color
    
    return generar_color_aleatorio()

def allowed_file(filename):
    """Verifica si la extensión del archivo es válida."""
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def process_image(request, UPLOAD_FOLDER, BASE_DIR, allowed_file_func=None):
    """
    Función optimizada para manejar imágenes:
    1. Si hay un archivo subido directo, lo usa
    2. Si no hay archivo pero hay displayed_image_url, lo usa
    3. Si hay ia_foto_filename y existe, lo usa
    4. Si todo falla, usa imagen predeterminada por categoría
    """
    if allowed_file_func is None:
        allowed_file_func = allowed_file
        
    # 1. Priorizar archivo subido directamente por el usuario
    file = request.files.get('foto')
    displayed_url = request.form.get("displayed_image_url", "").strip()
    ia_foto_filename = request.form.get("ia_foto_filename", "").strip()
    
    # A. Si hay un archivo subido, úsalo y retorna de inmediato
    if file and file.filename and allowed_file_func(file.filename):
        original_name = secure_filename(file.filename)
        ext = original_name.rsplit('.', 1)[1].lower()
        unique_name = f"{uuid.uuid4().hex}.{ext}"
        
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER)
        filepath = os.path.join(UPLOAD_FOLDER, unique_name)
        file.save(filepath)
        return unique_name
    
    # B. Si hay displayed_url válida, úsala
    if displayed_url:
        # Caso 1: URL local completa (/static/uploads/...)
        if displayed_url.startswith("/static/uploads/"):
            img_filename = displayed_url.split("/uploads/")[1]
            if os.path.exists(os.path.join(UPLOAD_FOLDER, img_filename)):
                return img_filename
        
        # Caso 2: Solo nombre de archivo
        elif "/" not in displayed_url:
            if os.path.exists(os.path.join(UPLOAD_FOLDER, displayed_url)):
                return displayed_url
        
        # Caso 3: URL externa - usa cache si posible
        elif displayed_url.startswith(("http://", "https://")):
            # Extraer nombre si existe en URL
            filename = os.path.basename(displayed_url.split("?")[0])
            if not filename or not allowed_file_func(filename):
                # Generar nombre aleatorio
                ext = "jpg"  # Default 
                filename = f"{uuid.uuid4().hex}.{ext}"
            
            # Verificar si ya existe (cacheada)
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            if not os.path.exists(filepath):
                # Intento rápido de descarga sin bloquear
                try:
                    r = requests.get(displayed_url, timeout=3.0)
                    if r.status_code == 200:
                        os.makedirs(os.path.dirname(filepath), exist_ok=True)
                        with open(filepath, 'wb') as f:
                            f.write(r.content)
                        return filename
                except:
                    pass  # Si falla, continúa sin error
            else:
                return filename
    
    # C. Si hay ia_foto_filename y existe físicamente, úsalo
    if ia_foto_filename:
        ia_filepath = os.path.join(UPLOAD_FOLDER, ia_foto_filename)
        if os.path.exists(ia_filepath):
            return ia_foto_filename
    
    # D. Usar imagen predeterminada según categoría
    categoria_norm = request.form.get("categoria_existente", "otros").lower()
    
    if "botanas" in categoria_norm or "dulces" in categoria_norm or "snacks" in categoria_norm:
        default_img = "default_snack.jpg"
    elif "bebidas" in categoria_norm:
        default_img = "default_drink.jpg"
    elif "frutas" in categoria_norm or "verduras" in categoria_norm:
        default_img = "default_fruit.jpg"
    else:
        default_img = "default_product.jpg"
    
    # Verificar que existe o copiar desde static/img a uploads
    default_path = os.path.join(BASE_DIR, 'static', 'img', default_img)
    if os.path.exists(default_path):
        dest_path = os.path.join(UPLOAD_FOLDER, default_img)
        if not os.path.exists(dest_path):
            shutil.copy2(default_path, dest_path)
        return default_img
    
    return None  # Si todo falla

def download_image_optimized(url, filepath, timeout=5.0):
    """Versión optimizada de descarga de imágenes."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8"
    }
    
    try:
        # Descarga con timeout corto para no bloquear
        response = requests.get(url, headers=headers, stream=True, timeout=timeout)
        if response.status_code == 200:
            if not os.path.exists(os.path.dirname(filepath)):
                os.makedirs(os.path.dirname(filepath), exist_ok=True)
            
            with open(filepath, "wb") as f:
                for chunk in response.iter_content(1024):
                    f.write(chunk)
            return True
    except Exception as e:
        print(f"Error descargando imagen {url}: {e}")
    
    return False

def async_download_image(url, filepath):
    """Descarga una imagen en un hilo separado."""
    def worker():
        download_image_optimized(url, filepath)
    
    thread = threading.Thread(target=worker)
    thread.daemon = True
    thread.start()

def parse_money(value_str):
    """
    Convierte un string con formato monetario a Decimal con precisión de 2 decimales.
    Compatible con el sistema de precisión decimal usado en ajuste_stock.py.
    
    Ejemplos:
        "$100.50" -> Decimal('100.50')
        "$1,234.56" -> Decimal('1234.56')
        "45.7" -> Decimal('45.70')
        "" -> Decimal('0.00')
    """
    if not value_str or value_str == '':
        return Decimal('0.00')
    
    # Convertir a string si no lo es
    value_str = str(value_str).strip()
    
    # Remover símbolo de moneda si existe
    if value_str.startswith("$"):
        value_str = value_str[1:]
    
    # Remover comas de miles
    value_str = value_str.replace(",", "")
    
    # Manejar cadena vacía después de limpiar
    if not value_str:
        return Decimal('0.00')
    
    try:
        # Crear Decimal y redondear a 2 decimales
        decimal_value = Decimal(value_str)
        # Quantize asegura exactamente 2 decimales
        return decimal_value.quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        # Si falla la conversión, retornar 0.00
        return Decimal('0.00')

def ensure_default_images(BASE_DIR, UPLOAD_FOLDER):
    """Asegura que todas las imágenes predeterminadas estén disponibles."""
    default_images = {
        "default_product.jpg",
        "default_snack.jpg",
        "default_drink.jpg",
        "default_fruit.jpg"
    }
    
    # Crear directorios si no existen
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(os.path.join(BASE_DIR, 'static', 'img'), exist_ok=True)
    
    # Verificar y copiar imágenes predeterminadas
    for img_file in default_images:
        src_path = os.path.join(BASE_DIR, 'static', 'img', img_file)
        dest_path = os.path.join(UPLOAD_FOLDER, img_file)
        
        # Si existe en origen pero no en destino, copiar
        if os.path.exists(src_path) and not os.path.exists(dest_path):
            shutil.copy2(src_path, dest_path)

def optimize_db_session(db_session):
    """Optimiza la sesión de base de datos para operaciones pesadas."""
    # Desactivar autoflush para mejorar rendimiento
    db_session.autoflush = False
    # Usar expire_on_commit=False para reutilizar objetos
    db_session.expire_on_commit = False
    return db_session

def cleanup_db_session(db_session):
    """Limpia la sesión después de operaciones grandes."""
    # Remover objetos de la sesión para evitar overhead
    db_session.expire_all()

def find_similar_product_image(nombre, db_session, Producto):
    """Busca imágenes en productos con nombres similares."""
    try:
        return db_session.query(Producto).filter(
            Producto.nombre.ilike(f"%{nombre}%"),
            Producto.foto.isnot(None),
            Producto.foto != ''
        ).first()
    except:
        return None

def find_similar_catalog_image(nombre, db_session, CatalogoGlobal):
    """Busca imágenes en el catálogo global con nombres similares."""
    try:
        return db_session.query(CatalogoGlobal).filter(
            CatalogoGlobal.nombre.ilike(f"%{nombre}%"),
            CatalogoGlobal.url_imagen.isnot(None),
            CatalogoGlobal.url_imagen != ''
        ).first()
    except:
        return None