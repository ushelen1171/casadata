#!/usr/bin/env node
// enrich_regions.js
// Вычисляет динамические поля роста из idealista_raw.json и обновляет REGIONS в data.js.
// Запуск: node enrich_regions.js
'use strict';

const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const DATA_JS     = path.join(ROOT, 'js', 'data.js');
const RAW_JSON    = path.join(ROOT, 'data', 'idealista_raw.json');
// data.js использует глобалы DEFAULTS и ITP_RATES из соседних файлов —
// без их загрузки в vm-контекст REGIONS не сформируется.
const DEFAULTS_JS = path.join(ROOT, 'js', 'defaults.js');
const ITP_RATES_JS = path.join(ROOT, 'js', 'itp-rates.js');
const CURRENT_YM  = '2026-04'; // дата последнего отчёта Idealista

// ── Маппинг id (data.js) → slug (idealista_raw.json) ─────────────────────────
const ID_TO_SLUG = {
  baleares:      'baleares',
  madrid:        'madrid-comunidad',
  pais_vasco:    'euskadi',
  canarias:      'canarias',
  cataluna:      'cataluna',
  andalucia:     'andalucia',
  valencia:      'comunitat-valenciana',
  cantabria:     'cantabria',
  navarra:       'navarra',
  galicia:       'galicia',
  aragon:        'aragon',
  asturias:      'asturias',
  murcia:        'murcia-region',
  la_rioja:      'la-rioja',
  castilla_leon: 'castilla-y-leon',
  extremadura:   'extremadura',
  clm:           'castilla-la-mancha',
};

// ── Вспомогательные функции ───────────────────────────────────────────────────

function ymBack(baseYM, years) {
  const d = new Date(baseYM + '-01');
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 7);
}

function yearsBetween(fromYM, toYM) {
  return (new Date(toYM + '-01') - new Date(fromYM + '-01')) / (365.25 * 24 * 3600 * 1000);
}

// Найти ближайшую непустую точку к targetYM (±maxDelta месяцев)
function findAnchor(history, targetYM, maxDelta = 6) {
  for (let d = 0; d <= maxDelta; d++) {
    const deltas = d === 0 ? [0] : [-d, d];
    for (const delta of deltas) {
      const dt = new Date(targetYM + '-01');
      dt.setMonth(dt.getMonth() + delta);
      const ym = dt.toISOString().slice(0, 7);
      const hit = history.find(x => x.mes === ym && x.precio_m2 !== null);
      if (hit) return hit;
    }
  }
  return null;
}

const r1 = v => v == null ? null : Math.round(v * 10) / 10;

function cumPct(past, current)         { return past && current ? r1((current / past - 1) * 100) : null; }
function cagrPct(past, current, years) { return past && current && years > 0 ? r1((Math.pow(current / past, 1 / years) - 1) * 100) : null; }

function findMax(history) {
  let price = null, mes = null;
  for (const x of history) {
    if (x.precio_m2 !== null && (price === null || x.precio_m2 > price)) {
      price = x.precio_m2;
      mes   = x.mes;
    }
  }
  return { price, mes };
}

// ── Загрузить данные ──────────────────────────────────────────────────────────

const raw = JSON.parse(fs.readFileSync(RAW_JSON, 'utf8'));

const dataJs     = fs.readFileSync(DATA_JS, 'utf8');
const defaultsJs = fs.readFileSync(DEFAULTS_JS, 'utf8');
const itpRatesJs = fs.readFileSync(ITP_RATES_JS, 'utf8');
const ctx = {};
vm.createContext(ctx);
// Порядок такой же, как в index.html: defaults → itp-rates → data.
// Object.freeze в defaults.js мешает повторному vm.runInContext, поэтому скрипт
// одноразовый — этого достаточно для node scripts/enrich_regions.js.
vm.runInContext(defaultsJs.replace(/\bconst\b/g, 'var'), ctx);
vm.runInContext(itpRatesJs.replace(/\bconst\b/g, 'var'), ctx);
vm.runInContext(dataJs.replace(/\bconst\b/g, 'var'), ctx);
const { REGIONS } = ctx;

// ── Вычислить поля для каждого региона ───────────────────────────────────────

const enriched = {};

for (const r of REGIONS) {
  const slug = ID_TO_SLUG[r.id];
  const reg  = slug && raw.regions[slug];
  if (!reg) { console.warn(`[SKIP] нет данных для ${r.id}`); continue; }

  const vh = reg.venta.monthly_history;
  const ah = reg.alquiler.monthly_history;
  const vs = reg.venta.summary;
  const as_ = reg.alquiler.summary;

  const vCur = vs.current_eur_m2;
  const aCur = as_.current_eur_m2;

  // Якоря: 1, 3, 5, 10, 20 лет назад
  const v1  = findAnchor(vh, ymBack(CURRENT_YM, 1));
  const v3  = findAnchor(vh, ymBack(CURRENT_YM, 3));
  const v5  = findAnchor(vh, ymBack(CURRENT_YM, 5));
  const v10 = findAnchor(vh, ymBack(CURRENT_YM, 10));
  const v20 = findAnchor(vh, ymBack(CURRENT_YM, 20));

  const a1  = findAnchor(ah, ymBack(CURRENT_YM, 1));
  const a3  = findAnchor(ah, ymBack(CURRENT_YM, 3));
  const a5  = findAnchor(ah, ymBack(CURRENT_YM, 5));
  const a10 = findAnchor(ah, ymBack(CURRENT_YM, 10));
  const a20 = findAnchor(ah, ymBack(CURRENT_YM, 20));

  // Самая ранняя доступная точка (для cagrMax — прокси cagr20 там, где нет 20y)
  const vAll = vh.filter(x => x.precio_m2 !== null);
  const aAll = ah.filter(x => x.precio_m2 !== null);
  const vEarly = vAll[vAll.length - 1];
  const aEarly = aAll[aAll.length - 1];

  const vMaxY = vEarly ? r1(yearsBetween(vEarly.mes, CURRENT_YM)) : null;
  const aMaxY = aEarly ? r1(yearsBetween(aEarly.mes, CURRENT_YM)) : null;

  const yrs = a => a ? yearsBetween(a.mes, CURRENT_YM) : null;

  // Максимум исторический
  const vMax = findMax(vh);
  const aMax = findMax(ah);

  enriched[r.id] = {
    // ── Цены продажи ─────────────────────────────────────────────────────────
    growth1:  vs.variation_yoy_pct != null ? r1(vs.variation_yoy_pct) : cumPct(v1?.precio_m2, vCur),
    growth5:  cumPct(v5?.precio_m2,  vCur),
    growth10: cumPct(v10?.precio_m2, vCur),
    growth20: cumPct(v20?.precio_m2, vCur),   // null если данных < 20 лет

    cagr3:    cagrPct(v3?.precio_m2,  vCur, yrs(v3)),
    cagr5:    cagrPct(v5?.precio_m2,  vCur, yrs(v5)),
    cagr10:   cagrPct(v10?.precio_m2, vCur, yrs(v10)),
    cagr20:   cagrPct(v20?.precio_m2, vCur, yrs(v20)),  // null если < 20 лет
    // cagrMax — прокси: CAGR от самой ранней доступной точки
    cagrMax:      cagrPct(vEarly?.precio_m2, vCur, vMaxY),
    cagrMaxYears: vMaxY,

    maxHistoric:     vMax.price,
    maxHistoricDate: vMax.mes,
    pctFromMax:      (vCur && vMax.price) ? r1((vCur / vMax.price - 1) * 100) : null,

    // ── Аренда ────────────────────────────────────────────────────────────────
    rentGrowth1:  as_.variation_yoy_pct != null ? r1(as_.variation_yoy_pct) : cumPct(a1?.precio_m2, aCur),
    rentGrowth5:  cumPct(a5?.precio_m2,  aCur),
    rentGrowth10: cumPct(a10?.precio_m2, aCur),
    rentGrowth20: cumPct(a20?.precio_m2, aCur),  // null для 14 из 17 регионов

    rentCagr3:    cagrPct(a3?.precio_m2,  aCur, yrs(a3)),
    rentCagr5:    cagrPct(a5?.precio_m2,  aCur, yrs(a5)),
    rentCagr10:   cagrPct(a10?.precio_m2, aCur, yrs(a10)),
    rentCagr20:   cagrPct(a20?.precio_m2, aCur, yrs(a20)),
    rentCagrMax:      cagrPct(aEarly?.precio_m2, aCur, aMaxY),
    rentCagrMaxYears: aMaxY,

    rentMaxHistoric:     aMax.price,
    rentMaxHistoricDate: aMax.mes,
    rentPctFromMax:      (aCur && aMax.price) ? r1((aCur / aMax.price - 1) * 100) : null,
  };
}

// ── Отчёт в консоль ───────────────────────────────────────────────────────────

console.log('\n╔══ VENTA: CAGR по горизонтам ═══════════════════════════════════════════════════════╗');
console.log('  id               cagr1  cagr5  cagr10  cagr20  cagrMax(лет)  max€/m²  pctFromMax');
console.log('  ' + '─'.repeat(85));
for (const r of REGIONS) {
  const e = enriched[r.id];
  if (!e) continue;
  const n = v => v == null ? ' null' : String(v).padStart(5);
  const c20flag = e.cagr20 == null ? ' ⚠' : '  ';
  console.log(
    ' ', r.id.padEnd(16),
    n(e.growth1)+'%',
    n(e.cagr5)+'%',
    n(e.cagr10)+'%',
    n(e.cagr20)+'%' + c20flag,
    `${n(e.cagrMax)}%(${e.cagrMaxYears}y)`.padEnd(14),
    String(e.maxHistoric).padStart(6),
    n(e.pctFromMax)+'%'
  );
}

console.log('\n╔══ ALQUILER: CAGR по горизонтам ════════════════════════════════════════════════════╗');
console.log('  id               cagr1  cagr5  cagr10  cagr20  cagrMax(лет)  max€/m²  pctFromMax');
console.log('  ' + '─'.repeat(85));
for (const r of REGIONS) {
  const e = enriched[r.id];
  if (!e) continue;
  const n = v => v == null ? ' null' : String(v).padStart(5);
  const c20flag = e.rentCagr20 == null ? ' ⚠' : '  ';
  console.log(
    ' ', r.id.padEnd(16),
    n(e.rentGrowth1)+'%',
    n(e.rentCagr5)+'%',
    n(e.rentCagr10)+'%',
    n(e.rentCagr20)+'%' + c20flag,
    `${n(e.rentCagrMax)}%(${e.rentCagrMaxYears}y)`.padEnd(14),
    String(e.rentMaxHistoric).padStart(5),
    n(e.rentPctFromMax)+'%'
  );
}

console.log('\n⚠  null в cagr20 = данные начинаются позже 2006-04 (пик пузыря)');
console.log('   cagrMax — прокси: CAGR от самой ранней доступной точки\n');

// ── Построить новый блок REGIONS ─────────────────────────────────────────────

function fv(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return `'${v}'`;
  return String(v);
}

function buildRegionBlock(r) {
  const e = enriched[r.id];
  if (!e) return `  /* MISSING: ${r.id} */`;

  // ITP-ставки берутся через spread из ITP_RATES — централизованная таблица в js/itp-rates.js.
  // Плоские itp / itpHab / itpInv в data.js не дублируем.
  const airbnb = r.airbnbRestricted ? 'true' : 'false';
  const noteKey = r.airbnbNoteKey ? `, airbnbNoteKey:'${r.airbnbNoteKey}'` : '';

  return [
    `  { id:'${r.id}', name:'${r.name}', price:${r.price}, rent:${r.rent.toFixed(2)},`,
    `    ...ITP_RATES.${r.id}, color:'${r.color}', airbnbRestricted:${airbnb}${noteKey},`,
    `    growth1:${fv(e.growth1)}, growth5:${fv(e.growth5)}, growth10:${fv(e.growth10)}, growth20:${fv(e.growth20)},`,
    `    cagr3:${fv(e.cagr3)}, cagr5:${fv(e.cagr5)}, cagr10:${fv(e.cagr10)}, cagr20:${fv(e.cagr20)}, cagrMax:${fv(e.cagrMax)}, cagrMaxYears:${fv(e.cagrMaxYears)},`,
    `    maxHistoric:${fv(e.maxHistoric)}, maxHistoricDate:${fv(e.maxHistoricDate)}, pctFromMax:${fv(e.pctFromMax)},`,
    `    rentGrowth1:${fv(e.rentGrowth1)}, rentGrowth5:${fv(e.rentGrowth5)}, rentGrowth10:${fv(e.rentGrowth10)}, rentGrowth20:${fv(e.rentGrowth20)},`,
    `    rentCagr3:${fv(e.rentCagr3)}, rentCagr5:${fv(e.rentCagr5)}, rentCagr10:${fv(e.rentCagr10)}, rentCagr20:${fv(e.rentCagr20)}, rentCagrMax:${fv(e.rentCagrMax)}, rentCagrMaxYears:${fv(e.rentCagrMaxYears)},`,
    `    rentMaxHistoric:${fv(e.rentMaxHistoric)}, rentMaxHistoricDate:${fv(e.rentMaxHistoricDate)}, rentPctFromMax:${fv(e.rentPctFromMax)} }`,
  ].join('\n');
}

const newRegionsBlock =
  'const REGIONS = [\n' +
  REGIONS.map(buildRegionBlock).join(',\n') +
  '\n];';

// Найти и заменить блок REGIONS в data.js
const regStart = dataJs.indexOf('const REGIONS = [');
if (regStart === -1) { console.error('REGIONS не найден в data.js'); process.exit(1); }

// Найти конец массива (первый ]; после начала)
const regEnd = dataJs.indexOf('\n];', regStart) + 3; // включаем \n];

// Удалить строку, перезаписывающую growth1 из GROWTH_DATA (теперь он в REGIONS)
const g1Line = `  r.growth1    = GROWTH_DATA[r.name] ? GROWTH_DATA[r.name][GROWTH_DATA[r.name].length - 1] : 0;`;
const g1Replacement = `  // growth1 вычислен из Idealista, хранится в REGIONS`;

const newDataJs = dataJs
  .slice(0, regStart)
  + newRegionsBlock
  + dataJs.slice(regEnd)
  .replace(g1Line, g1Replacement);

fs.writeFileSync(DATA_JS, newDataJs);

console.log(`✓ data.js обновлён: ${REGIONS.length} регионов, ${Object.keys(enriched).length} обогащено`);
console.log(`  Поля добавлены: growth1/5/10/20, cagr5/10/20/Max, maxHistoric, pctFromMax`);
console.log(`  + rentGrowth1/5/10/20, rentCagr5/10/20/Max, rentMaxHistoric, rentPctFromMax\n`);
