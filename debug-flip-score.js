// Debug script to check Flip Score calculations
const REGIONS = [
  { id:'baleares',      name:'Baleares',        price:4905, rent:18.70, growth10:113 },
  { id:'madrid',        name:'Madrid',          price:4234, rent:20.30, growth10:86 },
  { id:'pais_vasco',    name:'País Vasco',      price:3035, rent:14.90, growth10:56 },
  { id:'canarias',      name:'Canarias',        price:2789, rent:12.90, growth10:107 },
  { id:'cataluna',      name:'Cataluña',        price:2560, rent:20.02, growth10:55 },
  { id:'andalucia',     name:'Andalucía',       price:2468, rent:12.60, growth10:72 },
  { id:'valencia',      name:'Valencia',        price:2207, rent:14.90, growth10:70 },
  { id:'cantabria',     name:'Cantabria',       price:1750, rent:9.50,  growth10:46 },
  { id:'navarra',       name:'Navarra',         price:1800, rent:9.80,  growth10:44 },
  { id:'galicia',       name:'Galicia',         price:1650, rent:8.20,  growth10:43 },
  { id:'aragon',        name:'Aragón',          price:1600, rent:8.00,  growth10:45 },
  { id:'asturias',      name:'Asturias',        price:1480, rent:7.80,  growth10:35 },
  { id:'murcia',        name:'Murcia',          price:1250, rent:7.50,  growth10:47 },
  { id:'la_rioja',      name:'La Rioja',        price:1400, rent:7.20,  growth10:33 },
  { id:'castilla_leon', name:'Castilla y León', price:1300, rent:6.80,  growth10:30 },
  { id:'extremadura',   name:'Extremadura',     price:900,  rent:6.00,  growth10:15 },
  { id:'clm',           name:'C.-La Mancha',    price:850,  rent:5.80,  growth10:21 },
];

const PALETTES = {
  flip_score: {
    stops: [{v:2,c:'#FAEEDA'},{v:4,c:'#EF9F27'},{v:6,c:'#BA7517'},{v:8,c:'#854F0B'},{v:999,c:'#412402'}]
  }
};

function calculateFlipScore(region) {
  // Формула оценки для флиппинга (от 0 до 10)
  // 1. Рост цен (40% веса)
  const growthScore = Math.min(4, region.growth10 / 30);
  
  // 2. Доступность цены (30% веса) - чем ниже цена, тем лучше
  const priceScore = Math.min(3, Math.max(0, (4000 - region.price) / 1000));
  
  // 3. Доходность аренды (30% веса)
  const yieldScore = Math.min(3, region.rent / region.price * 100 / 0.7);
  
  const total = growthScore + priceScore + yieldScore;
  return Math.max(0, Math.min(10, total));
}

function getColor(score) {
  const stops = PALETTES.flip_score.stops;
  for (const stop of stops) {
    if (score <= stop.v) return stop.c;
  }
  return stops[stops.length - 1].c;
}

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('FLIP SCORE ANALYSIS - All 17 Regions');
console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('');

const results = [];
let colorCounts = {};

REGIONS.forEach(r => {
  const growthScore = Math.min(4, r.growth10 / 30);
  const priceScore = Math.min(3, Math.max(0, (4000 - r.price) / 1000));
  const yieldScore = Math.min(3, r.rent / r.price * 100 / 0.7);
  const total = growthScore + priceScore + yieldScore;
  const score = Math.max(0, Math.min(10, total));
  const color = getColor(score);
  
  results.push({
    name: r.name,
    growth: r.growth10,
    price: r.price,
    rent: r.rent,
    growthScore,
    priceScore,
    yieldScore,
    score,
    color
  });
  
  colorCounts[color] = (colorCounts[color] || 0) + 1;
});

// Sort by score descending
results.sort((a, b) => b.score - a.score);

console.log('Color Legend:');
console.log('  #FAEEDA (Light): 0-2 points');
console.log('  #EF9F27 (Orange): 2-4 points');
console.log('  #BA7517 (Brown): 4-6 points');
console.log('  #854F0B (Dark Brown): 6-8 points');
console.log('  #412402 (Very Dark): 8+ points');
console.log('');
console.log('═══════════════════════════════════════════════════════════════════════════════');

results.forEach(r => {
  const colorEmoji = {
    '#FAEEDA': '🟡',
    '#EF9F27': '🟠',
    '#BA7517': '🟤',
    '#854F0B': '🟰',
    '#412402': '⬛'
  }[r.color] || '?';
  
  console.log(`${colorEmoji} ${r.name.padEnd(20)} Score: ${r.score.toFixed(2).padEnd(5)} ` +
    `(G:${r.growthScore.toFixed(2)} + P:${r.priceScore.toFixed(2)} + Y:${r.yieldScore.toFixed(2)}) ` +
    `Color: ${r.color}`);
});

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('Color Distribution:');
console.log('');

Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).forEach(([color, count]) => {
  const colorName = {
    '#FAEEDA': 'Light (0-2)',
    '#EF9F27': 'Orange (2-4)',
    '#BA7517': 'Brown (4-6)',
    '#854F0B': 'Dark Brown (6-8)',
    '#412402': 'Very Dark (8+)'
  }[color] || 'Unknown';
  console.log(`${color} ${colorName.padEnd(20)} : ${count} regions`);
});

console.log('');
console.log('ISSUE ANALYSIS:');
console.log('If only 2 regions have different colors, the most likely causes are:');
console.log('1. Score calculation formula is wrong - needs wider distribution');
console.log('2. Most regions scoring in same narrow range (4-6)');
console.log('3. The formula needs tuning to spread scores across 0-10 range');
console.log('');
