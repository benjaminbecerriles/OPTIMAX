// Service worker para cachear recursos y mejorar rendimiento
const CACHE_NAME = 'optimax-product-cache-v1';

// Lista de recursos a cachear durante la instalación
const urlsToCache = [
  '/static/js/barcode-scanner.js',
  '/static/js/mi_scanner_quagga.js',
  '/static/js/quagga.min.js',
  '/static/img/1.png',
  '/static/img/2.png',
  '/static/img/3.png',
  '/static/img/4.png',
  '/static/img/optimaxlogo.png',
  '/static/img/default_product.jpg',
  '/static/img/default_snack.jpg',
  '/static/img/default_drink.jpg',
  '/static/img/default_fruit.jpg',
  '/static/css/choices.min.css',
  '/static/js/choices.min.js'
];

// Instalar service worker y cachear recursos iniciales
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando');
  
  // Esperar hasta que se completen todas las promesas
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cache abierto');
        // Añadir todos los URLs a la caché
        return cache.addAll(urlsToCache)
          .then(() => {
            console.log('[Service Worker] Recursos pre-cacheados');
          })
          .catch(error => {
            console.error('[Service Worker] Error en pre-cache:', error);
          });
      })
  );
  
  // Activar inmediatamente sin esperar a que otras pestañas cierren
  self.skipWaiting();
});

// Cuando el service worker se activa (después de instalarse)
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activando');
  
  // Limpiar cachés antiguos
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Controlar todas las páginas inmediatamente
  return self.clients.claim();
});

// Estrategia de cacheo para las peticiones: 'Network First, fallback to Cache'
self.addEventListener('fetch', event => {
  // Ignorar peticiones POST o que no sean HTTP/HTTPS
  if (event.request.method !== 'GET' || 
      !event.request.url.startsWith('http')) {
    return;
  }
  
  // Ignorar API endpoints excepto recursos estáticos
  if (event.request.url.includes('/api/') && 
      !event.request.url.includes('/static/')) {
    return;
  }

  // Estrategia: Intentar red primero, si falla usar cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Solo cachear respuestas válidas (status 200 OK)
        if (!response || response.status !== 200) {
          return response;
        }

        // Clonar la respuesta para poder guardarla en cache
        // mientras retornamos la original
        const responseToCache = response.clone();
        
        // Guardar en cache para uso futuro
        caches.open(CACHE_NAME)
          .then(cache => {
            // Solo cachear recursos locales o CDNs específicos
            if (event.request.url.includes('/static/') || 
                event.request.url.includes('cdn.jsdelivr.net')) {
              cache.put(event.request, responseToCache);
              console.log('[Service Worker] Recurso cacheado:', event.request.url);
            }
          })
          .catch(error => {
            console.error('[Service Worker] Error al cachear:', error);
          });

        return response;
      })
      .catch(error => {
        // Si la red falla, intentar servir desde cache
        console.log('[Service Worker] Fallback a cache para:', event.request.url);
        return caches.match(event.request)
          .then(cachedResponse => {
            // Retornar el recurso cacheado o undefined si no existe
            if (cachedResponse) {
              console.log('[Service Worker] Sirviendo desde cache:', event.request.url);
              return cachedResponse;
            }
            
            // Si no hay cache, mostrar error genérico para imágenes
            if (event.request.url.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
              return caches.match('/static/img/default_product.jpg');
            }
            
            console.log('[Service Worker] No hay respuesta en cache para:', event.request.url);
            return new Response('Recurso no disponible sin conexión', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Caché de respuestas de API (implementación opcional)
const apiCache = new Map();

// Mensaje desde la página principal
self.addEventListener('message', event => {
  // Permitir a la página principal cachear respuestas de API
  if (event.data && event.data.type === 'CACHE_API_RESPONSE') {
    const { endpoint, data, expiry } = event.data;
    if (endpoint && data) {
      apiCache.set(endpoint, {
        data,
        expiry: expiry || Date.now() + (60 * 60 * 1000) // 1 hora por defecto
      });
      console.log('[Service Worker] Respuesta API cacheada:', endpoint);
    }
  }
  
  // Limpiar cache cuando se solicita
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    apiCache.clear();
    
    caches.delete(CACHE_NAME)
      .then(() => {
        console.log('[Service Worker] Cache borrado exitosamente');
        // Notificar a la página que el cache fue borrado
        if (event.source) {
          event.source.postMessage({
            type: 'CACHE_CLEARED',
            success: true
          });
        }
      })
      .catch(error => {
        console.error('[Service Worker] Error al borrar cache:', error);
        if (event.source) {
          event.source.postMessage({
            type: 'CACHE_CLEARED',
            success: false,
            error: error.message
          });
        }
      });
  }
});