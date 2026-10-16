(function () {
  'use strict';

  const U = window.U, h = U.h, DB = window.DB, M = window.Model, V = window.View, App = window.App;
  const ms = () => window.Master.current;

  const GU = {};

  GU.conf = function () {
    const m = ms() || {};
    const g = m.glim || {};
    const severe = g.severe || {};
    return {
      ccSet: g.ccSet || 'acute',
      severe: {
        bmiUnder70: (severe.bmiUnder70 !== undefined && severe.bmiUnder70 !== null && severe.bmiUnder70 !== '') ? Number(severe.bmiUnder70) : null,
        bmiFrom70: (severe.bmiFrom70 !== undefined && severe.bmiFrom70 !== null && severe.bmiFrom70 !== '') ? Number(severe.bmiFrom70) : null,
        ccM: (severe.ccM !== undefined && severe.ccM !== null && severe.ccM !== '') ? Number(severe.ccM) : null,
        ccF: (severe.ccF !== undefined && severe.ccF !== null && severe.ccF !== '') ? Number(severe.ccF) : null
      }
    };
  };

  GU.cut = function () {
    const base = (window.Glim && window.Glim.CUT) ? window.Glim.CUT : {};
    const conf = GU.conf();
    const cut = JSON.parse(JSON.stringify(base));

    if (conf.ccSet && cut.cc && window.Glim && window.Glim.CC_SETS && window.Glim.CC_SETS[conf.ccSet]) {
      cut.cc.normal = window.Glim.CC_SETS[conf.ccSet];
    }
    if (!cut.bmi) cut.bmi = {};
    if (!cut.cc) cut.cc = {};

    if (conf.severe.bmiUnder70 !== null) cut.bmi.severeUnder70 = conf.severe.bmiUnder70;
    if (conf.severe.bmiFrom70 !== null) cut.bmi.severeFrom70 = conf.severe.bmiFrom70;
    if (conf.severe.ccM !== null) cut.cc.severeM = conf.severe.ccM;
    if (conf.severe.ccF !== null) cut.cc.severeF = conf.severe.ccF;

    return cut;
  };

  GU.of = function (r) {
    const g = (r && r.glim) || {};
    return {
      muscleLow: !!g.muscleLow,
      intakeLow1: !!g.intakeLow1,
      intakeLow2: !!g.intakeLow2,
      giChronic: !!g.giChronic,
      acute: !!g.acute,
      chronic: !!g.chronic,
      note: g.note || '',
      at: g.at || null
    };
  };

  GU.save = function (r, v) {
    if (!r) return Promise.resolve();
    r.glim = Object.assign({}, v, { at: Date.now() });
    return DB.put('residents', r);
  };

  GU.input = function (r, rWeights, measures, asOf) {
    const wList = (rWeights || []).filter(function (w) {
      return !asOf || w.date <= asOf;
    });
    wList.sort(function (a, b) {
      return a.date.localeCompare(b.date);
    });
    const cur = wList.length > 0 ? wList[wList.length - 1] : null;

    const bmi = (cur && r.heightCm) ? M.bmi(cur.value, r.heightCm) : null;
    const lossRateObj = (cur && M.lossRate) ? M.lossRate(wList, cur, 6) : null;
    const loss = lossRateObj ? lossRateObj.rate : null;

    const mList = (measures || []).filter(function (m) {
      const rId = m.residentId || m.resident_id;
      return rId === r.id && m.kind === 'cc' && (!asOf || m.date <= asOf);
    });
    mList.sort(function (a, b) {
      return a.date.localeCompare(b.date);
    });
    const latestCc = mList.length > 0 ? mList[mList.length - 1].value : null;

    const gOf = GU.of(r);
    const conf = GU.conf();

    return {
      age: M.age ? M.age(r.birth, asOf) : null,
      sex: r.gender,
      curWeight: cur ? cur.value : null,
      bmi: bmi,
      loss: loss,
      lossMonths: 6,
      cc: latestCc,
      ccSet: conf.ccSet,
      muscleLow: gOf.muscleLow,
      intakeLow1: gOf.intakeLow1,
      intakeLow2: gOf.intakeLow2,
      giChronic: gOf.giChronic,
      acute: gOf.acute,
      chronic: gOf.chronic,
      screened: true
    };
  };

  GU.edit = function (r, input, res, done) {
    const gOf = GU.of(r);
    const state = {
      intakeLow1: gOf.intakeLow1,
      intakeLow2: gOf.intakeLow2,
      giChronic: gOf.giChronic,
      acute: gOf.acute,
      chronic: gOf.chronic,
      muscleLow: gOf.muscleLow,
      note: gOf.note
    };

    const conf = GU.conf();
    const hasUnsetSevere = (
      conf.severe.bmiUnder70 === null ||
      conf.severe.bmiFrom70 === null ||
      conf.severe.ccM === null ||
      conf.severe.ccF === null
    );

    let close;
    const container = h('div', { class: 'glim-edit-modal' });

    function renderModal() {
      container.textContent = '';
      const inp = Object.assign({}, input, state);
      const currentRes = (window.Glim && window.Glim.assess) ? window.Glim.assess(inp, GU.cut()) : res;
      const words = (window.Glim && window.Glim.words) ? window.Glim.words(currentRes) : '';

      const phenoRows = (currentRes && currentRes.pheno) ? currentRes.pheno : [];
      const etiRows = (currentRes && currentRes.etio) ? currentRes.etio : [];

      const children = [
        h('h3', null, r.name + ' さんの GLIM 基準評価'),
        h('div', { class: 'glim-res-summary' },
          h('strong', null, '判定結果: '),
          words
        ),
        h('h4', null, '表現型基準（', String(currentRes.phenoHit || 0), ' 項目該当）'),
        h('table', { class: 'list bordered' },
          h('thead', null,
            h('tr', null,
              h('th', null, '項目'),
              h('th', null, '該当'),
              h('th', null, '重度'),
              h('th', null, '根拠')
            )
          ),
          h('tbody', null,
            phenoRows.map(function (p) {
              const sevText = currentRes.malnutrition
                ? (p.severe ? '重度' : (p.severeUnknown ? '重度の基準値なし' : ''))
                : '';
              return h('tr', null,
                h('td', null, p.label || p.name),
                h('td', { class: p.hit ? 'match-yes' : 'match-no' }, p.hit ? '○' : '×'),
                h('td', null, sevText),
                h('td', null, p.why || '')
              );
            })
          )
        ),
        h('h4', null, '病因基準（', String(currentRes.etioHit || 0), ' 項目該当）'),
        h('table', { class: 'list bordered' },
          h('thead', null,
            h('tr', null,
              h('th', null, '項目'),
              h('th', null, '該当'),
              h('th', null, '根拠')
            )
          ),
          h('tbody', null,
            etiRows.map(function (e) {
              return h('tr', null,
                h('td', null, e.label || e.name),
                h('td', { class: e.hit ? 'match-yes' : 'match-no' }, e.hit ? '○' : '×'),
                h('td', null, e.why || '')
              );
            })
          )
        ),
        h('h4', null, '病因基準・追加判定の入力'),
        h('div', { class: 'glim-inputs' },
          h('label', { class: 'checkbox-label' },
            h('input', {
              type: 'checkbox',
              checked: state.intakeLow1,
              onchange: function (e) { state.intakeLow1 = e.target.checked; renderModal(); }
            }),
            ' 1週間以上、必要栄養量の50%以下の食事摂取量'
          ),
          h('label', { class: 'checkbox-label' },
            h('input', {
              type: 'checkbox',
              checked: state.intakeLow2,
              onchange: function (e) { state.intakeLow2 = e.target.checked; renderModal(); }
            }),
            ' 2週間以上、様々な程度の食事摂取量減少'
          ),
          h('label', { class: 'checkbox-label' },
            h('input', {
              type: 'checkbox',
              checked: state.giChronic,
              onchange: function (e) { state.giChronic = e.target.checked; renderModal(); }
            }),
            ' 消化吸収に悪影響を及ぼす慢性的な消化管の状態'
          ),
          h('label', { class: 'checkbox-label' },
            h('input', {
              type: 'checkbox',
              checked: state.acute,
              onchange: function (e) { state.acute = e.target.checked; renderModal(); }
            }),
            ' 急性疾患や外傷による炎症'
          ),
          h('label', { class: 'checkbox-label' },
            h('input', {
              type: 'checkbox',
              checked: state.chronic,
              onchange: function (e) { state.chronic = e.target.checked; renderModal(); }
            }),
            ' 慢性疾患による炎症'
          ),
          h('hr', null),
          h('label', { class: 'checkbox-label' },
            h('input', {
              type: 'checkbox',
              checked: state.muscleLow,
              onchange: function (e) { state.muscleLow = e.target.checked; renderModal(); }
            }),
            ' 筋肉量の減少あり（画像や測定で確かめた）'
          )
        ),
        h('div', { class: 'glim-note' },
          h('label', null, '覚え書き:'),
          h('textarea', {
            rows: 3,
            value: state.note,
            oninput: function (e) { state.note = e.target.value; }
          })
        ),
        hasUnsetSevere ? h('p', { class: 'notice-text' },
          '低BMI と 筋肉量減少 は、アジア人の重度の基準値が示されていません。設定で施設の値を入れると判定します。'
        ) : null,
        h('div', { class: 'modal-actions' },
          h('button', {
            class: 'primary',
            onclick: function () {
              GU.save(r, state).then(function () {
                close();
                if (done) done();
              });
            }
          }, '保存'),
          h('button', { onclick: function () { close(); } }, 'キャンセル')
        )
      ];

      children.forEach(function (child) {
        if (child) container.appendChild(child);
      });
    }

    renderModal();
    close = U.modal(container);
  };

  App.registerScreen('glim', async function (params, root) {
    const date = (params && params[0]) || U.today();
    const m = ms() || {};

    const residents = (await DB.residents()) || [];
    const byRes = (window.Weights && window.Weights.byResident) ? await window.Weights.byResident() : {};
    const measures = (await DB.getAll('measures')) || [];

    const active = residents.filter(function (r) {
      return !r.archived && M.status(r, date, m.meals) === 'in';
    });

    active.sort(function (a, b) {
      const uA = a.unit || '';
      const uB = b.unit || '';
      if (uA !== uB) return uA.localeCompare(uB);
      const rA = a.room || '';
      const rB = b.room || '';
      return rA.localeCompare(rB);
    });

    if (active.length === 0) {
      root.textContent = '';
      root.appendChild(h('header', { class: 'topbar' }, h('h1', null, 'GLIM 基準による低栄養判定'),
        h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'))));
      root.appendChild(V.dateBar(date, (d) => App.go('#/glim/' + d)));
      root.appendChild(h('div', { class: 'empty' }, '対象の利用者がいません。'));
      return;
    }

    let missingHeightCount = 0;
    const totalCount = active.length;
    let malnutCount = 0;
    let severeCount = 0;

    const rows = active.map(function (r) {
      if (!r.heightCm) missingHeightCount++;

      const rWeights = byRes[r.id] || [];

      const input = GU.input(r, rWeights, measures, date);
      const cut = GU.cut();
      const res = (window.Glim && window.Glim.assess) ? window.Glim.assess(input, cut) : {};

      if (res.malnutrition) {
        malnutCount++;
        if (res.severity === 'severe') severeCount++;
      }

      const sevLabel = window.Glim && window.Glim.SEVERITY_LABEL ? window.Glim.SEVERITY_LABEL[res.severity] : res.severity;
      let badgeNode = '—';
      if (res.malnutrition && sevLabel) {
        const badgeClass = res.severity === 'severe' ? 'bad' : 'warn';
        badgeNode = h('span', { class: 'badge ' + badgeClass }, sevLabel);
      }

      const curRisk = (window.Weights && window.Weights.evaluate)
        ? window.Weights.evaluate(r, rWeights, date).risk
        : null;
      const riskBadge = (window.Weights && window.Weights.riskBadge)
        ? window.Weights.riskBadge(curRisk)
        : (curRisk || '—');

      return h('tr', null,
        h('td', null,
          h('a', {
            href: '#',
            onclick: function (e) {
              e.preventDefault();
              GU.edit(r, input, res, function () { App.refresh(); });
            }
          }, r.name)
        ),
        h('td', null, input.age !== null ? String(input.age) : '—'),
        h('td', null, input.bmi !== null ? String(input.bmi.toFixed(1)) : '—'),
        h('td', null, input.loss !== null ? String(input.loss.toFixed(1)) + '%' : '—'),
        h('td', null, input.cc !== null ? String(input.cc) + ' cm' : '—'),
        h('td', null, String(res.phenoHit || 0)),
        h('td', null, String(res.etioHit || 0)),
        h('td', null, badgeNode),
        h('td', null, riskBadge)
      );
    });

    let warningsNode = null;
    if (missingHeightCount > 0) {
      warningsNode = h('div', { class: 'no-print warning-bar' },
        '身長が入っていない人 ' + missingHeightCount + ' 人'
      );
    }

    const summaryNode = h('div', { class: 'summary-bar' },
      '対象: ' + totalCount + ' 人 / 低栄養: ' + malnutCount + ' 人（うち重度: ' + severeCount + ' 人）'
    );

    const tableNode = h('table', { class: 'data-table glim-table' },
      h('thead', null,
        h('tr', null,
          h('th', null, '名前'),
          h('th', null, '年齢'),
          h('th', null, 'BMI'),
          h('th', null, '6か月の体重変化'),
          h('th', null, '下腿周囲長'),
          h('th', null, '表現型'),
          h('th', null, '病因'),
          h('th', null, '判定'),
          h('th', null, '今の低栄養リスク（施設基準）')
        )
      ),
      h('tbody', null, rows)
    );

    root.textContent = '';
    root.appendChild(h('header', { class: 'topbar' }, h('h1', null, 'GLIM 基準による低栄養判定'),
      h('div', { class: 'no-print' }, h('button', { class: 'btn', onclick: () => window.print() }, '印刷'))));
    root.appendChild(V.dateBar(date, (d) => App.go('#/glim/' + d)));
    if (warningsNode) root.appendChild(warningsNode);
    root.appendChild(tableNode);
    root.appendChild(summaryNode);
  });

  App.registerSettings({
    order: 47,
    title: 'GLIM 基準（低栄養の判定）',
    render: function () {
      const m = ms() || {};
      if (!m.glim) {
        m.glim = { ccSet: 'acute', severe: { bmiUnder70: null, bmiFrom70: null, ccM: null, ccF: null } };
      }
      const conf = GU.conf();

      const ccSets = (window.Glim && Array.isArray(window.Glim.CC_SETS)) ? window.Glim.CC_SETS : [];

      const ccButtons = ccSets.map(function (item) {
        const isSel = conf.ccSet === item.id;
        return h('button', {
          class: 'btn seg' + (isSel ? ' on' : ''),
          onclick: function () {
            m.glim.ccSet = item.id;
            window.Master.save().then(function () { App.refresh(); });
          }
        }, item.label);
      });

      const bmi70 = conf.severe.bmiUnder70 !== null ? String(conf.severe.bmiUnder70) : '';
      const bmi70Plus = conf.severe.bmiFrom70 !== null ? String(conf.severe.bmiFrom70) : '';
      const ccM = conf.severe.ccM !== null ? String(conf.severe.ccM) : '';
      const ccF = conf.severe.ccF !== null ? String(conf.severe.ccF) : '';

      return h('div', { class: 'settings-section' },
        h('h4', null, '下腿周囲長の基準値セット'),
        h('div', { class: 'btn-group' }, ccButtons),
        h('h4', null, '重度低栄養の基準値（任意設定）'),
        h('div', { class: 'form-group' },
          h('label', null, '低BMI (70歳未満): '),
          h('input', {
            type: 'number',
            step: '0.1',
            value: bmi70,
            placeholder: '未設定 (null)',
            onchange: function (e) {
              const val = e.target.value.trim();
              m.glim.severe.bmiUnder70 = val === '' ? null : Number(val);
              window.Master.save().then(function () { App.refresh(); });
            }
          })
        ),
        h('div', { class: 'form-group' },
          h('label', null, '低BMI (70歳以上): '),
          h('input', {
            type: 'number',
            step: '0.1',
            value: bmi70Plus,
            placeholder: '未設定 (null)',
            onchange: function (e) {
              const val = e.target.value.trim();
              m.glim.severe.bmiFrom70 = val === '' ? null : Number(val);
              window.Master.save().then(function () { App.refresh(); });
            }
          })
        ),
        h('div', { class: 'form-group' },
          h('label', null, '下腿周囲長 (男性): '),
          h('input', {
            type: 'number',
            step: '0.1',
            value: ccM,
            placeholder: '未設定 (null)',
            onchange: function (e) {
              const val = e.target.value.trim();
              m.glim.severe.ccM = val === '' ? null : Number(val);
              window.Master.save().then(function () { App.refresh(); });
            }
          })
        ),
        h('div', { class: 'form-group' },
          h('label', null, '下腿周囲長 (女性): '),
          h('input', {
            type: 'number',
            step: '0.1',
            value: ccF,
            placeholder: '未設定 (null)',
            onchange: function (e) {
              const val = e.target.value.trim();
              m.glim.severe.ccF = val === '' ? null : Number(val);
              window.Master.save().then(function () { App.refresh(); });
            }
          })
        ),
        h('p', { class: 'desc-text' },
          'GLIM 基準ではアジア人の重度低栄養における BMI や筋肉量低下の閾値が明確に固定されていないため、既定では空欄（判定なし）となっています。'
        )
      );
    }
  });

  App.registerNav({
    order: 22,
    group: 'ひと',
    label: 'GLIM',
    icon: '🧪',
    hash: '#/glim',
    match: ['glim'],
    feature: 'weights'
  });

  window.GlimUI = GU;
})();