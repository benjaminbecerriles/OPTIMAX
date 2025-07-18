/**
 * Etiquetas.js - Sistema profesional de generación de etiquetas con códigos de barras
 * Versión optimizada con procesamiento por lotes y concordancia completa con HTML
 * Mejoras: Procesamiento por lotes, indicadores de progreso, validación de límites,
 * optimización de memoria, sistema de cancelación
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('Iniciando sistema de etiquetas profesional con procesamiento por lotes...');
  
  // Verificar dependencias críticas
  const dependencyChecks = [
    { name: 'JsBarcode', variable: window.JsBarcode },
    { name: 'jsPDF', variable: window.jspdf },
    { name: 'html2canvas', variable: window.html2canvas }
  ];
  
  const missingDependencies = dependencyChecks
    .filter(dep => typeof dep.variable === 'undefined')
    .map(dep => dep.name);
  
  if (missingDependencies.length > 0) {
    console.error(`Error: Dependencias faltantes: ${missingDependencies.join(', ')}`);
    mostrarErrorDependencias(missingDependencies.join(', '));
    return;
  }
  
  // Inicializar la aplicación
  initLabelApp();
});

/**
 * Muestra un mensaje de error si faltan dependencias
 * @param {string} dependencias - Nombre de las dependencias faltantes
 */
function mostrarErrorDependencias(dependencias) {
  const errorDiv = document.getElementById('dependency-error');
  if (errorDiv) {
    errorDiv.style.display = 'block';
    errorDiv.innerHTML = `
      <div style="display: flex; align-items: center;">
        <i class="fas fa-exclamation-circle" style="margin-right: 0.5rem; color: #e52e2e;"></i>
        <div>
          <strong>Error:</strong> No se pudieron cargar algunas bibliotecas necesarias (${dependencias}).
          <br>
          <span style="font-size: 0.875rem;">Por favor, recarga la página o verifica tu conexión a Internet.</span>
        </div>
      </div>
    `;
  }
}

/**
 * Muestra u oculta un indicador de carga con animación y mensaje personalizado
 * @param {HTMLElement} elemento - Elemento donde mostrar el loader
 * @param {boolean} mostrar - Si debe mostrarse u ocultarse
 * @param {string} mensaje - Mensaje principal a mostrar
 * @param {string} submensaje - Mensaje secundario opcional
 */
function mostrarCargando(elemento, mostrar, mensaje = "Procesando...", submensaje = "") {
  if (!elemento) return;
  
  // Remover cualquier loader existente
  const existingLoader = elemento.querySelector('.loading-overlay');
  if (existingLoader) {
    existingLoader.remove();
  }
  
  if (mostrar) {
    const loader = document.createElement('div');
    loader.className = 'loading-overlay';
    loader.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text">${mensaje}</div>
      ${submensaje ? `<div class="loading-subtext">${submensaje}</div>` : ''}
    `;
    elemento.style.position = 'relative';
    elemento.appendChild(loader);
  }
}

/**
 * Muestra un mensaje de alerta sobre formatos incompatibles
 * @param {string} mensaje - Mensaje de alerta a mostrar
 * @param {string} tipo - Tipo de alerta: 'warning', 'error', 'info'
 */
function mostrarAlertaFormato(mensaje, tipo = 'warning') {
  // Eliminar alerta previa si existe
  const alertaPrevia = document.getElementById('alerta-formato');
  if (alertaPrevia) {
    alertaPrevia.remove();
  }

  // Si no hay mensaje, solo eliminar alerta previa
  if (!mensaje) return;
  
  // Crear nueva alerta
  const alertaDiv = document.createElement('div');
  alertaDiv.id = 'alerta-formato';
  alertaDiv.className = `alerta-formato alerta-${tipo}`;
  
  // Configurar icono según tipo
  let icono = 'exclamation-triangle';
  if (tipo === 'error') icono = 'exclamation-circle';
  if (tipo === 'info') icono = 'info-circle';
  
  alertaDiv.innerHTML = `
    <i class="fas fa-${icono}"></i>
    <div class="alerta-mensaje">${mensaje}</div>
    <button class="alerta-cerrar" onclick="this.parentNode.remove();">×</button>
  `;
  
  // Insertar antes de los botones de acción
  const actionsSection = document.querySelector('.actions-section');
  if (actionsSection) {
    actionsSection.parentNode.insertBefore(alertaDiv, actionsSection);
  } else {
    // Insertar en cualquier lugar visible
    const mainContainer = document.querySelector('.etiquetas-layout');
    if (mainContainer) {
      mainContainer.appendChild(alertaDiv);
    }
  }
}

/**
 * NUEVA: Función para mostrar progreso por lotes (integrada del HTML)
 * @param {boolean} show - Mostrar u ocultar
 * @param {number} current - Etiquetas procesadas
 * @param {number} total - Total de etiquetas
 * @param {string} message - Mensaje de estado
 */
function showBatchProgress(show, current = 0, total = 0, message = 'Procesando...') {
  const batchProgress = document.getElementById('batch-progress');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const progressMessage = document.getElementById('progress-message');
  
  if (!batchProgress) return;
  
  if (show) {
    batchProgress.style.display = 'block';
    const percentage = total > 0 ? (current / total) * 100 : 0;
    
    if (progressBar) progressBar.style.width = percentage + '%';
    if (progressText) progressText.textContent = `${current.toLocaleString()} / ${total.toLocaleString()} etiquetas`;
    if (progressMessage) progressMessage.textContent = message;
  } else {
    batchProgress.style.display = 'none';
  }
}

/**
 * NUEVA: Función para obtener límites por tipo de impresora (integrada del HTML)
 * @param {string} impresora - Tipo de impresora
 * @returns {Object} Límites de la impresora
 */
function getPrinterLimits(impresora) {
  const limits = {
    normal: { safe: 300, warning: 500, maximum: 2000 },
    zebra: { safe: 500, warning: 800, maximum: 3000 },
    dymo: { safe: 500, warning: 800, maximum: 3000 },
    termica: { safe: 800, warning: 1200, maximum: 5000 }
  };
  
  return limits[impresora] || limits.normal;
}

/**
 * NUEVA: Función para obtener el tipo de impresora seleccionado (integrada del HTML)
 * @returns {string} Tipo de impresora
 */
function getSelectedPrinterType() {
  const selectedPrinter = document.querySelector('.printer-option.selected');
  return selectedPrinter ? selectedPrinter.dataset.printer : 'normal';
}

/**
 * NUEVA: Función para delay/pausa entre operaciones
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise} Promise que se resuelve después del delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * NUEVA: Sistema de control de cancelación
 */
const batchController = {
  cancelled: false,
  cancel() {
    this.cancelled = true;
    console.log('Operación cancelada por el usuario');
  },
  reset() {
    this.cancelled = false;
  },
  isCancelled() {
    return this.cancelled;
  }
};

/**
 * NUEVA: Función para limpiar memoria entre lotes
 * @param {HTMLElement} container - Contenedor a limpiar
 */
function cleanupMemory(container) {
  if (!container) return;
  
  // Limpiar SVGs y elementos DOM
  const svgs = container.querySelectorAll('svg');
  svgs.forEach(svg => {
    svg.innerHTML = '';
    if (svg.parentNode) {
      svg.parentNode.removeChild(svg);
    }
  });
  
  // Limpiar contenedor
  container.innerHTML = '';
  
  // Forzar garbage collection si está disponible
  if (window.gc) {
    window.gc();
  }
}

/**
 * Inicializa la aplicación completa de etiquetas
 * Arquitectura modular para máxima eficiencia y mantenibilidad
 */
function initLabelApp() {
  try {
    // Catalogar todos los formatos disponibles con configuraciones precisas de alineación
    const formatosCatalog = {
      // Formatos para impresora normal
      normal: [
        {
          value: "avery5160",
          text: "Avery 5160 (63.5mm x 26.9mm)",
          width: 63.5,
          height: 26.9,
          cols: 3,
          rows: 10,
          perPage: 30,
          // PERFECCIONADO: Valores exactos para Avery 5160 ajustados por pruebas de campo
          marginX: 7.0,    // Ajustado para centrar perfectamente
          marginY: 13.45,  // Ajustado para alinear verticalmente
          contentPaddingX: 1.0,  // Reducido para evitar que el contenido se salga
          contentPaddingY: 1.0,  // Reducido para evitar que el contenido se salga
          horizontalSpacing: 2.65,  // Calibrado exactamente para este formato
          verticalSpacing: 0.0,
          maxTextLength: 25,      // Máximo de caracteres para el nombre
          barcodeHeightFactor: 1.0 // Factor de altura normal
        },
        {
          value: "avery5161",
          text: "Avery 5161 (101.6mm x 25.4mm)",
          width: 101.6,
          height: 25.4,
          cols: 2,
          rows: 10,
          perPage: 20,
          // PERFECCIONADO: Valores exactos para Avery 5161
          marginX: 4.55,   // Ajustado
          marginY: 16.25,  // Ajustado
          contentPaddingX: 1.5,  // Reducido para evitar desbordamiento 
          contentPaddingY: 1.0,  // Reducido para evitar desbordamiento
          horizontalSpacing: 2.25,  // Calibrado exacto
          verticalSpacing: 0.0,
          maxTextLength: 40,      // Más espacio para texto
          barcodeHeightFactor: 1.0 // Factor de altura normal
        },
        {
          value: "avery5163",
          text: "Avery 5163 (101.6mm x 50.8mm)",
          width: 101.6,
          height: 50.8,
          cols: 2,
          rows: 5,
          perPage: 10,
          // PERFECCIONADO: Valores exactos para Avery 5163
          marginX: 4.55,   // Ajustado
          marginY: 13.25,  // Ajustado 
          contentPaddingX: 2.0,  // Ajustado para mejor alineación
          contentPaddingY: 2.0,  // Ajustado para mejor alineación
          horizontalSpacing: 2.25,  // Calibrado exacto
          verticalSpacing: 0.0,
          maxTextLength: 60,      // Mucho espacio para texto
          barcodeHeightFactor: 1.0 // Factor de altura normal
        }
      ],
      
      // Formatos para impresora Zebra con configuraciones de alineación mejoradas
      zebra: [
        {
          value: "zebra_2x1",
          text: "Zebra 2\" x 1\" (50.8mm x 25.4mm)",
          width: 50.8,
          height: 25.4,
          cols: 1,
          rows: 1,
          perPage: 1,
          // Configuraciones de alineación mejoradas para Zebra
          marginX: 1.0, // CORREGIDO
          marginY: 1.0, // CORREGIDO
          contentPaddingX: 1.0, // REDUCIDO para optimizar espacio
          contentPaddingY: 1.0, // REDUCIDO para optimizar espacio
          contentTopSpacing: 0.5,  // REDUCIDO para código de barras más grande
          contentBottomSpacing: 0.5, // REDUCIDO para código de barras más grande
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true,
          // OPTIMIZACIÓN: Parámetros específicos para códigos de barras
          maxTextLength: 18,       // Límite de texto para nombres
          barcodeHeightFactor: 1.5, // 50% más alto
          barcodeWidthFactor: 1.2,  // 20% más ancho
          prioritizeBarcode: true   // Priorizar código de barras
        },
        {
          value: "zebra_3x1",
          text: "Zebra 3\" x 1\" (76.2mm x 25.4mm)",
          width: 76.2,
          height: 25.4,
          cols: 1,
          rows: 1,
          perPage: 1,
          // Configuraciones de alineación mejoradas para Zebra
          marginX: 1.0, // CORREGIDO
          marginY: 1.0, // CORREGIDO
          contentPaddingX: 1.5, // REDUCIDO para optimizar espacio
          contentPaddingY: 1.0, // REDUCIDO para optimizar espacio
          contentTopSpacing: 0.5,  // REDUCIDO para código de barras más grande
          contentBottomSpacing: 0.5, // REDUCIDO para código de barras más grande
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true,
          // OPTIMIZACIÓN: Parámetros específicos para códigos de barras
          maxTextLength: 25,       // Límite de texto para nombres
          barcodeHeightFactor: 1.5, // 50% más alto
          barcodeWidthFactor: 1.2,  // 20% más ancho
          prioritizeBarcode: true   // Priorizar código de barras
        },
        {
          value: "zebra_4x1",
          text: "Zebra 4\" x 1\" (101.6mm x 25.4mm)",
          width: 101.6,
          height: 25.4,
          cols: 1,
          rows: 1,
          perPage: 1,
          // Configuraciones de alineación mejoradas para Zebra
          marginX: 1.0, // CORREGIDO
          marginY: 1.0, // CORREGIDO
          contentPaddingX: 1.5, // REDUCIDO para optimizar espacio
          contentPaddingY: 1.0, // REDUCIDO para optimizar espacio
          contentTopSpacing: 0.5,  // REDUCIDO para código de barras más grande
          contentBottomSpacing: 0.5, // REDUCIDO para código de barras más grande
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true,
          // OPTIMIZACIÓN: Parámetros específicos para códigos de barras
          maxTextLength: 35,       // Límite de texto para nombres
          barcodeHeightFactor: 1.5, // 50% más alto
          barcodeWidthFactor: 1.2,  // 20% más ancho
          prioritizeBarcode: true   // Priorizar código de barras
        }
      ],
      
      // Formatos para impresora DYMO con configuraciones de alineación mejoradas
      dymo: [
        {
          value: "dymo_11352",
          text: "DYMO 11352 (54mm x 25mm)",
          width: 54,
          height: 25,
          cols: 1,
          rows: 1,
          perPage: 1,
          // Configuraciones de alineación mejoradas para DYMO
          marginX: 0.0, // CORREGIDO
          marginY: 0.0, // CORREGIDO
          contentPaddingX: 1.0, // REDUCIDO para optimizar espacio
          contentPaddingY: 1.0, // REDUCIDO para optimizar espacio
          contentTopSpacing: 0.5,  // REDUCIDO para código de barras más grande
          contentBottomSpacing: 0.5, // REDUCIDO para código de barras más grande
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true,
          // OPTIMIZACIÓN: Parámetros específicos para códigos de barras
          maxTextLength: 20,       // Límite de texto para nombres
          barcodeHeightFactor: 1.6, // 60% más alto
          barcodeWidthFactor: 1.3,  // 30% más ancho
          prioritizeBarcode: true   // Priorizar código de barras
        },
        {
          value: "dymo_11353",
          text: "DYMO 11353 (25mm x 13mm)",
          width: 25,
          height: 13,
          cols: 1,
          rows: 1,
          perPage: 1,
          isSmall: true,
          // Configuraciones de alineación mejoradas para DYMO pequeña
          marginX: 0.0, // CORREGIDO
          marginY: 0.0, // CORREGIDO
          contentPaddingX: 0.5, // REDUCIDO para optimizar espacio
          contentPaddingY: 0.5, // REDUCIDO para optimizar espacio
          contentTopSpacing: 0.2,  // REDUCIDO para código de barras más grande
          contentBottomSpacing: 0.2, // REDUCIDO para código de barras más grande
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true,
          // OPTIMIZACIÓN: Parámetros específicos para códigos de barras en etiqueta muy pequeña
          maxTextLength: 10,       // Límite de texto para nombres
          barcodeHeightFactor: 1.6, // 60% más alto
          barcodeWidthFactor: 1.4,  // 40% más ancho
          prioritizeBarcode: true,  // Priorizar código de barras
          onlyBarcodeAndCode: true  // Mostrar solo el código y barcode
        },
        {
          value: "dymo_11354",
          text: "DYMO 11354 (57mm x 32mm)",
          width: 55,
          height: 32,
          cols: 1,
          rows: 1,
          perPage: 1,
          // Configuraciones de alineación mejoradas para DYMO
          marginX: 0.0, // CORREGIDO
          marginY: 0.0, // CORREGIDO
          contentPaddingX: 1.0, // REDUCIDO para optimizar espacio
          contentPaddingY: 1.0, // REDUCIDO para optimizar espacio
          contentTopSpacing: 1.0,  // REDUCIDO para código de barras más grande
          contentBottomSpacing: 1.0, // REDUCIDO para código de barras más grande
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true,
          // OPTIMIZACIÓN: Parámetros específicos para códigos de barras
          maxTextLength: 25,       // Límite de texto para nombres
          barcodeHeightFactor: 1.5, // 50% más alto
          barcodeWidthFactor: 1.3,  // 30% más ancho
          prioritizeBarcode: true   // Priorizar código de barras
        }
      ],
      
      // Formatos para impresora térmica con configuraciones de alineación mejoradas
      termica: [
        {
          value: "termica_40x25",
          text: "Térmica 40mm x 25mm",
          width: 40,
          height: 25,
          cols: 1,
          rows: 1,
          perPage: 1,
          // Configuraciones de alineación mejoradas para térmica
          marginX: 0.0, // CORREGIDO
          marginY: 0.0, // CORREGIDO
          contentPaddingX: 1.0, // REDUCIDO para optimizar espacio
          contentPaddingY: 1.0, // REDUCIDO para optimizar espacio
          contentTopSpacing: 0.5,  // REDUCIDO para código de barras más grande
          contentBottomSpacing: 0.5, // REDUCIDO para código de barras más grande
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true,
          // OPTIMIZACIÓN: Parámetros específicos para códigos de barras
          maxTextLength: 15,       // Límite de texto para nombres
          barcodeHeightFactor: 1.7, // 70% más alto
          barcodeWidthFactor: 1.3,  // 30% más ancho
          prioritizeBarcode: true,  // Priorizar código de barras
          onlyBarcodeAndCode: true  // Mostrar solo el código y barcode
        },
        {
          value: "termica_50x30",
          text: "Térmica 50mm x 30mm",
          width: 50,
          height: 30,
          cols: 1,
          rows: 1,
          perPage: 1,
          // Configuraciones de alineación mejoradas para térmica
          marginX: 0.0, // CORREGIDO
          marginY: 0.0, // CORREGIDO
          contentPaddingX: 1.0, // REDUCIDO para optimizar espacio
          contentPaddingY: 1.0, // REDUCIDO para optimizar espacio
          contentTopSpacing: 0.5,  // REDUCIDO para código de barras más grande
          contentBottomSpacing: 0.5, // REDUCIDO para código de barras más grande
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true,
          // OPTIMIZACIÓN: Parámetros específicos para códigos de barras
          maxTextLength: 18,       // Límite de texto para nombres
          barcodeHeightFactor: 1.6, // 60% más alto
          barcodeWidthFactor: 1.3,  // 30% más ancho
          prioritizeBarcode: true   // Priorizar código de barras
        },
        {
          value: "termica_58x40",
          text: "Térmica 58mm x 40mm",
          width: 58,
          height: 40,
          cols: 1,
          rows: 1,
          perPage: 1,
          // Configuraciones de alineación mejoradas para térmica
          marginX: 0.0, // CORREGIDO
          marginY: 0.0, // CORREGIDO
          contentPaddingX: 1.0, // REDUCIDO para optimizar espacio
          contentPaddingY: 1.0, // REDUCIDO para optimizar espacio
          contentTopSpacing: 1.0,  // REDUCIDO para código de barras más grande
          contentBottomSpacing: 1.0, // REDUCIDO para código de barras más grande
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true,
          // OPTIMIZACIÓN: Parámetros específicos para códigos de barras
          maxTextLength: 20,       // Límite de texto para nombres
          barcodeHeightFactor: 1.5, // 50% más alto
          barcodeWidthFactor: 1.3,  // 30% más ancho
          prioritizeBarcode: true   // Priorizar código de barras
        },
        {
          value: "termica_80x50",
          text: "Térmica 80mm x 50mm",
          width: 80,
          height: 50,
          cols: 1,
          rows: 1,
          perPage: 1,
          // Configuraciones de alineación mejoradas para térmica
          marginX: 0.0, // CORREGIDO
          marginY: 0.0, // CORREGIDO
          contentPaddingX: 1.5, // REDUCIDO para optimizar espacio
          contentPaddingY: 1.5, // REDUCIDO para optimizar espacio
          contentTopSpacing: 1.5,  // REDUCIDO para código de barras más grande
          contentBottomSpacing: 1.5, // REDUCIDO para código de barras más grande
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true,
          // OPTIMIZACIÓN: Parámetros específicos para códigos de barras
          maxTextLength: 30,       // Límite de texto para nombres
          barcodeHeightFactor: 1.5, // 50% más alto
          barcodeWidthFactor: 1.2,  // 20% más ancho
          prioritizeBarcode: true   // Priorizar código de barras
        }
      ]
    };

    // Estado de la aplicación MEJORADO con control de lotes
    const appState = {
      producto: null,           // Datos del producto
      formato: null,            // Formato de etiqueta seleccionado
      impresora: 'normal',      // Tipo de impresora activa
      cantidad: 0,              // Cantidad de etiquetas
      barcodesToGenerate: [],   // Códigos de barras pendientes
      isProcessing: false,      // Bloqueo de operaciones simultáneas
      pdfGenerating: false,     // Flag para evitar duplicación de PDF
      formatosCatalog: formatosCatalog, // Catálogo de formatos disponibles
      // NUEVOS: Control de lotes
      batchSize: 50,            // Tamaño de lote por defecto
      currentBatch: 0,          // Lote actual
      totalBatches: 0,          // Total de lotes
      processedLabels: 0        // Etiquetas procesadas
    };
    
    // Referencias a elementos del DOM
    const elements = {
      // Campos de entrada y selección
      checkboxStock: document.getElementById('usar_stock'),
      inputCantidad: document.getElementById('cantidad'),
      selectFormato: document.getElementById('formato_etiqueta'),
      printerOptions: document.querySelectorAll('.printer-option'),
      checkboxNombre: document.getElementById('mostrar_nombre'),
      checkboxPrecio: document.getElementById('mostrar_precio'),
      checkboxCodigo: document.getElementById('mostrar_codigo'),
      checkboxCodigoBarras: document.getElementById('mostrar_codigo_barras'),
      tamanoCodigoSelect: document.getElementById('tamano_codigo'),
      
      // Botones de acción
      btnPrint: document.getElementById('btn-print'),
      btnPDF: document.getElementById('btn-pdf'),
      
      // Contenedores
      previewContent: document.getElementById('preview-content'),
      printContent: document.getElementById('print-content'),
      pdfContainer: document.getElementById('pdf-container'),
    };
    
    // ====== INICIALIZACIÓN DE DATOS ======
    
    // Cargar datos del producto
    initProductData();
    
    // Configurar controladores de eventos
    setupEventListeners();
    
    // Configurar estado inicial de la interfaz
    setupInitialState();
    
    /**
     * Inicializa los datos del producto desde el DOM o valores predeterminados
     */
    function initProductData() {
      const productoElement = document.querySelector('[data-producto]');
      let productoData = {
        id: 0,
        nombre: 'Producto',
        codigo: '',
        precio: 0,
        stock: 0
      };
      
      if (productoElement) {
        try {
          productoData = JSON.parse(productoElement.dataset.producto);
          console.log('Datos del producto cargados:', productoData);
        } catch (e) {
          console.error('Error al parsear datos del producto:', e);
        }
      } else {
        // Intentar extraer datos del DOM como respaldo
        const nombre = document.querySelector('.product-name')?.textContent || 'Producto';
        const codigo = document.querySelector('.meta-value')?.textContent || '';
        const precio = parseFloat(document.querySelectorAll('.meta-value')[1]?.textContent?.replace('$', '') || 0);
        const stock = parseInt(document.querySelectorAll('.meta-value')[2]?.textContent?.replace(/\D/g, '') || 0);
        
        productoData = { id: 0, nombre, codigo, precio, stock };
        console.log('Datos del producto extraídos de elementos HTML:', productoData);
      }
      
      // Validar código de barras
      if (!productoData.codigo || productoData.codigo.trim() === '') {
        console.error('Error: El producto no tiene un código de barras válido');
        mostrarErrorDependencias('código de barras válido');
      }
      
      // Guardar en el estado
      appState.producto = productoData;
    }
    
    /**
     * MEJORADO: Configura los controladores de eventos para todos los componentes interactivos
     */
    function setupEventListeners() {
      // 1. Checkbox de stock
      if (elements.checkboxStock) {
        elements.checkboxStock.addEventListener('change', function() {
          if (elements.inputCantidad) {
            elements.inputCantidad.disabled = this.checked;
            if (this.checked) {
              elements.inputCantidad.value = appState.producto.stock;
              // CORRECCIÓN: Actualizar appState.cantidad cuando se marca "usar stock"
              appState.cantidad = parseInt(appState.producto.stock) || 0;
              console.log('Cantidad actualizada a stock actual:', appState.cantidad);
            } else {
              // CORRECCIÓN: Actualizar appState.cantidad al valor actual del input cuando se desmarca
              appState.cantidad = parseInt(elements.inputCantidad.value) || 0;
              console.log('Cantidad actualizada a valor manual:', appState.cantidad);
            }
            // NUEVO: Actualizar configuración de lotes
            updateBatchConfig();
          }
        });
      }
      
      // 2. Opciones de impresora
      if (elements.printerOptions && elements.printerOptions.length > 0) {
        elements.printerOptions.forEach(option => {
          option.addEventListener('click', function() {
            const printerId = this.dataset.printer;
            if (appState.impresora !== printerId) {
              // Actualizar UI
              elements.printerOptions.forEach(o => o.classList.remove('selected'));
              this.classList.add('selected');
              
              // Actualizar estado
              appState.impresora = printerId;
              console.log(`Impresora seleccionada: ${printerId}`);
              
              // Actualizar selectores de formato según la impresora seleccionada
              actualizarFormatosDisponibles(printerId);
              
              // NUEVO: Actualizar configuración de lotes
              updateBatchConfig();
            }
          });
        });
      }
      
      // 3. Selector de formato de etiquetas
      if (elements.selectFormato) {
        elements.selectFormato.addEventListener('change', function() {
          // Verificar si es una etiqueta pequeña y ajustar la interfaz
          const formatoSeleccionado = obtenerFormatoSeleccionado();
          const esEtiquetaPequena = verificarSiEtiquetaEsPequena(formatoSeleccionado);
          
          // Actualizar la interfaz según el tamaño
          ajustarInterfazSegunFormatoEtiqueta(formatoSeleccionado);
        });
      }
      
      // 4. Elementos de configuración con eventos
      const configElements = [
        { elem: elements.checkboxNombre },
        { elem: elements.checkboxPrecio },
        { elem: elements.checkboxCodigo },
        { elem: elements.checkboxCodigoBarras },
        { elem: elements.inputCantidad },
        { elem: elements.tamanoCodigoSelect }
      ];
      
      configElements.forEach(item => {
        if (item.elem) {
          item.elem.addEventListener('change', function() {
            // Si es el checkbox de código de barras, mostrar/ocultar opciones
            if (this === elements.checkboxCodigoBarras) {
              toggleCodigoBarrasOpciones();
            }
            
            // CORRECCIÓN: Actualizar appState.cantidad cuando cambia inputCantidad
            if (this === elements.inputCantidad) {
              appState.cantidad = parseInt(this.value) || 0;
              console.log('Cantidad actualizada manualmente:', appState.cantidad);
              // NUEVO: Actualizar configuración de lotes
              updateBatchConfig();
            }
          });
        }
      });
      
      // 5. Botones de acción MEJORADOS con validación
      if (elements.btnPrint) {
        elements.btnPrint.addEventListener('click', function() {
          if (validateBeforeProcessing()) {
            imprimirEtiquetas();
          }
        });
      }
      
      if (elements.btnPDF) {
        elements.btnPDF.addEventListener('click', function() {
          // Evitar múltiples clics rápidos
          if (!appState.pdfGenerating && validateBeforeProcessing()) {
            descargarPDF();
          }
        });
      }
    }
    
    /**
     * NUEVO: Valida antes de procesar etiquetas
     * @returns {boolean} Si es válido procesar
     */
    function validateBeforeProcessing() {
      const cantidad = obtenerCantidad();
      const impresora = appState.impresora;
      const limits = getPrinterLimits(impresora);
      
      // Verificar si excede límites máximos
      if (cantidad > limits.maximum) {
        mostrarAlertaFormato(
          `No se pueden procesar ${cantidad.toLocaleString()} etiquetas. El límite máximo para impresoras ${impresora} es ${limits.maximum.toLocaleString()} etiquetas.`,
          'error'
        );
        return false;
      }
      
      // Verificar si necesita confirmación para cantidades grandes
      if (cantidad > limits.warning) {
        const confirmMessage = `¿Está seguro de que desea procesar ${cantidad.toLocaleString()} etiquetas? Esta operación puede tomar varios minutos.`;
        if (!confirm(confirmMessage)) {
          return false;
        }
      }
      
      return true;
    }
    
    /**
     * NUEVO: Actualiza la configuración de lotes basada en la cantidad y tipo de impresora
     */
    function updateBatchConfig() {
      const cantidad = obtenerCantidad();
      const impresora = appState.impresora;
      const limits = getPrinterLimits(impresora);
      
      // Determinar tamaño de lote óptimo
      if (cantidad <= limits.safe) {
        appState.batchSize = cantidad; // Procesar todo de una vez
      } else if (impresora === 'normal') {
        appState.batchSize = 50; // Lotes más pequeños para impresoras normales
      } else {
        appState.batchSize = 100; // Lotes más grandes para impresoras térmicas
      }
      
      appState.totalBatches = Math.ceil(cantidad / appState.batchSize);
      appState.currentBatch = 0;
      appState.processedLabels = 0;
      
      console.log(`Configuración de lotes actualizada: ${appState.totalBatches} lotes de ${appState.batchSize} etiquetas`);
    }
    
    /**
     * Configura el estado inicial de la interfaz
     */
    function setupInitialState() {
      // Configurar estado inicial de cantidad
      if (elements.inputCantidad && elements.checkboxStock) {
        elements.inputCantidad.disabled = elements.checkboxStock.checked;
        // CORRECCIÓN: Inicializar appState.cantidad al valor correcto según el estado del checkbox
        if (elements.checkboxStock.checked) {
          appState.cantidad = parseInt(appState.producto.stock) || 0;
        } else {
          appState.cantidad = parseInt(elements.inputCantidad.value) || 0;
        }
        console.log('Cantidad inicial configurada:', appState.cantidad);
      }
      
      // Configurar opciones de código de barras
      toggleCodigoBarrasOpciones();
      
      // Inicializar formatos disponibles para la impresora por defecto
      actualizarFormatosDisponibles('normal');
      
      // NUEVO: Configurar lotes iniciales
      updateBatchConfig();
    }
    
    /**
     * Verifica si una etiqueta es considerada "pequeña" basada en sus dimensiones
     * @param {Object} formato - Formato de la etiqueta
     * @returns {boolean} - true si es una etiqueta pequeña
     */
    function verificarSiEtiquetaEsPequena(formato) {
      // Considerar etiqueta pequeña si tiene el marcador isSmall o dimensiones reducidas
      if (formato.isSmall) return true;
      
      // O si el ancho es menor a 30mm o la altura menor a 20mm
      return (formato.ancho < 30 || formato.alto < 20);
    }
    
    /**
     * Trunca el texto si excede el límite establecido
     * @param {string} texto - Texto a truncar
     * @param {number} limite - Límite de caracteres
     * @returns {string} - Texto truncado si excede el límite
     */
    function truncarTexto(texto, limite) {
      if (!texto) return '';
      if (texto.length <= limite) return texto;
      return texto.substring(0, limite) + '...';
    }
    
    /**
     * Ajusta la interfaz según el formato de etiqueta seleccionado
     * @param {Object} formato - Formato de la etiqueta seleccionado
     */
    function ajustarInterfazSegunFormatoEtiqueta(formato) {
      // Detectar si es una etiqueta pequeña
      const esEtiquetaPequena = verificarSiEtiquetaEsPequena(formato);
      
      // Verificar si es una etiqueta para impresora térmica que requiere solo código de barras y código
      const imprimiendoEnTermica = (appState.impresora !== 'normal');
      const requiereSoloCodigoBarras = formato.onlyBarcodeAndCode === true;
      
      // Para etiquetas pequeñas o formatos que solo admiten código y barcode
      if (esEtiquetaPequena || requiereSoloCodigoBarras) {
        // Mostrar alerta informativa
        mostrarAlertaFormato(
          "El formato de etiqueta seleccionado es pequeño. Solo se mostrará el código de barras y el texto del código.", 
          "info"
        );
        
        // Desactivar opciones irrelevantes
        if (elements.checkboxNombre) {
          elements.checkboxNombre.checked = false;
          elements.checkboxNombre.disabled = true;
        }
        
        if (elements.checkboxPrecio) {
          elements.checkboxPrecio.checked = false;
          elements.checkboxPrecio.disabled = true;
        }
        
        // Asegurar que código y código de barras estén activados
        if (elements.checkboxCodigo) {
          elements.checkboxCodigo.checked = true;
          elements.checkboxCodigo.disabled = true;
        }
        
        if (elements.checkboxCodigoBarras) {
          elements.checkboxCodigoBarras.checked = true;
          elements.checkboxCodigoBarras.disabled = true;
        }
        
        // Forzar tamaño grande para el código de barras en térmicas
        if (elements.tamanoCodigoSelect) {
          // Para impresoras térmicas, usar tamaño grande para barcode
          if (imprimiendoEnTermica) {
            elements.tamanoCodigoSelect.value = "grande";
          } else {
            elements.tamanoCodigoSelect.value = "pequeno";
          }
          elements.tamanoCodigoSelect.disabled = true;
        }
      } else if (imprimiendoEnTermica && formato.prioritizeBarcode) {
        // Para impresoras térmicas con etiquetas medianas, optimizar para código de barras
        mostrarAlertaFormato(
          "Formato optimizado para impresora térmica. Se priorizará el tamaño del código de barras.", 
          "info"
        );
        
        // Permitir nombres y precios pero dejar el código de barras como obligatorio
        if (elements.checkboxNombre) {
          elements.checkboxNombre.disabled = false;
        }
        
        if (elements.checkboxPrecio) {
          elements.checkboxPrecio.disabled = false;
        }
        
        // Asegurar que código y código de barras estén activados
        if (elements.checkboxCodigo) {
          elements.checkboxCodigo.checked = true;
          elements.checkboxCodigo.disabled = false;
        }
        
        if (elements.checkboxCodigoBarras) {
          elements.checkboxCodigoBarras.checked = true;
          elements.checkboxCodigoBarras.disabled = false;
        }
        
        // Forzar tamaño grande para el código de barras en térmicas
        if (elements.tamanoCodigoSelect) {
          elements.tamanoCodigoSelect.value = "grande";
          elements.tamanoCodigoSelect.disabled = false;
        }
      } else {
        // Restaurar funcionalidad normal para etiquetas estándar
        // Quitar alerta si existe
        const alertaPrevia = document.getElementById('alerta-formato');
        if (alertaPrevia) alertaPrevia.remove();
        
        // Habilitar todas las opciones
        if (elements.checkboxNombre) elements.checkboxNombre.disabled = false;
        if (elements.checkboxPrecio) elements.checkboxPrecio.disabled = false;
        if (elements.checkboxCodigo) elements.checkboxCodigo.disabled = false;
        if (elements.checkboxCodigoBarras) elements.checkboxCodigoBarras.disabled = false;
        if (elements.tamanoCodigoSelect) elements.tamanoCodigoSelect.disabled = false;
      }
    }
    
    /**
     * Actualiza los formatos de etiqueta disponibles en el select según la impresora seleccionada
     * @param {string} impresora - Tipo de impresora seleccionada
     */
    function actualizarFormatosDisponibles(impresora) {
      if (!elements.selectFormato) return;
      
      // Obtener los formatos específicos para esta impresora
      const formatos = appState.formatosCatalog[impresora] || [];
      
      // Guardar el valor seleccionado actualmente (si existiera)
      const valorActual = elements.selectFormato.value;
      
      // Vaciar el select para reconstruirlo con las opciones compatibles
      elements.selectFormato.innerHTML = '';
      
      // Añadir las opciones compatibles
      formatos.forEach(formato => {
        const option = document.createElement('option');
        option.value = formato.value;
        option.textContent = formato.text;
        
        // Añadir todos los atributos específicos de configuración
        option.dataset.width = formato.width;
        option.dataset.height = formato.height;
        option.dataset.cols = formato.cols;
        option.dataset.rows = formato.rows;
        option.dataset.perPage = formato.perPage;
        option.dataset.marginX = formato.marginX;
        option.dataset.marginY = formato.marginY;
        option.dataset.contentPaddingX = formato.contentPaddingX;
        option.dataset.contentPaddingY = formato.contentPaddingY;
        
        // Añadir parámetros de espacio vertical específicos
        if (formato.contentTopSpacing !== undefined) {
          option.dataset.contentTopSpacing = formato.contentTopSpacing;
        }
        if (formato.contentBottomSpacing !== undefined) {
          option.dataset.contentBottomSpacing = formato.contentBottomSpacing;
        }
        if (formato.barcodeVerticalShift !== undefined) {
          option.dataset.barcodeVerticalShift = formato.barcodeVerticalShift;
        }
        
        // Añadir marcadores de alineación si existen
        if (formato.centerOffset !== undefined) {
          option.dataset.centerOffset = formato.centerOffset;
        }
        if (formato.verticalCenter !== undefined) {
          option.dataset.verticalCenter = formato.verticalCenter;
        }
        if (formato.horizontalCenter !== undefined) {
          option.dataset.horizontalCenter = formato.horizontalCenter;
        }
        
        // Añadir espaciado entre etiquetas si está definido
        if (formato.horizontalSpacing !== undefined) {
          option.dataset.horizontalSpacing = formato.horizontalSpacing;
        }
        if (formato.verticalSpacing !== undefined) {
          option.dataset.verticalSpacing = formato.verticalSpacing;
        }
        
        // Añadir marcador si es etiqueta pequeña
        if (formato.isSmall) {
          option.dataset.isSmall = "true";
        }
        
        // OPTIMIZACIONES ADICIONALES: Añadir parámetros para códigos de barras
        if (formato.maxTextLength !== undefined) {
          option.dataset.maxTextLength = formato.maxTextLength;
        }
        if (formato.barcodeHeightFactor !== undefined) {
          option.dataset.barcodeHeightFactor = formato.barcodeHeightFactor;
        }
        if (formato.barcodeWidthFactor !== undefined) {
          option.dataset.barcodeWidthFactor = formato.barcodeWidthFactor;
        }
        if (formato.prioritizeBarcode !== undefined) {
          option.dataset.prioritizeBarcode = formato.prioritizeBarcode;
        }
        if (formato.onlyBarcodeAndCode !== undefined) {
          option.dataset.onlyBarcodeAndCode = formato.onlyBarcodeAndCode;
        }
        
        // Intentar mantener la selección previa si existe y es compatible
        if (formato.value === valorActual) {
          option.selected = true;
        }
        
        elements.selectFormato.appendChild(option);
      });
      
      // Si no hay opciones seleccionadas, seleccionar la primera
      if (elements.selectFormato.selectedIndex === -1 && elements.selectFormato.options.length > 0) {
        elements.selectFormato.selectedIndex = 0;
      }
      
      // Disparar evento change para actualizar la UI
      const event = new Event('change');
      elements.selectFormato.dispatchEvent(event);
    }
    
    /**
     * Muestra u oculta las opciones avanzadas de código de barras
     */
    function toggleCodigoBarrasOpciones() {
      const mostrar = !elements.checkboxCodigoBarras || elements.checkboxCodigoBarras.checked;
      const tabBarcode = document.getElementById('tab-barcode');
      
      if (tabBarcode) {
        // En el sistema de pestañas, controlamos visibilidad de la pestaña completa
        const tabButton = document.querySelector('[data-tab="barcode"]');
        
        if (tabButton) {
          if (mostrar) {
            tabButton.style.display = '';
          } else {
            tabButton.style.display = 'none';
            // Si la pestaña está activa, cambiar a general
            if (tabButton.classList.contains('active')) {
              document.querySelector('[data-tab="general"]').click();
            }
          }
        }
      } else {
        // Compatibilidad: buscar el div de opciones antiguo
        const opcionesDiv = document.getElementById('codigo_barras_opciones');
        if (opcionesDiv) {
          opcionesDiv.style.display = mostrar ? 'block' : 'none';
        }
      }
    }
    
    /**
     * Obtiene el formato de etiqueta seleccionado con todos sus parámetros
     * @returns {Object} Objeto con todos los datos del formato
     */
    function obtenerFormatoSeleccionado() {
      if (!elements.selectFormato || elements.selectFormato.selectedIndex === -1) {
        // Valor predeterminado si no hay selección
        return {
          id: 'avery5160',
          ancho: 63.5,
          alto: 26.9,
          columnas: 3,
          filas: 10,
          porPagina: 30,
          // Configuraciones predeterminadas de márgenes
          marginX: 6.5, // CORREGIDO
          marginY: 13.5, // CORREGIDO
          contentPaddingX: 2,
          contentPaddingY: 2,
          horizontalSpacing: 3.0, // NUEVO
          verticalSpacing: 0.0, // NUEVO
          maxTextLength: 25, // Valor predeterminado
          barcodeHeightFactor: 1.0 // Factor de altura normal
        };
      }
      
      const option = elements.selectFormato.options[elements.selectFormato.selectedIndex];
      
      // Crear objeto completo con todas las propiedades de configuración
      return {
        id: option.value,
        ancho: parseFloat(option.dataset.width),
        alto: parseFloat(option.dataset.height),
        columnas: parseInt(option.dataset.cols),
        filas: parseInt(option.dataset.rows),
        porPagina: parseInt(option.dataset.perPage),
        marginX: parseFloat(option.dataset.marginX || 0),
        marginY: parseFloat(option.dataset.marginY || 0),
        contentPaddingX: parseFloat(option.dataset.contentPaddingX || 2),
        contentPaddingY: parseFloat(option.dataset.contentPaddingY || 2),
        contentTopSpacing: parseFloat(option.dataset.contentTopSpacing || 0),
        contentBottomSpacing: parseFloat(option.dataset.contentBottomSpacing || 0),
        barcodeVerticalShift: parseFloat(option.dataset.barcodeVerticalShift || 0),
        centerOffset: parseFloat(option.dataset.centerOffset || 0),
        verticalCenter: option.dataset.verticalCenter === "true",
        horizontalCenter: option.dataset.horizontalCenter === "true",
        horizontalSpacing: parseFloat(option.dataset.horizontalSpacing || 0),
        verticalSpacing: parseFloat(option.dataset.verticalSpacing || 0),
        isSmall: option.dataset.isSmall === "true",
        // OPTIMIZACIONES: Parámetros para códigos de barras
        maxTextLength: parseInt(option.dataset.maxTextLength || 25),
        barcodeHeightFactor: parseFloat(option.dataset.barcodeHeightFactor || 1.0),
        barcodeWidthFactor: parseFloat(option.dataset.barcodeWidthFactor || 1.0),
        prioritizeBarcode: option.dataset.prioritizeBarcode === "true",
        onlyBarcodeAndCode: option.dataset.onlyBarcodeAndCode === "true"
      };
    }
    
    /**
     * Obtiene la cantidad de etiquetas a generar
     * @returns {number} Cantidad de etiquetas
     */
    function obtenerCantidad() {
      if (elements.checkboxStock && elements.checkboxStock.checked) {
        return Math.max(1, parseInt(appState.producto.stock) || 1);
      } else {
        return Math.max(1, parseInt(elements.inputCantidad?.value) || 1);
      }
    }
    
    // CORREGIDO: Función mejorada para posicionamiento preciso
    function calcularPosicionX(formato, configuracion, columnaIndex) {
      // Usar las configuraciones específicas para este formato
      let posX;
      
      // COMPENSACIONES PRECISAS ESPECÍFICAS: Ajustes calibrados por tipo de impresora
      const offsetCorrections = {
        'normal': {
          'avery5160': 0.35,
          'avery5161': 0.40,
          'avery5163': 0.40,
          'default': 0.35
        },
        'zebra': {
          'default': 0.25
        },
        'dymo': {
          'default': 0.25
        },
        'termica': {
          'default': 0.25
        }
      };
      
      // Obtener el factor de corrección adecuado
      const formatoId = formato.id || 'default';
      const correccion = (offsetCorrections[configuracion.impresora] && 
                          offsetCorrections[configuracion.impresora][formatoId]) || 
                          offsetCorrections[configuracion.impresora]?.default || 0;
      
      // Si la impresora es normal (impresora de hojas estándar)
      if (configuracion.impresora === 'normal') {
        // AJUSTE CRÍTICO: Fórmula mejorada con factor de corrección para cada columna
        posX = formato.marginX + (columnaIndex * (formato.ancho + formato.horizontalSpacing)) + (columnaIndex * correccion);
      } else {
        // Para impresoras térmicas/DYMO/Zebra
        posX = formato.marginX;
        
        // Aplicar centrado horizontal si está habilitado 
        if (formato.horizontalCenter) {
          // Ajuste para centrado horizontal preciso
          const espacioDisponible = configuracion.paginaAncho - formato.ancho;
          posX = Math.max(0, espacioDisponible / 2) + correccion;
        }
      }
      
      // Aplicar ajuste de posición para calibración fina
      if (formato.centerOffset !== undefined) {
        posX += formato.centerOffset;
      }
      
      return posX;
    }
    
    // CORREGIDO: Función mejorada para posicionamiento vertical preciso
    function calcularPosicionY(formato, configuracion, filaIndex) {
      // Usar las configuraciones específicas para este formato
      let posY;
      
      // COMPENSACIONES PRECISAS ESPECÍFICAS: Ajustes calibrados por tipo de impresora
      const offsetCorrections = {
        'normal': {
          'avery5160': 0.25,
          'avery5161': 0.30,
          'avery5163': 0.30,
          'default': 0.25
        },
        'zebra': {
          'default': 0.0
        },
        'dymo': {
          'default': 0.0
        },
        'termica': {
          'default': 0.0
        }
      };
      
      // Obtener el factor de corrección adecuado
      const formatoId = formato.id || 'default';
      const correccion = (offsetCorrections[configuracion.impresora] && 
                        offsetCorrections[configuracion.impresora][formatoId]) || 
                        offsetCorrections[configuracion.impresora]?.default || 0;
      
      // Si la impresora es normal (impresora de hojas estándar)
      if (configuracion.impresora === 'normal') {
        // AJUSTE CRÍTICO: Fórmula mejorada con factor de corrección para cada fila
        posY = formato.marginY + (filaIndex * (formato.alto + formato.verticalSpacing)) + (filaIndex * correccion);
      } else {
        // Para impresoras térmicas/DYMO/Zebra
        posY = formato.marginY;
        
        // Aplicar centrado vertical si está habilitado
        if (formato.verticalCenter) {
          // Ajuste para centrado vertical preciso
          const espacioDisponible = configuracion.paginaAlto - formato.alto;
          posY = Math.max(0, espacioDisponible / 2);
        }
      }
      
      return posY;
    }
    
    /**
     * Obtiene la configuración específica para el tipo de impresora seleccionado
     * Versión mejorada con especificaciones precisas por modelo
     * @param {Object} formato - Formato de etiqueta
     * @param {string} impresora - Tipo de impresora
     * @returns {Object} Configuración para la impresora
     */
    function obtenerConfiguracionImpresora(formato, impresora) {
      const config = {
        impresora: impresora,
        dpi: 300, // DPI por defecto
        paginaAncho: 210, // Valor por defecto (A4)
        paginaAlto: 297,  // Valor por defecto (A4)
        marginX: formato.marginX || 0,
        marginY: formato.marginY || 0,
        contentPaddingX: formato.contentPaddingX || 2,
        contentPaddingY: formato.contentPaddingY || 2,
        contentTopSpacing: formato.contentTopSpacing || 0,
        contentBottomSpacing: formato.contentBottomSpacing || 0,
        barcodeVerticalShift: formato.barcodeVerticalShift || 0,
        orientation: 'portrait',
        mediaType: 'default',
        verticalCenter: formato.verticalCenter || false,
        horizontalCenter: formato.horizontalCenter || false,
        // OPTIMIZACIONES: Añadir parámetros para códigos de barras
        maxTextLength: formato.maxTextLength || 25,
        barcodeHeightFactor: formato.barcodeHeightFactor || 1.0,
        barcodeWidthFactor: formato.barcodeWidthFactor || 1.0,
        prioritizeBarcode: formato.prioritizeBarcode || false,
        onlyBarcodeAndCode: formato.onlyBarcodeAndCode || false
      };
      
      // Aplicar configuración específica por tipo de impresora
      switch (impresora) {
        case 'zebra':
          config.dpi = 203; // 203 DPI es el estándar en Zebra GK420d/GX420d
          config.paginaAncho = Math.min(formato.ancho, 104); // 104mm es el ancho máximo (4.09")
          config.paginaAlto = formato.alto;
          config.mediaType = 'labels';
          config.orientation = formato.ancho > formato.alto ? 'landscape' : 'portrait';
          // Valores por defecto mejorados para Zebra
          if (!formato.barcodeHeightFactor) config.barcodeHeightFactor = 1.5;
          if (!formato.barcodeWidthFactor) config.barcodeWidthFactor = 1.2;
          break;
        
        case 'dymo':
          config.dpi = 300; // 300 DPI es el estándar en DYMO LabelWriter 450
          config.paginaAncho = Math.min(formato.ancho, 56); // 56mm es el ancho máximo (2.2")
          config.paginaAlto = formato.alto;
          config.mediaType = 'continuous';
          config.orientation = formato.ancho > formato.alto ? 'landscape' : 'portrait';
          // Valores por defecto mejorados para DYMO
          if (!formato.barcodeHeightFactor) config.barcodeHeightFactor = 1.6;
          if (!formato.barcodeWidthFactor) config.barcodeWidthFactor = 1.3;
          break;
        
        case 'termica':
          config.dpi = 203; // 203 DPI es común en impresoras térmicas
          config.paginaAncho = Math.min(formato.ancho, 80); // 80mm es el ancho estándar (también hay de 58mm)
          config.paginaAlto = formato.alto;
          config.mediaType = 'continuous';
          config.orientation = formato.ancho > formato.alto ? 'landscape' : 'portrait';
          // Valores por defecto mejorados para térmicas
          if (!formato.barcodeHeightFactor) config.barcodeHeightFactor = 1.7;
          if (!formato.barcodeWidthFactor) config.barcodeWidthFactor = 1.3;
          break;
        
        case 'normal':
        default:
          config.dpi = 300; // 300 DPI típico para láser/inyección
          config.paginaAncho = 210; // A4
          config.paginaAlto = 297;  // A4
          config.mediaType = 'sheets';
          config.orientation = 'portrait';
          break;
      }
      
      return config;
    }
    
    function crearEtiquetaHTML(x, y, ancho, alto, index = 0, posicionRelativa = false) {
      // Obtener el formato seleccionado
      const formato = obtenerFormatoSeleccionado();
      
      // Determinar el estilo de posicionamiento
      let positionStyle = posicionRelativa ? 
        'position:relative;' : 
        `position:absolute;left:${x}mm;top:${y}mm;`;
      
      // Detectar si es una etiqueta pequeña
      const esEtiquetaPequena = verificarSiEtiquetaEsPequena(formato);
      
      // OPTIMIZACIÓN: Determinar si estamos en impresora térmica para ajustes especiales
      const imprimiendoEnTermica = (appState.impresora !== 'normal');
      const requiereSoloCodigoBarras = formato.onlyBarcodeAndCode === true;
      
      // Determinar qué elementos mostrar según tamaño y configuración
      let mostrarCodigoBarras = esEtiquetaPequena ? true : (!elements.checkboxCodigoBarras || elements.checkboxCodigoBarras.checked);
      let mostrarCodigoTexto = esEtiquetaPequena ? true : (!elements.checkboxCodigo || elements.checkboxCodigo.checked);
      let mostrarNombre = esEtiquetaPequena ? false : (!elements.checkboxNombre || elements.checkboxNombre.checked);
      let mostrarPrecio = esEtiquetaPequena ? false : (!elements.checkboxPrecio || elements.checkboxPrecio.checked);
      
      // OPTIMIZACIÓN: Si es una etiqueta térmica que prioriza el código, ajustar lo que se muestra
      if (requiereSoloCodigoBarras || (imprimiendoEnTermica && formato.prioritizeBarcode)) {
        // Forzar código de barras visible
        mostrarCodigoBarras = true;
        mostrarCodigoTexto = true;
        
        // Para etiquetas muy pequeñas, solo mostrar código
        if (requiereSoloCodigoBarras) {
          mostrarNombre = false;
          mostrarPrecio = false;
        }
      }
      
      // Crear estilos CSS específicos para manejar el espacio vertical
      let contentStyle = '';
      let barcodeContainerStyle = '';
      
      // Configuración de espaciado y centrado personalizada
      if (formato.impresora !== 'normal' || (formato.contentTopSpacing > 0 || formato.contentBottomSpacing > 0)) {
        let barcodeMarginTop = 0;
        let barcodeMarginBottom = 0;
        
        // Si tenemos espaciados específicos definidos para este formato
        if (formato.contentTopSpacing > 0 || formato.contentBottomSpacing > 0) {
          barcodeMarginTop = formato.contentTopSpacing;
          barcodeMarginBottom = formato.contentBottomSpacing;
        }
        
        // Si hay desplazamiento vertical específico para el código de barras
        if (formato.barcodeVerticalShift !== undefined && formato.barcodeVerticalShift !== 0) {
          barcodeMarginTop += formato.barcodeVerticalShift;
          barcodeMarginBottom -= formato.barcodeVerticalShift;
        }
        
        // Ajustar valores negativos
        barcodeMarginTop = Math.max(0, barcodeMarginTop);
        barcodeMarginBottom = Math.max(0, barcodeMarginBottom);
        
        // OPTIMIZADO: Aumentar el espacio para códigos en impresoras térmicas
        const marginTopValue = imprimiendoEnTermica ? Math.max(0.5, barcodeMarginTop) : barcodeMarginTop;
        const marginBottomValue = imprimiendoEnTermica ? Math.max(0.5, barcodeMarginBottom) : barcodeMarginBottom;
        
        // Aplicar estilo al contenedor de barcode
        if (!esEtiquetaPequena) {
          // OPTIMIZADO: Usar max-width:98% para impresoras térmicas
          const maxWidth = imprimiendoEnTermica ? "98%" : "95%";
          barcodeContainerStyle = `style="display:flex;flex-direction:column;justify-content:center;align-items:center;margin-top:${marginTopValue}mm;margin-bottom:${marginBottomValue}mm;max-width:${maxWidth};overflow:hidden;"`;
        } else {
          // Para etiquetas pequeñas, usar valores optimizados
          const maxWidth = imprimiendoEnTermica ? "99%" : "95%";
          barcodeContainerStyle = `style="display:flex;flex-direction:column;justify-content:center;align-items:center;margin-top:${marginTopValue/2}mm;margin-bottom:${marginBottomValue/2}mm;max-width:${maxWidth};overflow:hidden;"`;
        }
      }
      
      // OPTIMIZADO: Ajuste de padding para evitar desbordamiento
      const reduccion = esEtiquetaPequena ? 1.5 : (imprimiendoEnTermica ? 1.0 : 0.5);
      const paddingX = Math.max(0.5, (formato.contentPaddingX || 2) - reduccion);
      const paddingY = Math.max(0.5, (formato.contentPaddingY || 2) - reduccion);
      
      // Estilo para el contenedor principal
      if (formato.verticalCenter || formato.horizontalCenter) {
        let centerStyles = [
          'display:flex', 
          'flex-direction:column',
          'max-width:100%',
          'overflow:hidden'
        ];
        
        if (formato.horizontalCenter) {
          centerStyles.push('align-items:center', 'text-align:center');
        }
        
        if (formato.verticalCenter) {
          centerStyles.push('justify-content:center');
        }
        
        contentStyle = `style="${centerStyles.join(';')};padding:${paddingY}mm ${paddingX}mm;"`;
      } else {
        // Para Avery, usar el estilo normal con padding reducido
        contentStyle = `style="padding:${paddingY}mm ${paddingX}mm;max-width:100%;overflow:hidden;"`;
      }
      
      // Construir el HTML de la etiqueta
      let html = `
        <div class="etiqueta ${esEtiquetaPequena ? 'small-label' : ''}" style="${positionStyle}width:${ancho}mm;height:${alto}mm;overflow:hidden;">
          <div class="etiqueta-content" ${contentStyle}>
      `;
      
      // Para etiquetas pequeñas, optimizar el espacio y modificar el estilo
      if (esEtiquetaPequena) {
        // Código de barras con tamaño ajustado para formato pequeño
        if (mostrarCodigoBarras) {
          // Envolvemos en div para mejor control del posicionamiento vertical
          html += `<div ${barcodeContainerStyle}>`;
          const svgId = `barcode-${index}-${Date.now()}`;
          // No mostrar texto en el SVG porque ocuparía demasiado espacio
          // OPTIMIZADO: Mayor altura para etiquetas pequeñas en impresoras térmicas
          const maxHeight = imprimiendoEnTermica ? "80%" : "65%";
          html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}" data-show-text="false" style="max-width:99%;max-height:${maxHeight};margin:auto;"></svg>`;
          html += `</div>`;
          appState.barcodesToGenerate.push(svgId);
        }
        
        // Código en texto con fuente más pequeña
        if (mostrarCodigoTexto) {
          // OPTIMIZADO: Texto más grande para térmicas
          const fontSize = imprimiendoEnTermica ? "7px" : "6px";
          html += `<div class="etiqueta-codigo" style="font-size:${fontSize};margin-top:1px;margin-bottom:0;text-align:center;max-width:99%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${appState.producto.codigo}</div>`;
        }
      } else {
        // Comportamiento normal para etiquetas estándar
        // Nombre del producto (truncado según las configuraciones del formato)
        if (mostrarNombre) {
          // OPTIMIZADO: Truncar el nombre si excede el límite de caracteres
          const nombreTruncado = truncarTexto(appState.producto.nombre, formato.maxTextLength);
          html += `<div class="etiqueta-nombre" style="max-width:98%;overflow:hidden;text-overflow:ellipsis;">${nombreTruncado}</div>`;
        }
        
        // Precio
        if (mostrarPrecio) {
          html += `<div class="etiqueta-precio" style="max-width:98%;">${parseFloat(appState.producto.precio).toFixed(2)}</div>`;
        }
        
        // Código de barras - ENVUELTO EN DIV PARA CONTROL DE POSICIÓN
        if (mostrarCodigoBarras) {
          // Envolvemos en div para mejor control del posicionamiento vertical
          html += `<div ${barcodeContainerStyle}>`;
          // Agregar un identificador único para este SVG
          const svgId = `barcode-${index}-${Date.now()}`;
          
          // Obtener si debemos mostrar el texto del código en el SVG
          const mostrarTextoEnSVG = !mostrarCodigoTexto; // Invertido para evitar duplicación
          
          // OPTIMIZADO: Mayor ancho para impresoras térmicas
          const maxWidth = imprimiendoEnTermica ? "99%" : "95%";
          const maxHeight = imprimiendoEnTermica ? "85%" : "75%";
          
          // Almacenar preferencia en el propio elemento para uso posterior
          html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}" data-show-text="${mostrarTextoEnSVG}" style="max-width:${maxWidth};max-height:${maxHeight};"></svg>`;
          html += `</div>`;
          
          // Agregar este SVG a la lista de códigos por generar
          appState.barcodesToGenerate.push(svgId);
        }
        
        // Código en texto (solo si no se muestra en el código de barras o si se especificó)
        if (mostrarCodigoTexto) {
          html += `<div class="etiqueta-codigo" style="max-width:98%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${appState.producto.codigo}</div>`;
        }
      }
      
      html += `
          </div>
        </div>
      `;
      
      return html;
    }
    
    /**
     * Genera los códigos de barras en las etiquetas
     * Sistema mejorado con procesamiento por lotes y optimización
     */
    function generarCodigosBarras() {
      if ((elements.checkboxCodigoBarras && !elements.checkboxCodigoBarras.checked) || appState.barcodesToGenerate.length === 0) {
        console.log('No se requieren códigos de barras o no hay SVGs para generar');
        return;
      }
      
      if (!appState.producto.codigo || appState.producto.codigo.trim() === '') {
        console.error('Código de barras inválido');
        return;
      }
      
      try {
        console.log(`Generando ${appState.barcodesToGenerate.length} códigos de barras...`);
        
        // Obtener configuración de código de barras
        const barcodeConfig = obtenerConfiguracionCodigoBarras();
        console.log('Configuración de códigos:', barcodeConfig);
        
        // Procesar cada código de barras por ID
        appState.barcodesToGenerate.forEach(svgId => {
          const svg = document.getElementById(svgId);
          if (!svg) {
            console.warn(`No se encontró el SVG con ID: ${svgId}`);
            return;
          }
          
          generarCodigoBarrasEnSVG(svg, barcodeConfig);
        });
        
        console.log('Generación de códigos de barras completada');
      } catch(e) {
        console.error("Error general al generar códigos de barras:", e);
      }
    }
    
    /**
     * Genera un código de barras en un elemento SVG específico
     * @param {SVGElement} svg - Elemento SVG donde generar el código
     * @param {Object} config - Configuración del código de barras
     */
    function generarCodigoBarrasEnSVG(svg, config) {
      try {
        const codigoLimpio = svg.dataset.codigo.trim();
        
        // Usar la preferencia almacenada en el SVG
        const mostrarTextoEnSVG = svg.dataset.showText === "true";
        
        // Verificar si es para una etiqueta pequeña y ajustar el tamaño
        const formato = obtenerFormatoSeleccionado();
        const esEtiquetaPequena = verificarSiEtiquetaEsPequena(formato);
        
        // OPTIMIZADO: Obtener factores de ajuste de tamaño para la impresora y formato actual
        const imprimiendoEnTermica = (appState.impresora !== 'normal');
        
        // OPTIMIZADO: Ajustes de tamaño mejorados para distintos tipos de impresoras y formatos
        let anchoLinea = config.anchoLinea;
        let altoBarras = config.altoBarras;
        let tamanoTexto = config.tamanoTexto;
        
        // Aplicar factores de ajuste según el formato y tipo de impresora
        if (imprimiendoEnTermica) {
          // Para impresoras térmicas, aumentar tamaño
          anchoLinea = config.anchoLinea * formato.barcodeWidthFactor;
          altoBarras = config.altoBarras * formato.barcodeHeightFactor;
          tamanoTexto = config.tamanoTexto * 1.1; // Aumentar texto un 10%
        } else if (esEtiquetaPequena) {
          // Para etiquetas pequeñas en impresoras normales
          anchoLinea = Math.max(0.8, config.anchoLinea * 0.8); // Reducir menos
          altoBarras = Math.max(20, config.altoBarras * 0.8); // Reducir menos
          tamanoTexto = Math.max(7, config.tamanoTexto * 0.8); // Reducir menos
        }
        
        // OPTIMIZADO: Margen ajustado para impresoras térmicas
        let margin = 0;
        if (esEtiquetaPequena) {
          margin = imprimiendoEnTermica ? 0 : 1;
        }
        
        // Actualizar la configuración con la preferencia de mostrar texto
        const jsBarcodeConfig = {
          format: config.formato,
          width: anchoLinea,
          height: altoBarras,
          displayValue: mostrarTextoEnSVG,
          fontSize: tamanoTexto,
          margin: margin, // Eliminar márgenes para mejor control posicional
          background: "#ffffff",
          text: codigoLimpio,
          textMargin: mostrarTextoEnSVG ? (esEtiquetaPequena ? 1 : 2) : 0, // Sin margen si no se muestra texto
          lineColor: "#000000"
        };
        
        // Generar código de barras con manejo de errores
        try {
          JsBarcode(svg, codigoLimpio, jsBarcodeConfig);
          
          // Post-procesamiento del SVG para corregir alineación vertical
          // Esto es crucial: el SVG generado por JsBarcode tiene problemas de posicionamiento interno
          // que debemos corregir manualmente
          ajustarAlineacionVerticalSVG(svg, formato);
          
        } catch(err) {
          console.error(`Error en código de barras, usando CODE128:`, err);
          
          // Segundo intento con CODE128
          JsBarcode(svg, codigoLimpio, {
            ...jsBarcodeConfig,
            format: "CODE128"
          });
          
          // También ajustar el fallback
          ajustarAlineacionVerticalSVG(svg, formato);
        }
      } catch(e) {
        console.error(`Error fatal en código de barras:`, e);
        
        // Mostrar mensaje de error
        if (svg.parentNode) {
          const errorMsg = document.createElement('div');
          errorMsg.textContent = "Error: Código inválido";
          errorMsg.style.color = "#e53e3e";
          errorMsg.style.fontSize = "8px";
          errorMsg.style.textAlign = "center";
          errorMsg.style.padding = "4px";
          svg.parentNode.replaceChild(errorMsg, svg);
        }
      }
    }
    
    /**
     * Ajusta la alineación vertical del SVG generado por JsBarcode
     * Corrige problemas de alineación vertical en código de barras
     * @param {SVGElement} svg - Elemento SVG a ajustar
     * @param {Object} formato - Formato de la etiqueta
     */
    function ajustarAlineacionVerticalSVG(svg, formato) {
      try {
        // Verificar si es impresora normal
        if (appState.impresora === 'normal') {
          return; // No ajustar para impresoras normales
        }
        
        // Obtener el elemento g principal dentro del SVG
        const gElement = svg.querySelector('g');
        if (!gElement) return;
        
        // Obtener la transformación actual (normalmente tiene un translate)
        const currentTransform = gElement.getAttribute('transform') || '';
        
        // Si ya tiene nuestra clase de ajuste, no hacer nada más
        if (svg.classList.contains('barcode-adjusted')) {
          return;
        }
        
        // Para impresoras térmicas, ajustar posicionamiento
        if (appState.impresora === 'termica' || appState.impresora === 'dymo' || appState.impresora === 'zebra') {
          // Calcular el desplazamiento vertical a aplicar
          const verticalOffset = formato.barcodeVerticalShift || 0;
          
          // Si existe una transformación previa, adaptarla
          if (currentTransform && currentTransform.includes('translate')) {
            // El formato típico es "translate(X,Y)"
            const match = currentTransform.match(/translate\s*\(\s*([^,]+)(?:,\s*([^)]+))?\s*\)/);
            if (match && match.length >= 3) {
              const x = parseFloat(match[1]) || 0;
              const y = parseFloat(match[2]) || 0;
              
              // Aplicar desplazamiento vertical adicional
              const newTransform = `translate(${x},${y + verticalOffset})`;
              gElement.setAttribute('transform', newTransform);
            }
          } else {
            // Si no hay transformación previa, crear una nueva
            gElement.setAttribute('transform', `translate(0,${verticalOffset})`);
          }
          
          // Eliminar márgenes internos adicionales que JsBarcode agrega
          svg.style.margin = '0';
          if (svg.parentNode) {
            svg.parentNode.style.margin = '0';
          }
          
          // Marcar como ajustado para evitar procesamiento múltiple
          svg.classList.add('barcode-adjusted');
        }
      } catch (e) {
        console.error("Error al ajustar alineación vertical del SVG:", e);
      }
    }
    
    /**
     * SOLUCIÓN CRÍTICA: Función de preprocesamiento para corregir SVGs antes del renderizado
     * Corrige problemas fundamentales de alineación en el código de barras
     * @param {SVGElement} svg - El elemento SVG a optimizar
     */
    function optimizarSVGParaImpresion(svg) {
      if (!svg) return;
      
      try {
        // Asegurar dimensiones exactas
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.margin = '0';
        svg.style.padding = '0';
        
        // Corregir ViewBox si no está definido
        if (!svg.getAttribute('viewBox')) {
          const bbox = svg.getBBox();
          if (bbox && bbox.width && bbox.height) {
            svg.setAttribute('viewBox', `0 0 ${bbox.width} ${bbox.height}`);
          }
        }
        
        // Optimizar grupo principal
        const gElement = svg.querySelector('g');
        if (gElement) {
          // Eliminar transformaciones que puedan causar desalineación
          const transform = gElement.getAttribute('transform');
          if (transform && transform.includes('translate')) {
            // Extraer valores de traducción
            const match = transform.match(/translate\s*\(\s*([^,]+)(?:,\s*([^)]+))?\s*\)/);
            if (match) {
              const x = parseFloat(match[1]) || 0;
              const y = parseFloat(match[2]) || 0;
              
              // Redondear a 4 decimales para evitar errores de precisión
              const newX = Math.round(x * 10000) / 10000;
              const newY = Math.round(y * 10000) / 10000;
              
              // Aplicar transformación precisa
              gElement.setAttribute('transform', `translate(${newX},${newY})`);
            }
          }
        }
        
        // Optimizar elementos internos (rectángulos, paths, etc.)
        const paths = svg.querySelectorAll('path, rect');
        paths.forEach(path => {
          // Asegurar que no haya coordenadas con demasiados decimales
          if (path.hasAttribute('d')) {
            const d = path.getAttribute('d');
            // Reemplazar decimales largos con precisión de 4 decimales
            const optimizedD = d.replace(/(\d+\.\d{4})\d+/g, '$1');
            path.setAttribute('d', optimizedD);
          }
          
          // Para rectángulos, asegurar posiciones precisas
          ['x', 'y', 'width', 'height'].forEach(attr => {
            if (path.hasAttribute(attr)) {
              const val = parseFloat(path.getAttribute(attr));
              path.setAttribute(attr, Math.round(val * 10000) / 10000);
            }
          });
        });
        
        // Aplicar clase especial para CSS específico
        svg.classList.add('optimized-barcode');
      } catch (e) {
        console.error("Error al optimizar SVG:", e);
      }
    }
    
    /**
     * Obtiene la configuración actual para los códigos de barras
     * @returns {Object} Configuración para códigos de barras
     */
    function obtenerConfiguracionCodigoBarras() {
      // Autodetectar formato basado en el código
      const codigoLimpio = appState.producto.codigo.trim();
      let formato;
      
      if (/^\d{13}$/.test(codigoLimpio)) {
        formato = "EAN13";
      } else if (/^\d{8}$/.test(codigoLimpio)) {
        formato = "EAN8";
      } else if (/^\d{12}$/.test(codigoLimpio)) {
        formato = "UPC";
      } else if (/^[0-9]+$/.test(codigoLimpio)) {
        formato = "CODE128C";
      } else {
        formato = "CODE128";
      }
      
      // Configurar tamaño según selección y tipo de impresora
      let anchoLinea = 2;
      let altoBarras = 40;
      let tamanoTexto = 10;
      
      if (elements.tamanoCodigoSelect) {
        switch(elements.tamanoCodigoSelect.value) {
          case 'pequeno':
            anchoLinea = 1.5;
            altoBarras = 30;
            tamanoTexto = 8;
            break;
          case 'grande':
            anchoLinea = 3;
            altoBarras = 50;
            tamanoTexto = 12;
            break;
        }
      }
      
      // OPTIMIZADO: Ajustes adicionales por tipo de impresora
      if (appState.impresora !== 'normal') {
        // Para impresoras térmicas, aumentar tamaño base
        switch(appState.impresora) {
          case 'zebra':
            // Zebra: Solo ligero aumento
            if (elements.tamanoCodigoSelect && elements.tamanoCodigoSelect.value === 'pequeno') {
              // Si está en pequeño, dar un tamaño medio para térmicas
              anchoLinea = 2.0;
              altoBarras = 40;
            }
            break;
          case 'dymo':
            // DYMO: Mayor aumento para etiquetas pequeñas
            if (elements.tamanoCodigoSelect && elements.tamanoCodigoSelect.value === 'pequeno') {
              anchoLinea = 2.0;
              altoBarras = 40;
            }
            break;
          case 'termica':
            // Térmica: Mayor aumento general
            if (elements.tamanoCodigoSelect && elements.tamanoCodigoSelect.value === 'pequeno') {
              anchoLinea = 2.2;
              altoBarras = 45;
            } else {
              // Para tamaño normal/grande, aumentar ligeramente
              anchoLinea += 0.5;
              altoBarras += 10;
            }
            break;
        }
      }
      
      return {
        formato,
        anchoLinea,
        altoBarras,
        tamanoTexto
      };
    }
    
    /**
     * MEJORADO: Imprime las etiquetas directamente con procesamiento por lotes
     * Implementación optimizada para compatibilidad con todas las impresoras
     */
    async function imprimirEtiquetas() {
      try {
        if (appState.isProcessing) {
          alert('Hay una operación en proceso. Por favor, espere un momento e intente nuevamente.');
          return;
        }
        
        console.log('Preparando impresión con procesamiento por lotes...');
        
        // Resetear controlador de cancelación
        batchController.reset();
        appState.isProcessing = true;
        
        const mainContainer = document.querySelector('.etiquetas-layout');
        
        // Obtener configuración actualizada
        const formato = appState.formato || obtenerFormatoSeleccionado();
        const impresora = appState.impresora;
        const cantidad = obtenerCantidad();
        const limits = getPrinterLimits(impresora);
        
        console.log('Imprimiendo etiquetas, cantidad:', cantidad);
        
        // Actualizar configuración de lotes
        updateBatchConfig();
        
        // Mostrar progreso si es necesario procesamiento por lotes
        if (cantidad > limits.safe) {
          showBatchProgress(true, 0, cantidad, "Preparando impresión por lotes...");
          await delay(100); // Dar tiempo para que se muestre la UI
        } else {
          mostrarCargando(mainContainer, true, "Preparando impresión...", "Creando diseño de etiquetas");
        }
        
        // Crear ventana para impresión
        const printWindow = window.open('', '_blank');
        
        if (!printWindow) {
          alert('Por favor, permite las ventanas emergentes para imprimir.');
          showBatchProgress(false);
          mostrarCargando(mainContainer, false);
          appState.isProcessing = false;
          return;
        }
        
        // Obtener configuración específica para la impresora
        const configuracion = obtenerConfiguracionImpresora(formato, impresora);
        const barcodeConfig = obtenerConfiguracionCodigoBarras();
        
        // Verificar si es una etiqueta pequeña
        const esEtiquetaPequena = verificarSiEtiquetaEsPequena(formato);
        const imprimiendoEnTermica = (impresora !== 'normal');
        const mostrarCodigoTexto = esEtiquetaPequena ? true : (!elements.checkboxCodigo || elements.checkboxCodigo.checked);
        
        // Crear estilos CSS optimizados para impresión con mejoras de alineación
        const cssStyles = `
          @page {
            size: ${impresora === 'normal' ? 'A4' : formato.ancho + 'mm ' + formato.alto + 'mm'};
            margin: 0;
          }
          
          body {
            margin: 0;
            padding: 0;
            font-family: 'Inter', Arial, sans-serif;
            background-color: #f0f0f0;
          }
          
          .preview-sheet {
            position: relative;
            width: ${impresora === 'normal' ? '210mm' : formato.ancho + 'mm'};
            height: ${impresora === 'normal' ? '297mm' : formato.alto + 'mm'};
            page-break-after: always;
            background-color: white;
            margin: 0 auto;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          
          .etiqueta {
            position: absolute;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            background: white;
            font-family: 'Inter', Arial, sans-serif;
            box-sizing: border-box;
            border: 1px dashed #ddd;
          }
          
          .etiqueta-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            padding: ${formato.contentPaddingY || 2}mm ${formato.contentPaddingX || 2}mm;
            text-align: center;
          }
          
          .barcode-container {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            margin: 0;
            padding: 0;
            width: 100%;
          }
          
          .etiqueta-nombre {
            font-weight: 600;
            font-size: 10px;
            margin-bottom: 2px;
            line-height: 1.1;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            word-break: break-word;
            text-align: center;
          }
          
          .etiqueta-precio {
            font-weight: 700;
            font-size: 12px;
            margin-bottom: 2px;
            color: #e52e2e;
            text-align: center;
          }
          
          .etiqueta-codigo {
            font-size: ${imprimiendoEnTermica ? '9px' : '8px'};
            margin-bottom: 3px;
            color: #666;
            text-align: center;
          }
          
          .etiqueta-barcode {
            max-width: ${imprimiendoEnTermica ? '99%' : '95%'};
            margin: 0 auto 2px;
            display: block;
          }
          
          .loading-indicator {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            padding: 10px;
            background-color: #f0f9ff;
            color: #e52e2e;
            text-align: center;
            font-size: 14px;
            z-index: 1000;
          }
          
          /* Ajustes específicos para impresoras térmicas */
          .thermal-label .etiqueta-content {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100%;
          }
          
          @media print {
            body * {
              visibility: visible;
            }
            .loading-indicator {
              display: none !important;
            }
          }
        `;
        
        // NUEVO: Procesar etiquetas por lotes
        let printHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Etiquetas - ${appState.producto.nombre}</title>
            <meta charset="UTF-8">
            <style>${cssStyles}</style>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          </head>
          <body>
            <div class="loading-indicator">
              Generando etiquetas por lotes, por favor espere...
            </div>
        `;
        
        // Función para crear etiqueta HTML para impresión (mantenida igual)
        function crearEtiquetaHTMLParaImpresion(x, y, ancho, alto, svgId) {
          // Verificar si es una etiqueta pequeña y ajustar el contenido
          const esEtiquetaPequena = verificarSiEtiquetaEsPequena(formato);
          const imprimiendoEnTermica = (impresora !== 'normal');
          const requiereSoloCodigoBarras = formato.onlyBarcodeAndCode === true;
          
          // Crear clase adicional para impresoras térmicas
          const claseAdicional = impresora !== 'normal' ? 'thermal-label' : '';
          
          // Configuración específica según tamaño de etiqueta
          let mostrarCodigoBarras = esEtiquetaPequena ? true : (!elements.checkboxCodigoBarras || elements.checkboxCodigoBarras.checked);
          let mostrarCodigoTexto = esEtiquetaPequena ? true : (!elements.checkboxCodigo || elements.checkboxCodigo.checked);
          let mostrarNombre = esEtiquetaPequena ? false : (!elements.checkboxNombre || elements.checkboxNombre.checked);
          let mostrarPrecio = esEtiquetaPequena ? false : (!elements.checkboxPrecio || elements.checkboxPrecio.checked);
          
          // OPTIMIZACIÓN: Si es una etiqueta térmica que prioriza el código, ajustar lo que se muestra
          if (requiereSoloCodigoBarras || (imprimiendoEnTermica && formato.prioritizeBarcode)) {
            // Forzar código de barras visible
            mostrarCodigoBarras = true;
            mostrarCodigoTexto = true;
            
            // Para etiquetas muy pequeñas, solo mostrar código
            if (requiereSoloCodigoBarras) {
              mostrarNombre = false;
              mostrarPrecio = false;
            }
          }
          
          // Estilos específicos para el contenedor del código de barras
          let barcodeContainerStyle = '';
          
          // Si hay espaciamiento vertical específico, aplicarlo
          if (formato.contentTopSpacing > 0 || formato.contentBottomSpacing > 0 || formato.barcodeVerticalShift !== 0) {
            let barcodeMarginTop = formato.contentTopSpacing || 0;
            let barcodeMarginBottom = formato.contentBottomSpacing || 0;
            
            // Aplicar desplazamiento vertical si se especificó
            if (formato.barcodeVerticalShift !== undefined && formato.barcodeVerticalShift !== 0) {
              barcodeMarginTop += formato.barcodeVerticalShift;
              barcodeMarginBottom -= formato.barcodeVerticalShift;
            }
            
            // Asegurar valores no negativos
            barcodeMarginTop = Math.max(0, barcodeMarginTop);
            barcodeMarginBottom = Math.max(0, barcodeMarginBottom);
            
            // OPTIMIZADO: Reducir márgenes para impresoras térmicas
            if (imprimiendoEnTermica) {
              barcodeMarginTop = Math.max(0, barcodeMarginTop / 2);
              barcodeMarginBottom = Math.max(0, barcodeMarginBottom / 2);
            }
            
            barcodeContainerStyle = `style="margin-top:${barcodeMarginTop}mm;margin-bottom:${barcodeMarginBottom}mm;"`;
          }
          
          // Construir HTML con clases y estilos específicos
          let html = `
            <div class="etiqueta ${claseAdicional}" style="left:${x}mm;top:${y}mm;width:${ancho}mm;height:${alto}mm;">
              <div class="etiqueta-content">
          `;
          
          // Para etiquetas pequeñas, optimizar el espacio
          if (esEtiquetaPequena) {
            // Código de barras con tamaño ajustado para formato pequeño
            if (mostrarCodigoBarras) {
              // Contenedor para control de posición vertical
              html += `<div class="barcode-container" ${barcodeContainerStyle}>`;
              // No mostrar texto en el SVG porque ocuparía demasiado espacio
              // OPTIMIZADO: Mayor altura para los códigos de barras en térmicas
              const maxHeight = imprimiendoEnTermica ? "80%" : "70%";
              html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}" data-show-text="false" style="max-width:${imprimiendoEnTermica ? '99%' : '95%'};max-height:${maxHeight};display:block;margin:0 auto;"></svg>`;
              html += `</div>`;
            }
            
            // Código en texto con fuente más grande para impresoras térmicas
            if (mostrarCodigoTexto) {
              const fontSize = imprimiendoEnTermica ? "7px" : "6px";
              html += `<div class="etiqueta-codigo" style="font-size:${fontSize};margin-top:1px;margin-bottom:0;text-align:center;">${appState.producto.codigo}</div>`;
            }
          } else {
            // Comportamiento normal para etiquetas estándar
            if (mostrarNombre) {
              // Truncar el nombre si excede el límite de caracteres
              const nombreTruncado = truncarTexto(appState.producto.nombre, formato.maxTextLength);
              html += `<div class="etiqueta-nombre">${nombreTruncado}</div>`;
            }
            
            if (mostrarPrecio) {
              html += `<div class="etiqueta-precio">$${parseFloat(appState.producto.precio).toFixed(2)}</div>`;
            }
            
            if (mostrarCodigoBarras) {
              // Contenedor para control de posición vertical
              html += `<div class="barcode-container" ${barcodeContainerStyle}>`;
              // Pasar preferencia de mostrar texto en el SVG
              const mostrarTextoEnSVG = !mostrarCodigoTexto;
              // OPTIMIZADO: Tamaño máximo optimizado para térmicas
              const maxWidth = imprimiendoEnTermica ? "99%" : "95%";
              const maxHeight = imprimiendoEnTermica ? "85%" : "75%";
              html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}" data-show-text="${mostrarTextoEnSVG}" style="max-width:${maxWidth};max-height:${maxHeight};display:block;margin:0 auto;"></svg>`;
              html += `</div>`;
            }
            
            if (mostrarCodigoTexto) {
              html += `<div class="etiqueta-codigo">${appState.producto.codigo}</div>`;
            }
          }
          
          html += `
              </div>
            </div>
          `;
          
          return html;
        }
        
        // NUEVO: Generar contenido por lotes
        if (cantidad > limits.safe) {
          // Procesamiento por lotes para cantidades grandes
          let etiquetasGeneradas = 0;
          
          for (let batchIndex = 0; batchIndex < appState.totalBatches; batchIndex++) {
            if (batchController.isCancelled()) {
              console.log('Operación cancelada por el usuario');
              break;
            }
            
            // Actualizar progreso
            showBatchProgress(true, etiquetasGeneradas, cantidad, `Procesando lote ${batchIndex + 1} de ${appState.totalBatches}...`);
            
            const batchStart = batchIndex * appState.batchSize;
            const batchEnd = Math.min(batchStart + appState.batchSize, cantidad);
            const batchCantidad = batchEnd - batchStart;
            
            console.log(`Procesando lote ${batchIndex + 1}: etiquetas ${batchStart + 1} a ${batchEnd}`);
            
            // Generar contenido según tipo de impresora para este lote
            if (impresora === 'normal') {
              // Para impresoras normales: agrupar en hojas
              const etiquetasPorPagina = formato.porPagina;
              const paginasEnLote = Math.ceil(batchCantidad / etiquetasPorPagina);
              
              for (let paginaEnLote = 0; paginaEnLote < paginasEnLote; paginaEnLote++) {
                printHtml += `<div class="preview-sheet">`;
                
                // Añadir etiquetas a la hoja
                for (let i = 0; i < formato.filas; i++) {
                  for (let j = 0; j < formato.columnas; j++) {
                    const indexEnPagina = paginaEnLote * etiquetasPorPagina + i * formato.columnas + j;
                    const indexGlobal = batchStart + indexEnPagina;
                    
                    if (indexGlobal < batchEnd && indexGlobal < cantidad) {
                      // Calcular posición corregida
                      const posX = calcularPosicionX(formato, configuracion, j);
                      const posY = calcularPosicionY(formato, configuracion, i);
                      
                      // Añadir etiqueta con ID único
                      const svgId = `print-barcode-${batchIndex}-${paginaEnLote}-${i}-${j}`;
                      printHtml += crearEtiquetaHTMLParaImpresion(posX, posY, formato.ancho, formato.alto, svgId);
                    }
                  }
                }
                
                printHtml += `</div>`;
              }
            } else {
              // Para impresoras térmicas: una etiqueta por página
              for (let i = 0; i < batchCantidad; i++) {
                const indexGlobal = batchStart + i;
                if (indexGlobal >= cantidad) break;
                
                let posX = formato.marginX || 0;
                let posY = formato.marginY || 0;
                
                printHtml += `<div class="preview-sheet thermal-page">`;
                const svgId = `print-barcode-thermal-${batchIndex}-${i}`;
                printHtml += crearEtiquetaHTMLParaImpresion(posX, posY, formato.ancho, formato.alto, svgId);
                printHtml += `</div>`;
              }
            }
            
            etiquetasGeneradas = batchEnd;
            
            // Pequeño delay para mantener UI responsiva
            await delay(50);
          }
        } else {
          // Procesamiento normal para cantidades pequeñas (mantener código original)
          if (impresora === 'normal') {
            // Calcular número de páginas
            const etiquetasPorPagina = formato.porPagina;
            const numPaginas = Math.ceil(cantidad / etiquetasPorPagina);
            
            for (let pagina = 0; pagina < numPaginas; pagina++) {
              printHtml += `<div class="preview-sheet">`;
              
              // Añadir etiquetas a la hoja
              for (let i = 0; i < formato.filas; i++) {
                for (let j = 0; j < formato.columnas; j++) {
                  const index = pagina * etiquetasPorPagina + i * formato.columnas + j;
                  
                  if (index < cantidad) {
                    // Calcular posición corregida
                    const posX = calcularPosicionX(formato, configuracion, j);
                    const posY = calcularPosicionY(formato, configuracion, i);
                    
                    // Añadir etiqueta con ID único
                    const svgId = `print-barcode-${pagina}-${i}-${j}`;
                    printHtml += crearEtiquetaHTMLParaImpresion(posX, posY, formato.ancho, formato.alto, svgId);
                  }
                }
              }
              
              printHtml += `</div>`;
            }
          } else {
            // Para impresoras térmicas: una etiqueta por página con centrado
            for (let i = 0; i < cantidad; i++) {
              // CORREGIDO: posicionamiento más preciso para etiquetas individuales
              // Centrar la etiqueta en la página basado en sus dimensiones reales
              let posX = 0; // Comenzar en el borde izquierdo
              let posY = 0; // Comenzar en el borde superior
              
              // Si se especificaron márgenes, usarlos
              if (formato.marginX !== undefined) {
                posX = formato.marginX;
              }
              
              if (formato.marginY !== undefined) {
                posY = formato.marginY;
              }
              
              printHtml += `<div class="preview-sheet thermal-page">`;
              const svgId = `print-barcode-thermal-${i}`;
              printHtml += crearEtiquetaHTMLParaImpresion(posX, posY, formato.ancho, formato.alto, svgId);
              printHtml += `</div>`;
            }
          }
        }
        
        // Script mejorado para generar códigos de barras y luego imprimir con manejo de errores
        printHtml += `
            <script>
              // Variables para seguimiento
              let processingComplete = false;
              let errorOccurred = false;
              
              // Temporizador de seguridad (90 segundos para lotes grandes)
              const safetyTimeout = setTimeout(() => {
                if (!processingComplete) {
                  console.error("Timeout alcanzado - cerrando ventana");
                  window.close();
                }
              }, 90000);
              
              // Función para ajustar la alineación vertical del SVG generado por JsBarcode
              function ajustarAlineacionVerticalSVG(svg, formato) {
                try {
                  // Solo ajustamos impresoras térmicas/DYMO/Zebra, no Avery
                  if ('${impresora}' === 'normal') {
                    return;
                  }
                  
                  // Obtener el elemento g principal dentro del SVG
                  const gElement = svg.querySelector('g');
                  if (!gElement) return;
                  
                  // Obtener la transformación actual (normalmente tiene un translate)
                  const currentTransform = gElement.getAttribute('transform') || '';
                  
                  // Si ya tiene nuestra clase de ajuste, no hacer nada
                  if (svg.classList.contains('barcode-adjusted')) {
                    return;
                  }
                  
                  // Para impresoras térmicas, ajustamos el posicionamiento vertical
                  if ('${impresora}' === 'termica' || '${impresora}' === 'dymo' || '${impresora}' === 'zebra') {
                    // Calcular el desplazamiento vertical adecuado para centrar perfectamente
                    const verticalOffset = ${formato.barcodeVerticalShift || 0};
                    
                    // Si existe una transformación previa, adaptarla
                    if (currentTransform && currentTransform.includes('translate')) {
                      // El formato típico es "translate(X,Y)"
                      const match = currentTransform.match(/translate\\(([^,]+),([^)]+)\\)/);
                      if (match && match.length === 3) {
                        const x = parseFloat(match[1]);
                        const y = parseFloat(match[2]);
                        
                        // Aplicar nuestro desplazamiento vertical adicional
                        const newTransform = \`translate(\${x},\${y + verticalOffset})\`;
                        gElement.setAttribute('transform', newTransform);
                      }
                    } else {
                      // Si no hay transformación previa, crear una nueva
                      gElement.setAttribute('transform', \`translate(0,\${verticalOffset})\`);
                    }
                    
                    // Eliminar márgenes internos adicionales que JsBarcode agrega
                    svg.style.margin = '0';
                    if (svg.parentNode) {
                      svg.parentNode.style.margin = '0';
                    }
                    
                    // Marcar como ajustado para evitar procesamiento múltiple
                    svg.classList.add('barcode-adjusted');
                  }
                } catch (e) {
                  console.error("Error al ajustar alineación vertical del SVG:", e);
                }
              }
              
              // NUEVO: Función para delay
              function delay(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
              }
              
              // Generar códigos de barras al cargar MEJORADO con procesamiento por lotes
              window.onload = async function() {
                try {
                  // Verificar que JsBarcode esté disponible
                  if (typeof JsBarcode === 'undefined') {
                    document.body.innerHTML = '<div style="padding:20px;text-align:center;"><h2 style="color:#e52e2e;">Error: No se pudo cargar la biblioteca de códigos de barras</h2><p>Por favor, intente nuevamente o use otra opción.</p></div>';
                    processingComplete = true;
                    errorOccurred = true;
                    return;
                  }
                  
                  console.log('Generando códigos de barras para impresión...');
                  document.querySelector('.loading-indicator').textContent = "Generando códigos de barras...";
                  
                  // Generar códigos de barras (con pequeño retraso para UI)
                  await delay(100);
                  
                  const barcodes = document.querySelectorAll('.etiqueta-barcode');
                  console.log(\`Generando \${barcodes.length} códigos de barras\`);
                  
                  // NUEVO: Procesar códigos de barras por lotes para mejor rendimiento
                  const batchSize = 50; // Procesar 50 códigos a la vez
                  const totalBatches = Math.ceil(barcodes.length / batchSize);
                  
                  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                    const batchStart = batchIndex * batchSize;
                    const batchEnd = Math.min(batchStart + batchSize, barcodes.length);
                    
                    document.querySelector('.loading-indicator').textContent = 
                      \`Generando códigos de barras... lote \${batchIndex + 1}/\${totalBatches} (\${batchEnd}/\${barcodes.length})\`;
                    
                    // Procesar lote actual
                    for (let i = batchStart; i < batchEnd; i++) {
                      const svg = barcodes[i];
                      try {
                        const codigo = svg.dataset.codigo;
                        // Obtener preferencia de mostrar texto
                        const mostrarTextoEnSVG = svg.dataset.showText === "true";
                        
                        // Detectar si es para una etiqueta pequeña basado en atributos
                        const esEtiquetaPequena = ${esEtiquetaPequena};
                        const imprimiendoEnTermica = ${imprimiendoEnTermica};
                        
                        // OPTIMIZADO: Configurar tamaños según el tipo de etiqueta e impresora
                        let anchoLinea = ${barcodeConfig.anchoLinea};
                        let altoBarras = ${barcodeConfig.altoBarras};
                        let tamanoTexto = ${barcodeConfig.tamanoTexto};
                        let margin = ${impresora === 'normal' ? 2 : 0}; // Eliminar márgenes para impresoras térmicas
                        
                        // Aplicar factores de ajuste según el tipo de impresora y formato
                        if (imprimiendoEnTermica) {
                          // Para impresoras térmicas, aumentar tamaño
                          const barcodeWidthFactor = ${formato.barcodeWidthFactor || 1.0};
                          const barcodeHeightFactor = ${formato.barcodeHeightFactor || 1.0};
                          
                          anchoLinea = anchoLinea * barcodeWidthFactor;
                          altoBarras = altoBarras * barcodeHeightFactor;
                          tamanoTexto = tamanoTexto * 1.1; // Aumentar texto un 10%
                          margin = 0; // Sin margen para térmicas
                        } else if (esEtiquetaPequena) {
                          // Para etiquetas pequeñas en impresoras normales
                          anchoLinea = Math.max(0.8, anchoLinea * 0.8); // Reducir menos
                          altoBarras = Math.max(20, altoBarras * 0.8); // Reducir menos
                          tamanoTexto = Math.max(7, tamanoTexto * 0.8); // Reducir menos
                          margin = 1;
                        }
                        
                        if (codigo) {
                          JsBarcode(svg, codigo, {
                            format: "${barcodeConfig.formato}",
                            width: anchoLinea,
                            height: altoBarras,
                            displayValue: mostrarTextoEnSVG,
                            fontSize: tamanoTexto,
                            margin: margin,
                            background: "#ffffff",
                            text: codigo,
                            textMargin: mostrarTextoEnSVG ? (esEtiquetaPequena ? 1 : 2) : 0,
                            lineColor: "#000000"
                          });
                          
                          // Ajustar alineación vertical después de generar el código
                          ajustarAlineacionVerticalSVG(svg, {
                            barcodeVerticalShift: ${formato.barcodeVerticalShift || 0}
                          });
                        }
                      } catch(e) {
                        console.error("Error generando código:", e);
                        // Intentar con formato alternativo
                        try {
                          const codigo = svg.dataset.codigo;
                          const mostrarTextoEnSVG = svg.dataset.showText === "true";
                          JsBarcode(svg, codigo, {
                            format: "CODE128",
                            width: ${barcodeConfig.anchoLinea},
                            height: ${barcodeConfig.altoBarras},
                            displayValue: mostrarTextoEnSVG
                          });
                          
                          // También ajustar el fallback
                          ajustarAlineacionVerticalSVG(svg, {
                            barcodeVerticalShift: ${formato.barcodeVerticalShift || 0}
                          });
                        } catch(e2) {
                          console.error("Error secundario:", e2);
                        }
                      }
                    }
                    
                    // Pequeña pausa entre lotes para mantener UI responsiva
                    await delay(10);
                  }
                  
                  console.log('Códigos generados, enviando a impresión...');
                  document.querySelector('.loading-indicator').textContent = "Enviando a impresión...";
                  
                  // Esperar a que se carguen los códigos de barras y luego imprimir
                  setTimeout(() => {
                    processingComplete = true;
                    clearTimeout(safetyTimeout);
                    window.print();
                    
                    // Cerrar ventana después de imprimir o cancelar
                    window.addEventListener('afterprint', function() {
                      setTimeout(() => window.close(), 500);
                    });
                    
                    // Timeout de seguridad para cerrar si afterprint no se dispara
                    setTimeout(() => {
                      if (!errorOccurred) window.close();
                    }, 3000);
                  }, 1000);
                } catch(e) {
                  console.error("Error durante procesamiento:", e);
                  document.body.innerHTML = \`
                    <div style="padding:20px;text-align:center;">
                      <h2 style="color:#e52e2e;">Error durante la preparación de impresión</h2>
                      <p style="color:#444;">\${e.message}</p>
                      <button onclick="window.close()" style="margin-top:20px;padding:8px 16px;background:#e52e2e;color:white;border:none;border-radius:6px;cursor:pointer;">
                        Cerrar ventana
                      </button>
                    </div>
                  \`;
                  processingComplete = true;
                  errorOccurred = true;
                }
              };
            </script>
          </body>
          </html>
        `;
        
        // Escribir HTML a la ventana de impresión
        printWindow.document.open();
        printWindow.document.write(printHtml);
        printWindow.document.close();
        
        // Temporizador de seguridad para quitar el indicador de carga
        setTimeout(() => {
          showBatchProgress(false);
          mostrarCargando(mainContainer, false);
          appState.isProcessing = false;
        }, 5000);
        
        // Evento para manejar cuando la ventana se cierra
        printWindow.addEventListener('unload', function() {
          showBatchProgress(false);
          mostrarCargando(mainContainer, false);
          appState.isProcessing = false;
        });
      } catch(e) {
        console.error("Error al imprimir etiquetas:", e);
        alert("Error al preparar la impresión: " + e.message);
        showBatchProgress(false);
        mostrarCargando(document.querySelector('.etiquetas-layout'), false);
        appState.isProcessing = false;
      }
    }
    
    /**
     * MEJORADO: Descarga las etiquetas como PDF con procesamiento por lotes
     * Implementación optimizada para evitar descarga doble y manejar grandes cantidades
     */
    async function descargarPDF() {
      try {
        if (appState.isProcessing) {
          alert('Hay una operación en proceso. Por favor, espere un momento e intente nuevamente.');
          return;
        }
        
        // Verificar que las bibliotecas estén disponibles
        if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
          alert("No se han podido cargar las bibliotecas necesarias para generar PDF. Verifica tu conexión a Internet o usa la opción 'Imprimir directamente'.");
          return;
        }
        
        // Flag para evitar descarga doble
        appState.pdfGenerating = true;
        appState.isProcessing = true;
        
        // Resetear controlador de cancelación
        batchController.reset();
        
        console.log('Preparando generación de PDF con procesamiento por lotes...');
        
        const mainContainer = document.querySelector('.etiquetas-layout');
        
        // Obtener configuración actualizada
        const formato = appState.formato || obtenerFormatoSeleccionado();
        const impresora = appState.impresora;
        const cantidad = obtenerCantidad();
        const limits = getPrinterLimits(impresora);
        
        console.log('Generando PDF, cantidad:', cantidad);
        
        // Actualizar configuración de lotes
        updateBatchConfig();
        
        // Mostrar progreso si es necesario procesamiento por lotes
        if (cantidad > limits.safe) {
          showBatchProgress(true, 0, cantidad, "Preparando generación de PDF por lotes...");
          await delay(100);
        } else {
          mostrarCargando(mainContainer, true, "Generando PDF...", "Preparando diseño");
        }
        
        // Obtener configuración específica para la impresora
        const configuracion = obtenerConfiguracionImpresora(formato, impresora);
        
        // Crear un contenedor temporal para el PDF
        const pdfContainer = elements.pdfContainer;
        pdfContainer.innerHTML = '';
        pdfContainer.style.display = 'block';
        pdfContainer.style.position = 'fixed';
        pdfContainer.style.left = '-9999px';
        pdfContainer.style.top = '0';
        
        // SOLUCIÓN PARA PDFs NEGROS: Opciones simplificadas de PDF
        const pdfOptions = {
          orientation: configuracion.orientation,
          unit: 'mm',
          format: impresora === 'normal' ? 'a4' : [configuracion.paginaAncho, configuracion.paginaAlto],
          compress: false,       // CRÍTICO: Desactivar compresión que causa problemas
          putOnlyUsedFonts: true // Optimización de fuentes
        };
        
        // Correcta inicialización para evitar descarga doble
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF(pdfOptions);
        
        // Verificar si es una etiqueta pequeña
        const esEtiquetaPequena = verificarSiEtiquetaEsPequena(formato);
        
        // Verificar si estamos generando PDF para impresora térmica
        const imprimiendoEnTermica = (impresora !== 'normal');
        
        // Verificar si debemos mostrar el código como texto separado
        const mostrarCodigoTexto = esEtiquetaPequena ? true : (!elements.checkboxCodigo || elements.checkboxCodigo.checked);
        
        // CORREGIDO: Calibración alta precisión DPI y conversión de unidades
        // DPI valores estándar por tipo de impresora:
        const DPI_CONFIG = {
          'normal': 300,    // 300 DPI para impresoras de oficina
          'zebra': 203,     // 203 DPI estándar para Zebra 
          'dymo': 300,      // 300 DPI para DYMO
          'termica': 203    // 203 DPI para impresoras térmicas
        };
        
        // FACTOR CRÍTICO: Usar DPI específico para la impresora seleccionada
        const DPI = DPI_CONFIG[impresora] || 300;
        const MM_TO_PX = DPI / 25.4; // 25.4mm = 1 pulgada - CONVERSIÓN PRECISA
        
        // CORRECCIÓN ADICIONAL: Factores de escala calibrados por tipo de impresora
        const SCALE_FACTORS = {
          'normal': 1.000,
          'zebra': 1.005,   // Factor de corrección para Zebra
          'dymo': 1.002,    // Factor de corrección para DYMO
          'termica': 1.003  // Factor de corrección para térmicas
        };
        const scaleFactor = SCALE_FACTORS[impresora] || 1.0;
        
        // CORRECCIÓN CRÍTICA para el texto del código fuera de las etiquetas
        const pdfCSS = `
          <style>
            body, html {
              margin: 0;
              padding: 0;
              font-family: 'Inter', Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              background-color: white;
              color: black;
            }
            
            .pdf-page {
              width: ${impresora === 'normal' ? '210mm' : formato.ancho + 'mm'};
              height: ${impresora === 'normal' ? '297mm' : formato.alto + 'mm'};
              position: relative;
              background-color: white;
              margin: 10px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              overflow: visible;
              page-break-after: always;
              box-sizing: border-box;
            }
            
            .etiqueta {
              position: absolute;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              overflow: hidden; /* AJUSTE CRÍTICO: Cambiado a hidden para mantener contenido dentro */
              background-color: white;
              box-sizing: border-box;
              border: 1px dashed #ddd;
              color: black;
            }
            
            .etiqueta-content {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              width: 100%;
              height: 100%;
              padding: ${Math.max(0.5, formato.contentPaddingY - 1)}mm ${Math.max(0.5, formato.contentPaddingX - 1)}mm; /* OPTIMIZADO */
              text-align: center;
              background-color: white;
              color: black;
            }
            
            .barcode-container {
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              margin: 0;
              padding: 0;
              width: 100%;
              background-color: white;
              max-width: ${imprimiendoEnTermica ? '99%' : '95%'}; /* OPTIMIZADO: Más espacio para impresoras térmicas */
              align-self: center; /* AJUSTE CRÍTICO: Centrar */
            }
            
            .etiqueta-nombre {
              font-weight: 600;
              font-size: 10px;
              margin-bottom: 2px;
              line-height: 1.1;
              overflow: hidden;
              text-overflow: ellipsis;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              word-break: break-word;
              text-align: center;
              color: #1d1d1f;
              max-width: ${imprimiendoEnTermica ? '98%' : '95%'}; /* OPTIMIZADO: Más espacio para impresoras térmicas */
            }
            
            .etiqueta-precio {
              font-weight: 700;
              font-size: 12px;
              margin-bottom: 2px;
              color: #e52e2e;
              text-align: center;
              max-width: ${imprimiendoEnTermica ? '98%' : '95%'}; /* OPTIMIZADO: Más espacio para impresoras térmicas */
            }
            
            .etiqueta-codigo {
              font-size: ${imprimiendoEnTermica ? '9px' : '8px'}; /* OPTIMIZADO: Fuente más grande para térmicas */
              margin-bottom: 2px; /* AJUSTE CRÍTICO: Reducido */
              color: #666;
              text-align: center;
              width: 100%; /* AJUSTE CRÍTICO: Ancho fijo */
              max-width: ${imprimiendoEnTermica ? '98%' : '95%'}; /* OPTIMIZADO: Más espacio para impresoras térmicas */
              white-space: nowrap; /* AJUSTE CRÍTICO: Evitar saltos */
              overflow: hidden; /* AJUSTE CRÍTICO: Ocultar exceso */
              text-overflow: ellipsis; /* AJUSTE CRÍTICO: Mostrar elipsis */
            }
            
            .etiqueta-barcode {
              max-width: ${imprimiendoEnTermica ? '99%' : '95%'}; /* OPTIMIZADO: Más espacio para impresoras térmicas */
              max-height: ${imprimiendoEnTermica ? '85%' : (esEtiquetaPequena ? '60%' : '75%')}; /* OPTIMIZADO */
              margin: 0 auto 2px;
              display: block;
              background-color: white;
            }
            
            /* Ajustes específicos para impresoras térmicas */
            .thermal-label .etiqueta-content {
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              height: 100%;
              background-color: white;
            }
            
            svg {
              background-color: white;
              max-width: ${imprimiendoEnTermica ? '99%' : '95%'} !important; /* OPTIMIZADO */
            }
          </style>
        `;
        
        // SOLUCIÓN PARA PDF NEGRO: Preprocesamiento CSS fundamental
        async function crearEtiquetasParaPDF() {
          let pdfHTML = pdfCSS;
          
          // AJUSTE CRUCIAL: CSS específico para asegurar fondo blanco
          pdfHTML += `
            <style>
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                font-family: 'Inter', sans-serif !important;
                background-color: white !important;
                color: black !important;
              }
              .pdf-page {
                width: ${impresora === 'normal' ? '210mm' : formato.ancho + 'mm'} !important;
                height: ${impresora === 'normal' ? '297mm' : formato.alto + 'mm'} !important;
                background-color: white !important;
                margin: 0 !important;
                padding: 0 !important;
                position: relative !important;
                overflow: visible !important;
              }
              .etiqueta {
                box-sizing: border-box !important;
                background-color: white !important;
                border: 1px dashed #ddd !important;
                color: black !important;
              }
              .etiqueta-content {
                background-color: white !important;
                color: black !important;
              }
              .etiqueta-barcode, .barcode-container {
                background-color: white !important;
              }
              /* FUNDAMENTAL: Forzar colores para elementos específicos */
              .etiqueta-nombre {
                color: #1d1d1f !important;
              }
              .etiqueta-precio {
                color: #e52e2e !important;
              }
              .etiqueta-codigo {
                color: #666 !important;
              }
            </style>
          `;
          
          // NUEVO: Generar contenido por lotes para PDFs grandes
          if (cantidad > limits.safe) {
            // Procesamiento por lotes para cantidades grandes
            let etiquetasGeneradas = 0;
            
            for (let batchIndex = 0; batchIndex < appState.totalBatches; batchIndex++) {
              if (batchController.isCancelled()) {
                console.log('Operación de PDF cancelada por el usuario');
                break;
              }
              
              // Actualizar progreso
              showBatchProgress(true, etiquetasGeneradas, cantidad, `Generando PDF: lote ${batchIndex + 1} de ${appState.totalBatches}...`);
              
              const batchStart = batchIndex * appState.batchSize;
              const batchEnd = Math.min(batchStart + appState.batchSize, cantidad);
              const batchCantidad = batchEnd - batchStart;
              
              console.log(`Generando PDF lote ${batchIndex + 1}: etiquetas ${batchStart + 1} a ${batchEnd}`);
              
              // Generar contenido según tipo de impresora para este lote
              if (impresora === 'normal') {
                // Para impresoras normales: agrupar en hojas
                const etiquetasPorPagina = formato.porPagina;
                const paginasEnLote = Math.ceil(batchCantidad / etiquetasPorPagina);
                
                for (let paginaEnLote = 0; paginaEnLote < paginasEnLote; paginaEnLote++) {
                  pdfHTML += `<div class="pdf-page">`;
                  
                  // Añadir etiquetas a la hoja
                  for (let i = 0; i < formato.filas; i++) {
                    for (let j = 0; j < formato.columnas; j++) {
                      const indexEnPagina = paginaEnLote * etiquetasPorPagina + i * formato.columnas + j;
                      const indexGlobal = batchStart + indexEnPagina;
                      
                      if (indexGlobal < batchEnd && indexGlobal < cantidad) {
                        // Calcular posición de la etiqueta - CORREGIDO para el formato específico
                        const posX = calcularPosicionX(formato, configuracion, j);
                        const posY = calcularPosicionY(formato, configuracion, i);
                        
                        // Crear etiqueta con ID único para PDF
                        const svgId = `pdf-barcode-${batchIndex}-${paginaEnLote}-${i}-${j}`;
                        pdfHTML += crearEtiquetaHTMLParaPDF(posX, posY, formato.ancho, formato.alto, svgId);
                      }
                    }
                  }
                  
                  pdfHTML += `</div>`;
                }
              } else {
                // Para impresoras térmicas: una etiqueta por página
                for (let i = 0; i < batchCantidad; i++) {
                  const indexGlobal = batchStart + i;
                  if (indexGlobal >= cantidad) break;
                  
                  let posX = formato.marginX || 0;
                  let posY = formato.marginY || 0;
                  
                  pdfHTML += `<div class="pdf-page">`;
                  const svgId = `pdf-barcode-thermal-${batchIndex}-${i}`;
                  pdfHTML += crearEtiquetaHTMLParaPDF(posX, posY, formato.ancho, formato.alto, svgId);
                  pdfHTML += `</div>`;
                }
              }
              
              etiquetasGeneradas = batchEnd;
              
              // Pequeño delay para mantener UI responsiva
              await delay(50);
            }
          } else {
            // Procesamiento normal para cantidades pequeñas (código original)
            if (impresora === 'normal') {
              // Para impresoras normales, crear hojas con múltiples etiquetas
              const etiquetasPorPagina = formato.porPagina;
              const numPaginas = Math.ceil(cantidad / etiquetasPorPagina);
              
              for (let pagina = 0; pagina < numPaginas; pagina++) {
                pdfHTML += `<div class="pdf-page">`;
                
                // Añadir etiquetas a la hoja
                for (let i = 0; i < formato.filas; i++) {
                  for (let j = 0; j < formato.columnas; j++) {
                    const index = pagina * etiquetasPorPagina + i * formato.columnas + j;
                    
                    if (index < cantidad) {
                      // Calcular posición de la etiqueta - CORREGIDO para el formato específico
                      const posX = calcularPosicionX(formato, configuracion, j);
                      const posY = calcularPosicionY(formato, configuracion, i);
                      
                      // Crear etiqueta con ID único para PDF
                      const svgId = `pdf-barcode-${pagina}-${i}-${j}`;
                      pdfHTML += crearEtiquetaHTMLParaPDF(posX, posY, formato.ancho, formato.alto, svgId);
                    }
                  }
                }
                
                pdfHTML += `</div>`;
              }
            } else {
              // Para impresoras térmicas, crear una hoja por etiqueta con centrado
              for (let i = 0; i < cantidad; i++) {
                // CORREGIDO: posicionamiento más preciso para etiquetas individuales
                // Centrar la etiqueta en la página basado en sus dimensiones reales
                let posX = 0; // Comenzar en el borde izquierdo
                let posY = 0; // Comenzar en el borde superior
                
                // Si se especificaron márgenes, usarlos
                if (formato.marginX !== undefined) {
                  posX = formato.marginX;
                }
                
                if (formato.marginY !== undefined) {
                  posY = formato.marginY;
                }
                
                pdfHTML += `<div class="pdf-page">`;
                const svgId = `pdf-barcode-thermal-${i}`;
                pdfHTML += crearEtiquetaHTMLParaPDF(posX, posY, formato.ancho, formato.alto, svgId);
                pdfHTML += `</div>`;
              }
            }
          }
          
          return pdfHTML;
        }
        
        // Función para crear HTML de etiqueta individual para PDF
        function crearEtiquetaHTMLParaPDF(x, y, ancho, alto, svgId) {
          // Verificar si es una etiqueta pequeña y ajustar el contenido
          const esEtiquetaPequena = verificarSiEtiquetaEsPequena(formato);
          const imprimiendoEnTermica = (impresora !== 'normal');
          const requiereSoloCodigoBarras = formato.onlyBarcodeAndCode === true;
          
          // Crear clase adicional para impresoras térmicas
          const claseAdicional = impresora !== 'normal' ? 'thermal-label' : '';
          
          // Configuración específica según tamaño de etiqueta
          let mostrarCodigoBarras = esEtiquetaPequena ? true : (!elements.checkboxCodigoBarras || elements.checkboxCodigoBarras.checked);
          let mostrarCodigoTexto = esEtiquetaPequena ? true : (!elements.checkboxCodigo || elements.checkboxCodigo.checked);
          let mostrarNombre = esEtiquetaPequena ? false : (!elements.checkboxNombre || elements.checkboxNombre.checked);
          let mostrarPrecio = esEtiquetaPequena ? false : (!elements.checkboxPrecio || elements.checkboxPrecio.checked);
          
          // OPTIMIZACIÓN: Si es una etiqueta térmica que prioriza el código, ajustar lo que se muestra
          if (requiereSoloCodigoBarras || (imprimiendoEnTermica && formato.prioritizeBarcode)) {
            // Forzar código de barras visible
            mostrarCodigoBarras = true;
            mostrarCodigoTexto = true;
            
            // Para etiquetas muy pequeñas, solo mostrar código
            if (requiereSoloCodigoBarras) {
              mostrarNombre = false;
              mostrarPrecio = false;
            }
          }
          
          // OPTIMIZADO: Ajuste de padding para evitar desbordamiento
          const reduccion = esEtiquetaPequena ? 1.5 : (imprimiendoEnTermica ? 1.0 : 0.5);
          const paddingX = Math.max(0.5, (formato.contentPaddingX || 2) - reduccion);
          const paddingY = Math.max(0.5, (formato.contentPaddingY || 2) - reduccion);
          
          // Estilos específicos para el contenedor del código de barras
          let barcodeContainerStyle = '';
          
          // Si hay espaciamiento vertical específico, aplicarlo
          if (formato.contentTopSpacing > 0 || formato.contentBottomSpacing > 0 || formato.barcodeVerticalShift !== 0) {
            let barcodeMarginTop = formato.contentTopSpacing || 0;
            let barcodeMarginBottom = formato.contentBottomSpacing || 0;
            
            // Aplicar desplazamiento vertical si se especificó
            if (formato.barcodeVerticalShift !== undefined && formato.barcodeVerticalShift !== 0) {
              barcodeMarginTop += formato.barcodeVerticalShift;
              barcodeMarginBottom -= formato.barcodeVerticalShift;
            }
            
            // Asegurar valores no negativos
            barcodeMarginTop = Math.max(0, barcodeMarginTop);
            barcodeMarginBottom = Math.max(0, barcodeMarginBottom);
            
            // OPTIMIZADO: Reducir espaciado para térmicas y aumentar margen
            if (imprimiendoEnTermica) {
              barcodeMarginTop = Math.max(0, barcodeMarginTop / 2);
              barcodeMarginBottom = Math.max(0, barcodeMarginBottom / 2);
            }
            
            barcodeContainerStyle = `style="margin-top:${barcodeMarginTop}mm;margin-bottom:${barcodeMarginBottom}mm;max-width:${imprimiendoEnTermica ? '99%' : '95%'};overflow:hidden;"`;
          } else {
            barcodeContainerStyle = `style="max-width:${imprimiendoEnTermica ? '99%' : '95%'};overflow:hidden;"`;
          }
          
          // Construir HTML con clases y estilos específicos
          let html = `
            <div class="etiqueta ${claseAdicional} ${esEtiquetaPequena ? 'small-label' : ''}" style="left:${x}mm;top:${y}mm;width:${ancho}mm;height:${alto}mm;">
              <div class="etiqueta-content" style="padding:${paddingY}mm ${paddingX}mm;overflow:hidden;">
          `;
          
          // Para etiquetas pequeñas, optimizar el espacio
          if (esEtiquetaPequena) {
            // Código de barras con tamaño ajustado para formato pequeño
            if (mostrarCodigoBarras) {
              // Contenedor para control de posición vertical
              html += `<div class="barcode-container" ${barcodeContainerStyle}>`;
              // No mostrar texto en el SVG porque ocuparía demasiado espacio
              // OPTIMIZADO: Mayor altura para los códigos en etiquetas pequeñas térmicas
              const maxHeight = imprimiendoEnTermica ? "80%" : "65%";
              html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}" data-show-text="false" style="max-width:${imprimiendoEnTermica ? '99%' : '95%'};max-height:${maxHeight};display:block;margin:0 auto;"></svg>`;
              html += `</div>`;
            }
            
            // Código en texto con fuente más grande para impresoras térmicas
            if (mostrarCodigoTexto) {
              const fontSize = imprimiendoEnTermica ? "7px" : "6px";
              html += `<div class="etiqueta-codigo" style="font-size:${fontSize};margin-top:1px;margin-bottom:0;text-align:center;max-width:99%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${appState.producto.codigo}</div>`;
            }
          } else {
            // Comportamiento normal para etiquetas estándar
            if (mostrarNombre) {
              // OPTIMIZADO: Truncar el nombre si excede el límite de caracteres
              const nombreTruncado = truncarTexto(appState.producto.nombre, formato.maxTextLength);
              html += `<div class="etiqueta-nombre" style="max-width:98%;overflow:hidden;text-overflow:ellipsis;">${nombreTruncado}</div>`;
            }
            
            if (mostrarPrecio) {
              html += `<div class="etiqueta-precio" style="max-width:98%;">${parseFloat(appState.producto.precio).toFixed(2)}</div>`;
            }
            
            if (mostrarCodigoBarras) {
              // Contenedor para control de posición vertical
              html += `<div class="barcode-container" ${barcodeContainerStyle}>`;
              // Pasar preferencia de mostrar texto en el SVG
              const mostrarTextoEnSVG = !mostrarCodigoTexto;
              // OPTIMIZADO: Mayor tamaño y altura para códigos de barras en térmicas
              const maxWidth = imprimiendoEnTermica ? "99%" : "95%";
              const maxHeight = imprimiendoEnTermica ? "85%" : "75%";
              html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}" data-show-text="${mostrarTextoEnSVG}" style="max-width:${maxWidth};max-height:${maxHeight};display:block;margin:0 auto;"></svg>`;
              html += `</div>`;
            }
            
            if (mostrarCodigoTexto) {
              html += `<div class="etiqueta-codigo" style="max-width:98%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${appState.producto.codigo}</div>`;
            }
          }
          
          html += `
              </div>
            </div>
          `;
          
          return html;
        }
        
        // Insertar HTML en el contenedor temporal
        const htmlContent = await crearEtiquetasParaPDF();
        pdfContainer.innerHTML = htmlContent;
        
        // Obtener configuración de códigos de barras
        const barcodeConfig = obtenerConfiguracionCodigoBarras();
        
        // NUEVO: Generar códigos de barras por lotes para el PDF
        const svgs = pdfContainer.querySelectorAll('.etiqueta-barcode');
        console.log(`Generando ${svgs.length} códigos de barras para PDF...`);
        
        if (cantidad > limits.safe) {
          // Procesamiento por lotes para códigos de barras
          const barcodesBatchSize = 25; // Lotes más pequeños para códigos de barras
          const totalBarcodesBatches = Math.ceil(svgs.length / barcodesBatchSize);
          
          for (let batchIndex = 0; batchIndex < totalBarcodesBatches; batchIndex++) {
            if (batchController.isCancelled()) {
              console.log('Generación de códigos de barras cancelada');
              break;
            }
            
            // Actualizar progreso
            const barcodeStart = batchIndex * barcodesBatchSize;
            const barcodeEnd = Math.min(barcodeStart + barcodesBatchSize, svgs.length);
            
            showBatchProgress(true, barcodeEnd, svgs.length, `Generando códigos de barras: lote ${batchIndex + 1}/${totalBarcodesBatches}...`);
            
            // Procesar lote de códigos de barras
            for (let i = barcodeStart; i < barcodeEnd; i++) {
              const svg = svgs[i];
              await generarCodigoBarrasParaPDF(svg, barcodeConfig, formato);
            }
            
            // Pequeño delay entre lotes
            await delay(20);
          }
        } else {
          // Procesamiento normal para cantidades pequeñas
          for (let svg of svgs) {
            await generarCodigoBarrasParaPDF(svg, barcodeConfig, formato);
          }
        }
        
        // Dar tiempo para que los SVG se rendericen correctamente
        await delay(500);
        
        // Función para procesar las páginas del PDF una por una MEJORADA
        async function procesarPaginasPDF() {
          const paginas = pdfContainer.querySelectorAll('.pdf-page');
          let paginasProcesadas = 0;
          
          if (paginas.length === 0) {
            finalizarPDF();
            return;
          }
          
          // Actualizar mensaje
          if (cantidad > limits.safe) {
            showBatchProgress(true, 0, paginas.length, `Procesando páginas de PDF: 0 de ${paginas.length}`);
          } else {
            mostrarCargando(
              document.querySelector('.etiquetas-layout'), 
              true, 
              "Generando PDF...", 
              `Procesando página 1 de ${paginas.length}`
            );
          }
          
          // NUEVO: Procesar páginas por lotes para mejor rendimiento
          const pagesBatchSize = Math.min(5, paginas.length); // Máximo 5 páginas por lote
          const totalPagesBatches = Math.ceil(paginas.length / pagesBatchSize);
          
          for (let batchIndex = 0; batchIndex < totalPagesBatches; batchIndex++) {
            if (batchController.isCancelled()) {
              console.log('Procesamiento de páginas cancelado');
              break;
            }
            
            const pageStart = batchIndex * pagesBatchSize;
            const pageEnd = Math.min(pageStart + pagesBatchSize, paginas.length);
            
            // Procesar lote de páginas
            for (let pageIndex = pageStart; pageIndex < pageEnd; pageIndex++) {
              const pagina = paginas[pageIndex];
              
              // Actualizar mensaje
              if (cantidad > limits.safe) {
                showBatchProgress(true, pageIndex + 1, paginas.length, `Procesando páginas de PDF: ${pageIndex + 1} de ${paginas.length}`);
              } else {
                mostrarCargando(
                  document.querySelector('.etiquetas-layout'), 
                  true, 
                  "Generando PDF...", 
                  `Procesando página ${pageIndex + 1} de ${paginas.length}`
                );
              }
              
              try {
                // SOLUCIÓN CRUCIAL para evitar PDFs en negro: Configuración optimizada para html2canvas
                const canvas = await window.html2canvas(pagina, {
                  scale: 3.0,               // Equilibrio entre calidad y rendimiento
                  logging: false,
                  backgroundColor: "white",  // CRÍTICO: Forzar fondo blanco
                  allowTaint: false,         // CRÍTICO: Cambiado a false para evitar problemas de renderizado
                  useCORS: true,
                  x: 0,
                  y: 0,
                  scrollX: 0,
                  scrollY: 0,
                  windowWidth: pagina.offsetWidth * MM_TO_PX,
                  windowHeight: pagina.offsetHeight * MM_TO_PX,
                  // CRUCIAL: Configuración para evitar PDFs en negro
                  imageTimeout: 0,           // Sin timeout para imágenes
                  ignoreElements: (element) => {
                    // Ignorar elementos que puedan causar problemas de renderizado  
                    return element.tagName === 'IFRAME' || 
                           element.classList.contains('ignore-render');
                  }
                });
                
                // Añadir imagen al PDF (excepto para la primera página)
                if (pageIndex > 0) {
                  pdf.addPage();
                }
                
                // CORREGIDO: Añadir la imagen con dimensiones precisas
                const imgData = canvas.toDataURL('image/JPEG', 0.95);
                
                // Obtener dimensiones de la página PDF
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                
                // Añadir la imagen manteniendo proporciones precisas
                pdf.addImage(
                  imgData, 
                  'JPEG', 
                  0, 
                  0, 
                  pdfWidth, 
                  pdfHeight,
                  null,
                  'FAST' // Para mejor rendimiento
                );
                
                paginasProcesadas++;
                
                // Limpiar memoria para páginas ya procesadas
                cleanupMemory(pagina);
                
              } catch (err) {
                console.error(`Error procesando página ${pageIndex + 1}:`, err);
                // Continuar con la siguiente página
                paginasProcesadas++;
              }
            }
            
            // Pequeño delay entre lotes de páginas
            await delay(100);
          }
          
          // Finalizar PDF
          finalizarPDF();
        }
        
        // Función auxiliar para generar código de barras específicamente para PDF
        async function generarCodigoBarrasParaPDF(svg, barcodeConfig, formato) {
          try {
            const codigo = svg.dataset.codigo;
            // Obtener preferencia de mostrar texto en el SVG
            const mostrarTextoEnSVG = svg.dataset.showText === "true";
            
            // OPTIMIZADO: Ajustes específicos para impresoras térmicas
            let anchoLinea = barcodeConfig.anchoLinea;
            let altoBarras = barcodeConfig.altoBarras;
            let tamanoTexto = barcodeConfig.tamanoTexto;
            let margin = impresora === 'normal' ? 2 : 0;
            
            // Aplicar factores de ajuste según el tipo de impresora y formato
            if (imprimiendoEnTermica) {
              // Para impresoras térmicas, aumentar tamaño base
              anchoLinea = barcodeConfig.anchoLinea * formato.barcodeWidthFactor;
              altoBarras = barcodeConfig.altoBarras * formato.barcodeHeightFactor;
              tamanoTexto = barcodeConfig.tamanoTexto * 1.1; // Aumentar texto un 10%
              margin = 0; // Sin margen para térmicas
            } else if (esEtiquetaPequena) {
              // Para etiquetas pequeñas en impresoras normales
              anchoLinea = Math.max(0.8, barcodeConfig.anchoLinea * 0.8);
              altoBarras = Math.max(20, barcodeConfig.altoBarras * 0.8);
              tamanoTexto = Math.max(7, barcodeConfig.tamanoTexto * 0.8);
              margin = 1;
            }
            
            // Parámetros de JsBarcode optimizados para precisión
            const parametrosBarcode = {
              format: barcodeConfig.formato,
              width: anchoLinea,
              height: altoBarras,
              displayValue: mostrarTextoEnSVG,
              fontSize: tamanoTexto,
              margin: margin,
              background: "#ffffff",
              text: codigo,
              textMargin: mostrarTextoEnSVG ? (esEtiquetaPequena ? 1 : 2) : 0,
              lineColor: "#000000",
              valid: () => true, // CRUCIAL: Evitar que bloquee códigos inválidos
            };
            
            // Generar el código de barras
            // SOLUCIÓN PARA PDF NEGRO: Generar el código de barras con parámetros simples
            JsBarcode(svg, codigo, {
              format: "CODE128", // Usar CODE128 para mayor compatibilidad
              width: parametrosBarcode.width,
              height: parametrosBarcode.height,
              displayValue: mostrarTextoEnSVG,
              fontSize: parametrosBarcode.fontSize,
              margin: margin,
              background: "#ffffff",
              lineColor: "#000000",
              text: codigo,
              textMargin: parametrosBarcode.textMargin
            });
            
            // OPTIMIZACIÓN CRÍTICA: Aplicar nueva función de optimización
            optimizarSVGParaImpresion(svg);
          } catch (e) {
            console.error("Error al generar código de barras para PDF:", e);
            // Intentar con CODE128 como fallback
            try {
              const mostrarTextoEnSVG = svg.dataset.showText === "true";
              JsBarcode(svg, svg.dataset.codigo, {
                format: "CODE128",
                width: 2,
                height: 40,
                displayValue: mostrarTextoEnSVG
              });
              
              // También ajustar el fallback
              ajustarAlineacionVerticalSVG(svg, formato);
              
            } catch (e2) {
              console.error("Error secundario de código de barras:", e2);
            }
          }
        }
        
        // Comenzar procesamiento de páginas
        await procesarPaginasPDF();
        
        // Finalizar y guardar el PDF
        function finalizarPDF() {
          try {
            // Nombre del producto seguro para el archivo
            const nombreSeguro = appState.producto.nombre
              .replace(/[^a-zA-Z0-9_\-\s]/g, '') // Eliminar caracteres especiales
              .substring(0, 30)                  // Limitar longitud
              .trim()
              .replace(/\s+/g, '_');            // Reemplazar espacios con guiones
              
            // Nombre del archivo
            const nombreArchivo = `Etiquetas_${nombreSeguro || 'Producto'}.pdf`;
            
            // Guardar el PDF una sola vez
            pdf.save(nombreArchivo);
            
            console.log('Generación de PDF completada, archivo guardado:', nombreArchivo);
            
            // Limpiar y ocultar contenedor
            setTimeout(() => {
              pdfContainer.innerHTML = '';
              pdfContainer.style.display = 'none';
              showBatchProgress(false);
              mostrarCargando(document.querySelector('.etiquetas-layout'), false);
              appState.isProcessing = false;
              appState.pdfGenerating = false; // Desactivar el flag
            }, 500);
          } catch (err) {
            console.error("Error al guardar el PDF:", err);
            alert("Error al guardar el PDF: " + err.message);
            showBatchProgress(false);
            mostrarCargando(document.querySelector('.etiquetas-layout'), false);
            appState.isProcessing = false;
            appState.pdfGenerating = false; // Desactivar el flag en caso de error
          }
        }
      } catch (e) {
        console.error("Error al generar PDF:", e);
        alert("Error al generar PDF: " + e.message);
        showBatchProgress(false);
        mostrarCargando(document.querySelector('.etiquetas-layout'), false);
        appState.isProcessing = false;
        appState.pdfGenerating = false; // Desactivar el flag en caso de error
      }
    }
  } catch (error) {
    console.error("Error global en la inicialización:", error);
    
    // Mostrar error en la interfaz
    const mainContainer = document.querySelector('.etiquetas-layout');
    if (mainContainer) {
      const errorMsg = document.createElement('div');
      errorMsg.style.textAlign = 'center';
      errorMsg.style.padding = '2rem';
      errorMsg.style.color = '#444';
      errorMsg.style.backgroundColor = '#f5f5f7';
      errorMsg.style.borderRadius = '0.5rem';
      errorMsg.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      errorMsg.style.maxWidth = '90%';
      errorMsg.style.margin = '1rem auto';
      
      errorMsg.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:#e52e2e;margin-bottom:1rem;display:block;"></i>
        <h3 style="font-size:1.25rem;font-weight:600;margin-bottom:0.75rem;color:#1d1d1f;">Error al inicializar el sistema de etiquetas</h3>
        <p style="color:#444;margin-bottom:1rem;">${error.message}</p>
        <p style="color:#666;font-size:0.875rem;">Por favor, recarga la página o contacta con soporte si el problema persiste.</p>
        
        <button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1rem;background:#e52e2e;color:white;border:none;border-radius:0.375rem;font-weight:500;cursor:pointer;">
          <i class="fas fa-sync-alt" style="margin-right:0.5rem;"></i> Recargar página
        </button>
      `;
      
      mainContainer.appendChild(errorMsg);
    }
  }
}