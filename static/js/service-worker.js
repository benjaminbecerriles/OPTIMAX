// Service worker para cachear recursos y mejorar rendimiento
const CACHE_NAME = 'optimax-product-cache-v2';
const API_CACHE_NAME = 'optimax-api-cache-v2';

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

// Lista de patrones de API para cachear agresivamente
const API_CACHE_PATTERNS = [
  '/api/autocomplete',
  '/api/find_by_code'
];

// Tiempo de caché para APIs (5 minutos)
const API_CACHE_DURATION = 5 * 60 * 1000;

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
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
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

// Verificar si una URL corresponde a una API que queremos cachear agresivamente
function isApiCacheable(url) {
  const urlObj = new URL(url);
  return API_CACHE_PATTERNS.some(pattern => urlObj.pathname.includes(pattern));
}

// Optimizado: Buscar en caché con prioridad para APIs
async function findInCache(request) {
  // Verificar si es una API cacheable
  if (isApiCacheable(request.url)) {
    try {
      const apiCache = await caches.open(API_CACHE_NAME);
      const cachedResponse = await apiCache.match(request);
      
      if (cachedResponse) {
        // Verificar tiempo de caché
        const cachedTime = cachedResponse.headers.get('sw-cache-time');
        if (cachedTime && Date.now() - parseInt(cachedTime) < API_CACHE_DURATION) {
          console.log('[Service Worker] Sirviendo API desde caché:', request.url);
          return cachedResponse;
        }
      }
    } catch (error) {
      console.error('[Service Worker] Error al buscar en caché API:', error);
    }
  }
  
  // Buscar en cache principal
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
  } catch (error) {
    console.error('[Service Worker] Error al buscar en caché principal:', error);
  }
  
  return null;
}

// Estrategia de cacheo optimizada para APIs
self.addEventListener('fetch', event => {
  // Ignorar peticiones POST o que no sean HTTP/HTTPS
  if (event.request.method !== 'GET' || 
      !event.request.url.startsWith('http')) {
    return;
  }
  
  const url = new URL(event.request.url);
  
  // Estrategia especial para APIs de autocompletado - Cache primero, luego red
  if (isApiCacheable(event.request.url)) {
    event.respondWith(
      findInCache(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Actualizar en segundo plano si es API
            fetch(event.request)
              .then(networkResponse => {
                if (networkResponse.ok) {
                  const clonedResponse = networkResponse.clone();
                  // Agregar tiempo de caché a los headers
                  const headers = new Headers(clonedResponse.headers);
                  headers.append('sw-cache-time', Date.now().toString());
                  
                  // Crear una nueva respuesta con los headers modificados
                  return clonedResponse.blob().then(blob => {
                    const newResponse = new Response(blob, {
                      status: clonedResponse.status,
                      statusText: clonedResponse.statusText,
                      headers: headers
                    });
                    
                    // Guardar en caché de API
                    caches.open(API_CACHE_NAME).then(cache => {
                      cache.put(event.request, newResponse);
                    });
                  });
                }
              })
              .catch(error => {
                console.error('[Service Worker] Error al actualizar caché API:', error);
              });
              
            return cachedResponse;
          }
          
          // Si no está en caché, intentar red
          return fetch(event.request)
            .then(networkResponse => {
              if (!networkResponse || !networkResponse.ok) {
                throw new Error('Network error');
              }
              
              const clonedResponse = networkResponse.clone();
              
              // Agregar tiempo de caché a los headers
              const headers = new Headers(clonedResponse.headers);
              headers.append('sw-cache-time', Date.now().toString());
              
              // Crear una nueva respuesta con los headers modificados
              return clonedResponse.blob().then(blob => {
                const newResponse = new Response(blob, {
                  status: clonedResponse.status,
                  statusText: clonedResponse.statusText,
                  headers: headers
                });
                
                // Guardar en caché de API
                caches.open(API_CACHE_NAME).then(cache => {
                  cache.put(event.request, newResponse);
                });
                
                return networkResponse;
              });
            })
            .catch(error => {
              console.error('[Service Worker] Error con la red para API:', error);
              return new Response(JSON.stringify({
                results: [],
                error: 'Error de conexión'
              }), {
                headers: {'Content-Type': 'application/json'}
              });
            });
        })
    );
    return;
  }
  
  // Para otros recursos: Estrategia de Red con fallback a Cache
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
        return findInCache(event.request)
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

// Optimización para API Autocomplete: Precarga basada en patrones comunes
const commonPrefixes = ['7', '75', '750', '8', '80', '9', '90'];

// Precarga de patrones comunes para autocompletado cuando el navegador está inactivo
self.addEventListener('idle', event => {
  // Solo si hay conectividad
  if (navigator.onLine) {
    // Precargar búsquedas comunes
    Promise.all(
      commonPrefixes.map(prefix => 
        fetch(`/api/autocomplete?q=${prefix}&t=${Date.now()}`)
          .then(response => {
            if (response.ok) {
              const clonedResponse = response.clone();
              
              // Guardar en caché con tiempo de expiración
              const headers = new Headers(clonedResponse.headers);
              headers.append('sw-cache-time', Date.now().toString());
              
              return clonedResponse.blob().then(blob => {
                const newResponse = new Response(blob, {
                  status: clonedResponse.status,
                  statusText: clonedResponse.statusText,
                  headers: headers
                });
                
                return caches.open(API_CACHE_NAME).then(cache => {
                  return cache.put(`/api/autocomplete?q=${prefix}`, newResponse);
                });
              });
            }
          })
          .catch(error => {
            console.log(`[Service Worker] Error precargando ${prefix}:`, error);
          })
      )
    ).then(() => {
      console.log('[Service Worker] Precarga de prefijos comunes completada');
    });
  }
});

// Caché de respuestas de API (implementación mejorada)
const apiMemoryCache = new Map();

// Mensaje desde la página principal
self.addEventListener('message', event => {
  // Permitir a la página principal cachear respuestas de API
  if (event.data && event.data.type === 'CACHE_API_RESPONSE') {
    const { endpoint, data, expiry } = event.data;
    if (endpoint && data) {
      const expiryTime = expiry || Date.now() + (60 * 60 * 1000); // 1 hora por defecto
      
      // Guardar en memoria
      apiMemoryCache.set(endpoint, {
        data,
        expiry: expiryTime
      });
      
      // Guardar en cache storage
      const response = new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'sw-cache-time': Date.now().toString()
        }
      });
      
      caches.open(API_CACHE_NAME)
        .then(cache => cache.put(endpoint, response))
        .catch(error => console.error('[Service Worker] Error guardando en caché:', error));
      
      console.log('[Service Worker] Respuesta API cacheada:', endpoint);
    }
  }
  
  // Limpiar cache cuando se solicita
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    // Limpiar caché en memoria
    apiMemoryCache.clear();
    
    // Limpiar caché de almacenamiento
    Promise.all([
      caches.delete(CACHE_NAME),
      caches.delete(API_CACHE_NAME)
    ])
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
  
  // Prefetch de recursos - optimización para autocompletado
  if (event.data && event.data.type === 'PREFETCH_AUTOCOMPLETE') {
    const prefixes = event.data.prefixes || commonPrefixes;
    
    // Hacer prefetch en segundo plano
    Promise.all(
      prefixes.map(prefix => 
        fetch(`/api/autocomplete?q=${prefix}&t=${Date.now()}`)
          .then(response => {
            if (response.ok) {
              const clonedResponse = response.clone();
              
              // Guardar en caché con tiempo de expiración
              const headers = new Headers(clonedResponse.headers);
              headers.append('sw-cache-time', Date.now().toString());
              
              return clonedResponse.blob().then(blob => {
                const newResponse = new Response(blob, {
                  status: clonedResponse.status,
                  statusText: clonedResponse.statusText,
                  headers: headers
                });
                
                return caches.open(API_CACHE_NAME).then(cache => {
                  return cache.put(`/api/autocomplete?q=${prefix}`, newResponse);
                });
              });
            }
          })
          .catch(error => {
            console.log(`[Service Worker] Error prefetch ${prefix}:`, error);
          })
      )
    ).then(() => {
      console.log('[Service Worker] Prefetch solicitado completado');
      if (event.source) {
        event.source.postMessage({
          type: 'PREFETCH_COMPLETED',
          success: true
        });
      }
    });
  }
});