// Excel の書き出しの試験。C:/AI/_setup/node/node.exe tools/test_xlsx.js
// .xlsx は ZIP の中に XML が入っているだけなので、ZIP の構造と XML の中身をここで確かめる。
'use strict';
global.window = global;
const X = require('../js/xlsx.js');
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }

// CRC32 は正解が公開されている値で確かめる（"123456789" → 0xCBF43926）
ok('CRC32 が正しい', X.crc32(X.utf8('123456789')) === 0xCBF43926, X.crc32(X.utf8('123456789')).toString(16));
ok('空でも落ちない', X.crc32(new Uint8Array(0)) === 0);

// 列の名前
ok('列の名前が A から続く', [0, 25, 26, 51, 52, 701, 702].map(X.colName).join(' ') === 'A Z AA AZ BA ZZ AAA',
  [0, 25, 26, 51, 52, 701, 702].map(X.colName).join(' '));

// シート名の決まり（/ \ ? * [ ] : は使えない、31 字まで、空は不可）
ok('使えない字が置き換わる', X.sheetName('a/b\\c?d*e[f]g:h', 0) === 'a_b_c_d_e_f_g_h', X.sheetName('a/b\\c?d*e[f]g:h', 0));
ok('31 字までに切られる', X.sheetName('あ'.repeat(40), 0).length === 31, X.sheetName('あ'.repeat(40), 0).length);
ok('空ならシート番号が付く', X.sheetName('', 2) === 'シート3', X.sheetName('', 2));

// ZIP の骨格
const bytes = X.build([
  { name: '表1', rows: [['名前', '数', '小数'], ['ごはん', 160, 404.2], ['<&">\'', null, '']] },
  { name: '表2', rows: [['あ']] },
  { name: '表1', rows: [['同じ名前']] }
]);
const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
ok('ZIP のしるしで始まる（PK\\x03\\x04）', dv.getUint32(0, true) === 0x04034b50, dv.getUint32(0, true).toString(16));
// 末尾 22 バイトが End of central directory
const eocd = bytes.length - 22;
ok('ZIP のしるしで終わる（PK\\x05\\x06）', dv.getUint32(eocd, true) === 0x06054b50);
const count = dv.getUint16(eocd + 8, true);
ok('入っているのは 7 ファイル（骨 4 ＋ シート 3）', count === 7, count);
ok('中央ディレクトリの位置と大きさが辻褄が合う',
  dv.getUint32(eocd + 16, true) + dv.getUint32(eocd + 12, true) === eocd,
  [dv.getUint32(eocd + 16, true), dv.getUint32(eocd + 12, true), eocd]);

// 中身の XML（無圧縮なので、そのまま文字として探せる）
const text = Buffer.from(bytes).toString('utf8');
ok('ワークブックにシートが 3 つ', (text.match(/<sheet name=/g) || []).length === 3);
ok('同じ名前のシートに番号が付く', text.indexOf('name="表1(2)"') >= 0);
ok('数値は数値として入る（160）', text.indexOf('<c r="B2"><v>160</v></c>') >= 0);
ok('小数もそのまま（404.2）', text.indexOf('<c r="C2"><v>404.2</v></c>') >= 0);
ok('文字は inlineStr で入る', text.indexOf('<c r="A2" t="inlineStr"><is><t xml:space="preserve">ごはん</t></is></c>') >= 0);
ok('XML の記号が逃がされる', text.indexOf('&lt;&amp;&quot;&gt;&apos;') >= 0);
ok('空とnullのセルは書かれない', text.indexOf('<c r="B3"') < 0 && text.indexOf('<c r="C3"') < 0);
ok('シートが 1 枚も無くても作れる', X.build([]).length > 0);
ok('中身が空の表でも作れる', X.build([{ name: 'から', rows: [] }]).length > 0);

// 日本語のファイル名（ZIP の名前は ASCII のままにしてある）
ok('ZIP の中のファイル名は ASCII', /xl\/worksheets\/sheet1\.xml/.test(text));
ok('Excel の MIME が入っている', /spreadsheetml\.sheet$/.test(X.MIME), X.MIME);

console.log('\n' + (n - bad) + '/' + n + (bad ? '  ← NG ' + bad + ' 件' : ' 通過'));
process.exit(bad ? 1 : 0);
