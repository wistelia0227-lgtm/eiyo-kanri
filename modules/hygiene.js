// 衛生管理の点検表・記録簿（削除可能）。様式と文言は js/hygiene_forms.js（通知の別紙のまま）。
// 保健所の巡回指導で見られる書類（調査 02 の 5.3）。検収の記録簿だけは modules/stock.js にある。
// 刷った時の形は通知の別紙に合わせた: 左上に表題／右上に日付と〈責任者・衛生管理者〉の印欄／
// 節の見出しは「１．毎日点検」のような素の行／下に〈改善を行った点〉〈計画的に改善すべき点〉の枠。
// 画面では ○ × のボタンで付け、刷る時はボタンを消して付けた印だけを出す（台紙は js/util.js の U.paper）。
// 置き場所: daily[date].hygiene = { 様式ID: { items:{項目ID:'○'|'×'}, people:{...}, water:[...], tables:{...}, improved, plan, by, kanri } }
(function () {
  'use strict';
  const U = window.U, h = U.h, DB = window.DB, M = window.Model, V = window.View, App = window.App;
  const HF = window.HygieneForms;
  const ms = () => window.Master.current;
  const HY = {};
  let form = 'shisetsu';

  HY.get = async function (date) {
    const d = (await DB.get('daily', date)) || { date: date, extra: {} };
    d.hygiene = d.hygiene || {};
    return d;
  };
  HY.recOf = function (daily, id) {
    const r = daily.hygiene[id] = daily.hygiene[id] || { items: {}, people: {}, water: [], tables: {}, improved: '', plan: '', by: '', kanri: '' };
    r.items = r.items || {}; r.people = r.people || {}; r.water = r.water || []; r.tables = r.tables || {};
    return r;
  };
  HY.ALL = () => HF.CHECKS.concat(HF.RECORDS);

  App.registerScreen('hygiene', async function (params, root) {
    if (params[0] && HF.form(params[0])) form = params[0];
    const date = params[1] || U.today();
    const daily = await HY.get(date);
    const f = HF.form(form);
    const rec = HY.recOf(daily, form);
    const save = async () => { await DB.put('daily', daily); };

    root.appendChild(h('header', { class: 'topbar no-print' }, h('h1', null, f.label + '　' + U.fmtDate(date, true)),
      h('div', null, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), ' ',
        h('a', { class: 'btn', href: '#/hygienelist/' + date.slice(0, 7) }, '1 か月ぶん'))));
    root.appendChild(h('div', { class: 'toolrow no-print' }, HY.ALL().map((x) =>
      h('a', { class: 'btn seg' + (x.id === form ? ' on' : ''), href: '#/hygiene/' + x.id + '/' + date }, x.label.replace('の点検表', '').replace('の記録簿', '')))));
    root.appendChild(V.dateBar(date, (d) => App.go('#/hygiene/' + form + '/' + d)));
    root.appendChild(h('div', { class: 'card info no-print' },
      '文言は ' + HF.SOURCE + ' のとおりです。検収の記録簿は ',
      h('a', { href: '#/stock/kenshu/' + date }, '検収・在庫'), ' にあります。'));

    // ここから下は紙の様式のとおりの形
    const names = [f.id === 'haiso' ? '記録者' : '責任者', f.id === 'haiso' ? '確認者' : '衛生管理者'];
    const paper = U.paper(f.label, { date: date, stamps: names, note: '（別紙）' });
    // 印欄はそのまま書き込めるようにする（手書きでも、打ってもよい）
    const keys = ['by', 'kanri'];
    paper.querySelectorAll('.stamp-cell').forEach((td, i) => {
      const el = h('input', { class: 'input no-print-border', type: 'text', value: rec[keys[i]] || '' });
      el.addEventListener('change', async () => { rec[keys[i]] = el.value.trim(); await save(); });
      td.appendChild(el);
    });
    root.appendChild(paper);

    if (f.sections) drawCheck(paper, f, rec, save, date, daily);
    if (f.tables) drawRecord(paper, f, rec, save);

    const setTxt = (key) => async (v) => { rec[key] = v; await save(); };
    if (f.foot) paper.appendChild(U.paperBox('〈' + f.foot + '〉', rec.improved, setTxt('improved'), 4));
    else {
      paper.appendChild(U.paperBox('〈改善を行った点〉', rec.improved, setTxt('improved')));
      paper.appendChild(U.paperBox('〈計画的に改善すべき点〉', rec.plan, setTxt('plan')));
    }

    if (f.sections) {
      const bad = HF.bad(f, rec);
      if (bad.length) root.appendChild(h('div', { class: 'card bad no-print' },
        h('b', null, '× が付いた項目（' + bad.length + '）'),
        h('ul', null, bad.map((x) => h('li', null, x.t)))));
    }
  });

  // ○ × を付ける欄。画面ではボタン、紙では付けた印だけ
  function markCell(get, set) {
    return h('td', { class: 'mark-cell no-print-border' },
      h('span', { class: 'print-only' }, get() || ''),
      h('div', { class: 'segrow' }, HF.MARKS.map((mk) =>
        h('button', { type: 'button', class: 'btn seg small' + (get() === mk ? ' on' : ''),
          onclick: async () => { await set(get() === mk ? '' : mk); App.refresh(); } }, mk))));
  }

  // ---- 点検表 ----
  function drawCheck(root, f, rec, save, date, daily) {
    // 従事者の表（人ごとの欄）。原本では点検項目の表より上にある
    if (f.people) {
      const staff = (ms().kitchenStaff || []).slice();
      while (staff.length < 5) staff.push('');   // 原本は空の 5 行。名前を入れていなくても刷って使える
      if (!(ms().kitchenStaff || []).length) root.appendChild(h('div', { class: 'sub no-print' }, '設定 → 調理従事者 に名前を入れると、この表に名前が入ります。'));
      root.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered staff' },
        h('thead', null, h('tr', null, [h('th', null, '氏　名')].concat(f.people.map((p) => h('th', null, h('span', { class: 'vert' }, p)))))),
        h('tbody', null, staff.map((nm, ri) => h('tr', null, h('th', null, nm || h('span', { class: 'blankrow' }, '')),
          f.people.map((p) => {
            if (!nm) return h('td', null, '');
            const key = nm + '/' + p;
            return markCell(() => rec.people[key], async (v) => { rec.people[key] = v; await save(); });
          })))))));
    }

    f.sections.forEach((s) => {
      // 節が 1 つしか無い様式は、原本に節の見出しが無い（表の見出し行が「点 検 項 目」）
      if (f.sections.length > 1) root.appendChild(h('div', { class: 'paper-sec' }, s.label));
      let no = 0;
      root.appendChild(h('table', { class: 'list bordered check' },
        h('thead', null, h('tr', null, h('th', null, ''), h('th', null, '点 検 項 目'), h('th', null, '点検結果'))),
        h('tbody', null, s.items.map((it, i) => {
          if (!it.sub) no++;
          const key = HF.itemId(s.id, i);
          return h('tr', null,
            h('th', { class: 'num' }, (s.nonum || it.sub) ? '' : String(no)),
            h('td', null, it.t, it.note ? h('div', { class: 'sub no-print' }, it.note) : null),
            markCell(() => rec.items[key], async (v) => { rec.items[key] = v; await save(); }));
        }))));
    });

    // 使用水の点検（様式5 の②）
    if (f.water) {
      const sec = h('section');
      const draw = () => {
        while (rec.water.length < 4) rec.water.push({});   // 原本は 4 行。紙に刷る時、書く欄が無いと使えない
        sec.innerHTML = '';
        sec.appendChild(h('div', { class: 'paper-sec' }, '② 使用水の点検表'));
        sec.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered' },
          h('thead', null, h('tr', null, HF.WATER_COLS.map((c) => h('th', null, c.label)).concat([h('th', { class: 'no-print' }, '')]))),
          h('tbody', null, rec.water.map((row, i) => h('tr', null,
            HF.WATER_COLS.map((c) => {
              const el = h('input', { class: 'input no-print-border', type: 'text', value: row[c.id] || '' });
              el.addEventListener('change', async () => { row[c.id] = el.value.trim(); await save(); });
              return h('td', null, el, c.unit ? h('span', { class: 'sub' }, c.unit) : null);
            }),
            h('td', { class: 'no-print' }, h('button', { class: 'btn small', onclick: async () => { rec.water.splice(i, 1); await save(); draw(); } }, '消す'))))))));
        sec.appendChild(h('div', { class: 'toolrow no-print' }, h('button', { class: 'btn', onclick: async () => {
          rec.water.push({}); await save(); draw();
        } }, '＋ 行を足す')));
      };
      draw();
      root.appendChild(sec);
    }
  }

  // ---- 記録簿 ----
  function drawRecord(root, f, rec, save) {
    if (f.head) {
      root.appendChild(h('table', { class: 'list bordered' }, h('tbody', null, h('tr', null, f.head.map((c) => {
        const el = h('input', { class: 'input no-print-border', type: 'text', value: (rec.tables.head || {})[c.id] || '' });
        el.addEventListener('change', async () => { rec.tables.head = rec.tables.head || {}; rec.tables.head[c.id] = el.value.trim(); await save(); });
        return [h('th', null, c.label), h('td', null, el)];
      })))));
    }
    f.tables.forEach((t) => {
      const rows = rec.tables[t.id] = rec.tables[t.id] || [];
      const sec = h('section');
      const draw = () => {
        // 紙に刷る時、書く欄が無いと使えない。空の行を 3 つは出しておく
        while (rows.length < 3) rows.push([]);
        sec.innerHTML = '';
        sec.appendChild(h('div', { class: 'paper-sec' }, t.label));
        sec.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered' },
          h('thead', null, h('tr', null, t.cols.map((c) => h('th', null, c)).concat([h('th', { class: 'no-print' }, '')]))),
          h('tbody', null, rows.map((row, i) => h('tr', null,
            t.cols.map((c, ci) => {
              const el = h('input', { class: 'input no-print-border', type: 'text', value: row[ci] || '' });
              el.addEventListener('change', async () => { row[ci] = el.value.trim(); await save(); });
              return h('td', null, el);
            }),
            h('td', { class: 'no-print' }, h('button', { class: 'btn small', onclick: async () => { rows.splice(i, 1); await save(); draw(); } }, '消す'))))))));
        sec.appendChild(h('div', { class: 'toolrow no-print' }, h('button', { class: 'btn', onclick: async () => {
          rows.push([]); await save(); draw();
        } }, '＋ 行を足す')));
      };
      draw();
      root.appendChild(sec);
    });
  }

  // ---- 1 か月ぶんの一覧（つけ忘れを見つける）----
  App.registerScreen('hygienelist', async function (params, root) {
    const ym = params[0] || U.today().slice(0, 7);
    const days = window.Report ? window.Report.daysOf(ym) : [];
    const recs = {};
    (await DB.getAll('daily')).forEach((x) => { if (x.date && x.date.slice(0, 7) === ym) recs[x.date] = x.hygiene || {}; });
    const forms = HF.CHECKS;
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, '衛生管理の点検表　' + ym.replace('-', '年') + '月'),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'))));
    root.appendChild(h('div', { class: 'toolrow no-print' },
      h('a', { class: 'btn', href: '#/hygienelist/' + (window.Report ? window.Report.addMonth(ym, -1) : ym) }, '◀ 前月'),
      h('a', { class: 'btn', href: '#/hygienelist/' + U.today().slice(0, 7) }, '今月'),
      h('a', { class: 'btn', href: '#/hygienelist/' + (window.Report ? window.Report.addMonth(ym, 1) : ym) }, '次月 ▶')));
    let miss = 0, bad = 0;
    root.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered' },
      h('thead', null, h('tr', null, [h('th', null, '日')].concat(forms.map((f) => h('th', null, f.label.replace('の点検表', '')))))),
      h('tbody', null, days.map((d) => {
        const past = d <= U.today();
        return h('tr', { class: [0, 6].indexOf(M.weekday(d)) >= 0 ? 'weekend' : '' },
          h('th', null, h('a', { href: '#/hygiene/' + forms[0].id + '/' + d }, U.fmtDate(d, true))),
          forms.map((f) => {
            const rec = (recs[d] || {})[f.id];
            const c = HF.countDone(f, rec);
            const ng = rec ? HF.bad(f, rec).length : 0;
            if (ng) bad++;
            if (!c.done && past) miss++;
            return h('td', { class: ng ? 'j-high' : (c.done === c.all && c.all ? 'j-done' : (past && !c.done ? 'sub' : '')) },
              h('a', { href: '#/hygiene/' + f.id + '/' + d },
                ng ? '× ' + ng : (c.done === c.all && c.all ? '○' : (c.done ? c.done + '/' + c.all : (past ? '未' : '')))));
          }));
      })))));
    root.appendChild(h('div', { class: 'sub' },
      (miss ? '今日までで ' + miss + ' 枠がまだです。' : '今日までのぶんは全部つけてあります。') +
      (bad ? '　× が付いた日が ' + bad + ' 枠あります（改善を行った点の欄に書いてください）。' : '')));
  });

  // 今日やること
  App.registerTodo(async function (ctx) {
    const daily = await HY.get(ctx.today);
    const yet = HF.CHECKS.filter((f) => {
      const rec = daily.hygiene[f.id];
      const c = HF.countDone(f, rec);
      return c.done < c.all;
    });
    const out = [];
    if (yet.length) out.push({ level: 'info', text: '衛生の点検表がまだ: ' + yet.map((f) => f.label.replace('の点検表', '')).join('・'),
      href: '#/hygiene/' + yet[0].id + '/' + ctx.today });
    HF.CHECKS.forEach((f) => {
      const ng = HF.bad(f, daily.hygiene[f.id]);
      if (ng.length) out.push({ level: 'warn', text: f.label + ' に × が ' + ng.length + ' 件（' + ng[0].t.slice(0, 20) + '…）',
        href: '#/hygiene/' + f.id + '/' + ctx.today });
    });
    return out;
  });

  // 設定: 調理従事者の名前（様式2 の表に使う）
  App.registerSettings({ order: 49, title: '調理従事者', render: function () {
    const m = ms();
    const ed = U.chipList(m.kitchenStaff || [], [], '名前を入れて Enter', async (list) => {
      m.kitchenStaff = list; await window.Master.save();
    });
    return h('div', null, h('div', { class: 'sub' }, '「従事者等の衛生管理点検表」の表に出る名前です。並べた順に行になります。'), ed);
  } });

  App.registerNav({ order: 35, group: '毎日', label: '衛生', icon: '🧼', hash: '#/hygiene', match: ['hygiene', 'hygienelist'], feature: 'reports' });
  window.Hygiene = HY;
})();
