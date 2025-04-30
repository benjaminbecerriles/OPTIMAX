// -------------------------------------------------
// SOLUCIÓN MEJORADA PARA EL CUADRO "¿ESTE ES TU PRODUCTO?"
// -------------------------------------------------

// Variable global para controlar el temporizador del cuadro rosa
let scanFoundTimeout = null;
let closeListenerActive = false;
let blockScanFoundHiding = false; // Previene el cierre accidental

// 1. FUNCIÓN PRINCIPAL PARA MANEJAR CÓDIGO ESCANEADO
function onScannedBarcode(code) {
  console.log("onScannedBarcode llamado con:", code);
  
  // Limpiar cualquier temporizador previo
  if (scanFoundTimeout) {
    clearTimeout(scanFoundTimeout);
    scanFoundTimeout = null;
  }
  
  // Activar bloqueo para prevenir cierre accidental
  blockScanFoundHiding = true;
  setTimeout(() => { blockScanFoundHiding = false; }, 1000);
  
  // Obtener referencias a elementos del DOM
  const scanFoundContainer = document.getElementById("scanFoundContainer");
  const scanFoundRow = document.getElementById("scanFoundRow");
  
  if (!scanFoundContainer || !scanFoundRow) {
    console.error("Elementos del cuadro rosa no encontrados");
    return;
  }
  
  // Verificar si el código ya existe en nuestro inventario
  verificarCodigoBarras(code).then(exists => {
    if (exists) {
      // Si ya existe, mostrar mensaje de advertencia
      if (typeof showBarcodeWarningModal === 'function') {
        showBarcodeWarningModal(code);
      } else {
        console.warn("Función showBarcodeWarningModal no encontrada");
      }
      if (typeof codigoBarrasValido !== 'undefined') {
        codigoBarrasValido = false;
      }
      return;
    }
    
    // Hacer la petición API directamente sin mostrar carga
    fetch(`/api/find_by_code?codigo=${encodeURIComponent(code)}&t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (!data.found) {
          console.log("Código no encontrado en la API");
          // Mostrar mensaje de no encontrado
          scanFoundContainer.style.display = "block";
          scanFoundRow.innerHTML = `
            <div class="scanFoundInner">
              <div class="scanFoundText">
                <div class="scanFoundTitle">NO SE ENCONTRÓ INFORMACIÓN</div>
                <div class="scanFoundName">Código: ${code}</div>
                <div class="scanFoundCode">Continúa llenando el formulario manualmente</div>
              </div>
            </div>
          `;
          scanFoundContainer.classList.add("animate-pulse");
          setupScanFoundTimeout(15000);
          return;
        }
        
        console.log("Datos encontrados:", data);
        // Mostrar la información encontrada inmediatamente
        showScanFound(data);
        
        // Configurar temporizador para mantener visible
        setupScanFoundTimeout(15000);
      })
      .catch(err => {
        console.error("Error en find-by-code:", err);
        hideScanFoundContainer();
      });
  });
  
  // Configurar un solo event listener para documentos si no existe
  if (!closeListenerActive) {
    setupCloseListener();
  }
}

// 2. FUNCIÓN PARA MOSTRAR LA INFORMACIÓN ENCONTRADA
function showScanFound(info) {
  const scanFoundContainer = document.getElementById("scanFoundContainer");
  const scanFoundRow = document.getElementById("scanFoundRow");
  const btnScanYes = document.getElementById("btnScanYes");
  const btnScanNo = document.getElementById("btnScanNo");
  
  if (!scanFoundContainer || !scanFoundRow) return;
  
  scanFoundContainer.classList.remove("animate-pulse");
  scanFoundRow.innerHTML = `
    <div class="scanFoundInner">
      <div class="scanFoundImageBox">
        <img src="${info.url_imagen || ''}" alt="Producto Escaneado"
             onerror="this.src='${window.location.origin}/static/img/default_product.jpg';" />
      </div>
      <div class="scanFoundText">
        <div class="scanFoundTitle">¿ESTE ES TU PRODUCTO?</div>
        <div class="scanFoundName">${info.nombre || 'Producto sin nombre'}</div>
        <div class="scanFoundCode">Código: ${info.codigo_barras || ''}</div>
      </div>
    </div>
  `;
  
  scanFoundContainer.style.display = "block";
  
  // Limpiar listeners anteriores para evitar duplicaciones
  const newBtnYes = btnScanYes.cloneNode(true);
  btnScanYes.parentNode.replaceChild(newBtnYes, btnScanYes);
  
  const newBtnNo = btnScanNo.cloneNode(true);
  btnScanNo.parentNode.replaceChild(newBtnNo, btnScanNo);
  
  // Guardar atributos para usarlos después
  newBtnYes.setAttribute("data-nombre", info.nombre || '');
  newBtnYes.setAttribute("data-marca", info.marca || '');
  newBtnYes.setAttribute("data-imagen", info.url_imagen || '');
  newBtnYes.setAttribute("data-categoria", info.categoria || '');
  
  // Configurar nuevos event listeners
  newBtnYes.addEventListener("click", function() {
    // Usar atributos guardados
    const nombre = this.getAttribute("data-nombre");
    const marca = this.getAttribute("data-marca");
    const imagenURL = this.getAttribute("data-imagen");
    const cat = this.getAttribute("data-categoria");
    
    // Actualizar campos del formulario
    const nombreInput = document.getElementById("nombre");
    const marcaInput = document.getElementById("marca");
    
    if (nombreInput) {
      nombreInput.value = nombre;
      if (typeof updateFloatingLabel === 'function') {
        updateFloatingLabel(nombreInput);
      }
    }
    
    if (marcaInput) {
      marcaInput.value = marca;
      if (typeof updateFloatingLabel === 'function') {
        updateFloatingLabel(marcaInput);
      }
    }
    
    // Actualizar imagen
    if (imagenURL) {
      const fotoPlaceholder = document.getElementById("fotoPlaceholder");
      if (fotoPlaceholder) {
        fotoPlaceholder.innerHTML = `
          <img src="${imagenURL}" alt="Imagen del Producto">
          <button type="button" class="remove-image" id="removeImageBtn">&times;</button>
        `;
        fotoPlaceholder.classList.add("has-image");
        
        // Actualizar campos ocultos
        const iaFotoFilename = document.getElementById("ia_foto_filename");
        if (iaFotoFilename) {
          iaFotoFilename.value = imagenURL.split("/").pop();
        }
        
        const displayedImageUrl = document.getElementById("displayed_image_url");
        if (displayedImageUrl) {
          displayedImageUrl.value = imagenURL;
        }
        
        // Reconectar listener para eliminar imagen
        setTimeout(function() {
          if (typeof attachRemoveImageListener === 'function') {
            attachRemoveImageListener();
          }
          if (typeof bindPhotoEvents === 'function') {
            bindPhotoEvents();
          }
        }, 100);
      }
    }
    
    // Actualizar categoría
    if (cat) {
      try {
        const removeAccents = function(str) {
          return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        };
        
        const catDB = removeAccents(cat.toLowerCase().trim());
        const catSelect = document.getElementById("categoria_existente");
        
        if (catSelect && window.categoryChoices) {
          for (let i = 0; i < catSelect.options.length; i++) {
            const rawOption = catSelect.options[i].value;
            const catOption = removeAccents(rawOption.toLowerCase().trim());
            
            if (catOption === catDB) {
              window.categoryChoices.setChoiceByValue(rawOption);
              break;
            }
          }
        }
      } catch (e) {
        console.warn("Error al actualizar categoría:", e);
      }
    }
    
    // Ocultar cuadro rosa
    hideScanFoundContainer();
  });
  
  newBtnNo.addEventListener("click", hideScanFoundContainer);
}

// 3. FUNCIÓN PARA OCULTAR EL CUADRO ROSA
function hideScanFoundContainer() {
  // Si está bloqueado, no ocultar
  if (blockScanFoundHiding) return;
  
  // Limpiar cualquier temporizador existente
  if (scanFoundTimeout) {
    clearTimeout(scanFoundTimeout);
    scanFoundTimeout = null;
  }
  
  const scanFoundContainer = document.getElementById("scanFoundContainer");
  const scanFoundRow = document.getElementById("scanFoundRow");
  
  if (scanFoundContainer) {
    scanFoundContainer.style.display = "none";
    scanFoundContainer.classList.remove("animate-pulse");
    
    if (scanFoundRow) {
      scanFoundRow.innerHTML = "";
    }
  }
}

// 4. CONFIGURAR TEMPORIZADOR PARA MANTENER EL CUADRO VISIBLE
function setupScanFoundTimeout(duration) {
  // Limpiar temporizador anterior si existe
  if (scanFoundTimeout) {
    clearTimeout(scanFoundTimeout);
  }
  
  // Establecer nuevo temporizador
  scanFoundTimeout = setTimeout(() => {
    hideScanFoundContainer();
  }, duration);
  
  console.log(`Temporizador configurado para ${duration/1000} segundos`);
}

// 5. CONFIGURAR LISTENER PARA CERRAR CUADRO AL HACER CLIC FUERA
function setupCloseListener() {
  // Marcar como activo
  closeListenerActive = true;
  
  document.addEventListener("click", function(e) {
    // No cerrar si el clic fue en el cuadro o sus elementos
    if (e.target.closest("#scanFoundContainer") || 
        e.target.closest("#scanFoundRow") || 
        e.target.closest("#codigo_barras_externo") || 
        e.target.closest("#scanIcon") || 
        e.target.closest("#cameraIcon") || 
        blockScanFoundHiding) {
      return;
    }
    
    // Ocultar el cuadro rosa
    hideScanFoundContainer();
  });
}

// 6. AÑADIR ESTILOS CSS PARA LA ANIMACIÓN DE PULSO
document.addEventListener("DOMContentLoaded", function() {
  // Añadir estilos si no existen
  if (!document.getElementById("scannerPulseStyles")) {
    const styleEl = document.createElement("style");
    styleEl.id = "scannerPulseStyles";
    styleEl.textContent = `
      @keyframes scan-pulse {
        0% { opacity: 1; }
        50% { opacity: 0.85; }
        100% { opacity: 1; }
      }
      
      .animate-pulse {
        animation: scan-pulse 1.5s ease-in-out infinite;
        box-shadow: 0 0 15px rgba(212, 138, 212, 0.7);
      }
    `;
    document.head.appendChild(styleEl);
  }
  
  // Configurar un observador para verificar si hay cambios en #scanFoundContainer
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.attributeName === 'style' && 
          mutation.target.id === 'scanFoundContainer' &&
          mutation.target.style.display === 'block') {
        console.log("scanFoundContainer ahora visible!");
      }
    });
  });
  
  // Empezar a observar el contenedor de escaneo
  const scanFoundContainer = document.getElementById("scanFoundContainer");
  if (scanFoundContainer) {
    observer.observe(scanFoundContainer, { attributes: true });
  }
});

// 7. VERIFICAR CÓDIGO DE BARRAS (Si no existe la función)
if (typeof verificarCodigoBarras !== 'function') {
  function verificarCodigoBarras(codigo) {
    if (!codigo || codigo.trim() === "") {
      return Promise.resolve(false); // No hay código que verificar
    }
    
    return fetch(`/api/check_barcode_exists?codigo=${encodeURIComponent(codigo)}&t=${Date.now()}`)
      .then(response => response.json())
      .then(data => data.exists)
      .catch(error => {
        console.error("Error verificando código de barras:", error);
        return false; // En caso de error, asumimos que no existe
      });
  }
}

// Asegurar que la función onScannedBarcode esté disponible globalmente
window.onScannedBarcode = onScannedBarcode;