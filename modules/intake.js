// 入所時の聞き取り（削除可能）。入る前・入った直後に聞くことを 1 枚にまとめ、そのまま食事情報に写す。
// 項目は実物 2 つの合わせ（調査 03 の 4.2）:
//   (a) 老健ケアパーク湘南台「日常生活動作表」（家族等が記入）
//   (b) 東京都西多摩保健所「栄養情報提供書（施設間移動用）」（管理栄養士同士の引き継ぎ）
// この 2 つは同じことを違う言葉で聞いている（とろみが「ポタージュ状」と「薄い」など）。
// 呼び方は施設のマスタを使い、書いてあった言葉はそのまま残す欄も置く。
// 空欄のまま印刷すれば、家族に渡す紙になる。
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, V = window.View, App = window.App;
  const ms = () => window.Master.current;
  const I = {};

  // 欄の定義。master を書くと、その施設のマスタから選ぶ欄になる
  I.GROUPS = [
    { id: 'src', label: '聞き取りのもと', fields: [
      { id: 'date', label: '聞き取った日', kind: 'date' },
      { id: 'by', label: '聞き取った人', kind: 'text' },
      { id: 'from', label: 'もと', kind: 'radio', options: ['家族が記入した用紙', '前の施設の栄養情報提供書', '病院の退院時サマリ', '本人・家族から直接', 'その他'] },
      { id: 'writer', label: '記入者と続柄', kind: 'text', hint: '例: 長女' }
    ] },
    { id: 'diet', label: '食事の内容', fields: [
      { id: 'shokushu', label: '食種', kind: 'master', master: 'shokushu' },
      { id: 'kcal', label: 'エネルギー (kcal)', kind: 'number' },
      { id: 'prot', label: 'たんぱく質 (g)', kind: 'number' },
      { id: 'nacl', label: '食塩相当量 (g)', kind: 'number' },
      { id: 'staple', label: '主食', kind: 'master', master: 'staple' },
      { id: 'stapleG', label: '主食の量 (g)', kind: 'number' },
      { id: 'side', label: '副食', kind: 'master', master: 'side' },
      { id: 'sideWord', label: '前の施設での呼び方（そのまま）', kind: 'text', hint: '例: きざみ 1cm角、ソフト食、ペースト状' },
      { id: 'ankake', label: 'あんかけ', kind: 'radio', options: ['要', '不要'] }
    ] },
    { id: 'thick', label: '水分ととろみ', fields: [
      { id: 'drinkThick', label: 'とろみ', kind: 'master', master: 'thick' },
      { id: 'thickWord', label: '前の施設での呼び方（そのまま）', kind: 'text', hint: '例: ポタージュ状、コンデンスミルク状、ヨーグルト状' },
      { id: 'thickener', label: 'とろみ剤の商品名', kind: 'text' },
      { id: 'drinks', label: '出していた飲み物', kind: 'checks', options: ['水', 'お茶', '牛乳', 'ジュース', '乳酸菌飲料', '水分ゼリー', 'とろみ水'] },
      { id: 'waterMl', label: '食事以外の水分量 (mL/日)', kind: 'number' }
    ] },
    { id: 'how', label: '食べ方', fields: [
      { id: 'assist', label: '摂取方法', kind: 'master', master: 'assist' },
      { id: 'minutes', label: 'かかる時間（分）', kind: 'number' },
      { id: 'tools', label: '使っている食具', kind: 'chips', master: 'tools' },
      { id: 'hand', label: '使う手', kind: 'radio', options: ['右', '左', '不明'] },
      { id: 'posture', label: '食事の姿勢', kind: 'radio', options: ['椅子', '車椅子', 'リクライニング車椅子', 'ベッド上 30度', 'ベッド上 45度', 'ベッド上 60度', 'ベッド上 90度'] },
      { id: 'neck', label: '頸部', kind: 'radio', options: ['前屈', '後屈', 'ふつう'] },
      { id: 'open', label: '開口', kind: 'radio', options: ['良い', '悪い'] },
      { id: 'apron', label: 'エプロン', kind: 'radio', options: ['要', '不要'] }
    ] },
    { id: 'amount', label: '食べている量', fields: [
      { id: 'stapleP', label: '主食（割）', kind: 'number' },
      { id: 'sideP', label: '副食（割）', kind: 'number' },
      { id: 'appetite', label: '食欲', kind: 'radio', options: ['ある', 'ない', 'ムラがある'] },
      { id: 'habit', label: '食べ方のくせ', kind: 'checks', options: ['もともと小食', '早食い', '途中で手が止まる', '盗食・異食', '夜間の空腹の訴え'] }
    ] },
    { id: 'swallow', label: '飲み込み・口の中', fields: [
      { id: 'sw', label: '飲み込み', kind: 'radio', options: ['問題なし', 'むせ込みあり', '見守りが要る', '吸引が要る'] },
      { id: 'swFreq', label: '吸引の頻度', kind: 'text' },
      { id: 'swWay', label: '注意していたこと', kind: 'checks', options: ['複数回嚥下', '交互嚥下', '一口量を少なく', '声かけ', '食後の座位保持'] },
      { id: 'denture', label: '義歯', kind: 'text', hint: '例: 上 総義歯・下 部分義歯・自歯あり' },
      { id: 'problems', label: '食事に関する問題点', kind: 'checks',
        options: ['食物認識障害', '嚥下障害', '咀嚼困難', '義歯不咬合', '麻痺（右）', '麻痺（左）', '食べこぼし', '口内残留', '開口困難', '食欲低下', '異食'] }
    ] },
    { id: 'ng', label: '食べられないもの', fields: [
      { id: 'allergy', label: '食物アレルギー', kind: 'chips', master: 'allergens' },
      { id: 'kinshi', label: '禁食（宗教・嗜好・医師の指示）', kind: 'chips' },
      { id: 'drugNg', label: '服薬による禁忌', kind: 'text', hint: '例: ワルファリン服用のため納豆・青汁・クロレラ' },
      { id: 'dislike', label: '嫌いな食べ物', kind: 'chips' },
      { id: 'like', label: '好きな食べ物', kind: 'chips' }
    ] },
    { id: 'supp', label: '補食・経管', fields: [
      { id: 'suppName', label: '栄養補助食品（品名・時間）', kind: 'text' },
      { id: 'oyatsu', label: 'おやつ', kind: 'radio', options: ['あり', 'なし'] },
      { id: 'tube', label: '経管栄養（品名・容量 × 回・kcal・水分）', kind: 'text' },
      { id: 'tubeWay', label: '経路', kind: 'radio', options: ['経鼻', '胃ろう', '腸ろう'] },
      { id: 'drugWay', label: '薬の飲み方', kind: 'radio', options: ['水で', 'とろみをつけて', 'ゼリーに埋めて', '粉砕して'] }
    ] },
    { id: 'wish', label: '本人・家族の希望', fields: [
      { id: 'wish', label: '希望', kind: 'textarea' },
      { id: 'note', label: '特記事項', kind: 'textarea' }
    ] }
  ];
  I.allFields = () => I.GROUPS.reduce((a, g) => a.concat(g.fields), []);

  I.get = (r) => (r && r.intake) || {};
  I.filled = (r) => { const v = I.get(r); return Object.keys(v).some((k) => v[k] !== '' && v[k] != null && !(Array.isArray(v[k]) && !v[k].length)); };

  // 聞き取りのうち、食事情報に写せるものを写す
  I.toDiet = function (v, diet) {
    const d = Object.assign({}, diet || M.emptyDiet());
    if (v.shokushu) d.shokushu = v.shokushu;
    if (v.staple) d.staple = v.staple;
    if (v.stapleG) d.stapleG = Number(v.stapleG) || null;
    if (v.side) d.side = v.side;
    if (v.drinkThick) d.drinkThick = v.drinkThick;
    if (v.assist) d.assist = v.assist;
    if (v.tools && v.tools.length) d.tools = v.tools.slice();
    if (v.allergy && v.allergy.length) d.allergy = v.allergy.slice();
    if (v.kinshi && v.kinshi.length) d.kinshi = v.kinshi.map((k) => (typeof k === 'string' ? { food: k, sub: '' } : k));
    if (v.suppName) d.supplements = [{ name: v.suppName, when: '' }];
    const notes = [v.sideWord ? '前の施設: ' + v.sideWord : '', v.thickWord ? 'とろみの呼び方: ' + v.thickWord : '',
      v.swWay && v.swWay.length ? v.swWay.join('・') : '', v.drugNg ? '服薬の禁忌: ' + v.drugNg : ''].filter(Boolean).join('　');
    if (notes) d.notes = [d.notes, notes].filter(Boolean).join('　');
    return d;
  };

  // ---- 画面 ----
  App.registerScreen('intake', async function (params, root) {
    const id = params[0];
    if (!id) { root.appendChild(h('div', { class: 'empty' }, V.t('person') + 'の一覧からえらんでください。')); return; }
    const raw = await DB.get('residents', id);
    if (!raw) { root.appendChild(h('div', { class: 'empty' }, '見つかりません。')); return; }
    const r = M.normalizeResident(raw);
    const m = ms();
    const v = Object.assign({}, I.get(r));
    if (!v.date) v.date = U.today();
    const inputs = {};

    function control(f) {
      if (f.kind === 'master') return (inputs[f.id] = U.select(m[f.master] || [], v[f.id] || '', { emptyLabel: '（未記入）' }));
      if (f.kind === 'chips') return (inputs[f.id] = U.chipList(v[f.id] || [], f.master ? m[f.master] : [], '入力して Enter'));
      if (f.kind === 'textarea') return (inputs[f.id] = h('textarea', { class: 'input', rows: '2' }, v[f.id] || ''));
      if (f.kind === 'number') return (inputs[f.id] = h('input', { class: 'input num', type: 'number', step: 'any', value: v[f.id] == null ? '' : v[f.id] }));
      if (f.kind === 'date') return (inputs[f.id] = h('input', { class: 'input', type: 'date', value: v[f.id] || '' }));
      if (f.kind === 'radio') {
        const box = h('div', { class: 'segrow' });
        const set = (x) => { v[f.id] = (v[f.id] === x ? '' : x);
          Array.prototype.forEach.call(box.children, (el) => el.classList.toggle('on', el.textContent === v[f.id])); };
        f.options.forEach((o) => box.appendChild(h('button', { type: 'button', class: 'btn seg small' + (v[f.id] === o ? ' on' : ''), onclick: () => set(o) }, o)));
        inputs[f.id] = { get: () => v[f.id] || '' };
        return box;
      }
      if (f.kind === 'checks') {
        const cur = (v[f.id] || []).slice();
        const box = h('div', { class: 'segrow' });
        f.options.forEach((o) => {
          const b = h('button', { type: 'button', class: 'btn seg small' + (cur.indexOf(o) >= 0 ? ' on' : ''), onclick: () => {
            const i = cur.indexOf(o); if (i >= 0) cur.splice(i, 1); else cur.push(o);
            b.classList.toggle('on', cur.indexOf(o) >= 0);
          } }, o);
          box.appendChild(b);
        });
        inputs[f.id] = { get: () => cur.slice() };
        return box;
      }
      return (inputs[f.id] = h('input', { class: 'input', type: 'text', value: v[f.id] || '' }));
    }
    function collect() {
      const out = {};
      I.allFields().forEach((f) => {
        const el = inputs[f.id];
        if (!el) return;
        if (el.get) { out[f.id] = el.get(); return; }
        const val = el.value;
        out[f.id] = (f.kind === 'number') ? (val === '' ? null : parseFloat(val)) : String(val || '').trim();
      });
      return out;
    }

    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, V.sama(r.name) + '　' + V.t('admit') + '時の聞き取り'),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), ' ',
        h('a', { class: 'btn', href: '#/resident/' + r.id }, V.t('person') + 'の画面'))));
    root.appendChild(h('div', { class: 'card info no-print' },
      '空欄のまま印刷すれば、家族に渡して書いてもらう紙になります。返ってきたら、ここに入れて「食事情報に写す」を押すと食札と食数に反映されます。'));

    I.GROUPS.forEach((g) => {
      const sec = h('section', { class: 'card' }, h('h2', null, g.label));
      const grid = h('div', { class: 'grid2' });
      g.fields.forEach((f) => grid.appendChild(U.field(f.label, control(f), f.hint)));
      sec.appendChild(grid);
      root.appendChild(sec);
    });

    root.appendChild(h('div', { class: 'toolrow no-print' },
      h('button', { class: 'btn primary', onclick: async () => {
        const rec = await DB.get('residents', r.id);
        rec.intake = collect();
        await DB.put('residents', rec);
        U.toast('保存しました');
      } }, '保存'),
      h('button', { class: 'btn', onclick: async () => {
        const got = collect();
        const rec = M.normalizeResident(await DB.get('residents', r.id));
        rec.intake = got;
        const cur = M.dietAt(rec, { d: U.today(), m: M.activeMeals(m)[0].id }, m.meals);
        const next = I.toDiet(got, cur);
        if (!await U.confirm('聞き取りの内容を食事情報に写します。今日から使う版として足します（前の版は履歴に残ります）。', { okLabel: '写す' })) return;
        rec.diet = (rec.diet || []).concat([{ id: U.uid('v'), from: { d: U.today(), m: M.activeMeals(m)[0].id },
          data: next, source: got.from || '', reason: V.t('admit') + '時の聞き取りから',
          by: V.recorder(), recordedAt: Date.now() }]);
        await DB.put('residents', rec);
        U.toast('食事情報に写しました');
        App.go('#/resident/' + r.id);
      } }, '食事情報に写す')));
    root.appendChild(h('table', { class: 'stamps print-only' }, h('tbody', null,
      h('tr', null, ['記入者', '続柄', '管理栄養士', '確認日'].map((s) => h('th', null, s))),
      h('tr', null, [0, 1, 2, 3].map(() => h('td', null, ' '))))));
  });

  // 個人画面からの入口
  window.Residents.registerSection({ order: 5, render: async function (r) {
    const has = I.filled(r);
    const v = I.get(r);
    return h('section', { class: 'card' }, h('h2', null, V.t('admit') + '時の聞き取り'),
      has ? h('div', null, h('div', { class: 'sub' }, (v.date ? U.fmtDate(v.date, true) : '') + (v.from ? '　' + v.from : '') + (v.writer ? '　' + v.writer : '')),
        h('div', null, [v.shokushu ? M.label(ms().shokushu, v.shokushu) : '', v.staple ? M.label(ms().staple, v.staple) : '',
          v.side ? M.label(ms().side, v.side) : '', (v.allergy || []).length ? 'アレルギー ' + v.allergy.join('・') : ''].filter(Boolean)
          .map((t) => h('span', { class: 'tag' }, t))))
        : h('div', { class: 'sub' }, 'まだありません。家族に渡す紙としても刷れます。'),
      h('div', { class: 'toolrow no-print' }, h('a', { class: 'btn', href: '#/intake/' + r.id }, has ? '開く' : '書く・刷る')));
  } });

  window.Intake = I;
})();
