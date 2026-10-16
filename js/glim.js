// GLIM 基準（低栄養の診断）の計算モジュール
//
// 出典:
//   日本臨床栄養代謝学会 GLIM ワーキンググループ「GLIM 基準について」2024.10.10 改訂版
//   https://www.jspen.or.jp/glim/glim_overview
//   同 GLIM FAQ 2024.3.19 版 https://www.jspen.or.jp/glim/glim_faq
//
// 注意（アジア人の重度基準について）:
//   GLIM 基準においてアジア人では「体重減少」のみ重度の基準値（6か月以内 >10%、6か月超 >20%）が示されており、
//   低BMI および筋肉量減少の重度基準値は明確に定められておらず施設・地域の合意等に委ねられている。
//   そのため G.CUT.severe の bmiUnder70 / bmiFrom70 / ccM / ccF の既定値は null（未設定）とし、
//   任意の数値を勝手に代入しない。

(function (root) {
  'use strict';
  const G = {};

  G.CUT = {
    loss:  { m6: 5, over6: 10, severeM6: 10, severeOver6: 20 },
    bmi:   { under70: 18.5, from70: 20, age: 70 },
    cc:    { acute: { m: 30, f: 29 }, kaifuku: { m: 33, f: 32 }, bmiAdj: { m: 33, f: 32 } },
    severe: { bmiUnder70: null, bmiFrom70: null, ccM: null, ccF: null }
  };

  G.CC_SETS = [
    { id: 'acute',   label: '急性期病棟（男30・女29）' },
    { id: 'kaifuku', label: '回復期病棟（男33・女32）' },
    { id: 'bmiAdj',  label: 'BMI で補正（男33・女32。BMI 25〜29.9 は −3cm、30〜40 は −7cm）' }
  ];

  G.SEVERITY_LABEL = {
    severe: '重度低栄養',
    moderate: '中等度低栄養'
  };

  const LABELS = {
    loss: '意図しない体重減少',
    bmi: '低BMI',
    muscle: '筋肉量減少',
    intake: '食事摂取量減少／消化吸収能低下',
    disease: '疾患負荷／炎症'
  };

  const SHORT_PHENOS = {
    loss: '体重減少',
    bmi: '低BMI',
    muscle: '筋肉量減少'
  };

  G.label = function (id) {
    return LABELS[id] || '';
  };

  G.ccCut = function (sex, ccSet, bmi, cut) {
    const c = cut || G.CUT;
    const setKey = ccSet || 'acute';
    const isMale = (sex === 'm');
    const baseCut = (c.cc[setKey] ? (isMale ? c.cc[setKey].m : c.cc[setKey].f) : (isMale ? 30 : 29));
    let adj = 0;

    if (setKey === 'bmiAdj') {
      if (typeof bmi === 'number' && !isNaN(bmi)) {
        if (bmi >= 25 && bmi <= 29.9) {
          adj = -3;
        } else if (bmi >= 30 && bmi <= 40) {
          adj = -7;
        } else {
          adj = 0;
        }
      } else {
        adj = 0;
      }
    }

    return { cut: baseCut, adj: adj };
  };

  G.assess = function (input, cut) {
    const c = cut || G.CUT;
    const p = input || {};
    const lacking = [];
    const severeUnknown = [];

    const screened = (p.screened !== undefined && p.screened !== null) ? !!p.screened : true;

    // 1. 表現型基準: 意図しない体重減少 (loss)
    let phenoLossHit = false;
    let phenoLossSevere = false;
    const phenoLossSevereUnknown = false;
    let phenoLossWhy = '';
    const lossVal = (typeof p.loss === 'number' && !isNaN(p.loss)) ? p.loss : null;

    if (lossVal === null) {
      phenoLossWhy = '記録が無い';
      lacking.push('体重の変化');
    } else {
      const months = (typeof p.lossMonths === 'number' && !isNaN(p.lossMonths)) ? p.lossMonths : 6;
      const cutHit = (months <= 6) ? c.loss.m6 : c.loss.over6;
      const cutSev = (months <= 6) ? c.loss.severeM6 : c.loss.severeOver6;

      if (lossVal > cutHit) {
        phenoLossHit = true;
      }
      if (lossVal > cutSev) {
        phenoLossSevere = true;
      }

      const monthText = months + 'か月' + (months <= 6 ? '以内' : '超');
      phenoLossWhy = monthText + 'に ' + (Math.round(lossVal * 10) / 10) + '% 減（基準: ' + cutHit + '% 超' + (phenoLossHit ? 'を満たす' : '以下') + '）';
    }

    const phenoLossObj = {
      id: 'loss',
      label: G.label('loss'),
      hit: phenoLossHit,
      severe: phenoLossSevere,
      severeUnknown: phenoLossSevereUnknown,
      value: lossVal,
      cut: (lossVal !== null) ? ((p.lossMonths || 6) <= 6 ? c.loss.m6 : c.loss.over6) : null,
      why: phenoLossWhy
    };

    // 2. 表現型基準: 低BMI (bmi)
    let phenoBmiHit = false;
    let phenoBmiSevere = false;
    let phenoBmiSevereUnknown = false;
    let phenoBmiWhy = '';
    const bmiVal = (typeof p.bmi === 'number' && !isNaN(p.bmi)) ? p.bmi : null;
    let bmiCutVal = null;

    if (bmiVal === null) {
      phenoBmiWhy = '記録が無い';
      lacking.push('BMI（身長か体重）');
    } else {
      const hasAge = (typeof p.age === 'number' && !isNaN(p.age));
      const isOld = hasAge ? (p.age >= c.bmi.age) : true;
      bmiCutVal = isOld ? c.bmi.from70 : c.bmi.under70;

      if (bmiVal < bmiCutVal) {
        phenoBmiHit = true;
      }

      const sevThreshold = isOld ? c.severe.bmiFrom70 : c.severe.bmiUnder70;
      if (typeof sevThreshold === 'number' && sevThreshold !== null) {
        if (bmiVal < sevThreshold) {
          phenoBmiSevere = true;
        }
      } else {
        phenoBmiSevereUnknown = true;
        severeUnknown.push('bmi');
      }

      const ageNote = hasAge ? (p.age + '歳') : '年齢不明のため' + c.bmi.age + '歳以上の基準を適用';
      phenoBmiWhy = 'BMI ' + (Math.round(bmiVal * 10) / 10) + '（' + ageNote + '、基準: ' + bmiCutVal + ' 未満' + (phenoBmiHit ? 'を満たす' : '以上') + '）';
    }

    const phenoBmiObj = {
      id: 'bmi',
      label: G.label('bmi'),
      hit: phenoBmiHit,
      severe: phenoBmiSevere,
      severeUnknown: phenoBmiSevereUnknown,
      value: bmiVal,
      cut: bmiCutVal,
      why: phenoBmiWhy
    };

    // 3. 表現型基準: 筋肉量減少 (muscle)
    let phenoMuscleHit = false;
    let phenoMuscleSevere = false;
    let phenoMuscleSevereUnknown = false;
    let phenoMuscleWhy = '';
    const ccVal = (typeof p.cc === 'number' && !isNaN(p.cc)) ? p.cc : null;
    const ccCutInfo = G.ccCut(p.sex, p.ccSet, bmiVal, c);
    const muscleCutEffective = ccCutInfo.cut + ccCutInfo.adj;

    if (p.muscleLow === true) {
      phenoMuscleHit = true;
      phenoMuscleWhy = '筋肉量減少あり（評価による判定）';
      const isMaleManual = (p.sex === 'm');
      const ccSevThresholdManual = isMaleManual ? c.severe.ccM : c.severe.ccF;
      if (typeof ccSevThresholdManual === 'number' && ccSevThresholdManual !== null) {
        if (ccVal !== null && ccVal < ccSevThresholdManual) {
          phenoMuscleSevere = true;
        }
      } else {
        phenoMuscleSevereUnknown = true;
        severeUnknown.push('muscle');
      }
    } else if (ccVal !== null) {
      if (ccVal < muscleCutEffective) {
        phenoMuscleHit = true;
      }
      const isMale = (p.sex === 'm');
      const ccSevThreshold = isMale ? c.severe.ccM : c.severe.ccF;
      if (typeof ccSevThreshold === 'number' && ccSevThreshold !== null) {
        if (ccVal < ccSevThreshold) {
          phenoMuscleSevere = true;
        }
      } else {
        phenoMuscleSevereUnknown = true;
        severeUnknown.push('muscle');
      }
      const adjText = ccCutInfo.adj !== 0 ? '（補正後 ' + muscleCutEffective + 'cm）' : '';
      phenoMuscleWhy = '下腿周囲長 ' + (Math.round(ccVal * 10) / 10) + 'cm（基準: ' + ccCutInfo.cut + 'cm' + adjText + ' 未満' + (phenoMuscleHit ? 'を満たす' : '以上') + '）';
    } else {
      phenoMuscleWhy = '記録が無い';
      lacking.push('下腿周囲長');
      const isMaleEmpty = (p.sex === 'm');
      const ccSevThresholdEmpty = isMaleEmpty ? c.severe.ccM : c.severe.ccF;
      if (typeof ccSevThresholdEmpty !== 'number' || ccSevThresholdEmpty === null) {
        phenoMuscleSevereUnknown = true;
        severeUnknown.push('muscle');
      }
    }

    const phenoMuscleObj = {
      id: 'muscle',
      label: G.label('muscle'),
      hit: phenoMuscleHit,
      severe: phenoMuscleSevere,
      severeUnknown: phenoMuscleSevereUnknown,
      value: (p.muscleLow === true) ? '判定あり' : ccVal,
      cut: (p.muscleLow === true) ? null : muscleCutEffective,
      why: phenoMuscleWhy
    };

    // 4. 病因基準: 食事摂取量減少／消化吸収能低下 (intake)
    const intakeHit = !!(p.intakeLow1 || p.intakeLow2 || p.giChronic);
    const intakeWhys = [];
    if (p.intakeLow1) intakeWhys.push('1週間以上の摂取量50%以下');
    if (p.intakeLow2) intakeWhys.push('2週間以上の食事摂取量減少');
    if (p.giChronic) intakeWhys.push('慢性的な消化管疾患・吸収障害');
    const intakeWhy = intakeHit ? intakeWhys.join('、') : '該当する摂取量低下・消化管症状なし';

    const etioIntakeObj = {
      id: 'intake',
      label: G.label('intake'),
      hit: intakeHit,
      why: intakeWhy
    };

    // 5. 病因基準: 疾患負荷／炎症 (disease)
    const diseaseHit = !!(p.acute || p.chronic);
    const diseaseWhys = [];
    if (p.acute) diseaseWhys.push('急性疾患・外傷・感染による炎症');
    if (p.chronic) diseaseWhys.push('慢性疾患による炎症');
    const diseaseWhy = diseaseHit ? diseaseWhys.join('、') : '該当する疾患負荷・炎症なし';

    const etioDiseaseObj = {
      id: 'disease',
      label: G.label('disease'),
      hit: diseaseHit,
      why: diseaseWhy
    };

    const phenoHitCount = (phenoLossHit ? 1 : 0) + (phenoBmiHit ? 1 : 0) + (phenoMuscleHit ? 1 : 0);
    const etioHitCount = (intakeHit ? 1 : 0) + (diseaseHit ? 1 : 0);

    const malnutrition = screened && (phenoHitCount >= 1) && (etioHitCount >= 1);

    let severity = null;
    if (malnutrition) {
      const isSevere = phenoLossSevere || phenoBmiSevere || phenoMuscleSevere;
      severity = isSevere ? 'severe' : 'moderate';
    }

    return {
      pheno: [phenoLossObj, phenoBmiObj, phenoMuscleObj],
      etio: [etioIntakeObj, etioDiseaseObj],
      phenoHit: phenoHitCount,
      etioHit: etioHitCount,
      malnutrition: malnutrition,
      severity: severity,
      severeUnknown: severeUnknown,
      lacking: lacking,
      screened: screened
    };
  };

  G.words = function (result) {
    if (!result || !result.malnutrition) {
      return '低栄養には当てはまりません';
    }

    const sevText = G.SEVERITY_LABEL[result.severity] || '低栄養';
    const hitPhenoNames = [];
    if (result.pheno && result.pheno.length) {
      for (let i = 0; i < result.pheno.length; i++) {
        const item = result.pheno[i];
        if (item.hit) {
          hitPhenoNames.push(SHORT_PHENOS[item.id] || item.label);
        }
      }
    }

    let text = sevText;
    if (hitPhenoNames.length > 0) {
      text += '（' + hitPhenoNames.join('・') + '）';
    }

    if (result.severeUnknown && result.severeUnknown.length > 0) {
      const unknownLabels = [];
      for (let j = 0; j < result.severeUnknown.length; j++) {
        const uId = result.severeUnknown[j];
        unknownLabels.push(SHORT_PHENOS[uId] || G.label(uId));
      }
      text += '（' + unknownLabels.join('・') + 'は重度の基準値が未設定）';
    }

    return text;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  root.Glim = G;
})(typeof window !== 'undefined' ? window : globalThis);