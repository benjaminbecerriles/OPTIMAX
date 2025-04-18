# sync_catalogo.py

import time
import threading
import sys

# Importamos la app Flask, la DB y la función de sincronización
from app import app, db, sync_gsheet_to_catalogo

def sincronizacion_cada_2min():
    """
    Hilo continuo que cada 2 minutos llama sync_gsheet_to_catalogo()
    bajo el contexto de Flask.
    """
    while True:
        with app.app_context():
            try:
                sync_gsheet_to_catalogo()
                print("[sync_catalogo] Sincronización exitosa con Google Sheets.")
            except Exception as e:
                print(f"[sync_catalogo] Error durante la sincronización: {e}", file=sys.stderr)
            finally:
                # IMPORTANTE: liberar la sesión en cada ciclo
                db.session.remove()

        # Esperamos 120 segundos (2 minutos) antes de la siguiente sincronización
        time.sleep(120)

if __name__ == "__main__":
    # 1) Creamos e iniciamos un hilo 'daemon' que corre en segundo plano
    t = threading.Thread(target=sincronizacion_cada_2min, daemon=True)
    t.start()

    print("[sync_catalogo] Hilo de sincronización iniciado. Se ejecutará cada 2 minutos.\n"
          "Presiona Ctrl+C para detener.")

    # 2) Mantenemos el proceso principal vivo para que no termine inmediatamente
    try:
        while True:
            time.sleep(3600)  # un 'idle loop' de 1 hora, repetido
    except KeyboardInterrupt:
        print("\n[sync_catalogo] Saliendo por Ctrl+C.")
        sys.exit(0)
