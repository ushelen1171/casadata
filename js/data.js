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
    growth1:8.6, growth5:67.9, growth10:162.1, growth20:null,
    cagr3:11.3, cagr5:10.9, cagr10:10.1, cagr20:null, cagrMax:3.8, cagrMaxYears:19.4,
    maxHistoric:5252, maxHistoricDate:'2026-04', pctFromMax:0,
    rentGrowth1:3.7, rentGrowth5:75.2, rentGrowth10:102, rentGrowth20:null,
    rentCagr3:9.2, rentCagr5:11.9, rentCagr10:7.3, rentCagr20:null, rentCagrMax:2.1, rentCagrMaxYears:19.2,
    rentMaxHistoric:20.2, rentMaxHistoricDate:'2025-06', rentPctFromMax:-2 },
  { id:'madrid', name:'Madrid', price:4707, rent:21.20,
    ...ITP_RATES.madrid, color:'#4a90d9', airbnbRestricted:true, airbnbNoteKey:'c2_airbnb_note_madrid',
    growth1:13.5, growth5:66.6, growth10:119.9, growth20:84.8,
    cagr3:14.5, cagr5:10.7, cagr10:8.2, cagr20:3.1, cagrMax:2.8, cagrMaxYears:20.2,
    maxHistoric:4707, maxHistoricDate:'2026-04', pctFromMax:0,
    rentGrowth1:9, rentGrowth5:57, rentGrowth10:94.5, rentGrowth20:null,
    rentCagr3:12.2, rentCagr5:9.4, rentCagr10:6.9, rentCagr20:null, rentCagrMax:3.2, rentCagrMaxYears:19,
    rentMaxHistoric:21.3, rentMaxHistoricDate:'2026-03', rentPctFromMax:-0.5 },
  { id:'pais_vasco', name:'País Vasco', price:3534, rent:15.10,
    ...ITP_RATES.pais_vasco, color:'#5cb88a', airbnbRestricted:true, airbnbNoteKey:'c2_airbnb_note_pais_vasco',
    growth1:13.2, growth5:33.2, growth10:40.8, growth20:null,
    cagr3:7.9, cagr5:5.9, cagr10:3.5, cagr20:null, cagrMax:0.8, cagrMaxYears:18.9,
    maxHistoric:3534, maxHistoricDate:'2026-04', pctFromMax:0,
    rentGrowth1:4.1, rentGrowth5:24.8, rentGrowth10:52.5, rentGrowth20:null,
    rentCagr3:6.2, rentCagr5:4.5, rentCagr10:4.3, rentCagr20:null, rentCagrMax:2.8, rentCagrMaxYears:16.1,
    rentMaxHistoric:15.2, rentMaxHistoricDate:'2026-03', rentPctFromMax:-0.7 },
  { id:'canarias', name:'Canarias', price:3283, rent:15.70,
    ...ITP_RATES.canarias, color:'#9b7fd4', airbnbRestricted:false,
    growth1:10.1, growth5:74.3, growth10:143.5, growth20:null,
    cagr3:14.2, cagr5:11.7, cagr10:9.3, cagr20:null, cagrMax:2.3, cagrMaxYears:19.4,
    maxHistoric:3283, maxHistoricDate:'2026-04', pctFromMax:0,
    rentGrowth1:7.5, rentGrowth5:60.2, rentGrowth10:124.3, rentGrowth20:null,
    rentCagr3:9.1, rentCagr5:9.9, rentCagr10:8.4, rentCagr20:null, rentCagrMax:2.7, rentCagrMaxYears:18.3,
    rentMaxHistoric:15.7, rentMaxHistoricDate:'2026-04', rentPctFromMax:0 },
  { id:'cataluna', name:'Cataluña', price:2890, rent:17.10,
    ...ITP_RATES.cataluna, color:'#e07a5f', airbnbRestricted:true, airbnbNoteKey:'c2_airbnb_note_cataluna',
    growth1:14.1, growth5:28.5, growth10:59.8, growth20:21.4,
    cagr3:7.3, cagr5:5.1, cagr10:4.8, cagr20:1, cagrMax:1.1, cagrMaxYears:20.2,
    maxHistoric:2890, maxHistoricDate:'2026-04', pctFromMax:0,
    rentGrowth1:-8.6, rentGrowth5:31.5, rentGrowth10:64.4, rentGrowth20:42.5,
    rentCagr3:4.9, rentCagr5:5.6, rentCagr10:5.1, rentCagr20:1.8, rentCagrMax:1.8, rentCagrMaxYears:19.8,
    rentMaxHistoric:19.2, rentMaxHistoricDate:'2025-06', rentPctFromMax:-10.9 },
  { id:'andalucia', name:'Andalucía', price:2852, rent:13.50,
    ...ITP_RATES.andalucia, color:'#f2cc8f', airbnbRestricted:false,
    growth1:17.6, growth5:69.2, growth10:105.9, growth20:44.6,
    cagr3:12.7, cagr5:11.1, cagr10:7.5, cagr20:1.9, cagrMax:1.8, cagrMaxYears:20.2,
    maxHistoric:2852, maxHistoricDate:'2026-04', pctFromMax:0,
    rentGrowth1:8, rentGrowth5:57, rentGrowth10:114.3, rentGrowth20:36.4,
    rentCagr3:10.9, rentCagr5:9.4, rentCagr10:7.9, rentCagr20:1.6, rentCagrMax:1.4, rentCagrMaxYears:20.2,
    rentMaxHistoric:13.5, rentMaxHistoricDate:'2026-04', rentPctFromMax:0 },
  { id:'valencia', name:'Valencia', price:2489, rent:12.90,
    ...ITP_RATES.valencia, color:'#81b29a', airbnbRestricted:true, airbnbNoteKey:'c2_airbnb_note_valencia',
    growth1:15.4, growth5:73.3, growth10:109.3, growth20:33.8,
    cagr3:13.9, cagr5:11.6, cagr10:7.7, cagr20:1.5, cagrMax:1.1, cagrMaxYears:20.2,
    maxHistoric:2489, maxHistoricDate:'2026-04', pctFromMax:0,
    rentGrowth1:8.1, rentGrowth5:72, rentGrowth10:134.5, rentGrowth20:37.2,
    rentCagr3:11.9, rentCagr5:11.5, rentCagr10:8.9, rentCagr20:1.6, rentCagrMax:1.3, rentCagrMaxYears:20.2,
    rentMaxHistoric:12.9, rentMaxHistoricDate:'2026-04', rentPctFromMax:0 },
  { id:'cantabria', name:'Cantabria', price:2154, rent:11.50,
    ...ITP_RATES.cantabria, color:'#a8c5da', airbnbRestricted:false,
    growth1:2.6, growth5:49.9, growth10:43.7, growth20:null,
    cagr3:12.4, cagr5:8.4, cagr10:3.7, cagr20:null, cagrMax:0.8, cagrMaxYears:19.2,
    maxHistoric:2154, maxHistoricDate:'2026-04', pctFromMax:0,
    rentGrowth1:1.3, rentGrowth5:47.4, rentGrowth10:82.5, rentGrowth20:null,
    rentCagr3:6.6, rentCagr5:8.1, rentCagr10:6.2, rentCagr20:null, rentCagrMax:-1.2, rentCagrMaxYears:18.8,
    rentMaxHistoric:14.8, rentMaxHistoricDate:'2007-07', rentPctFromMax:-22.3 },
  { id:'navarra', name:'Navarra', price:1932, rent:10.60,
    ...ITP_RATES.navarra, color:'#d4a5a5', airbnbRestricted:false,
    growth1:10.6, growth5:33.3, growth10:38.6, growth20:null,
    cagr3:6.2, cagr5:5.9, cagr10:3.3, cagr20:null, cagrMax:0.2, cagrMaxYears:18.5,
    maxHistoric:1932, maxHistoricDate:'2026-04', pctFromMax:0,
    rentGrowth1:1, rentGrowth5:19.1, rentGrowth10:63.1, rentGrowth20:null,
    rentCagr3:3.7, rentCagr5:3.6, rentCagr10:5, rentCagr20:null, rentCagrMax:3.2, rentCagrMaxYears:15.8,
    rentMaxHistoric:11.2, rentMaxHistoricDate:'2026-01', rentPctFromMax:-5.4 },
  { id:'asturias', name:'Asturias', price:1779, rent:10.50,
    ...ITP_RATES.asturias, color:'#b8c9d8', airbnbRestricted:false,
    growth1:17.7, growth5:32.7, growth10:28.6, growth20:null,
    cagr3:9.8, cagr5:5.8, cagr10:2.6, cagr20:null, cagrMax:0.2, cagrMaxYears:19.3,
    maxHistoric:1867, maxHistoricDate:'2008-04', pctFromMax:-4.7,
    rentGrowth1:8.2, rentGrowth5:40, rentGrowth10:72.1, rentGrowth20:null,
    rentCagr3:9, rentCagr5:7, rentCagr10:5.6, rentCagr20:null, rentCagrMax:-0.5, rentCagrMaxYears:18.2,
    rentMaxHistoric:12.5, rentMaxHistoricDate:'2008-02', rentPctFromMax:-16 },
  { id:'murcia', name:'Murcia', price:1747, rent:9.20,
    ...ITP_RATES.murcia, color:'#d8b894', airbnbRestricted:false,
    growth1:23, growth5:66.1, growth10:71.8, growth20:2.6,
    cagr3:15.3, cagr5:10.7, cagr10:5.6, cagr20:0.1, cagrMax:0.1, cagrMaxYears:19.7,
    maxHistoric:1786, maxHistoricDate:'2006-09', pctFromMax:-2.2,
    rentGrowth1:7, rentGrowth5:39.4, rentGrowth10:84, rentGrowth20:null,
    rentCagr3:8.5, rentCagr5:6.9, rentCagr10:6.3, rentCagr20:null, rentCagrMax:1.2, rentCagrMaxYears:18.9,
    rentMaxHistoric:9.2, rentMaxHistoricDate:'2026-04', rentPctFromMax:0 },
  { id:'aragon', name:'Aragón', price:1668, rent:10.80,
    ...ITP_RATES.aragon, color:'#c9b7d8', airbnbRestricted:false,
    growth1:13.3, growth5:26.7, growth10:31.6, growth20:null,
    cagr3:7, cagr5:4.9, cagr10:2.8, cagr20:null, cagrMax:-0.8, cagrMaxYears:19.2,
    maxHistoric:2008, maxHistoricDate:'2007-03', pctFromMax:-16.9,
    rentGrowth1:9.1, rentGrowth5:36.7, rentGrowth10:77, rentGrowth20:null,
    rentCagr3:9.2, rentCagr5:6.5, rentCagr10:5.9, rentCagr20:null, rentCagrMax:1.3, rentCagrMaxYears:18,
    rentMaxHistoric:10.8, rentMaxHistoricDate:'2026-04', rentPctFromMax:0 },
  { id:'galicia', name:'Galicia', price:1549, rent:9.70,
    ...ITP_RATES.galicia, color:'#a8d8a8', airbnbRestricted:false,
    growth1:8.9, growth5:16.2, growth10:12.2, growth20:3.3,
    cagr3:4.6, cagr5:3, cagr10:1.2, cagr20:0.2, cagrMax:0.2, cagrMaxYears:19.5,
    maxHistoric:1775, maxHistoricDate:'2011-11', pctFromMax:-12.7,
    rentGrowth1:4.3, rentGrowth5:36.6, rentGrowth10:79.6, rentGrowth20:null,
    rentCagr3:7.5, rentCagr5:6.4, rentCagr10:6, rentCagr20:null, rentCagrMax:0.1, rentCagrMaxYears:18.9,
    rentMaxHistoric:9.7, rentMaxHistoricDate:'2026-04', rentPctFromMax:0 },
  { id:'la_rioja', name:'La Rioja', price:1470, rent:9.30,
    ...ITP_RATES.la_rioja, color:'#c8d894', airbnbRestricted:false,
    growth1:1.1, growth5:18.7, growth10:31.8, growth20:null,
    cagr3:4.9, cagr5:3.5, cagr10:2.8, cagr20:null, cagrMax:0.3, cagrMaxYears:18.8,
    maxHistoric:1652, maxHistoricDate:'2008-01', pctFromMax:-11,
    rentGrowth1:1.3, rentGrowth5:36.8, rentGrowth10:86, rentGrowth20:null,
    rentCagr3:8.4, rentCagr5:6.5, rentCagr10:6.4, rentCagr20:null, rentCagrMax:2.5, rentCagrMaxYears:15.9,
    rentMaxHistoric:9.3, rentMaxHistoricDate:'2026-04', rentPctFromMax:0 },
  { id:'castilla_leon', name:'Castilla y León', price:1323, rent:9.50,
    ...ITP_RATES.castilla_leon, color:'#94b8c8', airbnbRestricted:false,
    growth1:9.1, growth5:16.7, growth10:14.9, growth20:8.7,
    cagr3:4.5, cagr5:3.1, cagr10:1.4, cagr20:0.4, cagrMax:0.4, cagrMaxYears:19.8,
    maxHistoric:1481, maxHistoricDate:'2011-06', pctFromMax:-10.7,
    rentGrowth1:6.7, rentGrowth5:37.7, rentGrowth10:79.2, rentGrowth20:null,
    rentCagr3:8.2, rentCagr5:6.6, rentCagr10:6, rentCagr20:null, rentCagrMax:2.9, rentCagrMaxYears:18.4,
    rentMaxHistoric:9.5, rentMaxHistoricDate:'2026-04', rentPctFromMax:0 },
  { id:'clm', name:'C.-La Mancha', price:1091, rent:8.60,
    ...ITP_RATES.clm, color:'#a8a8a8', airbnbRestricted:false,
    growth1:13.6, growth5:26, growth10:26, growth20:-20.4,
    cagr3:6.8, cagr5:4.7, cagr10:2.3, cagr20:-1.1, cagrMax:-1.1, cagrMaxYears:19.9,
    maxHistoric:1424, maxHistoricDate:'2007-05', pctFromMax:-23.4,
    rentGrowth1:11.7, rentGrowth5:48.3, rentGrowth10:91.1, rentGrowth20:null,
    rentCagr3:10.3, rentCagr5:8.2, rentCagr10:6.7, rentCagr20:null, rentCagrMax:2.5, rentCagrMaxYears:18.5,
    rentMaxHistoric:8.6, rentMaxHistoricDate:'2026-04', rentPctFromMax:0 },
  { id:'extremadura', name:'Extremadura', price:1071, rent:7.50,
    ...ITP_RATES.extremadura, color:'#b8a894', airbnbRestricted:false,
    growth1:1.8, growth5:15.8, growth10:15.2, growth20:null,
    cagr3:3.9, cagr5:3, cagr10:1.4, cagr20:null, cagrMax:-0.4, cagrMaxYears:19,
    maxHistoric:1217, maxHistoricDate:'2011-04', pctFromMax:-12,
    rentGrowth1:0.4, rentGrowth5:41.5, rentGrowth10:70.5, rentGrowth20:null,
    rentCagr3:7.7, rentCagr5:7.2, rentCagr10:5.5, rentCagr20:null, rentCagrMax:2, rentCagrMaxYears:16.8,
    rentMaxHistoric:7.5, rentMaxHistoricDate:'2026-04', rentPctFromMax:0 }
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

// Нотариус + регистр (одинаково для всех регионов)
const NOTARY_RATE = 0.015;

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
