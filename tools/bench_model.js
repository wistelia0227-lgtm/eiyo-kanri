// 栄養管理アプリの主要計算モジュールの処理速度を計測するベンチマークスクリプト
// Node.js 標準機能のみを使用し、食数計算・食札・献立チェック・栄養集計・同期処理等を測定
// 実行方法: C:/AI/_setup/node/node.exe tools/bench_model.js
'use strict';

global.window = global;

const M = require('../js/model.js');
const Master = require('../js/master.js');
const AS = require('../js/allergy_sheet.js');
const S = require('../js/sync.js');
require('../js/foods_data.js');
require('../js/dishes_seed.js');
const N = require('../js/nutri.js');
N.load(global.FOODS_DATA);

let seed = 123456789;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

function makeResidents(masters) {
  let seq = 0;
  const uid = (p) => p + (++seq);
  const residents = [];
  const shokushus = masters.shokushu;
  const allergens = masters.allergens;

  for (let i = 0; i < 300; i++) {
    const shokushuId = shokushus[i % shokushus.length].id;
    const allergy = [];
    if (rand() < 0.4) {
      const count = rand() < 0.5 ? 1 : 2;
      for (let c = 0; c < count; c++) {
        const idx = Math.floor(rand() * allergens.length);
        const item = allergens[idx];
        if (!allergy.includes(item)) allergy.push(item);
      }
    }
    const kinshi = [];
    if (rand() < 0.3) {
      kinshi.push({ food: '納豆', sub: '豆腐' });
    }

    const r = M.normalizeResident(Object.assign(M.newResident('利用者' + i, uid), {
      unit: 'U' + (i % 6),
      room: String(100 + i),
      stays: [{ id: uid('s'), from: { d: '2025-01-01', m: 'b' }, to: null, recordedAt: 1 }],
      diet: [{
        id: uid('v'),
        from: { d: '2025-01-01', m: 'b' },
        data: Object.assign(M.emptyDiet(), {
          shokushu: shokushuId,
          allergy: allergy,
          kinshi: kinshi
        }),
        recordedAt: 1
      }]
    }));
    residents.push(r);
  }
  return residents;
}

function makeDishes() {
  const seeds = global.DISHES_SEED.dishes;
  const dishes = [];
  const dishMap = {};

  for (let i = 1; i <= 2000; i++) {
    const seedDish = seeds[(i - 1) % seeds.length];
    const id = 'd' + i;
    const name = seedDish.name + '(' + i + ')';
    const dish = {
      id: id,
      name: name,
      kind: seedDish.kind,
      items: seedDish.items ? seedDish.items.slice() : [],
      allergy: seedDish.allergy ? seedDish.allergy.slice() : []
    };
    dishes.push(dish);
    dishMap[id] = dish;
  }
  return { dishes, dishMap };
}

function makeDates() {
  const dates = [];
  const start = new Date(2025, 0, 1);
  for (let i = 0; i < 365; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(yyyy + '-' + mm + '-' + dd);
  }
  return dates;
}

function makeMenus(dates, activeMeals, shokushu3, dishes) {
  const menus = {};
  let dishIndex = 0;

  for (const date of dates) {
    const cells = {};
    for (const meal of activeMeals) {
      for (const shokushu of shokushu3) {
        const key = meal.id + '/' + shokushu.id;
        const dishItems = [];
        for (let k = 0; k < 5; k++) {
          const d = dishes[dishIndex % dishes.length];
          dishIndex++;
          dishItems.push({ dishId: d.id, name: d.name, x: 1 });
        }
        cells[key] = dishItems;
      }
    }
    menus[date] = { date: date, cells: cells };
  }
  return menus;
}

const results = {};

function bench(name, times, fn) {
  if (times > 0) {
    fn(0);
  }

  const start = process.hrtime.bigint();
  for (let i = 0; i < times; i++) {
    fn(i);
  }
  const elapsedNs = process.hrtime.bigint() - start;
  const totalMs = Number(elapsedNs) / 1e6;
  const avgMs = times > 0 ? totalMs / times : 0;
  results[name] = Math.round(totalMs * 100) / 100;

  const nameStr = name.padEnd(20, ' ');
  const timesStr = String(times).padStart(8, ' ');
  const totalMsStr = totalMs.toFixed(2).padStart(10, ' ');
  const avgMsStr = avgMs.toFixed(4).padStart(10, ' ');
  const warn = totalMs > 1000 ? ' ★1秒超' : '';

  console.log(nameStr + '  ' + timesStr + '  ' + totalMsStr + 'ms  ' + avgMsStr + 'ms/回' + warn);
}

function main() {
  const masters = Master.DEFAULTS;
  const activeMeals = M.activeMeals(masters);
  const shokushu3 = masters.shokushu.slice(0, 3);
  const residents = makeResidents(masters);
  const { dishes, dishMap } = makeDishes();
  const dates = makeDates();
  const menus = makeMenus(dates, activeMeals, shokushu3, dishes);

  const slots = [];
  for (const d of dates) {
    for (const m of activeMeals) {
      slots.push({ d: d, m: m.id });
    }
  }

  bench('食数', slots.length, (idx) => {
    M.census(residents, slots[idx], masters);
  });

  bench('食札', slots.length, (idx) => {
    const slot = slots[idx];
    const list = M.census(residents, slot, masters);
    M.cardChangedIds(residents, slot.d, masters);
    for (let i = 0; i < list.length; i++) {
      M.dietAt(list[i], slot, masters.meals);
    }
  });

  function prepareRestrictionsTasks(numDays) {
    const tasks = [];
    for (let i = 0; i < numDays; i++) {
      const d = dates[i];
      for (const m of activeMeals) {
        for (const s of shokushu3) {
          const key = m.id + '/' + s.id;
          const items = menus[d].cells[key] || [];
          let words = [];
          for (let k = 0; k < items.length; k++) {
            const dish = dishMap[items[k].dishId];
            if (dish) {
              words = words.concat([dish.name], dish.items.map(it => it.name), dish.allergy || []);
            }
          }
          tasks.push({ slot: { d: d, m: m.id }, words: words });
        }
      }
    }
    return tasks;
  }

  const tasks14 = prepareRestrictionsTasks(14);
  bench('献立の注意（14日）', tasks14.length, (idx) => {
    const t = tasks14[idx];
    M.restrictionsAt(residents, t.slot, masters, t.words);
  });

  const tasks365 = prepareRestrictionsTasks(365);
  bench('献立の注意（1年）', tasks365.length, (idx) => {
    const t = tasks365[idx];
    M.restrictionsAt(residents, t.slot, masters, t.words);
  });

  bench('アレルギー表', slots.length, (idx) => {
    const slot = slots[idx];
    AS.build(residents, dishMap, menus[slot.d], slot, masters);
  });

  function prepareNutriTasks(numDays) {
    const tasks = [];
    for (let i = 0; i < numDays; i++) {
      const d = dates[i];
      for (const m of activeMeals) {
        for (const s of shokushu3) {
          const key = m.id + '/' + s.id;
          tasks.push(menus[d].cells[key] || []);
        }
      }
    }
    return tasks;
  }

  const nutTasks31 = prepareNutriTasks(31);
  bench('帳票（栄養1か月）', nutTasks31.length, (idx) => {
    const items = nutTasks31[idx];
    let accum = null;
    for (let k = 0; k < items.length; k++) {
      const dish = dishMap[items[k].dishId];
      if (dish && dish.items) {
        const itemSum = N.sum(dish.items.map(it => ({ no: it.no, g: it.g })));
        accum = accum ? N.add(accum, itemSum) : itemSum;
      }
    }
  });

  const nutTasks365 = prepareNutriTasks(365);
  bench('帳票（栄養1年）', nutTasks365.length, (idx) => {
    const items = nutTasks365[idx];
    let accum = null;
    for (let k = 0; k < items.length; k++) {
      const dish = dishMap[items[k].dishId];
      if (dish && dish.items) {
        const itemSum = N.sum(dish.items.map(it => ({ no: it.no, g: it.g })));
        accum = accum ? N.add(accum, itemSum) : itemSum;
      }
    }
  });

  const resA = residents.map(r => Object.assign({}, r, { _at: 1700000000000, _by: 'a' }));
  const resB = JSON.parse(JSON.stringify(resA));
  for (let i = 0; i < 100; i++) {
    const r = resB[i];
    r._at = 1700000001000;
    r._by = 'b';
    if (r.diet && r.diet.length > 0) {
      const last = r.diet[r.diet.length - 1];
      const nextDiet = JSON.parse(JSON.stringify(last));
      nextDiet.id = 'v_b_' + i;
      nextDiet.recordedAt = 1700000001000;
      r.diet.push(nextDiet);
    }
  }

  bench('突き合わせ', 1, () => {
    const local = S.pack({ residents: resA }, [], 'pcA', 1700000000000);
    const remote = S.pack({ residents: resB }, [], 'pcB', 1700000000000);
    S.merge(local, remote, 1700000000000, { meals: masters.meals });
  });

  console.log(JSON.stringify(results));
  process.exit(0);
}

main();