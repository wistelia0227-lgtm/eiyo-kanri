// 保健所に出す報告書の様式の試験。C:/AI/_setup/node/node.exe tools/test_houkoku.js
// 県が配っている Excel の中身と食い違っていないかを見る（項目の数・並び・文言）。
'use strict';
global.window = global;
const HK = require('../js/houkoku_forms.js');
const FG = require('../js/foodgroup.js');
let n = 0, bad = 0;
function ok(name, cond, extra) { n++; if (!cond) { bad++; console.log('NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } else console.log('ok  ' + name); }

ok('様式が 2 つ入っている', HK.FORMS.length === 2, HK.FORMS.map((f) => f.id));

// ---- 福岡県 様式第5号 ----
const F = HK.form('fukuoka5');
ok('福岡の様式が引ける', !!F && F.pref === '福岡県');
ok('様式番号は 様式第5号（第6条関係）', F.formNo === '様式第5号（第6条関係）', F.formNo);
ok('表題は 特定給食施設栄養報告書', F.title === '特定給食施設栄養報告書');
ok('出す先は保健福祉（環境）事務所長', F.to.indexOf('保健福祉（環境）事務所長') >= 0, F.to);
ok('出す時期は 2 月・7 月ぶん', F.when.indexOf('2 月') >= 0 && F.when.indexOf('7 月') >= 0, F.when);
ok('添付は 食品構成表 と 食品使用量日計表', F.attach.join() === '食品構成表,食品使用量日計表', F.attach);
ok('表と裏の 2 枚', F.pages.length === 2 && F.pages.map((p) => p.id).join() === 'omote,ura');

const fb = HK.blocks(F);
ok('大きな項目が 14 個（⒈〜⒕）', fb.length === 14, fb.length);
ok('項目の並びが様式どおり',
  fb.map((b) => b.title).join('／') === '施設の種類／所在地／連絡先／運営方法／対象者別給食数／食事提供時間／食種別給食数／従事者数／栄養アセスメント／その他／栄養給与状況／管理栄養士・栄養士による月間栄養指導件数（加算・非加算に関係なく記入してください。）／喫食者に対する情報提供／非常災害時の備え',
  fb.map((b) => b.title));

const kind = HK.field(F, 'kind');
ok('施設の種類は 5 つ', kind.opts.length === 5, kind.opts);
ok('施設の種類の文言が様式どおり',
  kind.opts.join('　') === '病院　介護老人保健施設　介護医療院　老人福祉施設　社会福祉施設', kind.opts);

const nut = HK.field(F, 'nut');
ok('栄養素の欄は 16 行（＊ 2 行を含む）', nut.rows.length === 16, nut.rows.length);
ok('栄養素の並びが様式どおり',
  nut.rows.slice(0, 14).map((r) => r.label).join('／')
  === 'エネルギー／たんぱく質／脂質／カルシウム／鉄／ビタミンＡ／ビタミンＢ１／ビタミンＢ２／ビタミンＣ／食物繊維／塩分（食塩相当量）／たんぱく質エネルギー比／脂質エネルギー比／炭水化物エネルギー比',
  nut.rows.map((r) => r.label));
ok('ビタミンＡの単位は μgRE（八訂の μgRAE ではなく様式の表記）', nut.rows.find((r) => r.id === 'va').unit === '(μgRE)');
ok('列は 給与栄養基準量 と 実給与栄養量', nut.cols.map((c) => c.label).join() === '給与栄養基準量,実給与栄養量');

const food = HK.field(F, 'food');
ok('提供食品量の欄は 19 行', food.rows.length === 19, food.rows.length);
ok('食品群の並びが様式どおり',
  food.rows.map((r) => r.label).join('／')
  === '魚介類／肉類／乳類／卵類／緑黄色野菜類／淡色野菜類／海草類／いも類／果実類／米／パン類／めん類／大豆製品／豆類／みそ類／油脂類／砂糖類／菓子類／その他',
  food.rows.map((r) => r.label));

// ---- 食品群の対応表 ----
ok('対応表の行数は様式の行数と同じ', HK.FG_FUKUOKA.length === food.rows.length);
(function () {
  const known = FG.ids();
  const wrong = [];
  HK.FG_FUKUOKA.forEach((r) => r.ids.forEach((id) => { if (known.indexOf(id) < 0) wrong.push(r.label + ':' + id); }));
  ok('対応表が指す食品群は全部 js/foodgroup.js にある', wrong.length === 0, wrong);
  const used = {};
  const dup = [];
  HK.FG_FUKUOKA.forEach((r) => r.ids.forEach((id) => { if (used[id]) dup.push(id); used[id] = true; }));
  ok('同じ食品群を 2 つの欄に入れていない', dup.length === 0, dup);
  const missing = known.filter((id) => !used[id]);
  ok('アプリの食品群はどれかの欄に入る（取りこぼしなし）', missing.length === 0, missing);
  ok('自動で出せない欄には理由が書いてある',
    HK.FG_FUKUOKA.filter((r) => !r.ids.length).every((r) => !!r.note),
    HK.FG_FUKUOKA.filter((r) => !r.ids.length).map((r) => r.label));
})();

// ---- 熊本県 別記第6号様式 その1 ----
const K = HK.form('kumamoto6');
ok('熊本の様式が引ける', !!K && K.pref === '熊本県');
ok('様式番号は 別記第６号様式（第５条関係）その１', K.formNo === '別記第６号様式（第５条関係）その１', K.formNo);
ok('表題は 栄養管理状況報告書', K.title === '栄養管理状況報告書');
ok('出す先は熊本県知事', K.to.indexOf('熊本県知事') >= 0, K.to);
ok('管理者記入用と業務担当者記入用の 2 枚', K.pages.map((p) => p.label).join() === '【管理者記入用】,【業務担当者記入用】', K.pages.map((p) => p.label));

const kb = HK.blocks(K);
ok('プロセスは A〜F', kb.map((b) => b.no).join() === 'A,B,F,C,D,E,F', kb.map((b) => b.no));
ok('施設種類は 6 つ', HK.field(K, 'kind').opts.length === 6, HK.field(K, 'kind').opts);
ok('会議の回数の選択肢が様式どおり',
  HK.field(K, 'kaigiKai').opts.join('／') === '年１回／年２〜３回／年４〜６回／年７〜１１回／年１２回以上',
  HK.field(K, 'kaigiKai').opts);
ok('摂取状況の把握の方法は 6 つ', HK.field(K, 'sesshuHoho').opts.length === 6);
ok('残食調査（個別：主食、副食別）が 2 番目', HK.field(K, 'sesshuHoho').opts[1] === '残食調査（個別：主食、副食別）');
ok('給与栄養量の列は 14 個', HK.field(K, 'kyuyo').cols.length === 14, HK.field(K, 'kyuyo').cols.length);
ok('給与栄養量の行は 平均値・最小値・最大値', HK.field(K, 'kyuyo').rows.map((r) => r.label).join() === '平均値,最小値,最大値');
ok('年齢階級の列は 9 段＋合計', HK.field(K, 'age').cols.length === 10, HK.field(K, 'age').cols.length);
ok('BMI の境目が様式どおり',
  HK.field(K, 'bmi').rows.map((r) => r.label + ':' + r.a).join('／')
  === '3〜17歳:や　せ／18〜49歳:BMI18.5未満／50〜64歳:BMI20.0未満／65歳以上:BMI21.5未満',
  HK.field(K, 'bmi').rows.map((r) => r.a));

// ---- 共通のきまり ----
(function () {
  const bad2 = [];
  HK.FORMS.forEach((f) => {
    const ids = {};
    HK.fields(f).forEach((x) => {
      if (!x.id) bad2.push(f.id + ': id の無い欄');
      if (ids[x.id]) bad2.push(f.id + ': id が重なっている ' + x.id);
      ids[x.id] = true;
      if (['text', 'num', 'note', 'yesno', 'choice', 'multi', 'grid', 'list'].indexOf(x.k) < 0) bad2.push(f.id + ': 知らない種類 ' + x.k + '(' + x.id + ')');
      if ((x.k === 'choice' || x.k === 'multi') && !(x.opts || []).length) bad2.push(f.id + ': 選択肢が無い ' + x.id);
      if (x.k === 'grid' && (!(x.rows || []).length || !(x.cols || []).length)) bad2.push(f.id + ': 表の行か列が無い ' + x.id);
    });
  });
  ok('欄の作りにおかしな所が無い', bad2.length === 0, bad2);
  ok('保存の鍵は様式と期間で分かれる', HK.key('fukuoka5', '2026-07') === 'houkoku_fukuoka5_2026-07');
  ok('様式が違えば鍵も違う', HK.key('fukuoka5', '2026-07') !== HK.key('kumamoto6', '2026-07'));
})();

// ---- 書いた/書いていないの数え方 ----
ok('空は書いていない扱い', !HK.filled({ k: 'text' }, '') && !HK.filled({ k: 'text' }, null) && !HK.filled({ k: 'text' }, '   '));
ok('文字が入っていれば書いた扱い', HK.filled({ k: 'text' }, 'あ'));
ok('選択肢は 1 つ以上で書いた扱い', HK.filled({ k: 'multi' }, ['1']) && !HK.filled({ k: 'multi' }, []));
ok('表は中身が 1 つでもあれば書いた扱い',
  HK.filled({ k: 'grid' }, { a: { b: '12' } }) && !HK.filled({ k: 'grid' }, { a: { b: '' } }));
ok('表の欄の名前は中身に数えない', !HK.filled({ k: 'grid' }, { nyusho: { teiin: '', b: '' } }));
ok('行を足すだけの表も空なら空', !HK.filled({ k: 'list' }, [{}, {}]) && HK.filled({ k: 'list' }, [{ name: '常食' }]));
(function () {
  const p0 = HK.progress(F, {});
  ok('何も書いていなければ 0 件', p0.done === 0 && p0.all > 40, p0);
  const p1 = HK.progress(F, { tel: '0944-00-0000', kind: '2' });
  ok('書いた分だけ増える', p1.done === 2 && p1.all === p0.all, p1);
})();

// ---- 自動で入れられる欄 ----
(function () {
  const a = HK.autoFields(F).map((x) => x.id);
  ok('福岡は食数・食種・栄養量・食品量を自動で入れる',
    ['kyushoku', 'shokushu', 'nut', 'food'].every((x) => a.indexOf(x) >= 0), a);
  const b = HK.autoFields(K).map((x) => x.id);
  ok('熊本は年齢構成・BMI・給与栄養量を自動で入れる',
    ['age', 'bmi', 'kyuyo'].every((x) => b.indexOf(x) >= 0), b);
  const all = HK.FORMS.reduce((acc, f) => acc.concat(HK.autoFields(f).map((x) => f.id + '.' + x.id)), []);
  ok('自動で入れる欄が 20 個以上ある', all.length >= 20, all.length);
})();

console.log('\n' + (n - bad) + '/' + n + (bad ? '  ← NG ' + bad + ' 件' : ' 通過'));
process.exit(bad ? 1 : 0);
