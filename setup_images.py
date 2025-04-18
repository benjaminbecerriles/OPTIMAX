#!/usr/bin/env python
# setup_images.py
# Ejecutar este script para preparar las imágenes predeterminadas

import os
import sys
import shutil
import requests
from PIL import Image, ImageDraw, ImageFont

# Asegúrate de que existan estas carpetas
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, 'static', 'uploads')
IMAGES_DIR = os.path.join(BASE_DIR, 'static', 'img')

# Crea las carpetas si no existen
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)

# Lista de imágenes predeterminadas para crear
DEFAULT_IMAGES = [
    {
        'name': 'default_product.jpg',
        'text': 'Producto',
        'color': '#EEEEEE',
        'text_color': '#333333'
    },
    {
        'name': 'default_snack.jpg',
        'text': 'Botana/Snack',
        'color': '#FFE4B5',  # Melocotón claro
        'text_color': '#D2691E'  # Marrón chocolate
    },
    {
        'name': 'default_drink.jpg',
        'text': 'Bebida',
        'color': '#E0F7FA',  # Azul muy claro
        'text_color': '#0097A7'  # Cian oscuro
    },
    {
        'name': 'default_fruit.jpg',
        'text': 'Fruta/Verdura',
        'color': '#E8F5E9',  # Verde muy claro
        'text_color': '#2E7D32'  # Verde oscuro
    }
]

def create_default_image(config, size=(400, 400)):
    """Crea una imagen simple con texto centrado"""
    img = Image.new('RGB', size, config['color'])
    draw = ImageDraw.Draw(img)
    
    # Intenta cargar una fuente, o usa la predeterminada
    try:
        # Busca una fuente en el sistema (ajusta según el OS)
        font_paths = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',  # Linux
            '/Library/Fonts/Arial Bold.ttf',  # macOS
            'C:\\Windows\\Fonts\\arialbd.ttf'  # Windows
        ]
        
        font = None
        for path in font_paths:
            if os.path.exists(path):
                font = ImageFont.truetype(path, 36)
                break
                
        if not font:
            font = ImageFont.load_default()
            
    except Exception:
        # Si falla, usa la fuente predeterminada
        font = ImageFont.load_default()
    
    # Obtén el tamaño del texto y centra
    try:
        # Pillow > 10.0.0
        text_width = draw.textlength(config['text'], font=font)
    except AttributeError:
        # Pillow < 10.0.0 (versiones anteriores)
        text_width, _ = draw.textsize(config['text'], font=font)
    
    text_height = 36  # Aproximado para la altura del texto
    position = ((size[0] - text_width) // 2, (size[1] - text_height) // 2)
    
    # Dibuja el texto
    draw.text(position, config['text'], fill=config['text_color'], font=font)
    
    # Guardar la imagen
    img_path = os.path.join(IMAGES_DIR, config['name'])
    img.save(img_path, "JPEG", quality=95)
    
    # También copia a uploads
    uploads_path = os.path.join(UPLOADS_DIR, config['name'])
    img.save(uploads_path, "JPEG", quality=95)
    
    print(f"✓ Creada imagen predeterminada: {config['name']}")
    return img_path

def main():
    """Crea todas las imágenes predeterminadas"""
    print("\n📸 Configurando imágenes predeterminadas para productos...")
    
    for img_config in DEFAULT_IMAGES:
        create_default_image(img_config)
    
    print("\n✅ Imágenes predeterminadas creadas correctamente en:")
    print(f"   - {IMAGES_DIR}")
    print(f"   - {UPLOADS_DIR}")
    print("\nPuedes usarlas como fallback cuando falle la descarga de imágenes externas.")

if __name__ == "__main__":
    main()