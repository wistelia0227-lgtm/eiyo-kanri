// オフラインで開けるようにする（https か localhost で配った時だけ登録される）。
// 直した時は VERSION を上げる。古い版のファイルは activate で消える。
const VERSION = 'v0.12';
const FILES = [
  './', './index.html', './css/style.css',
  './js/util.js', './js/model.js', './js/db.js', './js/profile.js',
  './js/foods_data.js', './js/nutri.js', './js/ncm.js', './js/phrases.js', './js/life_spec.js', './js/life.js',
  './js/dishes_seed.js', './js/master.js', './js/view.js', './js/app.js',
  './modules/board.js', './modules/facility.js', './modules/residents.js',
  './modules/ncm.js', './modules/careplan.js', './modules/life.js', './modules/census.js', './modules/home.js',
  './modules/cards.js', './modules/weights.js', './modules/rounds.js',
  './modules/foods.js', './modules/dishes.js', './modules/menu.js',
  './modules/seed.js', './modules/links.js', './modules/settings.js', './modules/devtools.js',
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
      // 取れたものは次回のために置いておく
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
