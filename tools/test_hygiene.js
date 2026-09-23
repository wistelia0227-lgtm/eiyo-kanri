// 衛生管理の点検表の試験。C:/AI/_setup/node/node.exe tools/test_hygiene.js
// 文言は通知の別紙のままでなければ意味がないので、数と代表の 1 文を字面で確かめる。
'use strict';
global.window = global;
const F = require('../js/hygiene_forms.js');
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }

ok('点検表が 5 つ（検収は在庫の側にある）', F.CHECKS.length === 5, F.CHECKS.map((x) => x.id));
ok('記録簿が 3 つ', F.RECORDS.length === 3, F.RECORDS.map((x) => x.id));

// 様式1 調理施設の点検表: 毎日 5・1か月 10（原本は 9 番だが 5 に 2 行ある）・3か月 3
const f1 = F.form('shisetsu');
ok('調理施設: 毎日は 5 項目', f1.sections[0].items.length === 5, f1.sections[0].items.length);
ok('調理施設: 1 か月ごとは 10 行（9 番 ＋ 5 の続き 1 行）', f1.sections[1].items.length === 10, f1.sections[1].items.length);
ok('調理施設: 3 か月ごとは 3 項目', f1.sections[2].items.length === 3, f1.sections[2].items.length);
ok('調理施設: 1 番の文言が原本どおり',
  f1.sections[0].items[0].t === '施設へのねずみや昆虫の侵入を防止するための設備に不備はありませんか。', f1.sections[0].items[0].t);
ok('調理施設: 床面 1m の但し書きが残っている', /床面から１ｍ以内の部分及び手指の触れる場所/.test(f1.sections[0].items[1].t));
ok('調理施設: シンクの 2 行目が「続き」になっている', f1.sections[1].items[5].sub === true && /加熱調理用食材/.test(f1.sections[1].items[5].t));

// 様式2 従事者等
const f2 = F.form('jujisha');
ok('従事者: 点検項目は 12', f2.sections[0].items.length === 12, f2.sections[0].items.length);
ok('従事者: 人ごとの欄は 9', f2.people.length === 9, f2.people);
ok('従事者: 12 番に「立ち入った者」の欄がある', f2.sections[0].items[11].note === '立ち入った者');

// 様式3 原材料
const f3 = F.form('genzairyo');
ok('原材料: 毎日は 8 行（5 番 ＋ 続き 3 行）', f3.sections[0].items.length === 8, f3.sections[0].items.length);
ok('原材料: 月1回は 2 行', f3.sections[1].items.length === 2);
ok('検食は 50g・−20℃・2週間',
  /５０ｇ程度/.test(f3.sections[2].items[0].t) && /－２０℃以下/.test(f3.sections[2].items[0].t) && /２週間以上/.test(f3.sections[2].items[0].t),
  f3.sections[2].items[0].t);

// 様式5 器具と使用水
const f5 = F.form('kigu');
ok('器具: 6 項目', f5.sections[0].items.length === 6);
ok('井戸水・貯水槽: 4 行', f5.sections[1].items.length === 4);
ok('使用水の表の列が 7', F.WATER_COLS.length === 7, F.WATER_COLS.map((c) => c.id));

// 様式6 調理等
const f6 = F.form('chori');
ok('調理中: 8 行（7 番 ＋ 続き 1 行）', f6.sections[0].items.length === 8, f6.sections[0].items.length);
ok('調理後: 5 項目', f6.sections[1].items.length === 5);
ok('廃棄物: 4 項目', f6.sections[2].items.length === 4);
ok('中心温度の条件が原本どおり（75℃1分・二枚貝85〜90℃90秒）',
  /７５℃で１分間以上/.test(f6.sections[0].items[4].t) && /８５〜９０℃で９０秒間以上/.test(f6.sections[0].items[4].t), f6.sections[0].items[4].t);
ok('床面 60cm・食缶は 30cm の但し書きが残っている',
  /６０ｃｍ以上/.test(f6.sections[0].items[5].t) && /３０ｃｍ以上の台/.test(f6.sections[0].items[5].t));
ok('調理後 2 時間以内', /２時間以内に喫食/.test(f6.sections[1].items[4].t));
// 別紙の様式は「冷凍又は冷凍設備」と印字されている（本文は「冷蔵設備」）。原文のまま持ち、注記で違いを書く
ok('原本の字をそのまま持っている（冷凍又は冷凍設備）', f6.sections[0].items[1].t.indexOf('冷凍又は冷凍設備') === 0, f6.sections[0].items[1].t);
ok('本文との違いを注記してある', /冷蔵設備/.test(f6.sections[0].items[1].note || ''), f6.sections[0].items[1].note);

// 記録簿の列
const r1 = F.form('hokan');
ok('食品保管時: 表が 5 つ', r1.tables.length === 5, r1.tables.map((t) => t.id));
ok('加熱後冷却の表に 6 列', r1.tables[3].cols.length === 6, r1.tables[3].cols);
const r2 = F.form('kanetsu');
ok('加熱加工: 揚げ物・焼き物蒸し物・煮物・炒め物 の 4 つ', r2.tables.length === 4, r2.tables.map((t) => t.label));
ok('揚げ物は油温と中心温度 A/B/C を取る', /油温/.test(r2.tables[0].cols[1]) && r2.tables[0].cols.indexOf('B(℃)') > 0);
const r3 = F.form('haiso');
ok('配送先: 上の欄が 4 つ、表は 5 列', r3.head.length === 4 && r3.tables[0].cols.length === 5);

// 出来ぐあいの判定
const rec = { items: {} };
ok('何も付けていなければ 0/…', F.countDone(f1, rec).done === 0 && F.countDone(f1, rec).all === 18, F.countDone(f1, rec));
F.itemsOf(f1).forEach((it) => { rec.items[F.itemId(it.section, it.index)] = '○'; });
ok('全部付ければ done', F.done(f1, rec) && F.countDone(f1, rec).done === 18);
ok('× は改善が要る所として拾える', (function () {
  rec.items[F.itemId('daily', 0)] = '×';
  const b = F.bad(f1, rec);
  return b.length === 1 && /ねずみや昆虫の侵入/.test(b[0].t);
})(), F.bad(f1, rec));
ok('項目 ID は 区分＋番号', F.itemId('daily', 0) === 'daily_0');
ok('出典が書いてある', /大量調理施設衛生管理マニュアル/.test(F.SOURCE) && /生食発0616第1号/.test(F.SOURCE), F.SOURCE);
ok('○ と × の 2 つで付ける', F.MARKS.join('') === '○×', F.MARKS);

console.log('\n' + (n - bad) + '/' + n + (bad ? '  ← NG ' + bad + ' 件' : ' 通過'));
process.exit(bad ? 1 : 0);
