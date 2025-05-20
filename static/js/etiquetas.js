/**
 * Etiquetas.js - Sistema profesional de generación de etiquetas con códigos de barras
 * Versión mejorada: Diseño limpio y solución de problemas
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
          <i class="fas fa-exclamation-circle" style="margin-right: 0.5rem; color: #0071e3;"></i>
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
   * Inicializa la aplicación completa de etiquetas
   * Arquitectura modular para máxima eficiencia y mantenibilidad
   */
  function initLabelApp() {
    try {
      // Estado de la aplicación
      const appState = {
        producto: null,           // Datos del producto
        formato: null,            // Formato de etiqueta seleccionado
        impresora: 'normal',      // Tipo de impresora activa
        cantidad: 0,              // Cantidad de etiquetas
        barcodesToGenerate: [],   // Códigos de barras pendientes
        isProcessing: false,      // Bloqueo de operaciones simultáneas
        zoomLevel: 100,           // Nivel de zoom para vista previa
        renderTimeout: null,      // Control de refresco
        pdfGenerating: false      // Flag para evitar duplicación de PDF
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
        formatoCodigoSelect: document.getElementById('formato_codigo'),
        tamanoCodigoSelect: document.getElementById('tamano_codigo'),
        
        // Botones de acción
        btnRefreshPreview: document.getElementById('btn-refresh-preview'),
        btnPreview: document.getElementById('btn-preview'),
        btnPrint: document.getElementById('btn-print'),
        btnPDF: document.getElementById('btn-pdf'),
        
        // Contenedores
        previewContainer: document.getElementById('preview-container'),
        previewContent: document.getElementById('preview-content'),
        printContent: document.getElementById('print-content'),
        pdfContainer: document.getElementById('pdf-container'),
        
        // Controles de zoom
        zoomIn: document.getElementById('zoom-in'),
        zoomOut: document.getElementById('zoom-out'),
        zoomValue: document.getElementById('zoom-value')
      };
      
      // ====== INICIALIZACIÓN DE DATOS ======
      
      // Cargar datos del producto
      initProductData();
      
      // Configurar controladores de eventos
      setupEventListeners();
      
      // Configurar estado inicial de la interfaz
      setupInitialState();
      
      // Generar vista previa inicial después de un breve retraso
      setTimeout(() => {
        generarVistaPrevia();
      }, 300);
      
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
            programarActualizacionVistaPrevia();
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
                
                // Regenerar vista previa
                programarActualizacionVistaPrevia();
              }
            });
          });
        }
        
        // 3. Elementos de configuración con eventos
        const configElements = [
          { elem: elements.checkboxNombre },
          { elem: elements.checkboxPrecio },
          { elem: elements.checkboxCodigo },
          { elem: elements.checkboxCodigoBarras },
          { elem: elements.selectFormato },
          { elem: elements.inputCantidad },
          { elem: elements.formatoCodigoSelect },
          { elem: elements.tamanoCodigoSelect }
        ];
        
        configElements.forEach(item => {
          if (item.elem) {
            item.elem.addEventListener('change', function() {
              // Si es el checkbox de código de barras, mostrar/ocultar opciones
              if (this === elements.checkboxCodigoBarras) {
                toggleCodigoBarrasOpciones();
              }
              
              // Programar actualización
              programarActualizacionVistaPrevia();
            });
          }
        });
        
        // 4. Botones de acción
        if (elements.btnRefreshPreview) {
          elements.btnRefreshPreview.addEventListener('click', function() {
            generarVistaPrevia(true); // Forzar regeneración
          });
        }
        
        if (elements.btnPreview) {
          elements.btnPreview.addEventListener('click', function() {
            generarVistaPrevia(true); // Forzar regeneración
          });
        }
        
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
        
        // 5. Controles de zoom
        if (elements.zoomIn && elements.zoomOut && elements.zoomValue) {
          elements.zoomIn.addEventListener('click', function() {
            if (appState.zoomLevel < 200) {
              appState.zoomLevel += 10;
              updateZoom();
            }
          });
          
          elements.zoomOut.addEventListener('click', function() {
            if (appState.zoomLevel > 50) {
              appState.zoomLevel -= 10;
              updateZoom();
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
        
        // Inicializar zoom
        updateZoom();
      }
      
      /**
       * Actualiza la visualización del zoom en la vista previa
       */
      function updateZoom() {
        if (elements.zoomValue && elements.previewContent) {
          elements.zoomValue.textContent = `${appState.zoomLevel}%`;
          elements.previewContent.style.transform = `scale(${appState.zoomLevel/100})`;
          elements.previewContent.style.transformOrigin = 'top center';
        }
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
       * Programa la actualización de la vista previa con debounce
       */
      function programarActualizacionVistaPrevia() {
        if (appState.renderTimeout) {
          clearTimeout(appState.renderTimeout);
        }
        
        appState.renderTimeout = setTimeout(() => {
          generarVistaPrevia();
        }, 300);
      }
      
      /**
       * Obtiene el formato de etiqueta seleccionado con todos sus parámetros
       * @returns {Object} Objeto con todos los datos del formato
       */
      function obtenerFormatoSeleccionado() {
        if (!elements.selectFormato) {
          return {
            id: 'avery5160',
            ancho: 63.5,
            alto: 26.9,
            columnas: 3,
            filas: 10,
            porPagina: 30
          };
        }
        
        const option = elements.selectFormato.options[elements.selectFormato.selectedIndex];
        return {
          id: option.value,
          ancho: parseFloat(option.dataset.width),
          alto: parseFloat(option.dataset.height),
          columnas: parseInt(option.dataset.cols),
          filas: parseInt(option.dataset.rows),
          porPagina: parseInt(option.dataset.perPage)
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
      
      /**
       * Genera la vista previa de las etiquetas con animación y manejo de errores
       * @param {boolean} forzar - Si es true, fuerza la regeneración incluso si ya está en proceso
       */
      function generarVistaPrevia(forzar = false) {
        if (!elements.previewContent) {
          console.error('No se encontró el contenedor de vista previa');
          return;
        }
        
        // Evitar múltiples generaciones simultáneas
        if (appState.isProcessing && !forzar) {
          console.log('Ya hay una operación en proceso, se omite esta solicitud');
          return;
        }
        
        try {
          console.log('Generando vista previa de etiquetas...');
          appState.isProcessing = true;
          
          // Mostrar indicador de carga
          mostrarCargando(elements.previewContainer, true, "Generando vista previa...");
          
          // Limpiar códigos pendientes
          appState.barcodesToGenerate = [];
          
          // Obtener configuración actualizada
          const cantidad = obtenerCantidad();
          const formato = obtenerFormatoSeleccionado();
          const impresora = appState.impresora;
          
          // Guardar en estado para uso posterior
          appState.cantidad = cantidad;
          appState.formato = formato;
          
          console.log(`Configuración: Formato=${formato.id}, Impresora=${impresora}, Cantidad=${cantidad}`);
          
          // Configuración según el tipo de impresora
          let configuracion = obtenerConfiguracionImpresora(formato, impresora);
          
          // Preparamos el HTML para la vista previa
          let previewHTML = '';
          
          if (impresora === 'normal') {
            // Para impresoras normales, crear hojas con múltiples etiquetas
            const etiquetasPorPagina = formato.porPagina;
            const numPaginas = Math.ceil(cantidad / etiquetasPorPagina);
            
            // Limitar a 1 página en la vista previa
            const paginasAMostrar = 1;
            
            for (let pagina = 0; pagina < paginasAMostrar; pagina++) {
              previewHTML += `
                <div class="preview-sheet" style="width:${configuracion.paginaAncho}mm;height:${configuracion.paginaAlto}mm;position:relative;">
              `;
              
              // Añadir etiquetas a la hoja
              for (let i = 0; i < formato.filas; i++) {
                for (let j = 0; j < formato.columnas; j++) {
                  const index = pagina * etiquetasPorPagina + i * formato.columnas + j;
                  
                  if (index < cantidad) {
                    // Calcular posición de la etiqueta - CORREGIDO para formatos específicos
                    const posX = calcularPosicionX(formato, configuracion, j);
                    const posY = calcularPosicionY(formato, configuracion, i);
                    
                    // Crear etiqueta
                    previewHTML += crearEtiquetaHTML(posX, posY, formato.ancho, formato.alto, index);
                  }
                }
              }
              
              previewHTML += `</div>`;
            }
            
            // Si hay más páginas, mostrar mensaje
            if (numPaginas > paginasAMostrar) {
              previewHTML += `
                <div style="margin-top:1rem;padding:0.75rem;background-color:#f0f9ff;border-radius:0.375rem;border:1px solid #e0f2fe;text-align:center;">
                  <div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;">
                    <i class="fas fa-info-circle" style="color:#0071e3;"></i>
                    <span style="color:#0c4a6e;font-size:0.875rem;font-weight:500;">
                      Se generarán ${numPaginas} páginas con ${cantidad} etiquetas en total.
                    </span>
                  </div>
                </div>
              `;
            }
          } else {
            // Para impresoras térmicas, mostrar solo algunas etiquetas como ejemplo
            const numEjemplos = Math.min(cantidad, 2); // Reducido a 2 para simplificar la vista
            previewHTML += `<div style="display:flex;flex-wrap:wrap;gap:1rem;justify-content:center;">`;
            
            for (let i = 0; i < numEjemplos; i++) {
              previewHTML += crearEtiquetaHTML(0, 0, formato.ancho, formato.alto, i, true);
            }
            
            previewHTML += `</div>`;
            
            if (cantidad > numEjemplos) {
              previewHTML += `
                <div style="margin-top:1rem;padding:0.75rem;background-color:#f0f9ff;border-radius:0.375rem;border:1px solid #e0f2fe;text-align:center;">
                  <div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;">
                    <i class="fas fa-info-circle" style="color:#0071e3;"></i>
                    <span style="color:#0c4a6e;font-size:0.875rem;font-weight:500;">
                      Se generarán ${cantidad} etiquetas en total.
                    </span>
                  </div>
                </div>
              `;
            }
          }
          
          // Actualizar contenido
          elements.previewContent.innerHTML = previewHTML;
          
          // Restaurar zoom
          updateZoom();
          
          // Generar códigos de barras después de un momento
          setTimeout(function() {
            generarCodigosBarras();
            // Quitar indicador de carga después de que se generen los códigos
            setTimeout(() => {
              mostrarCargando(elements.previewContainer, false);
              appState.isProcessing = false;
            }, 300);
          }, 200);
        } catch (error) {
          console.error("Error en generarVistaPrevia:", error);
          elements.previewContent.innerHTML = `
            <div style="padding:1.5rem;background-color:#fff5f5;border-radius:0.5rem;border:1px solid #fed7d7;text-align:center;margin:1rem auto;max-width:90%;">
              <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:#e53e3e;margin-bottom:1rem;"></i>
              <h3 style="color:#c53030;font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;">Error al generar vista previa</h3>
              <p style="color:#742a2a;font-size:0.875rem;">${error.message}</p>
              <p style="color:#742a2a;font-size:0.875rem;margin-top:0.5rem;">Intenta cambiar el formato de etiqueta o la impresora.</p>
            </div>
          `;
          mostrarCargando(elements.previewContainer, false);
          appState.isProcessing = false;
        }
      }
      
      /**
       * Calcula la posición X de una etiqueta, con correcciones para formatos específicos
       * @param {Object} formato - Formato de etiqueta seleccionado 
       * @param {Object} configuracion - Configuración de impresora
       * @param {number} columnaIndex - Índice de la columna (0, 1, 2...)
       * @returns {number} - Posición X en milímetros
       */
      function calcularPosicionX(formato, configuracion, columnaIndex) {
        // Corrección especial para formatos 101.6mm x 50.8mm (Avery 5163)
        if (formato.ancho === 101.6 && formato.alto === 50.8) {
          // Usa un margen específico para este formato (A4 = 210mm)
          const margenCorregido = (210 - (formato.ancho * formato.columnas)) / 2;
          return margenCorregido + (columnaIndex * formato.ancho);
        }
        
        // Para otros formatos, usar cálculo normal
        return configuracion.marginX + (columnaIndex * formato.ancho);
      }
      
      /**
       * Calcula la posición Y de una etiqueta, con correcciones si son necesarias
       * @param {Object} formato - Formato de etiqueta seleccionado 
       * @param {Object} configuracion - Configuración de impresora
       * @param {number} filaIndex - Índice de la fila (0, 1, 2...)
       * @returns {number} - Posición Y en milímetros
       */
      function calcularPosicionY(formato, configuracion, filaIndex) {
        // Por ahora usamos el margen Y estándar para todos los formatos
        return configuracion.marginY + (filaIndex * formato.alto);
      }
      
      /**
       * Obtiene la configuración específica para el tipo de impresora seleccionado
       * @param {Object} formato - Formato de etiqueta
       * @param {string} impresora - Tipo de impresora
       * @returns {Object} Configuración para la impresora
       */
      function obtenerConfiguracionImpresora(formato, impresora) {
        if (impresora === 'normal') {
          // Usar margen específico por formato
          let marginX = 6.35;  // Valor por defecto para la mayoría de formatos
          let marginY = 12.7;  // Valor por defecto para la mayoría de formatos
          
          // Calcular márgenes optimizados para formatos especiales
          if (formato.id === 'avery5163' || (formato.ancho === 101.6 && formato.alto === 50.8)) {
            // Formato 101.6mm x 50.8mm (2 etiquetas por fila en A4)
            // A4 ancho = 210mm, 2 etiquetas de 101.6mm = 203.2mm, margen total = 6.8mm, margen por lado = 3.4mm
            marginX = 3.4;
          } else if (formato.id === 'avery5161' || (formato.ancho === 101.6 && formato.alto === 26.9)) {
            // Formato 101.6mm x 26.9mm (2 etiquetas por fila en A4)
            marginX = 3.4; 
          }
          
          return {
            paginaAncho: 210, // mm (A4)
            paginaAlto: 297,  // mm (A4)
            marginX: marginX, // mm - CORREGIDO para formatos específicos
            marginY: marginY, // mm
            orientation: 'portrait'
          };
        } else {
          // Para impresoras térmicas, ajustamos según el formato
          return {
            paginaAncho: formato.ancho + 5,
            paginaAlto: formato.alto + 5,
            marginX: 2.5,
            marginY: 2.5,
            orientation: formato.ancho > formato.alto ? 'landscape' : 'portrait'
          };
        }
      }
      
      /**
       * Crea HTML para una etiqueta individual
       * @param {number} x - Posición X en milímetros
       * @param {number} y - Posición Y en milímetros
       * @param {number} ancho - Ancho en milímetros
       * @param {number} alto - Alto en milímetros
       * @param {number} index - Índice de la etiqueta (para identificación)
       * @param {boolean} posicionRelativa - Si true, usa posición relativa en lugar de absoluta
       * @returns {string} HTML de la etiqueta
       */
      function crearEtiquetaHTML(x, y, ancho, alto, index = 0, posicionRelativa = false) {
        let positionStyle = posicionRelativa ? 
          'position:relative;' : 
          `position:absolute;left:${x}mm;top:${y}mm;`;
        
        let html = `
          <div class="etiqueta" style="${positionStyle}width:${ancho}mm;height:${alto}mm;">
            <div class="etiqueta-content">
        `;
        
        // Nombre del producto
        if (!elements.checkboxNombre || elements.checkboxNombre.checked) {
          html += `<div class="etiqueta-nombre">${appState.producto.nombre}</div>`;
        }
        
        // Precio
        if (!elements.checkboxPrecio || elements.checkboxPrecio.checked) {
          html += `<div class="etiqueta-precio">$${parseFloat(appState.producto.precio).toFixed(2)}</div>`;
        }
        
        // Código de barras
        if (!elements.checkboxCodigoBarras || elements.checkboxCodigoBarras.checked) {
          // Agregar un identificador único para este SVG
          const svgId = `barcode-${index}-${Date.now()}`;
          html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}"></svg>`;
          
          // Agregar este SVG a la lista de códigos por generar
          appState.barcodesToGenerate.push(svgId);
        }
        
        // Código en texto
        if (!elements.checkboxCodigo || elements.checkboxCodigo.checked) {
          html += `<div class="etiqueta-codigo">${appState.producto.codigo}</div>`;
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
          
          // Generar código de barras con manejo de errores
          try {
            JsBarcode(svg, codigoLimpio, {
              format: config.formato,
              width: config.anchoLinea,
              height: config.altoBarras,
              displayValue: true,
              fontSize: config.tamanoTexto,
              margin: 2,
              background: "#ffffff",
              text: codigoLimpio,
              textMargin: 2,
              lineColor: "#000000",
              valid: function(valid) {
                if (!valid) {
                  console.warn(`El código ${codigoLimpio} no es válido para el formato ${config.formato}, usando CODE128`);
                  // Fallback a CODE128
                  JsBarcode(svg, codigoLimpio, {
                    format: "CODE128",
                    width: config.anchoLinea,
                    height: config.altoBarras,
                    displayValue: true,
                    fontSize: config.tamanoTexto,
                    margin: 2,
                    background: "#ffffff",
                    text: codigoLimpio,
                    textMargin: 2,
                    lineColor: "#000000"
                  });
                }
              }
            });
          } catch(err) {
            console.error(`Error en código de barras, usando CODE128:`, err);
            
            // Segundo intento con CODE128
            JsBarcode(svg, codigoLimpio, {
              format: "CODE128",
              width: config.anchoLinea,
              height: config.altoBarras,
              displayValue: true,
              fontSize: config.tamanoTexto,
              margin: 2
            });
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
       * Obtiene la configuración actual para los códigos de barras
       * @returns {Object} Configuración para códigos de barras
       */
      function obtenerConfiguracionCodigoBarras() {
        // Formato de código de barras
        let formato = 'CODE128';
        
        // Usar formato seleccionado o autodetectar
        if (elements.formatoCodigoSelect && elements.formatoCodigoSelect.value !== 'auto') {
          formato = elements.formatoCodigoSelect.value;
        } else {
          // Autodetectar formato basado en el código
          const codigoLimpio = appState.producto.codigo.trim();
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
          mostrarCargando(elements.previewContainer, true, "Preparando impresión...", "Creando diseño de etiquetas");
          
          // Crear ventana para impresión
          const printWindow = window.open('', '_blank');
          
          if (!printWindow) {
            alert('Por favor, permite las ventanas emergentes para imprimir.');
            mostrarCargando(elements.previewContainer, false);
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
          
          // Crear estilos CSS optimizados para impresión
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
            }
            .etiqueta-content {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              width: 100%;
              height: 100%;
              padding: 2px;
              text-align: center;
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
            }
            .etiqueta-precio {
              font-weight: 700;
              font-size: 12px;
              margin-bottom: 2px;
              color: #0071e3;
            }
            .etiqueta-codigo {
              font-size: 8px;
              margin-bottom: 3px;
              color: #666;
            }
            .etiqueta-barcode {
              max-width: 95%;
              margin-bottom: 2px;
            }
            .loading-indicator {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              padding: 10px;
              background-color: #f0f9ff;
              color: #0071e3;
              text-align: center;
              font-size: 14px;
              z-index: 1000;
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
            let html = `
              <div class="etiqueta" style="left:${x}mm;top:${y}mm;width:${ancho}mm;height:${alto}mm;">
                <div class="etiqueta-content">
            `;
            
            if (!elements.checkboxNombre || elements.checkboxNombre.checked) {
              html += `<div class="etiqueta-nombre">${appState.producto.nombre}</div>`;
            }
            
            if (!elements.checkboxPrecio || elements.checkboxPrecio.checked) {
              html += `<div class="etiqueta-precio">$${parseFloat(appState.producto.precio).toFixed(2)}</div>`;
            }
            
            if (!elements.checkboxCodigoBarras || elements.checkboxCodigoBarras.checked) {
              html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}"></svg>`;
            }
            
            if (!elements.checkboxCodigo || elements.checkboxCodigo.checked) {
              html += `<div class="etiqueta-codigo">${appState.producto.codigo}</div>`;
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
            // Para impresoras térmicas: una etiqueta por página
            for (let i = 0; i < cantidad; i++) {
              printHtml += `<div class="preview-sheet">`;
              const svgId = `print-barcode-thermal-${i}`;
              printHtml += crearEtiquetaHTMLParaImpresion(configuracion.marginX, configuracion.marginY, formato.ancho, formato.alto, svgId);
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
                
                // Generar códigos de barras al cargar
                window.onload = async function() {
                  try {
                    // Verificar que JsBarcode esté disponible
                    if (typeof JsBarcode === 'undefined') {
                      document.body.innerHTML = '<div style="padding:20px;text-align:center;"><h2 style="color:#0071e3;">Error: No se pudo cargar la biblioteca de códigos de barras</h2><p>Por favor, intente nuevamente o use otra opción.</p></div>';
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
                        if (codigo) {
                          JsBarcode(svg, codigo, {
                            format: "${barcodeConfig.formato}",
                            width: ${barcodeConfig.anchoLinea},
                            height: ${barcodeConfig.altoBarras},
                            displayValue: true,
                            fontSize: ${barcodeConfig.tamanoTexto},
                            margin: 2,
                            background: "#ffffff",
                            text: codigo,
                            textMargin: 2,
                            lineColor: "#000000"
                          });
                        }
                      } catch(e) {
                        console.error("Error generando código:", e);
                        // Intentar con formato alternativo
                        try {
                          const codigo = svg.dataset.codigo;
                          JsBarcode(svg, codigo, {
                            format: "CODE128",
                            width: ${barcodeConfig.anchoLinea},
                            height: ${barcodeConfig.altoBarras},
                            displayValue: true
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
                        <h2 style="color:#0071e3;">Error durante la preparación de impresión</h2>
                        <p style="color:#444;">\${e.message}</p>
                        <button onclick="window.close()" style="margin-top:20px;padding:8px 16px;background:#0071e3;color:white;border:none;border-radius:6px;cursor:pointer;">
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
            mostrarCargando(elements.previewContainer, false);
            appState.isProcessing = false;
          }, 3000);
          
          // Evento para manejar cuando la ventana se cierra
          printWindow.addEventListener('unload', function() {
            mostrarCargando(elements.previewContainer, false);
            appState.isProcessing = false;
          });
        } catch(e) {
          console.error("Error al imprimir etiquetas:", e);
          alert("Error al preparar la impresión: " + e.message);
          mostrarCargando(elements.previewContainer, false);
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
          mostrarCargando(elements.previewContainer, true, "Generando PDF...", "Preparando diseño");
          
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
          
          // Crear el PDF con orientación correcta
          const pdfOptions = {
            orientation: configuracion.orientation,
            unit: 'mm',
            format: impresora === 'normal' ? 'a4' : [configuracion.paginaAncho, configuracion.paginaAlto],
            hotfixes: ["px_scaling"]
          };
          
          // CORREGIDO: Correcta inicialización para evitar descarga doble
          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF(pdfOptions);
          
          // Preparar CSS para el contenedor del PDF
          const pdfCSS = `
            <style>
              body, html {
                margin: 0;
                padding: 0;
                font-family: 'Inter', Arial, sans-serif;
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
              }
              .pdf-page {
                width: ${impresora === 'normal' ? '210mm' : formato.ancho + 'mm'};
                height: ${impresora === 'normal' ? '297mm' : formato.alto + 'mm'};
                position: relative;
                background: white;
                margin: 10px;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                overflow: hidden;
                page-break-after: always;
                box-sizing: border-box;
              }
              .etiqueta {
                position: absolute;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                overflow: hidden;
                background: white;
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
                padding: 2px;
                text-align: center;
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
              }
              .etiqueta-precio {
                font-weight: 700;
                font-size: 12px;
                margin-bottom: 2px;
                color: #0071e3;
              }
              .etiqueta-codigo {
                font-size: 8px;
                margin-bottom: 3px;
                color: #666;
              }
              .etiqueta-barcode {
                max-width: 95%;
                margin-bottom: 2px;
              }
            </style>
          `;
          
          // Función para crear etiquetas para el PDF
          function crearEtiquetasParaPDF() {
            let pdfHTML = pdfCSS;
            
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
              // Para impresoras térmicas, crear una hoja por etiqueta
              for (let i = 0; i < cantidad; i++) {
                pdfHTML += `<div class="pdf-page">`;
                const svgId = `pdf-barcode-thermal-${i}`;
                pdfHTML += crearEtiquetaHTMLParaPDF(configuracion.marginX, configuracion.marginY, formato.ancho, formato.alto, svgId);
                pdfHTML += `</div>`;
              }
            }
            
            return pdfHTML;
          }
          
          // Función para crear HTML de etiqueta individual para PDF
          function crearEtiquetaHTMLParaPDF(x, y, ancho, alto, svgId) {
            let html = `
              <div class="etiqueta" style="left:${x}mm;top:${y}mm;width:${ancho}mm;height:${alto}mm;">
                <div class="etiqueta-content">
            `;
            
            if (!elements.checkboxNombre || elements.checkboxNombre.checked) {
              html += `<div class="etiqueta-nombre">${appState.producto.nombre}</div>`;
            }
            
            if (!elements.checkboxPrecio || elements.checkboxPrecio.checked) {
              html += `<div class="etiqueta-precio">$${parseFloat(appState.producto.precio).toFixed(2)}</div>`;
            }
            
            if (!elements.checkboxCodigoBarras || elements.checkboxCodigoBarras.checked) {
              html += `<svg class="etiqueta-barcode" id="${svgId}" data-codigo="${appState.producto.codigo}"></svg>`;
            }
            
            if (!elements.checkboxCodigo || elements.checkboxCodigo.checked) {
              html += `<div class="etiqueta-codigo">${appState.producto.codigo}</div>`;
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
          for (let svg of svgs) {
            try {
              const codigo = svg.dataset.codigo;
              
              JsBarcode(svg, codigo, {
                format: barcodeConfig.formato,
                width: barcodeConfig.anchoLinea,
                height: barcodeConfig.altoBarras,
                displayValue: true,
                fontSize: barcodeConfig.tamanoTexto,
                margin: 2,
                background: "#ffffff",
                text: codigo,
                textMargin: 2,
                lineColor: "#000000"
              });
            } catch (e) {
              console.error("Error al generar código de barras para PDF:", e);
              // Intentar con CODE128 como fallback
              try {
                JsBarcode(svg, svg.dataset.codigo, {
                  format: "CODE128",
                  width: 2,
                  height: 40,
                  displayValue: true
                });
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
              elements.previewContainer, 
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
                elements.previewContainer, 
                true, 
                "Generando PDF...", 
                `Procesando página ${index + 1} de ${paginas.length}`
              );
              
              // Usar html2canvas para convertir la página a imagen
              window.html2canvas(pagina, {
                scale: 2.5, // Mayor calidad de renderizado
                logging: false,
                backgroundColor: 'white',
                allowTaint: true,
                useCORS: true,
                x: 0,
                y: 0,
                scrollX: 0,
                scrollY: 0
              }).then(canvas => {
                // Añadir imagen al PDF (excepto para la primera página)
                if (index > 0) {
                  pdf.addPage();
                }
                
                // Añadir la imagen al PDF
                try {
                  const imgData = canvas.toDataURL('image/jpeg', 0.95);
                  pdf.addImage(
                    imgData, 
                    'JPEG', 
                    0, 
                    0, 
                    pdf.internal.pageSize.getWidth(), 
                    pdf.internal.pageSize.getHeight()
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
              
              // CORREGIDO: Guardar el PDF una sola vez
              pdf.save(nombreArchivo);
              
              console.log('Generación de PDF completada, archivo guardado:', nombreArchivo);
              
              // Limpiar y ocultar contenedor
              setTimeout(() => {
                pdfContainer.innerHTML = '';
                pdfContainer.style.display = 'none';
                mostrarCargando(elements.previewContainer, false);
                appState.isProcessing = false;
                appState.pdfGenerating = false; // Desactivar el flag
              }, 500);
            } catch (err) {
              console.error("Error al guardar el PDF:", err);
              alert("Error al guardar el PDF: " + err.message);
              mostrarCargando(elements.previewContainer, false);
              appState.isProcessing = false;
              appState.pdfGenerating = false; // Desactivar el flag en caso de error
            }
          }
        } catch (e) {
          console.error("Error al generar PDF:", e);
          alert("Error al generar PDF: " + e.message);
          mostrarCargando(elements.previewContainer, false);
          appState.isProcessing = false;
          appState.pdfGenerating = false; // Desactivar el flag en caso de error
        }
      }
    } catch (error) {
      console.error("Error global en la inicialización:", error);
      
      // Mostrar error en la interfaz
      const previewContent = document.getElementById('preview-content');
      if (previewContent) {
        previewContent.innerHTML = `
          <div style="text-align:center;padding:2rem;color:#444;background-color:#f5f5f7;border-radius:0.5rem;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:90%;margin:1rem auto;">
            <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:#0071e3;margin-bottom:1rem;display:block;"></i>
            <h3 style="font-size:1.25rem;font-weight:600;margin-bottom:0.75rem;color:#1d1d1f;">Error al inicializar el sistema de etiquetas</h3>
            <p style="color:#444;margin-bottom:1rem;">${error.message}</p>
            <p style="color:#666;font-size:0.875rem;">Por favor, recarga la página o contacta con soporte si el problema persiste.</p>
            
            <button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1rem;background:#0071e3;color:white;border:none;border-radius:0.375rem;font-weight:500;cursor:pointer;">
              <i class="fas fa-sync-alt" style="margin-right:0.5rem;"></i> Recargar página
            </button>
          </div>
        `;
      }
    }
  }