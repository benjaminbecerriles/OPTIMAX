/**
 * producto_scanner.js
 * Implementación específica de escáner para la página agregar_producto.html
 * Esta implementación asegura que el cuadro rosa aparezca correctamente
 */

// Flag para controlar si Quagga está activo
let quaggaActive = false;

// Controlador para evitar cierres prematuros del cuadro rosa
let scanFoundClosingTimeout = null;

/**
 * Inicializa el escáner de código de barras físico
 * @param {string} scanIconSelector - Selector del ícono que activa el escaneo
 * @param {string} inputSelector - Selector del input donde se copia el código
 */
function initProductBarcodeScanner(scanIconSelector, inputSelector) {
  const threshold = 150; // Tiempo máximo entre pulsaciones de teclas (ms)
  const timeoutDuration = 1000; // Tiempo de inactividad hasta finalizar escaneo (ms)

  const scanIcon = document.querySelector(scanIconSelector);
  const inputElement = document.querySelector(inputSelector);

  if (!scanIcon || !inputElement) {
    console.error("ProductScanner: No se encontró el ícono o input especificado");
    return;
  }

  let scanningActive = false;
  let scannedString = "";
  let lastTime = null;
  let scanTimeoutId = null;

  // Reiniciar y desactivar el escaneo
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
    scanIcon.classList.remove("scan-active");
  }

  // Manejador de eventos de teclado para capturar el escaneo
  function onKeyDown(e) {
    if (!scanningActive) return;

    const currentTime = Date.now();
    // Si la diferencia entre teclas es mayor al umbral, se reinicia la cadena
    if (lastTime && (currentTime - lastTime > threshold)) {
      scannedString = "";
    }
    lastTime = currentTime;

    // Si se presiona Enter, se finaliza el escaneo
    if (e.key === "Enter") {
      if (scannedString.length >= 3) {
        // Primero asignar el valor al input
        inputElement.value = scannedString;
        
        // IMPORTANTE: Hacer que el input dispare el evento de input para activar autocompletado
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        
        // CLAVE: Llamar a onScannedBarcode DESPUÉS de actualizar el input
        // Usar setTimeout para dar tiempo a que el input se actualice completamente
        setTimeout(() => {
          if (typeof window.onScannedBarcode === 'function') {
            window.onScannedBarcode(scannedString);
          }
        }, 50);
      }
      resetScanner();
      e.preventDefault();
      return;
    } else if (e.key.length === 1) {
      // Solo capturar teclas con un carácter (ignorar teclas de control)
      scannedString += e.key;
    }

    // Reiniciar el timeout: si no se pulsa nada en "timeoutDuration", finaliza el escaneo
    if (scanTimeoutId) {
      clearTimeout(scanTimeoutId);
    }
    scanTimeoutId = setTimeout(() => {
      if (scannedString.length >= 3) {
        // Asignar valor al input
        inputElement.value = scannedString;
        
        // Disparar evento de input
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Llamar a onScannedBarcode
        setTimeout(() => {
          if (typeof window.onScannedBarcode === 'function') {
            window.onScannedBarcode(scannedString);
          }
        }, 50);
      }
      resetScanner();
    }, timeoutDuration);
  }

  // Manejador de clics fuera del área de escaneo para cancelar
  function onDocumentClick(e) {
    if (!scanIcon.contains(e.target) && !inputElement.contains(e.target)) {
      resetScanner();
    }
  }

  // Iniciar el modo escaneo
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
    scanIcon.classList.add("scan-active");
  }

  // Evento de clic en el ícono para activar/cancelar el escaneo
  scanIcon.addEventListener("click", function(e) {
    e.stopPropagation();
    if (scanningActive) {
      resetScanner();
    } else {
      startScanning();
    }
  });
}

/**
 * Inicia el escaneo con la cámara usando QuaggaJS
 * Versión específica para la página de productos
 */
function iniciarProductoEscaneoQuagga() {
  // Si ya está activo, no iniciar de nuevo
  if (quaggaActive) return;
  
  const modal = document.getElementById("modalEscaneoCamara");
  if (!modal) {
    console.error("No se encontró el modal para escaneo con cámara");
    return;
  }
  
  modal.style.display = "block";
  const videoContainer = document.getElementById("videoContainer");
  if (!videoContainer) {
    console.error("No se encontró el contenedor de video");
    return;
  }
  
  // Limpiar el contenedor para evitar problemas con inicializaciones previas
  videoContainer.innerHTML = '';

  // Configuración optimizada para QuaggaJS
  Quagga.init(
    {
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: videoContainer,
        constraints: {
          width: {min: 640},
          height: {min: 480},
          facingMode: "environment", // Cámara trasera en móviles
          aspectRatio: {min: 1, max: 2}
        },
        area: { // Definir un área específica de escaneo
          top: "0%",
          right: "0%",
          left: "0%",
          bottom: "0%"
        }
      },
      locator: {
        patchSize: "medium",
        halfSample: true
      },
      numOfWorkers: 2,
      frequency: 10,
      decoder: {
        readers: [
          "code_128_reader",
          "ean_reader",
          "ean_8_reader",
          "code_39_reader",
          "upc_reader",
          "upc_e_reader"
        ]
      },
      debug: false
    },
    function(err) {
      if (err) {
        console.error("Error al iniciar Quagga:", err);
        videoContainer.innerHTML = `<div style="color: white; text-align: center; padding: 20px;">
          <p>Error al acceder a la cámara: ${err.message || "Desconocido"}</p>
          <p>Verifica que has dado permisos de cámara y refresca la página.</p>
        </div>`;
        quaggaActive = false;
        return;
      }
      
      console.log("Quagga inicializado correctamente para productos");
      quaggaActive = true;
      Quagga.start();
    }
  );
  
  // Detector de códigos de barras
  Quagga.onDetected(function(result) {
    if (!result || !result.codeResult) return;
    
    const codigoDetectado = result.codeResult.code;
    console.log("Código detectado con cámara:", codigoDetectado);
    
    // Detener Quagga y cerrar el modal
    Quagga.stop();
    quaggaActive = false;
    cerrarProductoModalEscaner();
    
    // Asignar el código al campo de entrada
    const inputElement = document.getElementById("codigo_barras_externo");
    if (inputElement) {
      inputElement.value = codigoDetectado;
      
      // Disparar evento de input para el autocompletado
      inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      
      // IMPORTANTE: Llamar a onScannedBarcode después de un pequeño retraso
      // para dar tiempo a que se actualice el input
      setTimeout(() => {
        if (typeof window.onScannedBarcode === 'function') {
          window.onScannedBarcode(codigoDetectado);
        }
      }, 50);
    }
  });
}

/**
 * Cierra el modal de escáner para productos
 */
function cerrarProductoModalEscaner() {
  // Detener Quagga si está activo
  if (window.Quagga && quaggaActive) {
    try {
      Quagga.stop();
      quaggaActive = false;
    } catch (e) {
      console.error("Error al detener Quagga:", e);
    }
  }

  // Ocultar el modal
  const modal = document.getElementById("modalEscaneoCamara");
  if (modal) {
    modal.style.display = "none";
  }
}

/**
 * Maneja el cuadro rosa "¿Es este tu producto?"
 * Evita cierres prematuros y agrega un temporizador
 */
function setupScanFoundBox() {
  const scanFoundContainer = document.getElementById("scanFoundContainer");
  const btnScanNo = document.getElementById("btnScanNo");
  
  if (btnScanNo) {
    // Reemplazar el listener del botón "No" para evitar propagación de eventos
    btnScanNo.addEventListener("click", function(e) {
      e.stopPropagation(); // Prevenir propagación
      hideScanFoundContainer();
    });
  }
  
  // Función mejorada para ocultar el cuadro rosa
  window.hideScanFoundContainer = function() {
    if (scanFoundClosingTimeout) {
      clearTimeout(scanFoundClosingTimeout);
      scanFoundClosingTimeout = null;
    }
    
    if (scanFoundContainer) {
      scanFoundContainer.style.display = "none";
      const scanFoundRow = document.getElementById("scanFoundRow");
      if (scanFoundRow) {
        scanFoundRow.innerHTML = "";
      }
    }
  };
  
  // Sobreescribir la función global onScannedBarcode para esta página
  window.onScannedBarcode = function(code) {
    // Si ya hay un timeout en curso, cancelarlo
    if (scanFoundClosingTimeout) {
      clearTimeout(scanFoundClosingTimeout);
      scanFoundClosingTimeout = null;
    }
    
    // Verificar duplicados en el inventario
    verificarCodigoBarras(code).then(exists => {
      if (exists) {
        // Si ya existe, mostrar advertencia
        if (typeof showBarcodeWarningModal === 'function') {
          showBarcodeWarningModal(code);
        }
        return;
      }
      
      // Mostrar cuadro de carga mientras se busca
      if (scanFoundContainer && document.getElementById("scanFoundRow")) {
        scanFoundContainer.style.display = "block";
        document.getElementById("scanFoundRow").innerHTML = `
          <div class="text-center py-3">
            <div class="spinner-border text-light" role="status">
              <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="mt-2 mb-0">Buscando información...</p>
          </div>
        `;
        
        // Evitar cierre por clic fuera
        const handleDocumentClick = (e) => {
          // Si el clic es fuera del scanFoundContainer y dentro del documento
          if (!scanFoundContainer.contains(e.target)) {
            e.stopPropagation();
          }
        };
        
        // Agregar listener temporal para prevenir cierres
        document.addEventListener("click", handleDocumentClick, true);
        
        // Quitar el listener después de un tiempo razonable
        setTimeout(() => {
          document.removeEventListener("click", handleDocumentClick, true);
        }, 1000);
      }
      
      fetch(`/api/find_by_code?codigo=${encodeURIComponent(code)}&t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (!data.found) {
            hideScanFoundContainer();
            return;
          }
          
          // Mostrar información en el cuadro rosa
          showScanFound(data);
          
          // Configurar cierre automático después de 10 segundos
          scanFoundClosingTimeout = setTimeout(() => {
            hideScanFoundContainer();
          }, 10000); // 10 segundos
        })
        .catch(err => {
          console.error("Error al buscar código:", err);
          hideScanFoundContainer();
        });
    });
  };
  
  // Función para verificar si el código ya existe en inventario
  window.verificarCodigoBarras = function(codigo) {
    if (!codigo || codigo.trim() === "") {
      return Promise.resolve(false);
    }
    
    return fetch(`/api/check_barcode_exists?codigo=${encodeURIComponent(codigo)}&t=${Date.now()}`)
      .then(response => response.json())
      .then(data => data.exists)
      .catch(error => {
        console.error("Error verificando código de barras:", error);
        return false;
      });
  };
}

// Inicializar todo cuando se carga el documento
document.addEventListener("DOMContentLoaded", function() {
  // Inicializar el escáner físico
  initProductBarcodeScanner("#scanIcon", "#codigo_barras_externo");
  
  // Configurar el cuadro rosa para evitar cierres prematuros
  setupScanFoundBox();
  
  // Vincular el botón de cámara
  const cameraIcon = document.getElementById("cameraIcon");
  if (cameraIcon) {
    cameraIcon.removeAttribute("onclick"); // Quitar onclick existente
    cameraIcon.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      iniciarProductoEscaneoQuagga();
    });
  }
  
  // Vincular el botón de cierre del modal
  const closeModalBtn = document.querySelector("#modalEscaneoCamara button");
  if (closeModalBtn) {
    closeModalBtn.removeAttribute("onclick"); // Quitar onclick existente
    closeModalBtn.addEventListener("click", function(e) {
      e.preventDefault();
      cerrarProductoModalEscaner();
    });
  }
  
  console.log("Producto Scanner inicializado correctamente");
});