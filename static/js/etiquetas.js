/**
 * Etiquetas.js - Sistema de generación de etiquetas con códigos de barras
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Iniciando sistema de etiquetas...');
    
    // Verificar que JsBarcode esté disponible
    if (typeof JsBarcode === 'undefined') {
      console.error('Error: JsBarcode no está disponible');
      mostrarErrorDependencias('JsBarcode');
      return;
    }
    
    // Inicializar la aplicación
    initLabelApp();
  });
  
  /**
   * Muestra un mensaje de error si falta alguna dependencia
   */
  function mostrarErrorDependencias(libreria) {
    const errorDiv = document.getElementById('dependency-error');
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.innerHTML = `<strong>Error:</strong> No se pudo cargar la biblioteca ${libreria}. Por favor, recarga la página.`;
    }
  }
  
  /**
   * Inicializa la aplicación de etiquetas
   */
  function initLabelApp() {
    try {
      // Obtener datos del producto del DOM
      const productoElement = document.querySelector('[data-producto]');
      let producto = {
        id: 0,
        nombre: 'Producto',
        codigo: '',
        precio: 0,
        stock: 0
      };
      
      // Si el elemento existe, obtener los datos del atributo data-producto
      if (productoElement) {
        try {
          producto = JSON.parse(productoElement.dataset.producto);
        } catch (e) {
          console.error('Error al parsear datos del producto:', e);
        }
      } else {
        // Si no hay elemento con datos, intentar obtener de otros elementos
        const nombre = document.querySelector('.product-name')?.textContent || 'Producto';
        const codigo = document.querySelector('.meta-item:nth-child(1) span')?.textContent || '';
        const precio = parseFloat(document.querySelector('.meta-item:nth-child(2) span')?.textContent?.replace('$', '') || 0);
        const stock = parseInt(document.querySelector('.product-stock')?.textContent?.replace('Stock:', '') || 0);
        
        producto = { id: 0, nombre, codigo, precio, stock };
      }
      
      console.log('Datos del producto:', producto);
      
      // Verificar código de barras
      if (!producto.codigo || producto.codigo.trim() === '') {
        console.error('Error: El producto no tiene un código de barras válido');
        mostrarErrorDependencias('código de barras');
        return;
      }
      
      // Elementos DOM principales
      const checkboxStock = document.getElementById('usar_stock');
      const inputCantidad = document.getElementById('cantidad');
      const selectFormato = document.getElementById('formato_etiqueta');
      const printerOptions = document.querySelectorAll('.printer-option');
      const checkboxNombre = document.getElementById('mostrar_nombre');
      const checkboxPrecio = document.getElementById('mostrar_precio');
      const checkboxCodigo = document.getElementById('mostrar_codigo');
      const checkboxCodigoBarras = document.getElementById('mostrar_codigo_barras');
      const btnPreview = document.getElementById('btn-preview');
      const btnPrint = document.getElementById('btn-print');
      const btnPDF = document.getElementById('btn-pdf');
      const previewContainer = document.getElementById('preview-container');
      const previewContent = document.getElementById('preview-content');
      
      // Elementos DOM para opciones de códigos de barras
      const formatoCodigoSelect = document.getElementById('formato_codigo');
      const tamanoCodigoSelect = document.getElementById('tamano_codigo');
      
      // Configurar eventos básicos
      if (checkboxStock) {
        checkboxStock.addEventListener('change', function() {
          if (inputCantidad) {
            inputCantidad.disabled = this.checked;
            if (this.checked) {
              inputCantidad.value = producto.stock;
            }
          }
          setTimeout(generarVistaPrevia, 50);
        });
      }
      
      // Evento para seleccionar impresora
      if (printerOptions) {
        printerOptions.forEach(option => {
          option.addEventListener('click', function() {
            printerOptions.forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
            setTimeout(generarVistaPrevia, 50);
          });
        });
      }
      
      // Configurar eventos para cambios en opciones
      const elementosConEventos = [
        { elem: checkboxNombre, delay: 50 },
        { elem: checkboxPrecio, delay: 50 },
        { elem: checkboxCodigo, delay: 50 },
        { elem: checkboxCodigoBarras, delay: 50 },
        { elem: selectFormato, delay: 50 },
        { elem: inputCantidad, delay: 200 },
        { elem: formatoCodigoSelect, delay: 50 },
        { elem: tamanoCodigoSelect, delay: 50 }
      ];
      
      elementosConEventos.forEach(item => {
        if (item.elem) {
          item.elem.addEventListener('change', function() {
            // Mostrar/ocultar opciones de código de barras
            if (this === checkboxCodigoBarras) {
              const opcionesDiv = document.getElementById('codigo_barras_opciones');
              if (opcionesDiv) {
                opcionesDiv.style.display = this.checked ? 'block' : 'none';
              }
            }
            
            // Generar vista previa con un retraso para evitar múltiples actualizaciones
            setTimeout(generarVistaPrevia, item.delay);
          });
        }
      });
      
      // Eventos para botones
      if (btnPreview) btnPreview.addEventListener('click', function() {
        setTimeout(generarVistaPrevia, 50);
      });
      
      if (btnPrint) btnPrint.addEventListener('click', imprimirEtiquetas);
      if (btnPDF) btnPDF.addEventListener('click', descargarPDF);
      
      // Inicializar estado de opciones
      const opcionesDiv = document.getElementById('codigo_barras_opciones');
      if (opcionesDiv && checkboxCodigoBarras) {
        opcionesDiv.style.display = checkboxCodigoBarras.checked ? 'block' : 'none';
      }
      
      // Generar vista previa inicial después de un breve retraso
      setTimeout(function() {
        generarVistaPrevia();
      }, 300);
      
      /**
       * Obtiene el formato de etiqueta seleccionado
       */
      function obtenerFormatoSeleccionado() {
        if (!selectFormato) {
          return {
            id: 'avery5160',
            ancho: 63.5,
            alto: 26.9,
            columnas: 3,
            filas: 10,
            porPagina: 30
          };
        }
        
        const option = selectFormato.options[selectFormato.selectedIndex];
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
       * Obtiene la impresora seleccionada
       */
      function obtenerImpresoraSeleccionada() {
        const selected = document.querySelector('.printer-option.selected');
        return selected ? selected.dataset.printer : 'normal';
      }
      
      /**
       * Obtiene la cantidad de etiquetas a generar
       */
      function obtenerCantidad() {
        return checkboxStock && checkboxStock.checked ? producto.stock : (parseInt(inputCantidad?.value) || 1);
      }
      
      /**
       * Genera la vista previa de las etiquetas
       */
      function generarVistaPrevia() {
        if (!previewContent) {
          console.error('No se encontró el contenedor de vista previa');
          return;
        }
        
        try {
          console.log('Generando vista previa...');
          
          // Mostrar indicador de carga
          previewContent.innerHTML = `
            <div style="text-align: center; padding: 50px 0;">
              <i class="fas fa-sync fa-spin" style="font-size: 30px; color: #aaa;"></i>
              <p style="margin-top: 10px; color: #666;">Generando vista previa...</p>
            </div>
          `;
          
          // Obtener configuración
          const cantidad = obtenerCantidad();
          const formato = obtenerFormatoSeleccionado();
          const impresora = obtenerImpresoraSeleccionada();
          
          // Configuración según el tipo de impresora
          let configuracion = {};
          
          if (impresora === 'normal') {
            // Página A4 estándar para impresoras normales
            configuracion = {
              paginaAncho: 210, // mm
              paginaAlto: 297,  // mm
              marginX: 6.35,    // mm
              marginY: 12.7,    // mm
            };
          } else {
            // Para impresoras térmicas, ajustamos según el formato
            configuracion = {
              paginaAncho: formato.ancho + 5,
              paginaAlto: formato.alto + 5,
              marginX: 2.5,
              marginY: 2.5,
            };
          }
          
          // Preparamos el HTML para la vista previa
          let previewHTML = '';
          
          if (impresora === 'normal') {
            // Para impresoras normales, crear hojas con múltiples etiquetas
            const etiquetasPorPagina = formato.porPagina;
            const numPaginas = Math.ceil(cantidad / etiquetasPorPagina);
            
            // Limitar a 2 páginas en la vista previa
            for (let pagina = 0; pagina < Math.min(numPaginas, 2); pagina++) {
              previewHTML += `<div class="preview-sheet" style="width:${configuracion.paginaAncho}mm;height:${configuracion.paginaAlto}mm;position:relative;">`;
              
              // Añadir etiquetas a la hoja
              for (let i = 0; i < formato.filas; i++) {
                for (let j = 0; j < formato.columnas; j++) {
                  const index = pagina * etiquetasPorPagina + i * formato.columnas + j;
                  
                  if (index < cantidad) {
                    // Calcular posición de la etiqueta
                    const posX = configuracion.marginX + j * formato.ancho;
                    const posY = configuracion.marginY + i * formato.alto;
                    
                    // Crear etiqueta
                    previewHTML += crearEtiquetaHTML(posX, posY, formato.ancho, formato.alto);
                  }
                }
              }
              
              previewHTML += `</div>`;
              
              // Separador entre páginas
              if (pagina < Math.min(numPaginas, 2) - 1) {
                previewHTML += `<div style="margin-bottom:20px;"></div>`;
              }
            }
            
            // Si hay más páginas, mostrar mensaje
            if (numPaginas > 2) {
              previewHTML += `
                <p style="margin-top:15px;font-style:italic;color:#666;">
                  Hay ${numPaginas} páginas en total. Solo se muestran las primeras 2 en la vista previa.
                </p>
              `;
            }
          } else {
            // Para impresoras térmicas, mostrar solo algunas etiquetas como ejemplo
            const numEjemplos = Math.min(cantidad, 4);
            previewHTML += `<div style="display:flex;flex-wrap:wrap;gap:10px;">`;
            
            for (let i = 0; i < numEjemplos; i++) {
              previewHTML += crearEtiquetaHTML(0, 0, formato.ancho, formato.alto, true);
            }
            
            previewHTML += `</div>`;
            
            if (cantidad > numEjemplos) {
              previewHTML += `
                <p style="margin-top:15px;font-style:italic;color:#666;">
                  Se generarán ${cantidad} etiquetas en total.
                </p>
              `;
            }
          }
          
          // Actualizar contenido
          previewContent.innerHTML = previewHTML;
          
          // Generar códigos de barras después de un momento
          setTimeout(function() {
            generarCodigosBarras();
          }, 200);
        } catch (error) {
          console.error("Error en generarVistaPrevia:", error);
          previewContent.innerHTML = `
            <div style="text-align:center;padding:30px;color:#721c24;background-color:#f8d7da;border-radius:5px;">
              <i class="fas fa-exclamation-triangle" style="font-size:24px;margin-bottom:10px;"></i>
              <p>Error al generar la vista previa: ${error.message}</p>
            </div>
          `;
        }
      }
      
      /**
       * Crea HTML para una etiqueta individual
       */
      function crearEtiquetaHTML(x, y, ancho, alto, posicionRelativa = false) {
        let positionStyle = posicionRelativa ? 
          'position:relative;' : 
          `position:absolute;left:${x}mm;top:${y}mm;`;
        
        let html = `
          <div class="etiqueta" style="${positionStyle}width:${ancho}mm;height:${alto}mm;">
            <div class="etiqueta-content">
        `;
        
        if (!checkboxNombre || checkboxNombre.checked) {
          html += `<div class="etiqueta-nombre">${producto.nombre}</div>`;
        }
        
        if (!checkboxPrecio || checkboxPrecio.checked) {
          html += `<div class="etiqueta-precio">$${parseFloat(producto.precio).toFixed(2)}</div>`;
        }
        
        if (!checkboxCodigoBarras || checkboxCodigoBarras.checked) {
          html += `<svg class="etiqueta-barcode" data-codigo="${producto.codigo}"></svg>`;
        }
        
        if (!checkboxCodigo || checkboxCodigo.checked) {
          html += `<div class="etiqueta-codigo">${producto.codigo}</div>`;
        }
        
        html += `
            </div>
          </div>
        `;
        
        return html;
      }
      
      /**
       * Genera los códigos de barras en las etiquetas
       */
      function generarCodigosBarras() {
        if (checkboxCodigoBarras && !checkboxCodigoBarras.checked) {
          return;
        }
        
        if (!producto.codigo || producto.codigo.trim() === '') {
          console.error('Código de barras inválido');
          return;
        }
        
        try {
          console.log('Generando códigos de barras...');
          
          // Generar código de barras para cada etiqueta
          document.querySelectorAll('.etiqueta-barcode').forEach((svg, index) => {
            try {
              // Obtener el código
              const codigo = svg.dataset.codigo || producto.codigo;
              const codigoLimpio = codigo.trim();
              
              // Obtener formato
              let formato = 'CODE128';
              
              // Usar formato seleccionado o autodetectar
              if (formatoCodigoSelect && formatoCodigoSelect.value !== 'auto') {
                formato = formatoCodigoSelect.value;
              } else {
                // Autodetectar formato basado en el código
                // CODE128 es el más flexible y maneja cualquier longitud
                if (/^\d{13}$/.test(codigoLimpio)) {
                  formato = "EAN13";
                } else if (/^\d{8}$/.test(codigoLimpio)) {
                  formato = "EAN8";
                } else if (/^\d{12}$/.test(codigoLimpio)) {
                  formato = "UPC";
                } else if (/^[0-9]+$/.test(codigoLimpio)) {
                  // Para cadenas numéricas de cualquier otra longitud, usar CODE128C
                  formato = "CODE128C";
                } else {
                  // Para códigos alfanuméricos, usar CODE128
                  formato = "CODE128";
                }
              }
              
              // Configurar tamaño
              let anchoLinea = 2;
              let altoBarras = 40;
              let tamanoTexto = 10;
              
              if (tamanoCodigoSelect) {
                switch(tamanoCodigoSelect.value) {
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
              
            // Generar código de barras
              try {
                JsBarcode(svg, codigoLimpio, {
                  format: formato,
                  width: anchoLinea,
                  height: altoBarras,
                  displayValue: true,
                  fontSize: tamanoTexto,
                  margin: 2,
                  background: "#ffffff",
                  text: codigoLimpio,
                  textMargin: 2,
                  lineColor: "#000000",
                  valid: function(valid) {
                    if (!valid) {
                      console.warn("El código no es válido para el formato seleccionado, intentando con CODE128");
                      // Si falla, intentar con CODE128 que es el más flexible
                      JsBarcode(svg, codigoLimpio, {
                        format: "CODE128",
                        width: anchoLinea,
                        height: altoBarras,
                        displayValue: true,
                        fontSize: tamanoTexto,
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
                console.error("Error principal, intentando usar CODE128:", err);
                // Último intento con CODE128
                JsBarcode(svg, codigoLimpio, {
                  format: "CODE128",
                  width: anchoLinea,
                  height: altoBarras,
                  displayValue: true,
                  fontSize: tamanoTexto,
                  margin: 2
                });
              }
            } catch(e) {
              console.error(`Error en código de barras #${index}:`, e);
              
              // Mostrar mensaje de error
              if (svg.parentNode) {
                const errorMsg = document.createElement('div');
                errorMsg.textContent = "Error: Código inválido";
                errorMsg.style.color = "red";
                errorMsg.style.fontSize = "8px";
                svg.parentNode.replaceChild(errorMsg, svg);
              }
            }
          });
        } catch(e) {
          console.error("Error al generar códigos de barras:", e);
        }
      }
      
      /**
       * Imprime las etiquetas directamente
       */
      function imprimirEtiquetas() {
        try {
          // Crear ventana para impresión
          const printWindow = window.open('', '_blank');
          
          if (!printWindow) {
            alert('Por favor, permite las ventanas emergentes para imprimir.');
            return;
          }
          
          // Obtener configuración
          const formato = obtenerFormatoSeleccionado();
          const impresora = obtenerImpresoraSeleccionada();
          const cantidad = obtenerCantidad();
          
          // Crear HTML para impresión
          let printHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>Etiquetas - ${producto.nombre}</title>
              <meta charset="UTF-8">
              <style>
                @page {
                  size: ${impresora === 'normal' ? 'A4' : formato.ancho + 'mm ' + formato.alto + 'mm'};
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 0;
                  font-family: Arial, sans-serif;
                }
                .preview-sheet {
                  position: relative;
                  width: ${impresora === 'normal' ? '210mm' : formato.ancho + 'mm'};
                  height: ${impresora === 'normal' ? '297mm' : formato.alto + 'mm'};
                  page-break-after: always;
                }
                .etiqueta {
                  position: absolute;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  overflow: hidden;
                  background: white;
                  font-family: Arial, sans-serif;
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
                  font-weight: bold;
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
                  font-weight: bold;
                  font-size: 12px;
                  margin-bottom: 2px;
                }
                .etiqueta-codigo {
                  font-size: 8px;
                  margin-bottom: 2px;
                }
                .etiqueta-barcode {
                  max-width: 95%;
                  margin-bottom: 2px;
                }
              </style>
              <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
            </head>
            <body>
          `;
          
          // Configuración según tipo de impresora
          let configuracion = {};
          
          if (impresora === 'normal') {
            // Página A4 estándar
            configuracion = {
              paginaAncho: 210, // mm
              paginaAlto: 297,  // mm
              marginX: 6.35,    // mm
              marginY: 12.7,    // mm
            };
            
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
                    // Calcular posición
                    const posX = configuracion.marginX + j * formato.ancho;
                    const posY = configuracion.marginY + i * formato.alto;
                    
                    // Añadir etiqueta
                    printHtml += crearEtiquetaHTML(posX, posY, formato.ancho, formato.alto);
                  }
                }
              }
              
              printHtml += `</div>`;
            }
          } else {
            // Para impresoras térmicas
            for (let i = 0; i < cantidad; i++) {
              printHtml += `<div class="preview-sheet">`;
              printHtml += crearEtiquetaHTML(0, 0, formato.ancho, formato.alto);
              printHtml += `</div>`;
            }
          }
          
          // Script para generar códigos de barras y luego imprimir
          printHtml += `
              <script>
                // Generar códigos de barras al cargar
                window.onload = function() {
                  try {
                    // Verificar que JsBarcode esté disponible
                    if (typeof JsBarcode === 'undefined') {
                      alert('Error: No se pudo cargar la biblioteca de códigos de barras');
                      return;
                    }
                    
                    // Generar códigos de barras
                    document.querySelectorAll('.etiqueta-barcode').forEach(svg => {
                      try {
                        const codigo = svg.dataset.codigo;
                        if (codigo) {
                          JsBarcode(svg, codigo, {
                            format: "${formatoCodigoSelect?.value === 'auto' ? 'CODE128' : formatoCodigoSelect?.value || 'CODE128'}",
                            width: ${anchoLinea},
                            height: ${altoBarras},
                            displayValue: true,
                            fontSize: ${tamanoTexto},
                            margin: 2,
                            background: "#ffffff",
                            text: codigo,
                            textMargin: 2,
                            lineColor: "#000000"
                          });
                        }
                      } catch(e) {
                        console.error("Error generando código:", e);
                      }
                    });
                    
                    // Esperar a que se carguen los códigos de barras y luego imprimir
                    setTimeout(() => {
                      window.print();
                      setTimeout(() => window.close(), 500);
                    }, 1000);
                  } catch(e) {
                    alert("Error: " + e.message);
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
        } catch(e) {
          console.error("Error al imprimir etiquetas:", e);
          alert("Error al preparar la impresión: " + e.message);
        }
      }
      
      /**
       * Descarga las etiquetas como PDF
       */
      function descargarPDF() {
        alert("Función de generación de PDF en desarrollo. Por favor, usa la opción 'Imprimir directamente' por ahora.");
        
        // Aquí iría la implementación completa de generación de PDF
        // Este código ha sido simplificado temporalmente para solucionar el error actual
      }
    } catch (error) {
      console.error("Error global en la inicialización:", error);
      
      // Mostrar error en la interfaz
      const previewContent = document.getElementById('preview-content');
      if (previewContent) {
        previewContent.innerHTML = `
          <div style="text-align:center;padding:30px;color:#721c24;background-color:#f8d7da;border-radius:5px;">
            <i class="fas fa-exclamation-triangle" style="font-size:24px;margin-bottom:10px;"></i>
            <p>Error al inicializar la aplicación: ${error.message}</p>
            <p>Por favor, recarga la página o contacta con soporte.</p>
          </div>
        `;
      }
    }
  }