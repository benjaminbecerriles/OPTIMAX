# sheets.py
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build

# 1) ALCANCE DE PERMISOS: Lectura/Escritura en Google Sheets
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# 2) DEFINE LA RUTA DEL ARCHIVO JSON (EL QUE TIENE LAS CREDENCIALES)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(BASE_DIR, 'credentials', 'service-account.json')

# 3) CARGA LAS CREDENCIALES DEL SERVICE ACCOUNT
credentials = service_account.Credentials.from_service_account_file(
    CREDENTIALS_FILE,
    scopes=SCOPES
)

# 4) CONSTRUYE EL SERVICIO DE GOOGLE SHEETS
service = build('sheets', 'v4', credentials=credentials)

# 5) ESTE ES EL ID DE TU HOJA DE CÁLCULO (sacado de la URL)
SPREADSHEET_ID = '1Y4rTKqrJ6AUcEjB-98JElKaFoYJ-K0MSs9I8dwqMrmg'

def leer_hoja(rango):
    """
    Lee los valores de la hoja de cálculo en el rango especificado.
    - 'rango' suele ser "Hoja1!A2:E" para leer la pestaña 'Hoja1',
      columnas A hasta E, saltando la fila de cabecera.
    Retorna una lista de listas con los valores obtenidos.
    """
    sheet = service.spreadsheets()
    result = sheet.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=rango
    ).execute()

    values = result.get('values', [])
    return values

def escribir_hoja(rango, valores):
    """
    (Opcional) Si deseas ESCRIBIR datos en la hoja de cálculo,
    p.ej. escribir filas nuevas en 'Hoja1!A2:E'.
    'valores' debe ser lista de listas, cada sub-lista es una fila.
    """
    body = {
        'values': valores
    }
    sheet = service.spreadsheets()
    result = sheet.values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=rango,
        valueInputOption='RAW',
        body=body
    ).execute()
    return result
