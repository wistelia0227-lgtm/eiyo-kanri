// index.html と sw.js の食い違いを見つける試験。C:/AI/_setup/node/node.exe tools/test_files.js
// なぜ要るか: モジュールを足したときに sw.js の一覧に入れ忘れると、オフラインでその画面だけ開けなくなる。
// 画面では気づけない（ネットがあれば動いてしまう）ので、ここで見る。
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

// index.html が読み込むもの
const assets = [].concat(
  (html.match(/src="([^"]+\.js)"/g) || []).map((s) => s.slice(5, -1)),
  (html.match(/href="([^"]+\.css)"/g) || []).map((s) => s.slice(6, -1))
);
ok('index.html が読み込むファイルを拾えた（30 以上）', assets.length >= 30, assets.length);

// sw.js の一覧
const files = (sw.match(/'\.\/[^']*'/g) || []).map((s) => s.slice(3, -1));
const missing = assets.filter((a) => files.indexOf(a) < 0);
ok('sw.js の一覧に、index.html の読み込むファイルが全部ある', missing.length === 0, missing);

const gone = files.filter((f) => f && f !== 'index.html' && !fs.existsSync(path.join(root, f)));
ok('sw.js の一覧に、無いファイルが書かれていない', gone.length === 0, gone);

const unused = files.filter((f) => /^(js|modules)\//.test(f) && assets.indexOf(f) < 0);
ok('sw.js の一覧に、index.html が読み込まないコードが無い', unused.length === 0, unused);

// 版が上がっているか（同じ版のまま直すと、古いキャッシュが残る）
ok('sw.js に版がある', /const VERSION = 'v[0-9.]+'/.test(sw), (sw.match(/const VERSION = '[^']*'/) || [])[0]);
// 画面とコードは HTTP キャッシュを飛ばして取る（新しい画面＋古い JavaScript を防ぐ）
ok("コードの取得に cache: 'no-store' が付いている", /cache: 'no-store'/.test(sw));
ok('大きいデータはキャッシュ優先のままである', /CACHE_FIRST/.test(sw) && /foods_data/.test(sw));

// 文字の壊れとBOM
function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    if (e.name === '.git' || e.name === '__pycache__') return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|css|html|md|webmanifest|txt)$/.test(e.name)) out.push(p);
  });
  return out;
}
const texts = walk(root, []);
const bom = texts.filter((p) => fs.readFileSync(p).slice(0, 3).equals(Buffer.from([0xEF, 0xBB, 0xBF])));
ok('BOM 付きのファイルが無い', bom.length === 0, bom.map((p) => path.relative(root, p)));
// UTF-8 の日本語を cp932 として読んでしまった時に出る字。この試験自身には見本として書いてあるので自分は見ない
const marks = new RegExp('[' + ['繧', '縺', '譁', '郢', '蜈', '蟄', '謌'].join('') + ']');
const mojibake = texts.filter((p) => p !== __filename && marks.test(fs.readFileSync(p, 'utf8')));
ok('文字化けしたファイルが無い', mojibake.length === 0, mojibake.map((p) => path.relative(root, p)));

console.log('\n' + (n - bad) + '/' + n + (bad ? '  ← NG ' + bad + ' 件' : ' 通過'));
process.exit(bad ? 1 : 0);
