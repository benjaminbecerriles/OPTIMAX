/**
 * Etiquetas.js - Sistema profesional de generación de etiquetas con códigos de barras
 * Versión optimizada y corregida: Compatibilidad de impresoras mejorada
 * Version modificada: Sin vista previa y adaptada para etiquetas pequeñas
 * Corrección específica: Alineación vertical precisa para todos los formatos de etiquetas
 * Corrección adicional: Ajuste de precisión en la conversión de unidades para PDF
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('Iniciando sistema de etiquetas profesional...');
  
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
          verticalSpacing: 0.0
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
          verticalSpacing: 0.0
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
          verticalSpacing: 0.0
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
          contentPaddingX: 2.0,
          contentPaddingY: 2.0,
          contentTopSpacing: 3.0,  // CORREGIDO
          contentBottomSpacing: 3.0, // CORREGIDO
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true
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
          contentPaddingX: 2.0,
          contentPaddingY: 2.0,
          contentTopSpacing: 3.0,  // CORREGIDO
          contentBottomSpacing: 3.0, // CORREGIDO
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true
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
          contentPaddingX: 2.0,
          contentPaddingY: 2.0,
          contentTopSpacing: 3.0,  // CORREGIDO
          contentBottomSpacing: 3.0, // CORREGIDO
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true
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
          contentPaddingX: 2.0,
          contentPaddingY: 2.0,
          contentTopSpacing: 2.0,  // CORREGIDO
          contentBottomSpacing: 2.0, // CORREGIDO
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true
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
          contentPaddingX: 1.0, // CORREGIDO
          contentPaddingY: 1.0, // CORREGIDO
          contentTopSpacing: 0.5,  // CORREGIDO
          contentBottomSpacing: 0.5, // CORREGIDO
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true
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
          contentPaddingX: 2.0,
          contentPaddingY: 2.0,
          contentTopSpacing: 3.0,  // CORREGIDO
          contentBottomSpacing: 3.0, // CORREGIDO
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true
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
          contentPaddingX: 2.0,
          contentPaddingY: 2.0,
          contentTopSpacing: 2.0,  // CORREGIDO
          contentBottomSpacing: 2.0, // CORREGIDO
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true
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
          contentPaddingX: 2.0,
          contentPaddingY: 2.0,
          contentTopSpacing: 3.0,  // CORREGIDO
          contentBottomSpacing: 3.0, // CORREGIDO
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true
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
          contentPaddingX: 2.0,
          contentPaddingY: 2.0,
          contentTopSpacing: 4.0,  // CORREGIDO
          contentBottomSpacing: 4.0, // CORREGIDO
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true
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
          contentPaddingX: 2.0,
          contentPaddingY: 2.0,
          contentTopSpacing: 5.0,  // CORREGIDO
          contentBottomSpacing: 5.0, // CORREGIDO
          barcodeVerticalShift: 0.0, // CORREGIDO
          verticalCenter: true,
          horizontalCenter: true
        }
      ]
    };

    // Estado de la aplicación
    const appState = {
      producto: null,           // Datos del producto
      formato: null,            // Formato de etiqueta seleccionado
      impresora: 'normal',      // Tipo de impresora activa
      cantidad: 0,              // Cantidad de etiquetas
      barcodesToGenerate: [],   // Códigos de barras pendientes
      isProcessing: false,      // Bloqueo de operaciones simultáneas
      pdfGenerating: false,     // Flag para evitar duplicación de PDF
      formatosCatalog: formatosCatalog // Catálogo de formatos disponibles
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
     * Configura los controladores de eventos para todos los componentes interactivos
     */
    function setupEventListeners() {
      // 1. Checkbox de stock
      if (elements.checkboxStock) {
        elements.checkboxStock.addEventListener('change', function() {
          if (elements.inputCantidad) {
            elements.inputCantidad.disabled = this.checked;
            if (this.checked) {
              elements.inputCantidad.value = appState.producto.stock;
            }
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
          ajustarInterfazSegunFormatoEtiqueta(esEtiquetaPequena);
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
          });
        }
      });
      
      // 5. Botones de acción
      if (elements.btnPrint) {
        elements.btnPrint.addEventListener('click', function() {
          imprimirEtiquetas();
        });
      }
      
      if (elements.btnPDF) {
        elements.btnPDF.addEventListener('click', function() {
          // Evitar múltiples clics rápidos
          if (!appState.pdfGenerating) {
            descargarPDF();
          }
        });
      }
    }
    
    /**
     * Configura el estado inicial de la interfaz
     */
    function setupInitialState() {
      // Configurar estado inicial de cantidad
      if (elements.inputCantidad && elements.checkboxStock) {
        elements.inputCantidad.disabled = elements.checkboxStock.checked;
      }
      
      // Configurar opciones de código de barras
      toggleCodigoBarrasOpciones();
      
      // Inicializar formatos disponibles para la impresora por defecto
      actualizarFormatosDisponibles('normal');
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
     * Ajusta la interfaz según el formato de etiqueta seleccionado
     * @param {boolean} esEtiquetaPequena - Si la etiqueta es considerada pequeña
     */
    function ajustarInterfazSegunFormatoEtiqueta(esEtiquetaPequena) {
      // Para etiquetas pequeñas, forzar sólo código de barras y texto
      if (esEtiquetaPequena) {
        // Mostrar alerta informativa
        mostrarAlertaFormato(
          "El formato de etiqueta seleccionado es pequeño. Sólo se mostrará el código de barras y el texto del código.", 
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
        
        // Forzar tamaño pequeño para el código de barras
        if (elements.tamanoCodigoSelect) {
          elements.tamanoCodigoSelect.value = "pequeno";
          elements.tamanoCodigoSelect.disabled = true;
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
        
        if (mostrar) {
          tabButton.style.display = '';
        } else {
          tabButton.style.display = 'none';
          // Si la pestaña está activa, cambiar a general
          if (tabButton.classList.contains('active')) {
            document.querySelector('[data-tab="general"]').click();
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
          verticalSpacing: 0.0 // NUEVO
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
        isSmall: option.dataset.isSmall === "true"
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
        horizontalCenter: formato.horizontalCenter || false
      };
      
      // Aplicar configuración específica por tipo de impresora
      switch (impresora) {
        case 'zebra':
          config.dpi = 203; // 203 DPI es el estándar en Zebra GK420d/GX420d
          config.paginaAncho = Math.min(formato.ancho, 104); // 104mm es el ancho máximo (4.09")
          config.paginaAlto = formato.alto;
          config.mediaType = 'labels';
          config.orientation = formato.ancho > formato.alto ? 'landscape' : 'portrait';
          break;
        
        case 'dymo':
          config.dpi = 300; // 300 DPI es el estándar en DYMO LabelWriter 450
          config.paginaAncho = Math.min(formato.ancho, 56); // 56mm es el ancho máximo (2.2")
          config.paginaAlto = formato.alto;
          config.mediaType = 'continuous';
          config.orientation = formato.ancho > formato.alto ? 'landscape' : 'portrait';
          break;
        
        case 'termica':
          config.dpi = 203; // 203 DPI es común en impresoras térmicas
          config.paginaAncho = Math.min(formato.ancho, 80); // 80mm es el ancho estándar (también hay de 58mm)
          config.paginaAlto = formato.alto;
          config.mediaType = 'continuous';
          config.orientation = formato.ancho > formato.alto ? 'landscape' : 'portrait';
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
      
      // Determinar qué elementos mostrar según tamaño y configuración
      const mostrarCodigoBarras = esEtiquetaPequena ? true : (!elements.checkboxCodigoBarras || elements.checkboxCodigoBarras.checked);
      const mostrarCodigoTexto = esEtiquetaPequena ? true : (!elements.checkboxCodigo || elements.checkboxCodigo.checked);
      const mostrarNombre = esEtiquetaPequena ? false : (!elements.checkboxNombre || elements.checkboxNombre.checked);
      const mostrarPrecio = esEtiquetaPequena ? false : (!elements.checkboxPrecio || elements.checkboxPrecio.checked);
      
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
        
        // Aplicar estilo al contenedor de barcode para etiquetas térmicas/DYMO/Zebra
        if (!esEtiquetaPequena) {
          barcodeContainerStyle = `style="display:flex;flex-direction:column;justify-content:center;align-items:center;margin-top:${barcodeMarginTop}mm;margin-bottom:${barcodeMarginBottom}mm;max-width:95%;overflow:hidden;"`;
        } else {
          // Para etiquetas pequeñas, usar valores más reducidos
          barcodeContainerStyle = `style="display:flex;flex-direction:column;justify-content:center;align-items:center;margin-top:${barcodeMarginTop/2}mm;margin-bottom:${barcodeMarginBottom/2}mm;max-width:95%;overflow:hidden;"`;
        }
      }
      
      // OPTIMIZADO: Ajuste de padding para evitar desbordamiento
      const reduccion = esEtiquetaPequena ? 1.5 : 1.0;
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
          html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}" data-show-text="false" style="max-width:95%;max-height:65%;margin:auto;"></svg>`;
          html += `</div>`;
          appState.barcodesToGenerate.push(svgId);
        }
        
        // Código en texto con fuente más pequeña
        if (mostrarCodigoTexto) {
          html += `<div class="etiqueta-codigo" style="font-size:6px;margin-top:1px;margin-bottom:0;text-align:center;max-width:95%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${appState.producto.codigo}</div>`;
        }
      } else {
        // Comportamiento normal para etiquetas estándar
        // Nombre del producto
        if (mostrarNombre) {
          html += `<div class="etiqueta-nombre" style="max-width:95%;overflow:hidden;text-overflow:ellipsis;">${appState.producto.nombre}</div>`;
        }
        
        // Precio
        if (mostrarPrecio) {
          html += `<div class="etiqueta-precio" style="max-width:95%;">${parseFloat(appState.producto.precio).toFixed(2)}</div>`;
        }
        
        // Código de barras - ENVUELTO EN DIV PARA CONTROL DE POSICIÓN
        if (mostrarCodigoBarras) {
          // Envolvemos en div para mejor control del posicionamiento vertical
          html += `<div ${barcodeContainerStyle}>`;
          // Agregar un identificador único para este SVG
          const svgId = `barcode-${index}-${Date.now()}`;
          
          // Obtener si debemos mostrar el texto del código en el SVG
          const mostrarTextoEnSVG = !mostrarCodigoTexto; // Invertido para evitar duplicación
          
          // Almacenar preferencia en el propio elemento para uso posterior
          html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}" data-show-text="${mostrarTextoEnSVG}" style="max-width:95%;"></svg>`;
          html += `</div>`;
          
          // Agregar este SVG a la lista de códigos por generar
          appState.barcodesToGenerate.push(svgId);
        }
        
        // Código en texto (solo si no se muestra en el código de barras o si se especificó)
        if (mostrarCodigoTexto) {
          html += `<div class="etiqueta-codigo" style="max-width:95%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${appState.producto.codigo}</div>`;
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
        let anchoLinea = config.anchoLinea;
        let altoBarras = config.altoBarras;
        let tamanoTexto = config.tamanoTexto;
        
        if (esEtiquetaPequena) {
          // Reducir tamaños para etiquetas pequeñas
          anchoLinea = Math.max(0.8, config.anchoLinea * 0.6);
          altoBarras = Math.max(15, config.altoBarras * 0.6);
          tamanoTexto = Math.max(6, config.tamanoTexto * 0.6);
        }
        
        // Aplicar ajustes específicos para impresoras térmicas/DYMO/Zebra
        if (appState.impresora !== 'normal') {
          // Reducir margen vertical para impresoras térmicas
          const margin = esEtiquetaPequena ? 1 : 0; // Reducir a 0 para impresoras térmicas no pequeñas
        }
        
        // Actualizar la configuración con la preferencia de mostrar texto
        const jsBarcodeConfig = {
          format: config.formato,
          width: anchoLinea,
          height: altoBarras,
          displayValue: mostrarTextoEnSVG,
          fontSize: tamanoTexto,
          margin: esEtiquetaPequena ? 1 : 0, // Eliminar márgenes para mejor control posicional
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
      
      // Configurar tamaño
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
      
      return {
        formato,
        anchoLinea,
        altoBarras,
        tamanoTexto
      };
    }
    
    /**
     * Imprime las etiquetas directamente
     * Implementación mejorada para compatibilidad con todas las impresoras
     */
    function imprimirEtiquetas() {
      try {
        if (appState.isProcessing) {
          alert('Hay una operación en proceso. Por favor, espere un momento e intente nuevamente.');
          return;
        }
        
        console.log('Preparando impresión...');
        appState.isProcessing = true;
        const mainContainer = document.querySelector('.etiquetas-layout');
        mostrarCargando(mainContainer, true, "Preparando impresión...", "Creando diseño de etiquetas");
        
        // Crear ventana para impresión
        const printWindow = window.open('', '_blank');
        
        if (!printWindow) {
          alert('Por favor, permite las ventanas emergentes para imprimir.');
          mostrarCargando(mainContainer, false);
          appState.isProcessing = false;
          return;
        }
        
        // Obtener configuración actualizada
        const formato = appState.formato || obtenerFormatoSeleccionado();
        const impresora = appState.impresora;
        const cantidad = appState.cantidad || obtenerCantidad();
        
        // Obtener configuración específica para la impresora
        const configuracion = obtenerConfiguracionImpresora(formato, impresora);
        
        // Obtener configuración de código de barras
        const barcodeConfig = obtenerConfiguracionCodigoBarras();
        
        // Verificar si es una etiqueta pequeña
        const esEtiquetaPequena = verificarSiEtiquetaEsPequena(formato);
        
        // Verificar si debemos mostrar el código como texto separado
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
            font-size: 8px;
            margin-bottom: 3px;
            color: #666;
            text-align: center;
          }
          
          .etiqueta-barcode {
            max-width: 95%;
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
        
        // Crear HTML para impresión, con indicador de carga
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
              Generando etiquetas, por favor espere...
            </div>
        `;
        
        // Crear funciones para generar etiquetas
        function crearEtiquetaHTMLParaImpresion(x, y, ancho, alto, svgId) {
          // Verificar si es una etiqueta pequeña y ajustar el contenido
          const esEtiquetaPequena = verificarSiEtiquetaEsPequena(formato);
          
          // Crear clase adicional para impresoras térmicas
          const claseAdicional = impresora !== 'normal' ? 'thermal-label' : '';
          
          // Configuración específica según tamaño de etiqueta
          const mostrarCodigoBarras = esEtiquetaPequena ? true : (!elements.checkboxCodigoBarras || elements.checkboxCodigoBarras.checked);
          const mostrarCodigoTexto = esEtiquetaPequena ? true : (!elements.checkboxCodigo || elements.checkboxCodigo.checked);
          const mostrarNombre = esEtiquetaPequena ? false : (!elements.checkboxNombre || elements.checkboxNombre.checked);
          const mostrarPrecio = esEtiquetaPequena ? false : (!elements.checkboxPrecio || elements.checkboxPrecio.checked);
          
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
              html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}" data-show-text="false" style="max-width:95%;max-height:70%;display:block;margin:0 auto;"></svg>`;
              html += `</div>`;
            }
            
            // Código en texto con fuente más pequeña
            if (mostrarCodigoTexto) {
              html += `<div class="etiqueta-codigo" style="font-size:6px;margin-top:1px;margin-bottom:0;text-align:center;">${appState.producto.codigo}</div>`;
            }
          } else {
            // Comportamiento normal para etiquetas estándar
            if (mostrarNombre) {
              html += `<div class="etiqueta-nombre">${appState.producto.nombre}</div>`;
            }
            
            if (mostrarPrecio) {
              html += `<div class="etiqueta-precio">$${parseFloat(appState.producto.precio).toFixed(2)}</div>`;
            }
            
            if (mostrarCodigoBarras) {
              // Contenedor para control de posición vertical
              html += `<div class="barcode-container" ${barcodeContainerStyle}>`;
              // Pasar preferencia de mostrar texto en el SVG
              const mostrarTextoEnSVG = !mostrarCodigoTexto;
              html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}" data-show-text="${mostrarTextoEnSVG}" style="display:block;margin:0 auto;"></svg>`;
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
        
        // Generar contenido según tipo de impresora
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
        
        // Script para generar códigos de barras y luego imprimir con manejo de errores
        printHtml += `
            <script>
              // Variables para seguimiento
              let processingComplete = false;
              let errorOccurred = false;
              
              // Temporizador de seguridad (60 segundos)
              const safetyTimeout = setTimeout(() => {
                if (!processingComplete) {
                  console.error("Timeout alcanzado - cerrando ventana");
                  window.close();
                }
              }, 60000);
              
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
              
              // Generar códigos de barras al cargar
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
                  await new Promise(resolve => setTimeout(resolve, 100));
                  
                  const barcodes = document.querySelectorAll('.etiqueta-barcode');
                  console.log(\`Generando \${barcodes.length} códigos de barras\`);
                  
                  for (let i = 0; i < barcodes.length; i++) {
                    const svg = barcodes[i];
                    try {
                      const codigo = svg.dataset.codigo;
                      // Obtener preferencia de mostrar texto
                      const mostrarTextoEnSVG = svg.dataset.showText === "true";
                      
                      // Detectar si es para una etiqueta pequeña basado en atributos
                      const esEtiquetaPequena = ${esEtiquetaPequena};
                      
                      // Configurar tamaños según el tipo de etiqueta
                      let anchoLinea = ${barcodeConfig.anchoLinea};
                      let altoBarras = ${barcodeConfig.altoBarras};
                      let tamanoTexto = ${barcodeConfig.tamanoTexto};
                      let margin = ${impresora === 'normal' ? 2 : 0}; // Eliminar márgenes para impresoras térmicas
                      
                      if (esEtiquetaPequena) {
                        // Reducir tamaños para etiquetas pequeñas
                        anchoLinea = Math.max(0.8, ${barcodeConfig.anchoLinea} * 0.6);
                        altoBarras = Math.max(15, ${barcodeConfig.altoBarras} * 0.6);
                        tamanoTexto = Math.max(6, ${barcodeConfig.tamanoTexto} * 0.6);
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
                    
                    // Actualizar indicador cada 10 códigos
                    if (i % 10 === 0) {
                      document.querySelector('.loading-indicator').textContent = 
                        \`Generando códigos de barras... \${i+1}/\${barcodes.length}\`;
                      // Dar tiempo para actualizar UI
                      await new Promise(resolve => setTimeout(resolve, 0));
                    }
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
          mostrarCargando(mainContainer, false);
          appState.isProcessing = false;
        }, 3000);
        
        // Evento para manejar cuando la ventana se cierra
        printWindow.addEventListener('unload', function() {
          mostrarCargando(mainContainer, false);
          appState.isProcessing = false;
        });
      } catch(e) {
        console.error("Error al imprimir etiquetas:", e);
        alert("Error al preparar la impresión: " + e.message);
        mostrarCargando(document.querySelector('.etiquetas-layout'), false);
        appState.isProcessing = false;
      }
    }
    
    /**
     * Descarga las etiquetas como PDF
     * Implementación corregida para evitar descarga doble
     */
    function descargarPDF() {
      try {
        if (appState.isProcessing) {
          alert('Hay una operación en proceso. Por favor, espere un momento e intente nuevamente.');
          return;
        }
        
        // Flag para evitar descarga doble
        appState.pdfGenerating = true;
        appState.isProcessing = true;
        
        // Verificar que las bibliotecas estén disponibles
        if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
          alert("No se han podido cargar las bibliotecas necesarias para generar PDF. Verifica tu conexión a Internet o usa la opción 'Imprimir directamente'.");
          appState.pdfGenerating = false;
          appState.isProcessing = false;
          return;
        }
        
        console.log('Preparando generación de PDF...');
        mostrarCargando(document.querySelector('.etiquetas-layout'), true, "Generando PDF...", "Preparando diseño");
        
        // Obtener configuración actualizada
        const formato = appState.formato || obtenerFormatoSeleccionado();
        const impresora = appState.impresora;
        const cantidad = appState.cantidad || obtenerCantidad();
        
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
              max-width: 95%; /* AJUSTE CRÍTICO: Limitar ancho */
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
              max-width: 95%; /* AJUSTE CRÍTICO: Limitar ancho */
            }
            
            .etiqueta-precio {
              font-weight: 700;
              font-size: 12px;
              margin-bottom: 2px;
              color: #e52e2e;
              text-align: center;
              max-width: 95%; /* AJUSTE CRÍTICO: Limitar ancho */
            }
            
            .etiqueta-codigo {
              font-size: 8px;
              margin-bottom: 2px; /* AJUSTE CRÍTICO: Reducido */
              color: #666;
              text-align: center;
              width: 100%; /* AJUSTE CRÍTICO: Ancho fijo */
              max-width: 95%; /* AJUSTE CRÍTICO: Limitar ancho */
              white-space: nowrap; /* AJUSTE CRÍTICO: Evitar saltos */
              overflow: hidden; /* AJUSTE CRÍTICO: Ocultar exceso */
              text-overflow: ellipsis; /* AJUSTE CRÍTICO: Mostrar elipsis */
            }
            
            .etiqueta-barcode {
              max-width: 95%;
              max-height: ${esEtiquetaPequena ? '60%' : '75%'}; /* OPTIMIZADO: Reducido para dejar espacio */
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
              max-width: 95% !important; /* CRÍTICO: Limitar ancho SVG */
            }
          </style>
        `;
        
            // SOLUCIÓN PARA PDF NEGRO: Preprocesamiento CSS fundamental
            function crearEtiquetasParaPDF() {
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
          
          return pdfHTML;
        }
        
        // Función para crear HTML de etiqueta individual para PDF
    function crearEtiquetaHTMLParaPDF(x, y, ancho, alto, svgId) {
      // Verificar si es una etiqueta pequeña y ajustar el contenido
      const esEtiquetaPequena = verificarSiEtiquetaEsPequena(formato);
      
      // Crear clase adicional para impresoras térmicas
      const claseAdicional = impresora !== 'normal' ? 'thermal-label' : '';
      
      // Configuración específica según tamaño de etiqueta
      const mostrarCodigoBarras = esEtiquetaPequena ? true : (!elements.checkboxCodigoBarras || elements.checkboxCodigoBarras.checked);
      const mostrarCodigoTexto = esEtiquetaPequena ? true : (!elements.checkboxCodigo || elements.checkboxCodigo.checked);
      const mostrarNombre = esEtiquetaPequena ? false : (!elements.checkboxNombre || elements.checkboxNombre.checked);
      const mostrarPrecio = esEtiquetaPequena ? false : (!elements.checkboxPrecio || elements.checkboxPrecio.checked);
      
      // OPTIMIZADO: Ajuste de padding para evitar desbordamiento
      const reduccion = esEtiquetaPequena ? 1.5 : 1.0;
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
        
        barcodeContainerStyle = `style="margin-top:${barcodeMarginTop}mm;margin-bottom:${barcodeMarginBottom}mm;max-width:95%;overflow:hidden;"`;
      } else {
        barcodeContainerStyle = `style="max-width:95%;overflow:hidden;"`;
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
          html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}" data-show-text="false" style="max-width:95%;max-height:65%;display:block;margin:0 auto;"></svg>`;
          html += `</div>`;
        }
        
        // Código en texto con fuente más pequeña
        if (mostrarCodigoTexto) {
          html += `<div class="etiqueta-codigo" style="font-size:6px;margin-top:1px;margin-bottom:0;text-align:center;max-width:95%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${appState.producto.codigo}</div>`;
        }
      } else {
        // Comportamiento normal para etiquetas estándar
        if (mostrarNombre) {
          html += `<div class="etiqueta-nombre" style="max-width:95%;overflow:hidden;text-overflow:ellipsis;">${appState.producto.nombre}</div>`;
        }
        
        if (mostrarPrecio) {
          html += `<div class="etiqueta-precio" style="max-width:95%;">${parseFloat(appState.producto.precio).toFixed(2)}</div>`;
        }
        
        if (mostrarCodigoBarras) {
          // Contenedor para control de posición vertical
          html += `<div class="barcode-container" ${barcodeContainerStyle}>`;
          // Pasar preferencia de mostrar texto en el SVG
          const mostrarTextoEnSVG = !mostrarCodigoTexto;
          html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}" data-show-text="${mostrarTextoEnSVG}" style="max-width:95%;display:block;margin:0 auto;"></svg>`;
          html += `</div>`;
        }
        
        if (mostrarCodigoTexto) {
          html += `<div class="etiqueta-codigo" style="max-width:95%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${appState.producto.codigo}</div>`;
        }
      }
      
      html += `
          </div>
        </div>
      `;
      
      return html;
    }
        
        // Insertar HTML en el contenedor temporal
        pdfContainer.innerHTML = crearEtiquetasParaPDF();
        
        // Obtener configuración de códigos de barras
        const barcodeConfig = obtenerConfiguracionCodigoBarras();
        
        // Generar códigos de barras para el PDF
        const svgs = pdfContainer.querySelectorAll('.etiqueta-barcode');
        
        // Una vez que se genera un código de barras para PDF, optimizarlo para impresión precisa
        for (let svg of svgs) {
            try {
              const codigo = svg.dataset.codigo;
              // Obtener preferencia de mostrar texto en el SVG
              const mostrarTextoEnSVG = svg.dataset.showText === "true";
              
              // Parámetros de JsBarcode optimizados para precisión
              const parametrosBarcode = {
                format: barcodeConfig.formato,
                width: barcodeConfig.anchoLinea,
                height: barcodeConfig.altoBarras,
                displayValue: mostrarTextoEnSVG,
                fontSize: barcodeConfig.tamanoTexto,
                margin: impresora === 'normal' ? 2 : 0, // Eliminar márgenes para impresoras térmicas
                background: "#ffffff",
                text: codigo,
                textMargin: mostrarTextoEnSVG ? 2 : 0,
                lineColor: "#000000",
                valid: () => true, // CRUCIAL: Evitar que bloquee códigos inválidos
              };
              
              // Si es etiqueta pequeña, ajustar tamaños
              if (esEtiquetaPequena) {
                parametrosBarcode.width = Math.max(0.8, barcodeConfig.anchoLinea * 0.6);
                parametrosBarcode.height = Math.max(15, barcodeConfig.altoBarras * 0.6);
                parametrosBarcode.fontSize = Math.max(6, barcodeConfig.tamanoTexto * 0.6);
                parametrosBarcode.margin = 1;
                parametrosBarcode.textMargin = mostrarTextoEnSVG ? 1 : 0;
              }
              
              // Generar el código de barras
              // SOLUCIÓN PARA PDF NEGRO: Generar el código de barras con parámetros simples
              JsBarcode(svg, codigo, {
                format: "CODE128", // Usar CODE128 para mayor compatibilidad
                width: parametrosBarcode.width,
                height: parametrosBarcode.height,
                displayValue: mostrarTextoEnSVG,
                fontSize: parametrosBarcode.fontSize,
                margin: 2,
                background: "#ffffff",
                lineColor: "#000000",
                text: codigo,
                textMargin: 2
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
        
        // Dar tiempo para que los SVG se rendericen correctamente
        setTimeout(() => {
          procesarPaginasPDF();
        }, 500);
        
        // Función para procesar las páginas del PDF una por una
        function procesarPaginasPDF() {
          const paginas = pdfContainer.querySelectorAll('.pdf-page');
          let paginasProcesadas = 0;
          
          if (paginas.length === 0) {
            finalizarPDF();
            return;
          }
          
          // Actualizar mensaje
          mostrarCargando(
            document.querySelector('.etiquetas-layout'), 
            true, 
            "Generando PDF...", 
            `Procesando página 1 de ${paginas.length}`
          );
          
          // Función recursiva para procesar cada página
          function procesarPagina(index) {
            if (index >= paginas.length) {
              // Todas las páginas procesadas, guardar PDF
              finalizarPDF();
              return;
            }
            
            const pagina = paginas[index];
            
            // Actualizar mensaje
            mostrarCargando(
              document.querySelector('.etiquetas-layout'), 
              true, 
              "Generando PDF...", 
              `Procesando página ${index + 1} de ${paginas.length}`
            );
            
            // SOLUCIÓN CRUCIAL para evitar PDFs en negro: Configuración optimizada para html2canvas
            window.html2canvas(pagina, {
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
            }).then(canvas => {
              // Añadir imagen al PDF (excepto para la primera página)
              if (index > 0) {
                pdf.addPage();
              }
              
              // CORREGIDO: Añadir la imagen con dimensiones precisas
              try {
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                
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
                
                // Actualizar contador y procesar siguiente página
                paginasProcesadas++;
                setTimeout(() => procesarPagina(index + 1), 100);
              } catch (err) {
                console.error("Error añadiendo imagen al PDF:", err);
                // Intentar continuar con la siguiente página
                paginasProcesadas++;
                setTimeout(() => procesarPagina(index + 1), 100);
              }
            }).catch(err => {
              console.error("Error en html2canvas:", err);
              // Intentar continuar con la siguiente página
              paginasProcesadas++;
              setTimeout(() => procesarPagina(index + 1), 100);
            });
          }
          
          // Comenzar procesamiento con la primera página
          procesarPagina(0);
        }
        
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
              mostrarCargando(document.querySelector('.etiquetas-layout'), false);
              appState.isProcessing = false;
              appState.pdfGenerating = false; // Desactivar el flag
            }, 500);
          } catch (err) {
            console.error("Error al guardar el PDF:", err);
            alert("Error al guardar el PDF: " + err.message);
            mostrarCargando(document.querySelector('.etiquetas-layout'), false);
            appState.isProcessing = false;
            appState.pdfGenerating = false; // Desactivar el flag en caso de error
          }
        }
      } catch (e) {
        console.error("Error al generar PDF:", e);
        alert("Error al generar PDF: " + e.message);
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