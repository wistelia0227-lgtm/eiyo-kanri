// オフラインで開けるようにする（https か localhost で配った時だけ登録される）。
// 直した時は VERSION を上げる。古い版のファイルは activate で消える。
//
// 取り方の方針:
//  - 画面と JavaScript・CSS は「まずネット、だめならキャッシュ」。直した版がすぐ届く
//  - 大きくて変わらないもの（成分表 1MB、初期データ、LIFE の項目定義、アイコン）は「まずキャッシュ」。速さ優先。
//    こちらは VERSION を上げた時に入れ替わる
const VERSION = 'v0.16';
const FILES = [
  './', './index.html', './css/style.css',
  './js/util.js', './js/model.js', './js/db.js', './js/profile.js',
  './js/foods_data.js', './js/nutri.js', './js/ncm.js', './js/life_spec.js', './js/life.js', './js/phrases.js',
  './js/dishes_seed.js', './js/master.js', './js/view.js', './js/app.js',
  './modules/board.js', './modules/facility.js', './modules/residents.js',
  './modules/ncm.js', './modules/careplan.js', './modules/life.js', './modules/census.js', './modules/home.js',
  './modules/cards.js', './modules/weights.js', './modules/rounds.js',
  './modules/foods.js', './modules/dishes.js', './modules/menu.js',
  './modules/seed.js', './modules/forms.js', './modules/measures.js', './modules/supplements.js',
  './modules/links.js', './modules/settings.js', './modules/devtools.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'
];
const CACHE_FIRST = /(foods_data[.]js|dishes_seed[.]js|life_spec[.]js|icons[/])/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  if (CACHE_FIRST.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    })));
    return;
  }
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
