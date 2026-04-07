// ============================================================
// data.js — все данные приложения
// Чтобы обновить цены: измените числа в REGIONS
// Чтобы добавить регион: добавьте объект в массив REGIONS
// Последнее обновление: Q4 2025
// ============================================================

const DATA_UPDATED = 'Q4 2025';
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

const REGIONS = [
  { id:'baleares',      name:'Baleares',        price:4905, rent:18.70, itp:0.08,  growth10:113, color:'#c9a84c' },
  { id:'madrid',        name:'Madrid',          price:4234, rent:20.30, itp:0.06,  growth10:86,  color:'#4a90d9' },
  { id:'pais_vasco',    name:'País Vasco',      price:3035, rent:14.90, itp:0.07,  growth10:56,  color:'#5cb88a' },
  { id:'canarias',      name:'Canarias',        price:2789, rent:12.90, itp:0.065, growth10:107, color:'#9b7fd4' },
  { id:'cataluna',      name:'Cataluña',        price:2560, rent:20.02, itp:0.10,  growth10:55,  color:'#e07a5f' },
  { id:'andalucia',     name:'Andalucía',       price:2468, rent:12.60, itp:0.07,  growth10:72,  color:'#f2cc8f' },
  { id:'valencia',      name:'Valencia',        price:2207, rent:14.90, itp:0.10,  growth10:70,  color:'#81b29a' },
  { id:'cantabria',     name:'Cantabria',       price:1750, rent:9.50,  itp:0.10,  growth10:46,  color:'#a8c5da' },
  { id:'navarra',       name:'Navarra',         price:1800, rent:9.80,  itp:0.06,  growth10:44,  color:'#d4a5a5' },
  { id:'galicia',       name:'Galicia',         price:1650, rent:8.20,  itp:0.10,  growth10:43,  color:'#a8d8a8' },
  { id:'aragon',        name:'Aragón',          price:1600, rent:8.00,  itp:0.08,  growth10:45,  color:'#c9b7d8' },
  { id:'asturias',      name:'Asturias',        price:1480, rent:7.80,  itp:0.08,  growth10:35,  color:'#b8c9d8' },
  { id:'murcia',        name:'Murcia',          price:1250, rent:7.50,  itp:0.08,  growth10:47,  color:'#d8b894' },
  { id:'la_rioja',      name:'La Rioja',        price:1400, rent:7.20,  itp:0.07,  growth10:33,  color:'#c8d894' },
  { id:'castilla_leon', name:'Castilla y León', price:1300, rent:6.80,  itp:0.08,  growth10:30,  color:'#94b8c8' },
  { id:'extremadura',   name:'Extremadura',     price:900,  rent:6.00,  itp:0.08,  growth10:15,  color:'#b8a894' },
  { id:'clm',           name:'C.-La Mancha',    price:850,  rent:5.80,  itp:0.09,  growth10:21,  color:'#a8a8a8' },
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
  r.growth1    = GROWTH_DATA[r.name] ? GROWTH_DATA[r.name][GROWTH_DATA[r.name].length - 1] : 0;
});
