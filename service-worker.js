
// service-worker.js
// Atualize esta versão sempre que fizer um deploy significativo para forçar limpeza de caches antigos
const CACHE_NAME = 'kronos-pro-cache-v' + new Date().getTime(); 

// Recursos essenciais
const APP_SHELL_URLS = [
  './', 
  './index.html', 
  './manifest.json', 
  './KRONOS_ARQ.svg'
];

self.addEventListener('install', (event) => {
  // Força o novo service worker a se tornar ativo imediatamente, ignorando a espera
  self.skipWaiting();
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('Cache aberto. Armazenando App Shell.');
      try {
        await cache.addAll(APP_SHELL_URLS);
      } catch (error) {
        console.error('Falha ao armazenar recursos:', error);
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  // Toma controle de todas as abas abertas imediatamente
  event.waitUntil(clients.claim());

  // Limpa caches antigos
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Ignora requisições não-GET e não-http (ex: extensões)
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // ESTRATÉGIA: Network First para TUDO (HTML, JS, CSS, Imagens)
  // Tenta pegar da rede. Se falhar (offline), pega do cache.
  // Isso garante que o usuário sempre veja a versão mais nova se tiver internet.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a resposta for válida, atualiza o cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Se falhar a rede, tenta pegar do cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se for uma requisição de navegação e não tiver no cache, retorna o index.html do cache
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return null;
        });
      })
  );
});
