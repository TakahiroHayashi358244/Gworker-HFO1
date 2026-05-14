// HFO1 希望シフト PWA Service Worker
const CACHE_NAME = 'hfo1-shift-v1';
const urlsToCache = [
  './',
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

// インストール
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// アクティベート（古いキャッシュ削除）
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// fetch: GAS（script.google.com）は常にネットワーク、静的アセットはキャッシュ優先
self.addEventListener('fetch', function(event) {
  var url = event.request.url;
  // sw.js自身とGASは常にネットワーク取得
  if (url.indexOf('sw.js') !== -1 || url.indexOf('script.google.com') !== -1 || url.indexOf('googleusercontent.com') !== -1) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request);
    })
  );
});

// アップデートメッセージ
self.addEventListener('message', function(event) {
  if (event.data === 'CHECK_UPDATE') {
    var client = event.source;
    if (!client) return;
    fetch('./', { cache: 'no-store' })
      .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return caches.open(CACHE_NAME).then(function(cache) {
          return cache.put('./', res.clone());
        });
      })
      .then(function() { client.postMessage('UPDATED'); })
      .catch(function() { client.postMessage('ERROR'); });
  }
});
