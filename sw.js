// 繧ｪ繝輔Λ繧､繝ｳ縺ｧ髢九￠繧九ｈ縺・↓縺吶ｋ・・ttps 縺・localhost 縺ｧ驟阪▲縺滓凾縺縺醍匳骭ｲ縺輔ｌ繧具ｼ峨・// 逶ｴ縺励◆譎ゅ・ VERSION 繧剃ｸ翫￡繧九ょ商縺・沿縺ｮ繝輔ぃ繧､繝ｫ縺ｯ activate 縺ｧ豸医∴繧九・const VERSION = 'v0.15';
const FILES = [
  './', './index.html', './css/style.css',
  './js/util.js', './js/model.js', './js/db.js', './js/profile.js',
  './js/foods_data.js', './js/nutri.js', './js/ncm.js', './js/phrases.js', './js/life_spec.js', './js/life.js',
  './js/dishes_seed.js', './js/master.js', './js/view.js', './js/app.js',
  './modules/board.js', './modules/facility.js', './modules/residents.js',
  './modules/ncm.js', './modules/careplan.js', './modules/life.js', './modules/census.js', './modules/home.js',
  './modules/cards.js', './modules/weights.js', './modules/rounds.js',
  './modules/foods.js', './modules/dishes.js', './modules/menu.js',
  './modules/seed.js', './modules/forms.js', './modules/measures.js', './modules/supplements.js', './modules/links.js', './modules/settings.js', './modules/devtools.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      // 蜿悶ｌ縺溘ｂ縺ｮ縺ｯ谺｡蝗槭・縺溘ａ縺ｫ鄂ｮ縺・※縺翫￥
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
