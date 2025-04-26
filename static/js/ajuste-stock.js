/**
 * Funcionalidades para la página de ajuste de stock
 */
document.addEventListener('DOMContentLoaded', function() {
    // Filtrado de productos
    initializeFilters();
    
    // Gestión de pestañas
    initializeTabs();
    
    // Manejadores de eventos para botones de acciones rápidas
    initializeQuickActions();
  });
  
  /**
   * Inicializa el sistema de filtros para productos
   */
  function initializeFilters() {
    const searchInput = document.getElementById('searchInput');
    const categoriaFilter = document.getElementById('categoriaFilter');
    const stockFilter = document.getElementById('stockFilter');
    const orderFilter = document.getElementById('orderFilter');
    const favoritosCheck = document.getElementById('favoritosCheck');
    const productCards = document.querySelectorAll('.product-card');
    
    if (!searchInput || !productCards.length) return;
    
    // Función para aplicar todos los filtros
    function applyFilters() {
      const searchTerm = searchInput.value.toLowerCase();
      const categoriaSelected = categoriaFilter ? categoriaFilter.value.toLowerCase() : '';
      const stockSelected = stockFilter ? stockFilter.value : '';
      const favoritosOnly = favoritosCheck ? favoritosCheck.checked : false;
      
      let visibleCount = 0;
      
      productCards.forEach(card => {
        const categoria = card.getAttribute('data-categoria')?.toLowerCase() || '';
        const stock = parseInt(card.getAttribute('data-stock') || '0');
        const favorito = card.getAttribute('data-favorito') === 'True';
        const title = card.querySelector('.product-title')?.textContent.toLowerCase() || '';
        const code = card.querySelector('.product-info-item span')?.textContent.toLowerCase() || '';
        
        // Filtro de búsqueda
        const matchesSearch = !searchTerm || 
                             title.includes(searchTerm) || 
                             code.includes(searchTerm) || 
                             categoria.includes(searchTerm);
        
        // Filtro de categoría
        const matchesCategoria = !categoriaSelected || categoriaSelected === '' || categoria === categoriaSelected;
        
        // Filtro de stock
        let matchesStock = true;
        if (stockSelected === 'low') {
          matchesStock = stock <= 5;
        } else if (stockSelected === 'medium') {
          matchesStock = stock > 5 && stock <= 20;
        } else if (stockSelected === 'high') {
          matchesStock = stock > 20;
        }
        
        // Filtro de favoritos
        const matchesFavoritos = !favoritosOnly || favorito;
        
        // Aplicar visibilidad
        if (matchesSearch && matchesCategoria && matchesStock && matchesFavoritos) {
          card.style.display = '';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });
      
      // Mostrar mensaje si no hay resultados
      const noResultsMessage = document.getElementById('noResultsMessage');
      if (noResultsMessage) {
        if (visibleCount === 0) {
          noResultsMessage.style.display = 'block';
        } else {
          noResultsMessage.style.display = 'none';
        }
      }
      
      // Actualizar contador de resultados
      const resultsCounter = document.getElementById('resultsCounter');
      if (resultsCounter) {
        resultsCounter.textContent = `${visibleCount} productos encontrados`;
      }
    }
    
    // Asignar eventos a los filtros
    if (searchInput) {
      searchInput.addEventListener('input', applyFilters);
      // Limpiar búsqueda al hacer clic en X
      const clearSearchBtn = document.getElementById('clearSearch');
      if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
          searchInput.value = '';
          applyFilters();
        });
      }
    }
    
    if (categoriaFilter) {
      categoriaFilter.addEventListener('change', applyFilters);
    }
    
    if (stockFilter) {
      stockFilter.addEventListener('change', applyFilters);
    }
    
    if (favoritosCheck) {
      favoritosCheck.addEventListener('change', applyFilters);
    }
    
    // Ordenamiento
    if (orderFilter) {
      orderFilter.addEventListener('change', function() {
        const value = this.value;
        const productGrid = document.querySelector('.products-grid');
        if (!productGrid) return;
        
        const productArray = Array.from(productCards);
        
        productArray.sort((a, b) => {
          if (value === 'alfabetico') {
            const titleA = a.querySelector('.product-title')?.textContent || '';
            const titleB = b.querySelector('.product-title')?.textContent || '';
            return titleA.localeCompare(titleB);
          } else if (value === 'stock-asc') {
            const stockA = parseInt(a.getAttribute('data-stock') || '0');
            const stockB = parseInt(b.getAttribute('data-stock') || '0');
            return stockA - stockB;
          } else if (value === 'stock-desc') {
            const stockA = parseInt(a.getAttribute('data-stock') || '0');
            const stockB = parseInt(b.getAttribute('data-stock') || '0');
            return stockB - stockA;
          } else if (value === 'precio-asc') {
            const precioA = parseFloat(a.getAttribute('data-precio') || '0');
            const precioB = parseFloat(b.getAttribute('data-precio') || '0');
            return precioA - precioB;
          } else if (value === 'precio-desc') {
            const precioA = parseFloat(a.getAttribute('data-precio') || '0');
            const precioB = parseFloat(b.getAttribute('data-precio') || '0');
            return precioB - precioA;
          }
          // Por defecto, recientes
          return 0;
        });
        
        // Reordenar elementos
        productArray.forEach(card => {
          productGrid.appendChild(card);
        });
        
        // Aplicar filtros después de ordenar
        applyFilters();
      });
    }
    
    // Aplicar filtros iniciales
    applyFilters();
    
    // Botón para resetear filtros
    const resetFiltersBtn = document.getElementById('resetFilters');
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', function() {
        if (searchInput) searchInput.value = '';
        if (categoriaFilter) categoriaFilter.value = '';
        if (stockFilter) stockFilter.value = '';
        if (orderFilter) orderFilter.value = 'recientes';
        if (favoritosCheck) favoritosCheck.checked = false;
        applyFilters();
      });
    }
  }
  
  /**
   * Inicializa las pestañas de entrada/salida
   */
  function initializeTabs() {
    const entradaTab = document.getElementById('entrada-tab');
    const salidaTab = document.getElementById('salida-tab');
    const entradaContent = document.getElementById('entrada');
    const salidaContent = document.getElementById('salida');
    
    if (!entradaTab || !salidaTab || !entradaContent || !salidaContent) return;
    
    entradaTab.addEventListener('click', function() {
      entradaTab.classList.add('active');
      salidaTab.classList.remove('active');
      entradaContent.classList.add('active', 'show');
      salidaContent.classList.remove('active', 'show');
      
      // Actualizar URL con parámetro de pestaña
      const url = new URL(window.location);
      url.searchParams.set('tab', 'entrada');
      window.history.replaceState(null, '', url);
    });
    
    salidaTab.addEventListener('click', function() {
      salidaTab.classList.add('active');
      entradaTab.classList.remove('active');
      salidaContent.classList.add('active', 'show');
      entradaContent.classList.remove('active', 'show');
      
      // Actualizar URL con parámetro de pestaña
      const url = new URL(window.location);
      url.searchParams.set('tab', 'salida');
      window.history.replaceState(null, '', url);
    });
    
    // Inicializar pestaña según parámetro URL
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    
    if (tabParam === 'salida') {
      salidaTab.click();
    } else {
      entradaTab.click();
    }
  }
  
  /**
   * Inicializa acciones rápidas para productos
   */
  function initializeQuickActions() {
    // Botón de escaneo
    const scanButton = document.getElementById('scanButton');
    if (scanButton) {
      scanButton.addEventListener('click', function() {
        // La funcionalidad de escaneo se maneja en barcode-scanner.js
        // Este click solo activa el modo escaneo visualmente
        scanButton.classList.add('scan-active');
        setTimeout(() => {
          scanButton.classList.remove('scan-active');
        }, 500);
      });
    }
    
    // Mostrar modal de historial
    const btnHistorial = document.getElementById('btnHistorial');
    if (btnHistorial) {
      btnHistorial.addEventListener('click', function(e) {
        e.preventDefault();
        // Aquí se implementaría la lógica para mostrar el modal de historial
        alert('Funcionalidad de historial en desarrollo.');
      });
    }
    
    // Animación de aparición para tarjetas de productos
    const productCards = document.querySelectorAll('.product-card');
    productCards.forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, 50 * index);
    });
  }
  
  /**
   * Función auxiliar para formatear moneda
   * @param {number} amount - Cantidad a formatear
   * @returns {string} - Cantidad formateada como moneda
   */
  function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  }
  
  /**
   * Función auxiliar para formatear fecha
   * @param {Date} date - Fecha a formatear
   * @returns {string} - Fecha formateada
   */
  function formatDate(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }