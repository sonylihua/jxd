/* ============================================================
   静息岛 · Service Worker
   策略：stale-while-revalidate —— 有缓存先返回（秒开、可离线），
   后台静默拉最新版本更新缓存；没有缓存才走网络。
   云端 API（/.cloud/）永远直连网络，绝不缓存。
   改动任何静态文件后，请把 CACHE_VERSION 加一位。
   ============================================================ */
var CACHE_VERSION = 'v3';
var CACHE_NAME = 'jingxidao-' + CACHE_VERSION;

var PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/js/audio.js',
  './assets/js/data.js',
  './assets/js/games.js',
  './assets/js/cloud.js',
  './assets/js/app.js',
  './assets/js/vendor/workbuddy-cloud-sdk.global.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-180.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (c) { return c.addAll(PRECACHE); })
      .catch(function (err) { /* 单个资源失败不阻塞安装 */ })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_NAME) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  // 云端 API / 鉴权 / 流式接口：一律直连，不走缓存
  if (url.pathname.indexOf('/.cloud/') === 0) return;

  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        // 离线且无缓存：页面请求兜底到 index.html（SPA 式兜底）
        if (req.mode === 'navigate') return caches.match('./index.html');
        return undefined;
      });
      return hit || net;
    })
  );
});
