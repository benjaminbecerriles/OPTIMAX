/**
 * ubicacion-productos.js - Maneja las interacciones para la gestión de ubicaciones de productos
 */

document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos DOM
    const productRows = document.querySelectorAll('#productsTableBody tr[data-product-id]');
    const searchInput = document.getElementById('searchProducts');
    const categoryFilter = document.getElementById('categoryFilter');
    const locationFilter = document.getElementById('locationFilter');
    const searchButton = document.getElementById('searchButton');
    const searchProductsModal = document.getElementById('searchProductsModal');
    const selectedProductsList = document.getElementById('selectedProductsList');
    const selectedCount = document.getElementById('selectedCount');
    const saveUbicacionMasivaBtn = document.getElementById('saveUbicacionMasiva');
  
    // Conjunto para almacenar IDs de productos seleccionados manualmente
    const selectedProducts = new Set();
  
    // =========================================================================
    // FUNCIONES DE FILTRADO Y BÚSQUEDA
    // =========================================================================
  
    function filterProducts() {
      const searchText = searchInput.value.toLowerCase();
      const categoryValue = categoryFilter.value.toLowerCase();
      const locationValue = locationFilter.value.toLowerCase();
      
      let visibleCount = 0;
  
      productRows.forEach(row => {
        const productName = row.querySelector('.product-name').textContent.toLowerCase();
        const productCode = row.querySelector('.product-code').textContent.toLowerCase();
        const category = row.querySelector('.category-badge').textContent.toLowerCase();
        const location = row.querySelector('.location-display').textContent.toLowerCase();
  
        const matchesSearch = !searchText || 
                              productName.includes(searchText) || 
                              productCode.includes(searchText);
                              
        const matchesCategory = !categoryValue || category.includes(categoryValue);
        const matchesLocation = !locationValue || location.includes(locationValue);
  
        if (matchesSearch && matchesCategory && matchesLocation) {
          row.style.display = '';
          visibleCount++;
        } else {
          row.style.display = 'none';
        }
      });
  
      // Mostrar mensaje si no hay resultados
      const noResultsRow = document.getElementById('noResultsRow');
      if (visibleCount === 0) {
        if (!noResultsRow) {
          const tableBody = document.getElementById('productsTableBody');
          const newRow = document.createElement('tr');
          newRow.id = 'noResultsRow';
          newRow.innerHTML = `
            <td colspan="5" class="text-center py-4">
              <div class="empty-state">
                <i class="fas fa-search empty-icon"></i>
                <p>No se encontraron productos con los filtros seleccionados</p>
                <button class="btn-primary" id="clearFiltersBtn">Limpiar filtros</button>
              </div>
            </td>
          `;
          tableBody.appendChild(newRow);
          
          // Agregar evento al botón de limpiar filtros
          document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);
        }
      } else if (noResultsRow) {
        noResultsRow.remove();
      }
    }
  
    function clearFilters() {
      searchInput.value = '';
      categoryFilter.value = '';
      locationFilter.value = '';
      filterProducts();
    }
  
    // Conectar eventos de filtrado
    searchInput.addEventListener('input', filterProducts);
    categoryFilter.addEventListener('change', filterProducts);
    locationFilter.addEventListener('change', filterProducts);
    searchButton.addEventListener('click', filterProducts);
  
    // =========================================================================
    // EDICIÓN DE UBICACIÓN INDIVIDUAL
    // =========================================================================
  
    productRows.forEach(row => {
      setupRowEditing(row);
    });
  
    function setupRowEditing(row) {
      const productId = row.dataset.productId;
      const editBtn = row.querySelector('.btn-edit-location');
      const saveBtn = row.querySelector('.btn-save-location');
      const cancelBtn = row.querySelector('.btn-cancel-edit');
      const locationDisplay = row.querySelector('.location-display');
      const locationEdit = row.querySelector('.location-edit');
  
      // Guardar valor original para cancelar
      let originalValue = locationEdit.value;
  
      editBtn.addEventListener('click', () => {
        // Cerrar cualquier otra fila que esté en edición
        document.querySelectorAll('.location-edit').forEach(input => {
          if (input !== locationEdit && input.style.display === 'block') {
            const parentRow = input.closest('tr');
            const parentDisplay = parentRow.querySelector('.location-display');
            const parentEditBtn = parentRow.querySelector('.btn-edit-location');
            const parentSaveBtn = parentRow.querySelector('.btn-save-location');
            const parentCancelBtn = parentRow.querySelector('.btn-cancel-edit');
            
            input.style.display = 'none';
            parentDisplay.style.display = 'block';
            parentEditBtn.style.display = 'inline-flex';
            parentSaveBtn.style.display = 'none';
            parentCancelBtn.style.display = 'none';
          }
        });
  
        // Mostrar campo de edición en esta fila
        locationDisplay.style.display = 'none';
        locationEdit.style.display = 'block';
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-flex';
        cancelBtn.style.display = 'inline-flex';
        locationEdit.focus();
      });
  
      saveBtn.addEventListener('click', () => {
        const newLocation = locationEdit.value.trim();
        
        // Mostrar indicador de carga
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        saveBtn.disabled = true;
        
        // Enviar al servidor
        fetch(`/api/actualizar-ubicacion/${productId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ ubicacion: newLocation })
        })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Actualizar UI
            locationDisplay.textContent = newLocation || 'Sin asignar';
            originalValue = newLocation; // Actualizar valor original para futuros cancels
            
            // Actualizar el filtro de ubicaciones si es necesario
            updateLocationFilters(newLocation);
            
            // Mostrar notificación de éxito
            showNotification('Ubicación actualizada correctamente', 'success');
          } else {
            throw new Error(data.message || 'Error al guardar la ubicación');
          }
        })
        .catch(error => {
          showNotification('Error: ' + error.message, 'error');
        })
        .finally(() => {
          // Restaurar botón y vista
          saveBtn.innerHTML = '<i class="fas fa-save"></i>';
          saveBtn.disabled = false;
          
          locationDisplay.style.display = 'block';
          locationEdit.style.display = 'none';
          saveBtn.style.display = 'none';
          cancelBtn.style.display = 'none';
          editBtn.style.display = 'inline-flex';
        });
      });
  
      cancelBtn.addEventListener('click', () => {
        // Restaurar valor original
        locationEdit.value = originalValue;
        
        // Restaurar vista
        locationDisplay.style.display = 'block';
        locationEdit.style.display = 'none';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        editBtn.style.display = 'inline-flex';
      });
  
      // Manejar tecla Enter para guardar
      locationEdit.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveBtn.click();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelBtn.click();
        }
      });
    }
  
    // =========================================================================
    // ASIGNACIÓN MASIVA DE UBICACIONES
    // =========================================================================
  
    // Cambiar tipo de selección en el modal
    const selectionTypeRadios = document.querySelectorAll('input[name="selectionType"]');
    const categorySelection = document.getElementById('categorySelection');
    const manualSelection = document.getElementById('manualSelection');
  
    selectionTypeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'category') {
          categorySelection.style.display = 'block';
          manualSelection.style.display = 'none';
        } else {
          categorySelection.style.display = 'none';
          manualSelection.style.display = 'block';
        }
      });
    });
  
    // Buscar productos en el modal
    searchProductsModal.addEventListener('input', () => {
      const searchText = searchProductsModal.value.toLowerCase();
      
      // Actualizar lista de productos encontrados
      updateProductSearchResults(searchText);
    });
  
    function updateProductSearchResults(searchText) {
      // Aquí implementaríamos una búsqueda en tiempo real de productos
      // que coincidan con el texto de búsqueda
      
      // Este es solo un ejemplo. En una implementación real, 
      // se haría una petición AJAX al servidor para obtener resultados
      
      // Limpiar resultados anteriores
      selectedProductsList.innerHTML = '';
      
      // Si no hay texto de búsqueda, mostrar solo los seleccionados
      if (!searchText) {
        displaySelectedProducts();
        return;
      }
      
      // Buscar entre los productos visibles
      const matchingProducts = [];
      productRows.forEach(row => {
        const productId = row.dataset.productId;
        const productName = row.querySelector('.product-name').textContent.toLowerCase();
        const productCode = row.querySelector('.product-code').textContent.toLowerCase();
        
        if (productName.includes(searchText) || productCode.includes(searchText)) {
          matchingProducts.push({
            id: productId,
            name: row.querySelector('.product-name').textContent,
            selected: selectedProducts.has(productId)
          });
        }
      });
      
      // Mostrar resultados
      matchingProducts.forEach(product => {
        const li = document.createElement('li');
        li.innerHTML = `
          <label>
            <input type="checkbox" data-product-id="${product.id}" 
                   ${product.selected ? 'checked' : ''}>
            ${product.name}
          </label>
        `;
        
        // Manejar selección/deselección
        const checkbox = li.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) {
            selectedProducts.add(product.id);
          } else {
            selectedProducts.delete(product.id);
          }
          updateSelectedCount();
        });
        
        selectedProductsList.appendChild(li);
      });
      
      // Si no hay resultados
      if (matchingProducts.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No se encontraron productos';
        li.style.fontStyle = 'italic';
        li.style.color = '#666';
        selectedProductsList.appendChild(li);
      }
    }
  
    function displaySelectedProducts() {
      // Mostrar solo los productos seleccionados
      selectedProductsList.innerHTML = '';
      
      if (selectedProducts.size === 0) {
        const li = document.createElement('li');
        li.textContent = 'No hay productos seleccionados';
        li.style.fontStyle = 'italic';
        li.style.color = '#666';
        selectedProductsList.appendChild(li);
        return;
      }
      
      // Crear un elemento para cada producto seleccionado
      selectedProducts.forEach(productId => {
        const row = document.querySelector(`tr[data-product-id="${productId}"]`);
        if (row) {
          const productName = row.querySelector('.product-name').textContent;
          
          const li = document.createElement('li');
          li.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>${productName}</span>
              <button type="button" class="btn-remove-product" data-product-id="${productId}">
                <i class="fas fa-times"></i>
              </button>
            </div>
          `;
          
          // Agregar evento para quitar producto
          li.querySelector('.btn-remove-product').addEventListener('click', () => {
            selectedProducts.delete(productId);
            updateSelectedCount();
            displaySelectedProducts();
          });
          
          selectedProductsList.appendChild(li);
        }
      });
    }
  
    function updateSelectedCount() {
      selectedCount.textContent = selectedProducts.size;
    }
  
    // Guardar ubicación masiva
    saveUbicacionMasivaBtn.addEventListener('click', () => {
      const ubicacion = document.getElementById('ubicacionMasiva').value.trim();
      
      if (!ubicacion) {
        showNotification('Por favor ingresa una ubicación', 'error');
        return;
      }
      
      const selectionType = document.querySelector('input[name="selectionType"]:checked').value;
      let data = {
        ubicacion: ubicacion
      };
      
      if (selectionType === 'category') {
        const selectedCategory = document.getElementById('categoriaSelector').value;
        data.categoria = selectedCategory;
      } else {
        // Selección manual
        if (selectedProducts.size === 0) {
          showNotification('No hay productos seleccionados', 'error');
          return;
        }
        
        data.producto_ids = Array.from(selectedProducts);
      }
      
      // Mostrar indicador de carga
      saveUbicacionMasivaBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
      saveUbicacionMasivaBtn.disabled = true;
      
      // Enviar al servidor
      fetch('/api/actualizar-ubicacion-masiva', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(data)
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Cerrar modal
          const modal = bootstrap.Modal.getInstance(document.getElementById('ubicacionMasivaModal'));
          modal.hide();
          
          // Actualizar UI - Recargar página para ver cambios
          showNotification(`Se actualizaron ${data.count} productos`, 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          throw new Error(data.message || 'Error al guardar las ubicaciones');
        }
      })
      .catch(error => {
        showNotification('Error: ' + error.message, 'error');
      })
      .finally(() => {
        // Restaurar botón
        saveUbicacionMasivaBtn.innerHTML = 'Guardar';
        saveUbicacionMasivaBtn.disabled = false;
      });
    });
  
    // =========================================================================
    // FUNCIONES DE UTILIDAD
    // =========================================================================
  
    function updateLocationFilters(newLocation) {
      // Si la ubicación no existe en el filtro y no está vacía, agregarla
      if (newLocation && Array.from(locationFilter.options).every(opt => opt.value !== newLocation)) {
        const option = document.createElement('option');
        option.value = newLocation;
        option.textContent = newLocation;
        locationFilter.appendChild(option);
      }
    }
  
    function showNotification(message, type) {
      // Verificar si ya existe una notificación
      let notification = document.querySelector('.notification');
      
      if (!notification) {
        // Crear el elemento si no existe
        notification = document.createElement('div');
        notification.className = 'notification';
        document.body.appendChild(notification);
        
        // Agregar estilos si no existen
        if (!document.getElementById('notificationStyles')) {
          const style = document.createElement('style');
          style.id = 'notificationStyles';
          style.textContent = `
            .notification {
              position: fixed;
              top: 20px;
              right: 20px;
              padding: 12px 20px;
              border-radius: 5px;
              box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
              z-index: 9999;
              transition: transform 0.3s, opacity 0.3s;
              transform: translateY(-20px);
              opacity: 0;
            }
            .notification.show {
              transform: translateY(0);
              opacity: 1;
            }
            .notification.success {
              background-color: #d4edda;
              color: #155724;
              border-left: 4px solid #28a745;
            }
            .notification.error {
              background-color: #f8d7da;
              color: #721c24;
              border-left: 4px solid #dc3545;
            }
          `;
          document.head.appendChild(style);
        }
      }
      
      // Actualizar contenido y clase
      notification.textContent = message;
      notification.className = `notification ${type}`;
      
      // Mostrar con animación
      setTimeout(() => {
        notification.classList.add('show');
      }, 10);
      
      // Ocultar después de un tiempo
      setTimeout(() => {
        notification.classList.remove('show');
        
        // Eliminar después de la transición
        setTimeout(() => {
          notification.remove();
        }, 300);
      }, 3000);
    }
  });