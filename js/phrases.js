// 欄ごとの文例（削除不可の基盤）。window.Phrases で公開。
// 献ダテマンの「緑の本マーク → チェックで選んで 選択／追加選択、鉛筆で今の文を登録」と、
// ケアライズの「入力欄ごとに別の文章リスト」を真似た。共通の定型文 1 個では役に立たない（欄ごとに語彙が違う）。
(function (root) {
  'use strict';
  const P = {};

  // 欄の定義。id は保存のキー、label は文例の管理画面に出す名前
  P.FIELDS = [
    { id: 'ncm.special', label: '栄養ケア 特記事項' },
    { id: 'ncm.other', label: '栄養ケア リスクのその他' },
    { id: 'ncm.intakeOther', label: '栄養ケア 補助食品など' },
    { id: 'ncm.caution', label: '栄養ケア 食事の留意事項' },
    { id: 'round.note', label: 'ミールラウンドの気づき' },
    { id: 'diet.reason', label: '食事変更の理由' },
    { id: 'diet.notes', label: '食札に出す注意' },
    { id: 'plan.needs', label: '計画 解決すべき課題' },
    { id: 'plan.goal', label: '計画 目標' },
    { id: 'plan.care', label: '計画 栄養ケアの具体的内容' },
    { id: 'journal.kenshoku', label: '検食簿 所見' },
    { id: 'journal.nisshi', label: '給食日誌' }
  ];

  // 初期の文例（導入初日から使えるように。施設で足す・消す・直すことが前提）
  P.DEFAULTS = {
    'ncm.special': [
      '体重・摂取量とも安定しており、現在の食事内容を継続する。',
      '体重減少が続いているため、栄養補助食品の追加を検討する。',
      'むせ込みが増えており、食形態・とろみの見直しを看護師と相談した。',
      '食事摂取量が低下している。嗜好を聞き取り、代替品を用意する。',
      '発熱・感染により一時的に摂取量が低下したが、回復傾向にある。',
      '義歯の不適合があり、歯科受診を依頼した。',
      '家族の希望で食形態を上げた。誤嚥のリスクを説明し、医師・看護師に確認済み。',
      '食事の姿勢が崩れやすいため、クッションで調整することとした。',
      '食事時間が延びているため、介助の方法を見直した。'
    ],
    'ncm.other': ['認知症の進行により食事の認識が困難', '長期臥床', '経管栄養からの移行中', '術後の回復期'],
    'ncm.intakeOther': ['高カロリーゼリー 1個/日', '栄養補助飲料 125ml/日', 'とろみ茶 適宜', 'おやつ 半量'],
    'ncm.caution': ['療養食（医師の食事箋あり）', 'アレルギー対応食', '刻み・とろみあり', '自助具を使用', '一口量を少なめに', '交互嚥下'],
    'round.note': [
      'むせ込みなく完食された。',
      '汁物でむせ込みあり。とろみを検討する。',
      '途中で手が止まり、声かけで再開された。',
      '主食は進むが副菜が残る。',
      '姿勢が崩れやすく、途中で座り直しを介助した。',
      '義歯が合わず、咀嚼に時間がかかっていた。',
      '食事に集中できず、周囲の音に反応していた。',
      '自分で召し上がれていた。介助は不要。'
    ],
    'diet.reason': [
      'むせ込みが増えたため', '食事摂取量の低下のため', '体重減少のため', '医師の指示のため',
      '嚥下機能の低下のため', '義歯の不適合のため', '本人・家族の希望のため', '退院後の指示のため', '状態が改善したため'
    ],
    'diet.notes': ['冷まして提供', '一口量を少なめに', '交互嚥下', '声かけをしながら', '最後に水分を', '半分ずつ提供'],
    'plan.needs': [
      '低栄養状態の改善が必要', '体重減少の予防が必要', '嚥下機能に応じた食形態の調整が必要',
      '食事摂取量の維持・向上が必要', '本人の好みに合った食事の提供が必要', '誤嚥性肺炎の予防が必要'
    ],
    'plan.goal': [
      '体重を維持する', '食事摂取量を8割以上に保つ', 'むせ込みなく食事ができる',
      '好きな物を安全に食べられる', '経口摂取を継続する', '低栄養リスクを中から低にする'
    ],
    'plan.care': [
      '毎食の摂取量を記録し、週1回まとめて確認する（担当: 介護職員）',
      '月1回体重を測定する（担当: 看護職員）',
      '食事の観察を週3回以上行い、対応を記録する（担当: 管理栄養士）',
      '栄養補助食品を1日1個提供する（担当: 管理栄養士）',
      '食形態・とろみを状態に合わせて見直す（担当: 管理栄養士・看護職員）',
      '嗜好を聞き取り、献立に反映する（担当: 管理栄養士）'
    ],
    'journal.kenshoku': [
      '量・味付け・温度とも適切であった。',
      '味付けがやや濃い。次回は調味を控える。',
      '主菜が冷めていた。配膳の時間を見直す。',
      'きざみの大きさが不ぞろい。調理担当に伝えた。',
      '彩りが乏しい。緑の野菜を足すとよい。',
      '汁物の温度が低かった。保温に注意する。',
      '異物・異臭なし。衛生面の問題は認めない。',
      '量が多く、残食が出そうである。'
    ],
    'journal.nisshi': [
      '特記事項なし。',
      '欠員なく通常どおり実施した。',
      '納品に遅れがあり、献立の一部を変更した。',
      '行事食を提供した。',
      '残食が多かったため、次回の量を調整する。',
      '設備の不具合があり、業者に連絡した。'
    ]
  };

  P.merge = function (saved) {
    const out = {};
    P.FIELDS.forEach((f) => {
      out[f.id] = (saved && saved[f.id]) ? saved[f.id].slice() : (P.DEFAULTS[f.id] || []).slice();
    });
    Object.keys(saved || {}).forEach((k) => { if (!out[k]) out[k] = saved[k].slice(); });
    return out;
  };
  P.get = function (masters, key) { return (masters.phrases && masters.phrases[key]) || []; };
  P.label = function (key) { const f = P.FIELDS.find((x) => x.id === key); return f ? f.label : key; };
  // 今の文を文例に足す（重複は足さない）。足したら true
  P.add = function (masters, key, text) {
    text = String(text || '').trim();
    if (!text) return false;
    masters.phrases = masters.phrases || {};
    const list = masters.phrases[key] = masters.phrases[key] || [];
    if (list.indexOf(text) >= 0) return false;
    list.push(text);
    return true;
  };
  // 選んだ文をつなぐ。mode 'replace' なら置き換え、'append' なら今の文の後ろに足す
  P.apply = function (current, picked, mode, sep) {
    const joined = picked.join(sep == null ? '\n' : sep);
    if (mode === 'append' && String(current || '').trim()) return String(current).replace(/\s+$/, '') + (sep == null ? '\n' : sep) + joined;
    return joined;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P;
  root.Phrases = P;
})(typeof window !== 'undefined' ? window : globalThis);
