// 衛生管理の点検表・記録簿（削除可能）。様式と文言は js/hygiene_forms.js（通知の別紙のまま）。
// 保健所の巡回指導で見られる書類（調査 02 の 5.3）。検収の記録簿だけは modules/stock.js にある。
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

    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, f.label + '　' + U.fmtDate(date, true)),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'), ' ',
        h('a', { class: 'btn', href: '#/hygienelist/' + date.slice(0, 7) }, '1 か月ぶん'))));
    root.appendChild(h('div', { class: 'toolrow no-print' }, HY.ALL().map((x) =>
      h('a', { class: 'btn seg' + (x.id === form ? ' on' : ''), href: '#/hygiene/' + x.id + '/' + date }, x.label.replace('の点検表', '').replace('の記録簿', '')))));
    root.appendChild(V.dateBar(date, (d) => App.go('#/hygiene/' + form + '/' + d)));
    root.appendChild(h('div', { class: 'card info no-print' },
      '文言は ' + HF.SOURCE + ' のとおりです。検収の記録簿は ',
      h('a', { href: '#/stock/kenshu/' + date }, '検収・在庫'), ' にあります。'));

    if (f.sections) drawCheck(root, f, rec, save, date, daily);
    if (f.tables) drawRecord(root, f, rec, save);

    // 共通の下欄
    const txt = (key, label, rows) => {
      const el = h('textarea', { class: 'input', rows: String(rows || 2) }, rec[key] || '');
      el.addEventListener('change', async () => { rec[key] = el.value; await save(); });
      return U.field(label, el);
    };
    root.appendChild(h('section', { class: 'card' },
      f.foot ? txt('improved', '〈' + f.foot + '〉', 3) : h('div', { class: 'grid2' }, txt('improved', '〈改善を行った点〉'), txt('plan', '〈計画的に改善すべき点〉')),
      h('div', { class: 'grid2' },
        U.field('責任者', nameInput(rec, 'by', save)),
        U.field(f.id === 'haiso' ? '記録者' : '衛生管理者', nameInput(rec, 'kanri', save)))));
  });

  function nameInput(rec, key, save) {
    const el = h('input', { class: 'input', type: 'text', value: rec[key] || '' });
    el.addEventListener('change', async () => { rec[key] = el.value.trim(); await save(); });
    return el;
  }

  // ---- 点検表 ----
  function drawCheck(root, f, rec, save, date, daily) {
    // 従事者の表（人ごとの欄）
    if (f.people) {
      const staff = (ms().kitchenStaff || []);
      const sec = h('section', { class: 'card' }, h('h2', null, '調理従事者等'));
      if (!staff.length) sec.appendChild(h('div', { class: 'sub' }, '設定 → 調理従事者 に名前を入れると、ここに行が出ます。'));
      else sec.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered' },
        h('thead', null, h('tr', null, [h('th', null, '氏名')].concat(f.people.map((p) => h('th', null, p))))),
        h('tbody', null, staff.map((nm) => h('tr', null, h('th', null, nm),
          f.people.map((p) => {
            const key = nm + '/' + p;
            return h('td', { class: 'checkbox-cell' }, h('div', { class: 'segrow' }, HF.MARKS.map((mk) =>
              h('button', { type: 'button', class: 'btn seg small' + (rec.people[key] === mk ? ' on' : ''),
                onclick: async () => { rec.people[key] = (rec.people[key] === mk ? '' : mk); await save(); App.refresh(); } }, mk))));
          })))))));
      root.appendChild(sec);
    }

    f.sections.forEach((s) => {
      const sec = h('section', { class: 'card' }, h('h2', null, s.label));
      let no = 0;
      sec.appendChild(h('table', { class: 'list bordered check' },
        h('thead', null, h('tr', null, h('th', null, ''), h('th', null, '点 検 項 目'), h('th', null, '点検結果'))),
        h('tbody', null, s.items.map((it, i) => {
          if (!it.sub) no++;
          const key = HF.itemId(s.id, i);
          return h('tr', null,
            h('th', { class: 'num' }, it.sub ? '' : String(no)),
            h('td', null, it.t, it.note ? h('div', { class: 'sub' }, it.note) : null),
            h('td', { class: 'checkbox-cell no-print-border' }, h('div', { class: 'segrow' }, HF.MARKS.map((mk) =>
              h('button', { type: 'button', class: 'btn seg small' + (rec.items[key] === mk ? ' on' : ''),
                onclick: async () => { rec.items[key] = (rec.items[key] === mk ? '' : mk); await save(); App.refresh(); } }, mk)))));
        }))));
      root.appendChild(sec);
    });

    // 使用水の点検（様式5 の②）
    if (f.water) {
      const sec = h('section', { class: 'card' }, h('h2', null, '② 使用水の点検表'));
      const draw = () => {
        sec.innerHTML = '';
        sec.appendChild(h('h2', null, '② 使用水の点検表'));
        sec.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered' },
          h('thead', null, h('tr', null, HF.WATER_COLS.map((c) => h('th', null, c.label)).concat([h('th', { class: 'no-print' }, '')]))),
          h('tbody', null, rec.water.map((row, i) => h('tr', null,
            HF.WATER_COLS.map((c) => {
              const el = h('input', { class: 'input', type: 'text', value: row[c.id] || '' });
              el.addEventListener('change', async () => { row[c.id] = el.value.trim(); await save(); });
              return h('td', null, el);
            }),
            h('td', { class: 'no-print' }, h('button', { class: 'btn small', onclick: async () => { rec.water.splice(i, 1); await save(); draw(); } }, '消す'))))))));
        sec.appendChild(h('div', { class: 'toolrow no-print' }, h('button', { class: 'btn', onclick: async () => {
          rec.water.push({}); await save(); draw();
        } }, '＋ 行を足す')));
      };
      draw();
      root.appendChild(sec);
    }

    const bad = HF.bad(f, rec);
    if (bad.length) root.appendChild(h('div', { class: 'card bad no-print' },
      h('b', null, '× が付いた項目（' + bad.length + '）'),
      h('ul', null, bad.map((x) => h('li', null, x.t)))));
  }

  // ---- 記録簿 ----
  function drawRecord(root, f, rec, save) {
    if (f.head) {
      const grid = h('div', { class: 'grid2' });
      f.head.forEach((c) => {
        const el = h('input', { class: 'input', type: 'text', value: (rec.tables.head || {})[c.id] || '' });
        el.addEventListener('change', async () => { rec.tables.head = rec.tables.head || {}; rec.tables.head[c.id] = el.value.trim(); await save(); });
        grid.appendChild(U.field(c.label, el));
      });
      root.appendChild(h('section', { class: 'card' }, grid));
    }
    f.tables.forEach((t) => {
      const rows = rec.tables[t.id] = rec.tables[t.id] || [];
      const sec = h('section', { class: 'card' });
      const draw = () => {
        sec.innerHTML = '';
        sec.appendChild(h('h2', null, t.label));
        sec.appendChild(h('div', { class: 'scroll-x' }, h('table', { class: 'list bordered' },
          h('thead', null, h('tr', null, t.cols.map((c) => h('th', null, c)).concat([h('th', { class: 'no-print' }, '')]))),
          h('tbody', null, rows.length ? rows.map((row, i) => h('tr', null,
            t.cols.map((c, ci) => {
              const el = h('input', { class: 'input', type: 'text', value: row[ci] || '' });
              el.addEventListener('change', async () => { row[ci] = el.value.trim(); await save(); });
              return h('td', null, el);
            }),
            h('td', { class: 'no-print' }, h('button', { class: 'btn small', onclick: async () => { rows.splice(i, 1); await save(); draw(); } }, '消す'))))
            : [h('tr', null, h('td', { colspan: String(t.cols.length + 1), class: 'sub' }, '（まだありません）'))]))));
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
