// HFO1 希望シフト PWA Service Worker
// v2: HTMLは常にネットワーク優先(network-first)に変更。
//     ボタンURL等の更新が即反映されるようにする。
//     静的アセット(アイコン)は従来どおりキャッシュ優先。
const CACHE_NAME = 'hfo1-shift-v2';   // ← バージョンを上げると古いキャッシュが自動削除される
const urlsToCache = [
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

// インストール
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // 1つ失敗しても全体が止まらないよう個別に追加
      return Promise.all(
        urlsToCache.map(function(u) {
          return cache.add(u).catch(function() { /* 無い物は無視 */ });
        })
      );
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

// fetch
self.addEventListener('fetch', function(event) {
  var req = event.request;
  var url = req.url;

  // sw.js自身・GAS・googleusercontentは常にネットワーク（介入しない）
  if (url.indexOf('sw.js') !== -1 ||
      url.indexOf('script.google.com') !== -1 ||
      url.indexOf('googleusercontent.com') !== -1) {
    return;
  }

  // HTMLナビゲーション（ページ本体）は network-first
  // → 常に最新のHTML（最新のボタンURL）を取りに行く。失敗時のみキャッシュ。
  var isHTML = req.mode === 'navigate' ||
               (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (isHTML) {
    event.respondWith(
      fetch(req).then(function(res) {
        // 取得成功したら最新をキャッシュに保存（オフライン用）
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put('./', copy);
        });
        return res;
      }).catch(function() {
        // オフライン時はキャッシュにフォールバック
        return caches.match('./').then(function(c) {
          return c || caches.match(req);
        });
      })
    );
    return;
  }

  // それ以外（アイコン等の静的アセット）は cache-first
  event.respondWith(
    caches.match(req).then(function(cached) {
      return cached || fetch(req);
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
