// ============================================================
// data.js — все данные приложения
// Чтобы обновить цены: измените числа в REGIONS
// Чтобы добавить регион: добавьте объект в массив REGIONS
// Последнее обновление: Q2 2026
// ============================================================

const DATA_UPDATED = 'Q2 2026';
const DATA_SOURCES = 'INE, Idealista, Colegio de Registradores';

// Коэффициент роста стоимости после ремонта
// Источник: Tecnitasa, Terreta Spain 2025
const RENOVATION_UPLIFT = {
  'Madrid':          0.38,  // +35-40%
  'Cataluña':        0.38,
  'Andalucía':       0.38,
  'Valencia':        0.35,
  'País Vasco':      0.35,
  'Baleares':        0.13,  // +12-15%
  'Canarias':        0.13,
  'Murcia':          0.13,
  'La Rioja':        0.13,
  // остальные регионы
  'default':         0.22   // +20-25%
};

// ITP rates are defined in js/itp-rates.js (ITP_RATES constant).
// To update rates: edit js/itp-rates.js and docs/spain_itp_data.md in sync.

const REGIONS = [
  { id:'baleares', name:'Baleares', price:5252, rent:19.80,
    ...ITP_RATES.baleares, color:'#c9a84c', airbnbRestricted:true, airbnbNoteKey:'c2_airbnb_note_baleares',
    growth1:6.8, growth5:68, growth10:165, growth20:108.3,
    cagr3:10.5, cagr5:10.9, cagr10:10.2, cagr20:3.8, cagrMax:3.8, cagrMaxYears:19.6,
    maxHistoric:5337, maxHistoricDate:'2026-06', pctFromMax:0,
    rentGrowth1:-0.1, rentGrowth5:77.2, rentGrowth10:85.3, rentGrowth20:null,
    rentCagr3:7.2, rentCagr5:12.1, rentCagr10:6.4, rentCagr20:null, rentCagrMax:2.2, rentCagrMaxYears:19.3,
    rentMaxHistoric:20.2, rentMaxHistoricDate:'2026-06', rentPctFromMax:0 },
  { id:'madrid', name:'Madrid', price:4707, rent:21.20,
    ...ITP_RATES.madrid, color:'#4a90d9', airbnbRestricted:true, airbnbNoteKey:'c2_airbnb_note_madrid',
    growth1:11.6, growth5:65.9, growth10:122.7, growth20:81.7,
    cagr3:15.1, cagr5:10.7, cagr10:8.3, cagr20:3, cagrMax:2.9, cagrMaxYears:20.4,
    maxHistoric:4786, maxHistoricDate:'2026-06', pctFromMax:0,
    rentGrowth1:7.8, rentGrowth5:60.7, rentGrowth10:97.3, rentGrowth20:null,
    rentCagr3:12.1, rentCagr5:10, rentCagr10:7, rentCagr20:null, rentCagrMax:3.3, rentCagrMaxYears:19.2,
    rentMaxHistoric:21.7, rentMaxHistoricDate:'2026-06', rentPctFromMax:0 },
  { id:'pais_vasco', name:'País Vasco', price:3534, rent:15.10,
    ...ITP_RATES.pais_vasco, color:'#5cb88a', airbnbRestricted:true, airbnbNoteKey:'c2_airbnb_note_pais_vasco',
    growth1:11.9, growth5:36.2, growth10:44.1, growth20:null,
    cagr3:8.7, cagr5:6.4, cagr10:3.7, cagr20:null, cagrMax:0.9, cagrMaxYears:19.1,
    maxHistoric:3611, maxHistoricDate:'2026-06', pctFromMax:0,
    rentGrowth1:0.2, rentGrowth5:24.2, rentGrowth10:50.5, rentGrowth20:null,
    rentCagr3:5.5, rentCagr5:4.4, rentCagr10:4.2, rentCagr20:null, rentCagrMax:2.7, rentCagrMaxYears:16.3,
    rentMaxHistoric:15.2, rentMaxHistoricDate:'2026-03', rentPctFromMax:-2 },
  { id:'canarias', name:'Canarias', price:3283, rent:15.70,
    ...ITP_RATES.canarias, color:'#9b7fd4', airbnbRestricted:false,
    growth1:7.4, growth5:73.4, growth10:144, growth20:57.2,
    cagr3:13.7, cagr5:11.6, cagr10:9.3, cagr20:2.3, cagrMax:2.3, cagrMaxYears:19.6,
    maxHistoric:3297, maxHistoricDate:'2026-06', pctFromMax:0,
    rentGrowth1:4.7, rentGrowth5:62.2, rentGrowth10:123.9, rentGrowth20:null,
    rentCagr3:8.3, rentCagr5:10.2, rentCagr10:8.4, rentCagr20:null, rentCagrMax:2.8, rentCagrMaxYears:18.5,
    rentMaxHistoric:15.9, rentMaxHistoricDate:'2026-06', rentPctFromMax:0 },
  { id:'cataluna', name:'Cataluña', price:2890, rent:17.10,
    ...ITP_RATES.cataluna, color:'#e07a5f', airbnbRestricted:true, airbnbNoteKey:'c2_airbnb_note_cataluna',
    growth1:14, growth5:31.3, growth10:64.5, growth20:22.1,
    cagr3:7.8, cagr5:5.6, cagr10:5.1, cagr20:1, cagrMax:1.2, cagrMaxYears:20.3,
    maxHistoric:2959, maxHistoricDate:'2026-06', pctFromMax:0,
    rentGrowth1:-8.2, rentGrowth5:35.4, rentGrowth10:66, rentGrowth20:46.7,
    rentCagr3:5.2, rentCagr5:6.2, rentCagr10:5.2, rentCagr20:1.9, rentCagrMax:1.9, rentCagrMaxYears:20,
    rentMaxHistoric:19.2, rentMaxHistoricDate:'2025-06', rentPctFromMax:-8.3 },
  { id:'andalucia', name:'Andalucía', price:2852, rent:13.50,
    ...ITP_RATES.andalucia, color:'#f2cc8f', airbnbRestricted:false,
    growth1:16.6, growth5:69.4, growth10:111.8, growth20:48,
    cagr3:13.2, cagr5:11.1, cagr10:7.8, cagr20:2, cagrMax:1.9, cagrMaxYears:20.4,
    maxHistoric:2936, maxHistoricDate:'2026-06', pctFromMax:0,
    rentGrowth1:6, rentGrowth5:57, rentGrowth10:107.7, rentGrowth20:36.4,
    rentCagr3:9.8, rentCagr5:9.4, rentCagr10:7.6, rentCagr20:1.6, rentCagrMax:1.4, rentCagrMaxYears:20.4,
    rentMaxHistoric:13.5, rentMaxHistoricDate:'2026-06', rentPctFromMax:0 },
  { id:'valencia', name:'Valencia', price:2489, rent:12.90,
    ...ITP_RATES.valencia, color:'#81b29a', airbnbRestricted:true, airbnbNoteKey:'c2_airbnb_note_valencia',
    growth1:13.3, growth5:73.5, growth10:113.4, growth20:37.8,
    cagr3:14, cagr5:11.7, cagr10:7.9, cagr20:1.6, cagrMax:1.2, cagrMaxYears:20.4,
    maxHistoric:2552, maxHistoricDate:'2026-06', pctFromMax:0,
    rentGrowth1:7.4, rentGrowth5:76, rentGrowth10:135.7, rentGrowth20:41.9,
    rentCagr3:11.2, rentCagr5:12, rentCagr10:9, rentCagr20:1.8, rentCagrMax:1.4, rentCagrMaxYears:20.4,
    rentMaxHistoric:13.2, rentMaxHistoricDate:'2026-06', rentPctFromMax:0 },
  { id:'cantabria', name:'Cantabria', price:2154, rent:11.50,
    ...ITP_RATES.cantabria, color:'#a8c5da', airbnbRestricted:false,
    growth1:18.4, growth5:53.8, growth10:50.3, growth20:null,
    cagr3:13, cagr5:9, cagr10:4.2, cagr20:null, cagrMax:0.9, cagrMaxYears:19.3,
    maxHistoric:2220, maxHistoricDate:'2026-06', pctFromMax:0,
    rentGrowth1:-2.6, rentGrowth5:45.7, rentGrowth10:87.3, rentGrowth20:null,
    rentCagr3:5.3, rentCagr5:7.8, rentCagr10:6.5, rentCagr20:null, rentCagrMax:-1, rentCagrMaxYears:19,
    rentMaxHistoric:14.8, rentMaxHistoricDate:'2007-07', rentPctFromMax:-20.3 },
  { id:'navarra', name:'Navarra', price:1932, rent:10.60,
    ...ITP_RATES.navarra, color:'#d4a5a5', airbnbRestricted:false,
    growth1:13, growth5:35.4, growth10:40.4, growth20:null,
    cagr3:5.7, cagr5:6.3, cagr10:3.4, cagr20:null, cagrMax:0.3, cagrMaxYears:18.7,
    maxHistoric:1968, maxHistoricDate:'2026-06', pctFromMax:0,
    rentGrowth1:0.8, rentGrowth5:19.1, rentGrowth10:58.2, rentGrowth20:null,
    rentCagr3:3, rentCagr5:3.6, rentCagr10:4.7, rentCagr20:null, rentCagrMax:3.2, rentCagrMaxYears:16,
    rentMaxHistoric:11.2, rentMaxHistoricDate:'2026-01', rentPctFromMax:-5.4 },
  { id:'asturias', name:'Asturias', price:1779, rent:10.50,
    ...ITP_RATES.asturias, color:'#b8c9d8', airbnbRestricted:false,
    growth1:14.5, growth5:33.8, growth10:30.4, growth20:5.3,
    cagr3:10, cagr5:6, cagr10:2.7, cagr20:0.3, cagrMax:0.3, cagrMaxYears:19.5,
    maxHistoric:1867, maxHistoricDate:'2008-04', pctFromMax:-3.5,
    rentGrowth1:10.3, rentGrowth5:44, rentGrowth10:74.2, rentGrowth20:null,
    rentCagr3:10.1, rentCagr5:7.6, rentCagr10:5.7, rentCagr20:null, rentCagrMax:-0.3, rentCagrMaxYears:18.4,
    rentMaxHistoric:12.5, rentMaxHistoricDate:'2008-02', rentPctFromMax:-13.6 },
  { id:'murcia', name:'Murcia', price:1747, rent:9.20,
    ...ITP_RATES.murcia, color:'#d8b894', airbnbRestricted:false,
    growth1:21.1, growth5:72.1, growth10:79.8, growth20:6.6,
    cagr3:16.1, cagr5:11.5, cagr10:6, cagr20:0.3, cagrMax:0.3, cagrMaxYears:19.8,
    maxHistoric:1816, maxHistoricDate:'2026-06', pctFromMax:0,
    rentGrowth1:3.5, rentGrowth5:41.8, rentGrowth10:86.3, rentGrowth20:null,
    rentCagr3:6.8, rentCagr5:7.2, rentCagr10:6.4, rentCagr20:null, rentCagrMax:1.4, rentCagrMaxYears:19.1,
    rentMaxHistoric:9.5, rentMaxHistoricDate:'2026-06', rentPctFromMax:0 },
  { id:'aragon', name:'Aragón', price:1668, rent:10.80,
    ...ITP_RATES.aragon, color:'#c9b7d8', airbnbRestricted:false,
    growth1:14.6, growth5:29.7, growth10:35.8, growth20:null,
    cagr3:7.3, cagr5:5.3, cagr10:3.1, cagr20:null, cagrMax:-0.6, cagrMaxYears:19.4,
    maxHistoric:2008, maxHistoricDate:'2007-03', pctFromMax:-14.8,
    rentGrowth1:10, rentGrowth5:40.5, rentGrowth10:79, rentGrowth20:null,
    rentCagr3:9.3, rentCagr5:7, rentCagr10:6, rentCagr20:null, rentCagrMax:1.4, rentCagrMaxYears:18.2,
    rentMaxHistoric:11.1, rentMaxHistoricDate:'2026-06', rentPctFromMax:0 },
  { id:'galicia', name:'Galicia', price:1549, rent:9.70,
    ...ITP_RATES.galicia, color:'#a8d8a8', airbnbRestricted:false,
    growth1:10, growth5:18.9, growth10:15.2, growth20:5.8,
    cagr3:5.3, cagr5:3.5, cagr10:1.4, cagr20:0.3, cagrMax:0.3, cagrMaxYears:19.7,
    maxHistoric:1775, maxHistoricDate:'2011-11', pctFromMax:-10.6,
    rentGrowth1:2.8, rentGrowth5:37.5, rentGrowth10:80, rentGrowth20:null,
    rentCagr3:6.9, rentCagr5:6.6, rentCagr10:6.1, rentCagr20:null, rentCagrMax:0.2, rentCagrMaxYears:19.1,
    rentMaxHistoric:9.9, rentMaxHistoricDate:'2026-06', rentPctFromMax:0 },
  { id:'la_rioja', name:'La Rioja', price:1470, rent:9.30,
    ...ITP_RATES.la_rioja, color:'#c8d894', airbnbRestricted:false,
    growth1:9.4, growth5:22.3, growth10:36.4, growth20:null,
    cagr3:6, cagr5:4.1, cagr10:3.2, cagr20:null, cagrMax:0.5, cagrMaxYears:18.9,
    maxHistoric:1652, maxHistoricDate:'2008-01', pctFromMax:-8.7,
    rentGrowth1:6.7, rentGrowth5:37.1, rentGrowth10:84.6, rentGrowth20:null,
    rentCagr3:8.6, rentCagr5:6.5, rentCagr10:6.3, rentCagr20:null, rentCagrMax:2.7, rentCagrMaxYears:16.1,
    rentMaxHistoric:9.6, rentMaxHistoricDate:'2026-06', rentPctFromMax:0 },
  { id:'castilla_leon', name:'Castilla y León', price:1323, rent:9.50,
    ...ITP_RATES.castilla_leon, color:'#94b8c8', airbnbRestricted:false,
    growth1:10.9, growth5:19.4, growth10:18.1, growth20:11.7,
    cagr3:5.5, cagr5:3.6, cagr10:1.7, cagr20:0.6, cagrMax:0.6, cagrMaxYears:20,
    maxHistoric:1481, maxHistoricDate:'2011-06', pctFromMax:-8.2,
    rentGrowth1:7.4, rentGrowth5:40.6, rentGrowth10:79.6, rentGrowth20:null,
    rentCagr3:8.5, rentCagr5:7.1, rentCagr10:6, rentCagr20:null, rentCagrMax:3, rentCagrMaxYears:18.6,
    rentMaxHistoric:9.7, rentMaxHistoricDate:'2026-06', rentPctFromMax:0 },
  { id:'clm', name:'C.-La Mancha', price:1091, rent:8.60,
    ...ITP_RATES.clm, color:'#a8a8a8', airbnbRestricted:false,
    growth1:14.7, growth5:27.1, growth10:29.1, growth20:-19.3,
    cagr3:7.3, cagr5:4.9, cagr10:2.6, cagr20:-1.1, cagrMax:-1, cagrMaxYears:20.1,
    maxHistoric:1424, maxHistoricDate:'2007-05', pctFromMax:-21.8,
    rentGrowth1:10.3, rentGrowth5:50, rentGrowth10:89.1, rentGrowth20:null,
    rentCagr3:10.2, rentCagr5:8.4, rentCagr10:6.6, rentCagr20:null, rentCagrMax:2.6, rentCagrMaxYears:18.7,
    rentMaxHistoric:8.7, rentMaxHistoricDate:'2026-06', rentPctFromMax:0 },
  { id:'extremadura', name:'Extremadura', price:1071, rent:7.50,
    ...ITP_RATES.extremadura, color:'#b8a894', airbnbRestricted:false,
    growth1:9.9, growth5:16.6, growth10:17.1, growth20:null,
    cagr3:4.3, cagr5:3.1, cagr10:1.6, cagr20:null, cagrMax:-0.4, cagrMaxYears:19.2,
    maxHistoric:1217, maxHistoricDate:'2011-04', pctFromMax:-11,
    rentGrowth1:5.8, rentGrowth5:42.6, rentGrowth10:75, rentGrowth20:null,
    rentCagr3:8.1, rentCagr5:7.4, rentCagr10:5.8, rentCagr20:null, rentCagrMax:2.1, rentCagrMaxYears:16.9,
    rentMaxHistoric:7.7, rentMaxHistoricDate:'2026-06', rentPctFromMax:0 }
];

// Годовой рост цен % по регионам, 2016–2025
// Источник: INE IPV
const GROWTH_DATA = {
  'Baleares':        [4.5,  7.2, 11.8, 10.2, -0.5,  8.8,  9.1,  7.4, 11.0, 10.0],
  'Madrid':          [6.1,  9.5, 12.2, 11.0, -1.2,  6.5,  5.8,  9.1, 11.9, 11.6],
  'País Vasco':      [3.2,  5.5,  7.8,  7.2, -0.8,  4.8,  5.0,  7.5, 10.8, 12.4],
  'Canarias':        [5.2,  8.0, 10.5,  9.8,  0.2,  9.2,  8.5,  8.9, 10.8, 12.4],
  'Cataluña':        [5.0,  7.8, 11.0,  9.5, -1.8,  5.2,  4.5,  6.0,  9.5, 11.7],
  'Andalucía':       [2.5,  5.0,  8.2,  8.5, -0.5,  5.8,  6.2,  8.0, 11.5, 14.0],
  'Valencia':        [3.0,  5.8,  8.5,  8.0, -1.5,  7.2,  6.8,  7.5, 10.5,  9.9],
  'Navarra':         [2.8,  4.2,  6.5,  6.8, -0.2,  4.2,  4.8,  6.5,  9.5, 11.4],
  'Cantabria':       [2.0,  3.8,  5.5,  5.8,  0.5,  4.5,  5.2,  6.8, 10.2,  9.3],
  'Galicia':         [1.8,  3.5,  5.2,  5.5,  0.2,  4.0,  4.5,  6.5,  9.8, 11.2],
  'Aragón':          [1.5,  3.2,  5.5,  5.2, -0.8,  4.2,  4.8,  6.2,  9.2, 13.2],
  'Asturias':        [0.5,  1.8,  3.5,  3.8,  0.0,  3.5,  3.8,  5.5,  8.0, 13.1],
  'Murcia':          [1.8,  3.5,  6.2,  6.5, -1.0,  5.5,  5.8,  6.8,  9.5, 13.3],
  'La Rioja':        [1.2,  2.8,  4.8,  4.5, -0.5,  3.8,  4.2,  5.8,  9.0, 13.2],
  'Castilla y León': [0.2,  1.5,  3.2,  3.5, -0.2,  3.0,  3.5,  5.0,  8.5, 12.4],
  'Extremadura':     [-0.5, 0.8,  2.5,  2.8,  0.5,  2.5,  3.2,  4.5,  7.2, 10.9],
  'C.-La Mancha':    [-0.8, 0.5,  2.2,  2.5,  0.2,  2.8,  3.5,  4.8,  7.5, 10.4],
};

const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

// Нотариус + регистр (одинаково для всех регионов) — единый источник правды в defaults.js.
const NOTARY_RATE = DEFAULTS.notaryPct / 100;

// ITP таблица для гида
const ITP_TABLE = [
  ['Andalucía',       '7%',  ''],
  ['Aragón',          '8%',  ''],
  ['Asturias',        '8%',  ''],
  ['Baleares',        '8%',  'до 10% для объектов > 400k €'],
  ['Canarias',        '6.5%',''],
  ['Cantabria',       '10%', ''],
  ['Castilla y León', '8%',  ''],
  ['C.-La Mancha',    '9%',  ''],
  ['Cataluña',        '10%', 'до 11% при цене > 1M €'],
  ['Extremadura',     '8%',  ''],
  ['Galicia',         '10%', ''],
  ['Madrid',          '6%',  'самый низкий в стране'],
  ['Murcia',          '8%',  ''],
  ['Navarra',         '6%',  ''],
  ['La Rioja',        '7%',  ''],
  ['País Vasco',      '7%',  ''],
  ['Valencia',        '10%', ''],
];

// Предвычислить производные поля
REGIONS.forEach(r => {
  r.totalCost  = r.price * (1 + r.itp + NOTARY_RATE);
  r.annualRent = r.rent * 12;
  r.pr         = r.price / r.annualRent;
  r.prAdj      = r.totalCost / r.annualRent;
  r.yield      = r.annualRent / r.price * 100;
  // Add last year growth for map
  // growth1 вычислен из Idealista, хранится в REGIONS
});
