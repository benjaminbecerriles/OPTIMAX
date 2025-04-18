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
  
    // 3) Inicializa Quagga con configuración básica
    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: videoContainer, // el DIV donde se "pegará" el video
          constraints: {
            facingMode: "environment" // cámara trasera (en móviles)
          }
        },
        decoder: {
          // Tipos de código que deseas reconocer (añade o quita según tu necesidad)
          readers: ["code_128_reader", "ean_reader", "upc_reader", "code_39_reader"]
        }
      },
      function (err) {
        if (err) {
          console.error("Error al iniciar Quagga:", err);
          cerrarModalEscaner();
          return;
        }
        console.log("Quagga inicializado correctamente");
        Quagga.start(); // Inicia la cámara y la detección
      }
    );
  
    // 4) Callback cuando Quagga detecta un código de barras
    Quagga.onDetected(function (result) {
      if (!result || !result.codeResult) {
        return;
      }
      const codigoDetectado = result.codeResult.code;
      console.log("Código detectado:", codigoDetectado);
  
      // (Opcional) Si usas un campo para "código interno", lo limpias
      const inputInterno = document.getElementById("codigo_interno");
      if (inputInterno) {
        inputInterno.value = "";
      }
  
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
      Quagga.stop();
    }
  
    // Ocultar el modal
    const modal = document.getElementById("modalEscaneoCamara");
    if (modal) {
      modal.style.display = "none";
    }
  }
  