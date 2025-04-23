// static/js/mi_scanner_quagga.js

// Función que inicia el modal y la captura de QuaggaJS
function iniciarEscaneoQuagga() {
  // 1) Localiza el DIV del modal y lo muestra
  const modal = document.getElementById("modalEscaneoCamara");
  if (!modal) {
    console.error("No se encontró el elemento con id='modalEscaneoCamara'.");
    return;
  }
  modal.style.display = "block";

  // 2) Localiza el contenedor donde Quagga inyecta el <video>
  const videoContainer = document.getElementById("videoContainer");
  if (!videoContainer) {
    console.error("No se encontró el elemento con id='videoContainer'.");
    return;
  }
  
  // Limpiar el contenedor para evitar problemas con inicializaciones previas
  videoContainer.innerHTML = '';

  console.log("Iniciando configuración de Quagga...");

  // 3) Inicializa Quagga con configuración mejorada
  Quagga.init(
    {
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: videoContainer,
        constraints: {
          width: {min: 640},
          height: {min: 480},
          facingMode: "environment", // cámara trasera en móviles
          aspectRatio: {min: 1, max: 2}
        },
        area: { // definir un área específica de escaneo
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
          "code_39_vin_reader",
          "upc_reader",
          "upc_e_reader"
        ]
      },
      debug: {
        drawBoundingBox: true,
        showFrequency: true,
        drawScanline: true,
        showPattern: true
      }
    },
    function (err) {
      if (err) {
        console.error("Error al iniciar Quagga:", err);
        videoContainer.innerHTML = `<div style="color: white; text-align: center; padding: 20px;">
          <p>Error al acceder a la cámara: ${err.message || "Desconocido"}</p>
          <p>Verifica que has dado permisos de cámara y refresca la página.</p>
        </div>`;
        return;
      }
      console.log("Quagga inicializado correctamente");
      Quagga.start();
    }
  );

  // 4) Callback cuando Quagga detecta un código de barras
  Quagga.onDetected(function (result) {
    if (!result || !result.codeResult) {
      return;
    }
    const codigoDetectado = result.codeResult.code;
    console.log("Código detectado:", codigoDetectado);

    // Asigna el código detectado al campo "Ingresar Código de Barras"
    const inputExterno = document.getElementById("codigo_barras_externo");
    if (inputExterno) {
      inputExterno.value = codigoDetectado;

      // Aquí llamamos a la función onScannedBarcode si existe
      if (typeof onScannedBarcode === "function") {
        console.log("Llamando onScannedBarcode con:", codigoDetectado);
        onScannedBarcode(codigoDetectado);
      }
    }

    // Detén Quagga y cierra el modal
    Quagga.stop();
    cerrarModalEscaner();
  });
}

// Función para cerrar el modal de escáner y detener Quagga manualmente
function cerrarModalEscaner() {
  // Detener Quagga si sigue corriendo
  if (window.Quagga) {
    try {
      Quagga.stop();
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