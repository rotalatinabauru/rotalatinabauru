/* Rota Latina — service worker
   Estratégia: REDE PRIMEIRO para o app, cache só como rede de segurança.
   Assim nunca fica preso numa versão antiga; o cache só entra em cena sem sinal. */
const CACHE = 'rota-latina-v1';
const APP = 'rota_latina_app.html';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.add(APP)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* nada de Firebase, Google APIs ou WhatsApp passa pelo cache */
  if (url.origin !== self.location.origin) {
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      e.respondWith(
        caches.match(req).then(hit => hit || fetch(req).then(res => {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
          return res;
        }).catch(() => hit))
      );
    }
    return;
  }

  /* mesma origem: rede primeiro, cache se estiver sem sinal */
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok && (req.destination === 'document' || url.pathname.endsWith('.html') || url.pathname.endsWith('.png') || url.pathname.endsWith('.json'))) {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then(hit => {
      if (hit) return hit;
      /* sem sinal e sem cópia: só o app tem tela de reserva, o resto falha normalmente */
      if (req.mode === 'navigate' && url.pathname.endsWith(APP)) return caches.match(APP);
      return Response.error();
    }))
  );
});
