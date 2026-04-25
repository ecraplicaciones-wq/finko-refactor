// ─────────────────────────────────────────────────────────────────────────────
// Finko Pro — Service Worker v4
// Estrategia: Cache-First con revalidación en background (stale-while-revalidate)
//
// CHANGELOG v4 (bugs corregidos):
// ① Faltaban ahorrado.js, exports.js e iconos del manifest en PRECACHE_ASSETS.
// ② style.css?v=2.1 nunca hacía match en el caché — URL normalizada en fetch.
// ③ skipWaiting() automático en install movido al handler de SKIP_WAITING.
// ④ Filtro Google Fonts era .includes('fonts.g') — ahora verifica dominios exactos.
// ⑤ Fallback offline era Response('', 408) vacío — ahora sirve index.html o 503.
// ⑥ Se agrega _notificarOffline() para mostrar banner visible al usuario.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ Actualizar CACHE_NAME con cada release que cambie assets críticos.
// v6: se corrigieron los paths de PRECACHE_ASSETS — antes listaba 11 módulos
// fantasma (dashboard/gastos/fijos/…) que no existen en la estructura real
// core/infra/ui/dominio → todo caía al catch de install y la app no funcionaba
// offline. Ver auditoría C1.
const CACHE_NAME = 'finko-pro-v6';

// ─── ASSETS QUE SE CACHEAN AL INSTALAR ───────────────────────────────────────
const PRECACHE_ASSETS = [
  // ─── Raíz ──────────────────────────────────────────────────────────────────
  './',
  './index.html',
  './style.css',      // El query param ?v=X se normaliza en el fetch handler (Fix ②)
  './manifest.json',

  // ─── Módulos JS (estructura real: core/infra/ui/dominio) ───────────────────
  // core/
  './modules/core/state.js',
  './modules/core/storage.js',
  './modules/core/constants.js',
  // infra/
  './modules/infra/utils.js',
  './modules/infra/a11y.js',
  './modules/infra/render.js',
  // ui/
  './modules/ui/shell.js',
  './modules/ui/events.js',
  // dominio/
  './modules/dominio/analisis.js',
  './modules/dominio/compromisos.js',
  './modules/dominio/exports.js',
  './modules/dominio/ingresos.js',
  './modules/dominio/metas.js',
  './modules/dominio/tesoreria.js',
  // lazy-loaded (pero lo precacheamos para offline completo)
  './modules/calculadoras.js',

  // ─── Iconos para instalación PWA ───────────────────────────────────────────
  // ✅ Fix ①: el manifest.json referencia estos archivos. Sin cachearlos, el
  // ícono del launcher y la pantalla de instalación quedan rotos sin conexión.
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

// ─── INSTALL: llenar el caché con los assets críticos ────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache =>
        // allSettled: si un asset falla, el SW instala igual.
        // Los assets fallidos se intentan en la primera visita online.
        Promise.allSettled(
          PRECACHE_ASSETS.map(url =>
            cache.add(url).catch(err =>
              console.warn(`[SW Finko] No se pudo cachear: ${url}`, err)
            )
          )
        )
      )
      .then(results => {
        const ok      = results.filter(r => r.status === 'fulfilled').length;
        const fallidas = results.filter(r => r.status === 'rejected').length;
        if (fallidas > 0) {
          console.warn(`[SW Finko] ${fallidas} asset(s) sin cachear. ${ok} cacheados correctamente.`);
        } else {
          console.log(`[SW Finko] Precache completo ✅ — ${ok} assets listos offline.`);
        }
        // ✅ Fix ③: NO skipWaiting() automático. El cliente lo pide via mensaje
        // solo cuando ya no quedan tabs con la versión anterior. Sin esto, un
        // usuario con la app abierta podría recibir JS nuevo + caché viejo → crash.
      })
  );
});

// ─── ACTIVATE: limpiar cachés de versiones anteriores ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log(`[SW Finko] Eliminando caché obsoleto: ${key}`);
              return caches.delete(key);
            })
        )
      )
      .then(() => {
        console.log('[SW Finko] Activado. Controlando todos los clientes.');
        return self.clients.claim();
      })
  );
});

// ─── FETCH: Cache-First + stale-while-revalidate ─────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // ✅ Fix ④: antes era url.hostname.includes('fonts.g') — un string que podría
  // coincidir con dominios no relacionados. Ahora son los dos hostnames exactos.
  const isGoogleFont =
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (url.origin !== location.origin && !isGoogleFont) return;

  // ✅ Fix ②: index.html solicita style.css?v=2.1 pero el SW lo guardó como
  // ./style.css (sin query). La clave de caché no coincidía — offline, el CSS
  // nunca se encontraba y la app se veía sin estilos.
  // Solución: para requests del mismo origen con query string, normalizamos la
  // clave de caché eliminando los parámetros. El versionado real lo hace
  // CACHE_NAME — no el query param de la hoja de estilos.
  const cacheKey = (url.origin === location.origin && url.search)
    ? new Request(url.origin + url.pathname)
    : event.request;

  event.respondWith(
    caches.match(cacheKey).then(cached => {

      // ── Stale-While-Revalidate ─────────────────────────────────────────────
      if (cached) {
        fetch(event.request)
          .then(response => {
            if (response?.ok && response.type !== 'opaque') {
              // Clonar ANTES de que cualquier consumidor lea el body.
              // El clone va al caché; el original se descarta (no se sirve).
              const toCache = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, toCache));
            }
          })
          .catch(() => { _notificarOffline(); });
        return cached;
      }

      // ── Sin caché: intentar la red ─────────────────────────────────────────
      return fetch(event.request)
        .then(response => {
          if (!response?.ok || response.type === 'opaque') return response;
          // ✅ FIX clone(): clonar en variable separada antes de cache.put().
          // Si se pasa response.clone() directamente a una Promise asíncrona
          // y luego se devuelve response, ambos comparten el body stream y el
          // browser puede lanzar "Response body is already used".
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, toCache));
          return response;
        })
        .catch(() => {
          _notificarOffline();

          // ✅ Fix ⑤: antes devolvía new Response('', { status: 408 }) — un
          // cuerpo vacío que el browser rechaza silenciosamente. Resultaba en
          // errores de módulo sin mensaje claro para depurar.
          // Ahora: navegaciones reciben index.html (la app carga completa),
          // assets reciben un 503 con mensaje descriptivo en lugar de silencio.
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          const esCss = url.pathname.endsWith('.css');
          return new Response(
            `/* [Finko Pro — Sin conexión]\n * ${url.pathname} no disponible sin internet.\n * Tus datos locales siguen intactos. */`,
            {
              status: 503,
              statusText: 'Sin conexión — datos locales activos',
              headers: { 'Content-Type': esCss ? 'text/css' : 'text/javascript' }
            }
          );
        });
    })
  );
});

// ─── MENSAJES DESDE LA APP ───────────────────────────────────────────────────
self.addEventListener('message', event => {
  // ✅ Fix ③: skipWaiting SOLO cuando el cliente lo pide explícitamente.
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW Finko] Nueva versión activada por solicitud del cliente.');
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => console.log('[SW Finko] Caché limpiado manualmente.'));
  }
});

// ─── HELPER: avisar a los clientes que no hay conexión ───────────────────────
// ✅ Fix ⑥: events.js escucha este mensaje y muestra un banner visible.
// Antes no había ningún aviso — el usuario creía que la app estaba caída.
function _notificarOffline() {
  self.clients
    .matchAll({ includeUncontrolled: true, type: 'window' })
    .then(clients => clients.forEach(c =>
      c.postMessage({ type: 'FINKO_OFFLINE' })
    ));
}