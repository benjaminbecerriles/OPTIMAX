// static/js/barcode-scanner.js

/**
 * Inicializa la funcionalidad de escaneo de códigos de barras.
 * @param {string} scanIconSelector - Selector del ícono que activa el modo escaneo.
 * @param {string} inputSelector - Selector del input donde se pegará el código.
 * @param {object} options - Opciones de configuración:
 *                           - threshold: tiempo máximo (ms) entre pulsaciones para considerarlo escaneo (por defecto 150ms)
 *                           - timeoutDuration: tiempo de inactividad (ms) para finalizar el escaneo (por defecto 1000ms)
 */
function initBarcodeScanner(scanIconSelector, inputSelector, options) {
  const threshold = (options && options.threshold) || 150;
  const timeoutDuration = (options && options.timeoutDuration) || 1000;

  const scanIcon = document.querySelector(scanIconSelector);
  const inputElement = document.querySelector(inputSelector);

  if (!scanIcon || !inputElement) {
    console.error("Barcode scanner: No se encontró el ícono o el input especificado.");
    return;
  }

  let scanningActive = false;
  let scannedString = "";
  let lastTime = null;
  let scanTimeoutId = null;

  // Función para reiniciar y desactivar el modo escaneo
  function resetScanner() {
    scanningActive = false;
    scannedString = "";
    lastTime = null;
    if (scanTimeoutId) {
      clearTimeout(scanTimeoutId);
      scanTimeoutId = null;
    }
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("click", onDocumentClick);
    // Quitar la animación del ícono
    scanIcon.classList.remove("scan-active");
  }

  // Función que se ejecuta en cada pulsación de tecla
  function onKeyDown(e) {
    if (!scanningActive) return;

    const currentTime = Date.now();
    // Si la diferencia entre teclas es mayor al umbral, se reinicia la cadena
    if (lastTime && (currentTime - lastTime > threshold)) {
      scannedString = "";
    }
    lastTime = currentTime;

    // Si se presiona Enter, finalizamos el escaneo
    if (e.key === "Enter") {
      if (scannedString.length >= 3) {
        inputElement.value = scannedString;
        
        // MODIFICADO: Llamar a la función de procesamiento de código de barras
        // Buscar primero en serviceworker (nueva implementación)
        if (window.serviceworker && typeof window.serviceworker.handleScanFoundBarcode === 'function') {
          console.log("Usando serviceworker.handleScanFoundBarcode desde barcode-scanner");
          window.serviceworker.handleScanFoundBarcode(scannedString);
        }
        // Si no existe, usar la implementación global
        else if (typeof window.onScannedBarcode === 'function') {
          console.log("Usando window.onScannedBarcode desde barcode-scanner");
          window.onScannedBarcode(scannedString);
        }
        // Último recurso: buscar en el scope global
        else if (typeof onScannedBarcode === 'function') {
          console.log("Usando onScannedBarcode global desde barcode-scanner");
          onScannedBarcode(scannedString);
        }
      }
      resetScanner();
      e.preventDefault();
      return;
    } else if (e.key.length === 1) {
      // Solo se consideran teclas con un carácter (ignora teclas de control)
      scannedString += e.key;
    }

    // Reiniciamos el timeout: si no se pulsa nada en "timeoutDuration", finaliza el escaneo automáticamente
    if (scanTimeoutId) {
      clearTimeout(scanTimeoutId);
    }
    scanTimeoutId = setTimeout(() => {
      if (scannedString.length >= 3) {
        inputElement.value = scannedString;
        
        // MODIFICADO: Misma lógica que arriba para timeout
        if (window.serviceworker && typeof window.serviceworker.handleScanFoundBarcode === 'function') {
          window.serviceworker.handleScanFoundBarcode(scannedString);
        }
        else if (typeof window.onScannedBarcode === 'function') {
          window.onScannedBarcode(scannedString);
        }
        else if (typeof onScannedBarcode === 'function') {
          onScannedBarcode(scannedString);
        }
      }
      resetScanner();
    }, timeoutDuration);
  }

  // Listener global: si se hace clic fuera del área del ícono o del input, se cancela el escaneo
  function onDocumentClick(e) {
    if (!scanIcon.contains(e.target) && !inputElement.contains(e.target)) {
      resetScanner();
    }
  }

  // Función para iniciar el modo escaneo
  function startScanning() {
    if (scanningActive) {
      resetScanner();
      return;
    }
    scanningActive = true;
    scannedString = "";
    lastTime = null;
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onDocumentClick);
    // Agregar animación al ícono de escaneo sin enfocar el input (modo "invisible")
    scanIcon.classList.add("scan-active");
  }

  // Al hacer clic en el ícono se activa o se cancela el modo escaneo:
  scanIcon.addEventListener("click", function(e) {
    e.stopPropagation();
    if (scanningActive) {
      // Si ya está activo, al picarlo de nuevo se cancela el proceso.
      resetScanner();
    } else {
      startScanning();
    }
  });
}

// Exponemos la función para que esté disponible globalmente
window.initBarcodeScanner = initBarcodeScanner;