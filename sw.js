// 네트워크 우선 + 캐시 보조
// - 온라인: 항상 GitHub 최신 파일을 받아 쓰고 캐시도 갱신 → 업데이트 즉시 반영
// - 오프라인(현장): 마지막으로 받은 파일을 캐시에서 사용
const CACHE_NAME = 'drilllog-v4';
const ASSETS = [
  './',
  './index.html',
  './drilllog.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 외부 요청은 관여 안 함

  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // 브라우저 HTTP 캐시를 건너뛰고 서버에 최신 여부 확인
      const res = await fetch(req.url, { cache: 'no-cache' });
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const page = await cache.match('./index.html');
        if (page) return page;
      }
      throw err;
    }
  })());
});
