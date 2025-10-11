// Service Worker pour SecretVault PWA
const CACHE_NAME = 'secretvault-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json'
];

// ========== INSTALL EVENT ==========
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache ouvert');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Erreur mise en cache:', err);
      });
    })
  );
  
  self.skipWaiting();
});

// ========== ACTIVATE EVENT ==========
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Suppression cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  self.clients.claim();
});

// ========== FETCH EVENT ==========
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  // Firebase & API = Network First
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic.com')) {
    event.respondWith(networkFirst(request));
  } 
  // Assets locaux = Cache First
  else {
    event.respondWith(cacheFirst(request));
  }
});

// ========== CACHE FIRST STRATEGY ==========
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    
    if (!networkResponse || networkResponse.status !== 200) {
      return networkResponse;
    }

    const responseToCache = networkResponse.clone();
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, responseToCache);

    return networkResponse;
  } catch (error) {
    console.log('Cache first error:', error);
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// ========== NETWORK FIRST STRATEGY ==========
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const responseToCache = networkResponse.clone();
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, responseToCache);
      return networkResponse;
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network error:', error);
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

// ========== MESSAGE HANDLER ==========
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});