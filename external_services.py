# external_services.py
import os
import random
import requests
import urllib.parse
from werkzeug.utils import secure_filename
from config import SERPAPI_API_KEY, OPENAI_API_KEY, UPLOAD_FOLDER, ALLOWED_EXTENSIONS
import openai

# Configurar OpenAI
openai.api_key = OPENAI_API_KEY

# ==============================
# FUNCIONES DE BÚSQUEDA DE IMÁGENES
# ==============================
def download_image_with_headers(url, filepath):
    """
    Intenta descargar una imagen con diferentes cabeceras y agentes de usuario.
    Algunas páginas bloquean descargas sin un User-Agent adecuado.
    """
    headers_list = [
        # Firefox en Windows
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
            "Accept": "image/jpeg, image/png, image/*;q=0.8",
            "Referer": url
        },
        # Chrome en Mac
        {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        },
        # Safari en iPhone
        {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
        }
    ]
    
    for headers in headers_list:
        try:
            print(f"DEBUG: Intentando descargar {url} con cabeceras: {headers}")
            response = requests.get(url, headers=headers, stream=True, timeout=10)
            if response.status_code == 200:
                if not os.path.exists(os.path.dirname(filepath)):
                    os.makedirs(os.path.dirname(filepath))
                
                with open(filepath, "wb") as f:
                    for chunk in response.iter_content(1024):
                        f.write(chunk)
                print(f"DEBUG: Descarga exitosa para {url}")
                return True
            print(f"DEBUG: Error al descargar {url}, código {response.status_code}")
        except Exception as e:
            print(f"DEBUG: Excepción al descargar {url}: {e}")
    
    return False

def buscar_imagen_google_images(nombre_producto, codigo_barras_externo=None):
    """
    Uso de SerpAPI (engine=google_images) para buscar imagen y guardarla localmente.
    """
    query = nombre_producto
    if codigo_barras_externo and not codigo_barras_externo.startswith("INT-"):
        query += f" {codigo_barras_externo}"

    params = {
        "engine": "google_images",
        "q": query,
        "api_key": SERPAPI_API_KEY,
        "ijn": "0",
        "num": "9"
    }
    print(f"Buscando imagen en Google Images para: {query}")
    print(f"URL SerpAPI: https://serpapi.com/search?{urllib.parse.urlencode(params)}")
    
    try:
        response = requests.get("https://serpapi.com/search", params=params)
        # Verificar el código de estado HTTP
        if response.status_code != 200:
            print(f"Error: SerpAPI devolvió código {response.status_code}")
            print(f"Respuesta: {response.text}")
            return None
            
        data = response.json()
        
        # Verificar si hay un error en la respuesta JSON
        if "error" in data:
            print(f"Error de SerpAPI: {data['error']}")
            return None
            
        # Verificar si hay resultados de imágenes
        images = data.get("images_results", [])
        if not images:
            print("No se encontraron imágenes para esta consulta")
            return None
            
        # Usar la primera imagen encontrada
        first_image = images[0]
        image_url = first_image.get("thumbnail") or first_image.get("original")
        
        if not image_url:
            print("URL de imagen no encontrada en la respuesta")
            return None
            
        # Descargar la imagen
        print(f"Intentando descargar imagen desde: {image_url}")
        ext = image_url.rsplit('.', 1)[-1].split('?')[0]
        if ext not in ALLOWED_EXTENSIONS:
            ext = "jpg"
        filename = secure_filename(f"{random.randint(100000,999999)}.{ext}")
        
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        # Intentar descargar con diferentes cabeceras
        if download_image_with_headers(image_url, filepath):
            print("Imagen descargada y guardada como:", filename)
            return filename
        else:
            print(f"No se pudo descargar la imagen desde {image_url}")
            return None
    except Exception as e:
        print(f"Error completo al buscar imagen con google_images: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

# ==============================
# FUNCIONES GPT (OPCIONAL)
# ==============================
def buscar_titulos_serpapi(codigo_barras):
    """(Opcional) Búsqueda en Google con SerpAPI para extraer títulos de resultados orgánicos."""
    params = {
        "engine": "google",
        "q": codigo_barras,
        "api_key": SERPAPI_API_KEY,
        "hl": "es",
        "num": "10"
    }
    resp = requests.get("https://serpapi.com/search", params=params)
    data = resp.json()
    titles = []
    if "organic_results" in data:
        for item in data["organic_results"]:
            t = item.get("title")
            if t:
                titles.append(t)
    print(f"\n=== DEBUG SERPAPI TITLES PARA: {codigo_barras} ===")
    for t in titles:
        print(" -", t)
    print("=== FIN LISTADO TITULOS ===\n")
    return titles

def gpt_extraer_nombre_categoria(titulos):
    """
    (Opcional) Usa GPT para determinar nombre y categoría a partir de títulos de Google.
    """
    if not titulos:
        return {"nombre": "Producto IA", "categoria": "General"}
    prompt = f"""
Los siguientes títulos provienen de una búsqueda en Google sobre un código de barras:

{titulos}

Por favor, deduce un posible nombre de producto y una categoría.
Si no hay información clara, inventa algo genérico.
Devuélveme un JSON con claves "nombre" y "categoria".
Ejemplo: {{"nombre": "Coca Cola 600 ml", "categoria": "Bebidas"}}
"""
    try:
        print("\n=== Llamando a GPT con estos títulos: ===")
        for t in titulos:
            print(" -", t)
        print("=== FIN LISTADO TITULOS ===\n")
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.3
        )
        content = response.choices[0].message.content.strip()
        import json
        data = json.loads(content)
        nombre = data.get("nombre", "Producto IA")
        categoria = data.get("categoria", "General")
        return {"nombre": nombre, "categoria": categoria}
    except Exception as e:
        print("Error GPT:", e)
        return {"nombre": "Producto IA", "categoria": "General"}

def buscar_nombre_categoria_por_barcode(codigo_barras):
    titulos = buscar_titulos_serpapi(codigo_barras)
    return gpt_extraer_nombre_categoria(titulos)

# ==============================
# SINCRONIZACIÓN CON GOOGLE SHEETS
# ==============================
def sync_gsheet_to_catalogo():
    from sheets import leer_hoja  # Asegúrate de tener 'sheets.py' con leer_hoja()
    from models.models import CatalogoGlobal
    from database import db
    
    data = leer_hoja("Hoja 1!A2:F")
    if not data:
        print("No hay filas en la hoja de Google.")
        return

    codigos_sheet = set()
    for row in data:
        if len(row) < 6:
            continue
        codigo = row[0].strip()
        nombre = row[1].strip()
        marca = row[2].strip()
        categoria = row[3].strip()
        unidad = row[4].strip()
        url_img = row[5].strip()

        # Truncar URL si es demasiado larga para evitar errores
        from productos import truncar_url
        url_img = truncar_url(url_img, 295)  # Usar 295 para la columna de 300 caracteres

        codigos_sheet.add(codigo)

        ref = CatalogoGlobal.query.filter_by(codigo_barras=codigo).first()
        if ref:
            ref.nombre = nombre
            ref.marca = marca
            ref.categoria = categoria
            ref.url_imagen = url_img
            print(f"Actualizando {codigo} -> {nombre}")
        else:
            nuevo = CatalogoGlobal(
                codigo_barras=codigo,
                nombre=nombre,
                marca=marca,
                categoria=categoria,
                url_imagen=url_img
            )
            db.session.add(nuevo)
            print(f"Creando {codigo} -> {nombre}")

    db.session.commit()

    # Elimina lo que ya no existe en la Hoja
    todos = CatalogoGlobal.query.all()
    for ref in todos:
        if ref.codigo_barras not in codigos_sheet:
            db.session.delete(ref)
            print(f"Borrando {ref.codigo_barras}, ya no está en la hoja.")
    db.session.commit()