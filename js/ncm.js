// 栄養ケア・マネジメント（NCM）の計算。DOM にも DB にも触れない（Node で試験できる）。window.NCM で公開。
// 様式: 厚生労働省 別紙様式4-1-1（施設）／4-3-1（通所・居宅）。期限は一体的取組通知 第三 Ⅰ。
//   入所後おおむね1週間以内にスクリーニング／モニタリングは 低3月毎・高2週毎・中は施設が計画書に定める／再スクリーニングは全員3月毎
(function (root) {
  'use strict';
  const M = (typeof Model !== 'undefined') ? Model : require('./model.js');
  const N = {};

  N.PROCESS = [
    { id: 'screening', label: 'スクリーニング' },
    { id: 'assessment', label: 'アセスメント' },
    { id: 'monitoring', label: 'モニタリング' }
  ];
  N.LEVELS = [{ id: 'low', label: '低' }, { id: 'mid', label: '中' }, { id: 'high', label: '高' }];
  N.FEEDING = [
    { id: 'oral', label: '経口のみ' }, { id: 'partial', label: '一部経口' },
    { id: 'enteral', label: '経腸栄養法', midRisk: true }, { id: 'parenteral', label: '静脈栄養法', midRisk: true }
  ];
  N.EVAL = [{ id: 'improved', label: '改善' }, { id: 'improving', label: '改善傾向' }, { id: 'maintained', label: '維持' }, { id: 'not', label: '改善が認められない' }];
  N.FIVE = ['よい', 'まあよい', 'ふつう', 'あまりよくない', 'よくない'];
  N.FIVE_SAT = ['大いにある', 'ややある', 'ふつう', 'ややない', '全くない'];
  // 多職種による栄養ケアの課題（様式4-1-1）
  N.ISSUES_ORAL = ['安定した正しい姿勢が自分で取れない', '食事に集中することができない', '食事中に傾眠や意識混濁がある',
    '歯（義歯）のない状態で食事をしている', '食べ物を口腔内に溜め込む', '固形の食べ物を咀しゃく中にむせる',
    '食後、頬の内側や口腔内に残渣がある', '水分でむせる', '食事中、食後に咳をすることがある'];
  N.ISSUES_OTHER = ['褥瘡', '生活機能低下', '嘔気・嘔吐', '下痢', '便秘', '浮腫', '脱水', '感染', '発熱', '閉じこもり', 'うつ', '認知症', '薬の影響'];
  N.GLIM = [{ id: '', label: '（記入しない）' }, { id: 'no', label: '低栄養 非該当' }, { id: 'mid', label: '低栄養（中等度）' }, { id: 'severe', label: '低栄養（重度）' }];
  // 経口維持加算を算定する場合の欄
  N.JOBS = ['医師', '歯科医師', '管理栄養士', '栄養士', '歯科衛生士', '言語聴覚士', '作業療法士', '理学療法士', '看護職員', '介護職員', '介護支援専門員'];
  N.TESTS = ['水飲みテスト', '頚部聴診法', '嚥下内視鏡検査', '嚥下造影検査', '咀嚼能力・機能の検査', '認知機能に課題あり（検査不可のため食事の観察にて確認）', 'その他'];
  N.MEETING_ITEMS = ['食事の形態・とろみ、補助食の活用', '食事の周囲環境', '食事の介助の方法', '口腔のケアの方法', '医療又は歯科医療受療の必要性'];

  // 期限の既定（設定で変えられる）。中リスクは通知に数値が無く、施設が計画書に定める
  N.DEFAULT_INTERVALS = { low: 90, mid: 30, high: 14, rescreen: 90, firstWithin: 7, planReview: 90 };
  N.intervals = function (masters) { return Object.assign({}, N.DEFAULT_INTERVALS, (masters && masters.ncm) || {}); };

  N.empty = function (residentId, date) {
    return { id: '', residentId: residentId, date: date, process: 'monitoring', by: '',
      level: '', levelManual: false,
      body: { heightCm: null, weightKg: null, loss1: null, loss3: null, loss6: null, ulcer: false, feeding: '', other: '' },
      intake: { pct: null, staple: null, side: null, other: '' },
      nut: { inKcal: null, inProt: null, outKcal: null, outProt: null, needKcal: null, needProt: null },
      swallow: { need: false, code: '', thick: '' },
      caution: { has: false, text: '' },
      will: { motivation: 0, satisfaction: 0, attitude: 0 },
      issues: [], special: '', evaluation: '', planChange: false, glim: '',
      iji: null,
      recordedAt: 0 };
  };
  N.normalize = function (r) {
    const e = N.empty(r.residentId, r.date);
    const out = Object.assign(e, r);
    ['body', 'intake', 'nut', 'swallow', 'caution', 'will'].forEach((k) => { out[k] = Object.assign(e[k], r[k] || {}); });
    out.issues = r.issues || [];
    return out;
  };

  // 記録から低栄養リスクの候補を出す（人が上書きできる。制度上 BMI・摂取量・補給法は高へ上げられる）
  N.autoLevel = function (rec, th) {
    const b = rec.body || {};
    const bmi = M.bmi(b.weightKg, b.heightCm);
    const feeding = N.FEEDING.find((f) => f.id === b.feeding);
    const r = M.risk({
      bmi: bmi,
      loss: { m1: b.loss1, m3: b.loss3, m6: b.loss6 },
      intake: (rec.intake && rec.intake.pct != null) ? rec.intake.pct : null,
      tube: !!(feeding && feeding.midRisk),
      pressureUlcer: !!b.ulcer
    }, th);
    return { level: r.level, reasons: r.reasons, bmi: bmi };
  };

  // 次にいつやるか。records = 記録の一覧（順不同でよい）
  N.nextDue = function (resident, records, masters, today) {
    const iv = N.intervals(masters);
    const mine = (records || []).filter((r) => r.residentId === resident.id).slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    const live = (resident.stays || []).filter((s) => !s.cancelledAt).sort((a, b) => a.from.d.localeCompare(b.from.d));
    const cur = live.filter((s) => s.from.d <= today);
    const since = cur.length ? cur[cur.length - 1].from.d : (live[0] ? live[0].from.d : null);
    if (!mine.length) {
      const due = since ? M.addDays(since, iv.firstWithin) : today;
      return { kind: 'first', due: due, last: null, lastLevel: null,
        overdueDays: Math.max(0, M.dayNum(today) - M.dayNum(due)),
        reason: '入所からおおむね' + iv.firstWithin + '日以内に最初のスクリーニング' };
    }
    const last = mine[mine.length - 1];
    const lastLevel = last.level || null;
    const days = iv[lastLevel] || iv.mid;
    const dueMon = M.addDays(last.date, days);
    const lastScr = mine.filter((r) => r.process === 'screening').slice(-1)[0];
    const dueScr = M.addDays((lastScr || mine[0]).date, iv.rescreen);
    const useScr = M.dayNum(dueScr) <= M.dayNum(dueMon);
    const due = useScr ? dueScr : dueMon;
    const lv = N.LEVELS.find((l) => l.id === lastLevel);
    return { kind: useScr ? 'rescreen' : 'monitor', due: due, last: last, lastLevel: lastLevel,
      overdueDays: Math.max(0, M.dayNum(today) - M.dayNum(due)),
      reason: useScr ? '再スクリーニング（全員 ' + iv.rescreen + ' 日毎）'
        : 'モニタリング（' + (lv ? lv.label : '未判定') + 'リスクは ' + days + ' 日毎）' };
  };

  // 前回の記録を写して新しい記録を作る（変わった所だけ直す運用）
  N.copyFrom = function (prev, date, process) {
    const r = N.normalize(JSON.parse(JSON.stringify(prev)));
    r.id = ''; r.date = date; r.process = process || 'monitoring';
    r.recordedAt = 0; r.special = ''; r.evaluation = ''; r.planChange = false;
    if (r.iji) {
      r.iji = Object.assign({}, r.iji, {
        observe: { members: (r.iji.observe || {}).members || [], date: '' },
        meeting: { members: (r.iji.meeting || {}).members || [], date: '', items: {} }, note: '' });
    }
    return r;
  };

  // 期限の一覧。soonDays 日以内に来るもの（過ぎたものを含む）
  N.dueList = function (residents, records, masters, today, soonDays) {
    const soon = soonDays == null ? 7 : soonDays;
    const out = [];
    residents.forEach((r) => {
      if (r.archived) return;
      if (M.status(r, today, masters.meals) !== 'in') return;
      const d = N.nextDue(r, records, masters, today);
      const left = M.dayNum(d.due) - M.dayNum(today);
      if (left <= soon) out.push(Object.assign({ resident: r, daysLeft: left }, d));
    });
    return out.sort((a, b) => a.daysLeft - b.daysLeft ||
      (a.resident.unit + a.resident.room).localeCompare(b.resident.unit + b.resident.room, 'ja'));
  };

  // 計画書（様式4-1-2）。分類は様式の選択肢
  N.PLAN_CATEGORIES = ['栄養補給・食事', '栄養食事相談', '経口移行の支援', '経口維持の支援', '多職種による課題の解決'];
  // 算定加算のチェック欄（様式4-1-2 の「算定加算」）
  N.PLAN_ADDONS = [
    { id: 'kyoka', label: '栄養マネジメント強化加算' },
    { id: 'ikou', label: '経口移行加算' },
    { id: 'iji1', label: '経口維持加算（Ⅰ）' },
    { id: 'iji2', label: '経口維持加算（Ⅱ）' },
    { id: 'ryoyo', label: '療養食加算' }
  ];
  N.emptyPlan = function (residentId, date) {
    return { id: '', residentId: residentId, firstAt: date, updatedAt: date, author: '',
      wish: '', explainedAt: '', explainedBy: '', needs: '', level: '',
      longGoal: '', longTerm: '', rows: [], special: '', addons: [], progress: [],
      recordedAt: 0 };
  };
  N.normalizePlan = function (p) {
    const e = N.emptyPlan(p.residentId, p.updatedAt || p.firstAt);
    const out = Object.assign(e, p);
    out.rows = (p.rows || []).map((r) => Object.assign({ cat: '', goal: '', term: '', care: '', freq: '', who: '' }, r));
    out.addons = p.addons || [];
    out.progress = (p.progress || []).map((x) => Object.assign({ date: '', text: '', by: '' }, x));
    return out;
  };
  // 計画を見直す（前の版を写して新しい版を作る）。経過記録は引き継がない（新しい用紙になる）
  N.revisePlan = function (prev, date) {
    const p = N.normalizePlan(JSON.parse(JSON.stringify(prev)));
    p.id = ''; p.updatedAt = date; p.recordedAt = 0;
    p.explainedAt = ''; p.progress = [];
    return p;
  };
  // 計画の状態。返り値 { has, current, staleDays, needsReview }
  N.planState = function (plans, residentId, masters, today) {
    const mine = (plans || []).filter((p) => p.residentId === residentId)
      .sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || '') || (a.recordedAt || 0) - (b.recordedAt || 0));
    const cur = mine[mine.length - 1] || null;
    const iv = N.intervals(masters);
    const days = cur ? M.dayNum(today) - M.dayNum(cur.updatedAt) : null;
    return { has: !!cur, current: cur, all: mine, staleDays: days,
      needsReview: !cur || days >= (iv.planReview || 90) };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = N;
  root.NCM = N;
})(typeof window !== 'undefined' ? window : globalThis);
