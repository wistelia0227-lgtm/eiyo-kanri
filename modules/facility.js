// 事業所の登録（削除可能ではない: 呼び方と機能の入切がここで決まる）。
// 種類・給食の方式・算定している加算を選ぶと、使う機能と呼び方の「推奨」が決まる。機能は 1 つずつ手で入切できる。
(function () {
  'use strict';
  const U = window.U, h = U.h, P = window.Profile, App = window.App;
  const ms = () => window.Master.current;
  const F = {};

  F.edit = function (opts) {
    opts = opts || {};
    const p = JSON.parse(JSON.stringify(ms().profile));
    const touched = {}; // 手で入切した機能。以後は推奨で上書きしない
    const m = ms();
    const name = h('input', { class: 'input', type: 'text', value: m.facility.name, placeholder: '例: ○○園' });
    const rec = h('input', { class: 'input', type: 'text', value: m.facility.recorder, placeholder: '例: 栄養 花子' });
    // 保健所に出す報告書（modules/houkoku.js）で使う。入れておくと様式に自動で入る
    const CONTACT = [
      { k: 'zip', label: '郵便番号', ph: '例: 836-0000' },
      { k: 'addr', label: '所在地', ph: '例: 福岡県大牟田市○○ 1-2-3' },
      { k: 'tel', label: '電話' }, { k: 'fax', label: 'FAX' }, { k: 'mail', label: 'E-mail' },
      { k: 'kanrisha', label: '管理者名', ph: '例: 施設長 ○○' },
      { k: 'setchiName', label: '設置者（法人名）' }, { k: 'setchiAddr', label: '設置者の所在地' }
    ];
    const contact = {};
    CONTACT.forEach((c) => { contact[c.k] = h('input', { class: 'input', type: 'text', value: m.facility[c.k] || '', placeholder: c.ph || '' }); });
    const dietitians = h('input', { class: 'input num', type: 'number', min: '1', value: p.dietitians || 1 });
    const supply = U.select(P.SUPPLY, p.supply, { emptyLabel: '（選んでください）' });
    let close, redraw;

    // 種類（複数可。特養＋ショート併設のような形が普通）
    const kindBox = h('div', { class: 'pickgrid' });
    const groups = [];
    P.KINDS.forEach((k) => { if (groups.indexOf(k.group) < 0) groups.push(k.group); });
    groups.forEach((g) => {
      kindBox.appendChild(h('div', { class: 'pickgroup' }, h('div', { class: 'pickgroup-t' }, g),
        P.KINDS.filter((k) => k.group === g).map((k) => h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: p.kinds.indexOf(k.id) >= 0, onchange: (e) => {
            if (e.target.checked) p.kinds.push(k.id); else p.kinds.splice(p.kinds.indexOf(k.id), 1);
            if (!p.termsEdited) p.terms = P.defaultTerms(p.kinds);
            redraw();
          } }), ' ' + k.label))));
    });

    const addonBox = h('div'), termBox = h('div'), featBox = h('div'), noteBox = h('div');
    const termInput = (key, label, ph) => {
      const i = h('input', { class: 'input', type: 'text', value: p.terms[key] || '', placeholder: ph,
        onchange: () => { p.terms[key] = i.value.trim() || ph; p.termsEdited = true; } });
      return U.field(label, i);
    };
    redraw = function () {
      // 加算（種類に合うものだけ出す）
      const list = P.addonsFor(p.kinds);
      addonBox.innerHTML = '';
      if (!p.kinds.length) addonBox.appendChild(h('div', { class: 'sub' }, '先に事業所の種類を選ぶと、関係する加算が出ます。'));
      else if (!list.length) addonBox.appendChild(h('div', { class: 'sub' }, 'この種類に、栄養に関わる加算の登録はありません。'));
      else addonBox.appendChild(h('div', { class: 'pickgrid' }, list.map((a) => h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: p.addons.indexOf(a.id) >= 0, onchange: (e) => {
          if (e.target.checked) p.addons.push(a.id); else p.addons.splice(p.addons.indexOf(a.id), 1);
          redraw();
        } }), ' ' + a.label))));
      // 呼び方
      termBox.innerHTML = '';
      termBox.appendChild(h('div', { class: 'grid3' },
        termInput('person', 'この人たちの呼び方', '利用者'), termInput('suffix', '氏名のあとに付ける', '様'), termInput('place', '場所の呼び方', 'ユニット・フロア'),
        termInput('admit', '来たときの言い方', '入所'), termInput('leave', '帰るときの言い方', '退所')));
      // 機能
      const rc = P.recommend(p);
      if (!p.setupDone || p.kinds.length) P.FEATURES.forEach((f) => { if (!touched[f.id] && p.kinds.length) p.features[f.id] = !!rc[f.id]; });
      featBox.innerHTML = '';
      featBox.appendChild(h('div', { class: 'pickgrid' }, P.FEATURES.map((f) => h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: p.features[f.id] !== false, onchange: (e) => { p.features[f.id] = e.target.checked; touched[f.id] = true; } }),
        ' ' + f.label, rc[f.id] ? h('span', { class: 'tag ok' }, '推奨') : null, h('div', { class: 'sub' }, f.desc)))));
      featBox.appendChild(h('button', { class: 'btn small', onclick: () => { P.FEATURES.forEach((f) => { p.features[f.id] = !!rc[f.id]; delete touched[f.id]; }); redraw(); } }, '推奨のとおりにする'));
      // 注意書き
      const notes = P.notes(p);
      noteBox.innerHTML = '';
      if (notes.length) noteBox.appendChild(h('div', { class: 'card info' }, h('b', null, '登録した内容から'),
        notes.map((n) => h('div', null, '・' + n.label + ': ' + n.text))));
    };
    redraw();

    const save = async () => {
      if (!p.kinds.length) { U.toast('事業所の種類を 1 つ以上選んでください', true); return; }
      p.supply = supply.value;
      p.dietitians = parseInt(dietitians.value, 10) || 1;
      p.setupDone = true;
      const fac = { name: name.value.trim(), recorder: rec.value.trim() };
      CONTACT.forEach((c) => { fac[c.k] = contact[c.k].value.trim(); });
      ms().facility = fac;
      ms().profile = P.normalize(p);
      await window.Master.save();
      close();
      U.toast('登録しました');
      if (opts.then) opts.then(); else App.refresh();
    };
    close = U.modal(h('div', null,
      h('h2', null, '事業所の登録'),
      h('div', { class: 'sub' }, 'ここで選んだ内容に合わせて、使う機能と画面の言葉が変わります。あとから何度でも直せます。'),
      h('div', { class: 'grid3' }, U.field('事業所の名前', name), U.field('いつも記録する人', rec), U.field('管理栄養士・栄養士の人数', dietitians)),
      h('details', { class: 'fold' }, h('summary', null, '所在地・連絡先（保健所に出す報告書に使う）'),
        h('div', { class: 'grid3' }, CONTACT.map((c) => U.field(c.label, contact[c.k])))),
      h('h3', null, '事業所の種類（併設があれば複数選ぶ）'), kindBox,
      h('h3', null, '給食の出し方'), supply,
      h('h3', null, '算定している加算'), addonBox,
      h('h3', null, '画面の言葉'), termBox,
      h('h3', null, '使う機能'), featBox,
      noteBox,
      h('div', { class: 'modal-btns' }, opts.first ? null : h('button', { class: 'btn', onclick: () => close() }, 'やめる'),
        h('button', { class: 'btn primary', onclick: save }, '保存'))), { wide: true });
  };

  App.registerSettings({ order: 5, title: '事業所', render: function () {
    const p = ms().profile, m = ms();
    const kinds = p.kinds.map((k) => (P.kind(k) || { label: k }).label).join('、');
    const sup = (P.SUPPLY.find((s) => s.id === p.supply) || {}).label || '未登録';
    const addons = p.addons.map((a) => (P.ADDONS.find((x) => x.id === a) || { label: a }).label);
    const offs = P.FEATURES.filter((f) => p.features[f.id] === false).map((f) => f.label);
    return h('div', { class: 'card' },
      p.setupDone ? null : h('div', { class: 'card warn' }, 'まだ登録されていません。登録すると、使う機能と画面の言葉が事業所に合います。'),
      h('table', { class: 'kv' },
        h('tr', null, h('th', null, '名前'), h('td', null, m.facility.name || '（未登録）')),
        h('tr', null, h('th', null, '種類'), h('td', null, kinds || '（未登録）')),
        h('tr', null, h('th', null, '給食'), h('td', null, sup)),
        h('tr', null, h('th', null, '管理栄養士'), h('td', null, p.dietitians + ' 人')),
        h('tr', null, h('th', null, '算定している加算'), h('td', null, addons.length ? addons.join('、') : 'なし')),
        h('tr', null, h('th', null, '画面の言葉'), h('td', null, [p.terms.person, p.terms.suffix, p.terms.place, p.terms.admit, p.terms.leave].join(' / '))),
        h('tr', null, h('th', null, '使わない機能'), h('td', null, offs.length ? offs.join('、') : 'なし（全部使う）'))),
      P.notes(p).map((n) => h('div', { class: 'sub' }, '・' + n.label + ': ' + n.text)),
      h('button', { class: 'btn primary', onclick: () => F.edit() }, p.setupDone ? '事業所の登録を直す' : '事業所を登録する'));
  } });

  window.Facility = F;
})();
