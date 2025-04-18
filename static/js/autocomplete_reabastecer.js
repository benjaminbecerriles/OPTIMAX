// static/js/autocomplete_reabastecer.js
// -----------------------------------------------------------------------------
// Este script implementa una búsqueda sencilla y filtrado en vivo (client-side)
// sobre las tarjetas mostradas en reabastecer_listado.html. No requiere rutas
// extra en el backend. Cada vez que el usuario teclea algo, se ocultan o
// muestran las tarjetas según coincidan con el texto.
//
// Si más adelante deseas usar un endpoint en Flask para autocompletar, podrías
// adaptar este mismo archivo para hacer peticiones fetch a /api/autocomplete,
// recibiendo sugerencias en JSON y mostrándolas en un menú desplegable.
//
// -----------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return; // Si no existe el input, salimos.
  
    // Selecciona todos los contenedores de tarjetas (los .card) o sus padres (.col)
    // (Dependiendo de tu HTML, ajusta la clase que contenga toda la tarjeta).
    const productCols = document.querySelectorAll('.row .col');
  
    // Escucha el evento 'input' (cada vez que cambia el texto)
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
  
      // Recorre cada tarjeta y la oculta/muestra según si coincide con 'query'
      productCols.forEach(col => {
        const cardText = col.innerText.toLowerCase();
        if (cardText.includes(query)) {
          col.style.display = '';
        } else {
          col.style.display = 'none';
        }
      });
    });
  });
  