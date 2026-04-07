// Debug script to verify color distribution with new palette
const flipScorePalette = {
  stops: [{v:3.5,c:'#FAEEDA'},{v:4.4,c:'#EF9F27'},{v:4.66,c:'#BA7517'},{v:5.17,c:'#854F0B'},{v:999,c:'#412402'}]
};

const testScores = [
  { region: 'Madrid', score: 3.55 },
  { region: 'País Vasco', score: 3.53 },
  { region: 'Cataluña', score: 4.39 },
  { region: 'Baleares', score: 4.31 },
  { region: 'La Rioja', score: 4.43 },
  { region: 'Navarra', score: 4.44 },
  { region: 'Asturias', score: 4.44 },
  { region: 'Castilla y León', score: 4.45 },
  { region: 'Extremadura', score: 4.45 },
  { region: 'Galicia', score: 4.49 },
  { region: 'Cantabria', score: 4.56 },
  { region: 'Aragón', score: 4.61 },
  { region: 'Andalucía', score: 4.66 },
  { region: 'C.-La Mancha', score: 4.67 },
  { region: 'Valencia', score: 5.09 },
  { region: 'Murcia', score: 5.17 },
  { region: 'Canarias', score: 5.44 }
];

function getColorForScore(score) {
  for (let stop of flipScorePalette.stops) {
    if (score < stop.v) return stop.c;
  }
  return flipScorePalette.stops[flipScorePalette.stops.length - 1].c;
}

const colorMap = {};
testScores.forEach(item => {
  const color = getColorForScore(item.score);
  if (!colorMap[color]) colorMap[color] = [];
  colorMap[color].push(item);
});

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║          FLIP SCORE COLOR DISTRIBUTION (Updated Palette)          ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

Object.entries(colorMap).forEach(([color, regions]) => {
  const colorName = {
    '#FAEEDA': 'Light Yellow    (< 3.5)',
    '#EF9F27': 'Orange          (3.5-4.4)',
    '#BA7517': 'Brown           (4.4-4.66)',
    '#854F0B': 'Dark Brown      (4.66-5.17)',
    '#412402': 'Very Dark       (5.17+)'
  }[color] || color;
  
  console.log(`${colorName}:`);
  regions.forEach(r => {
    console.log(`  • ${r.region.padEnd(18)} ${r.score.toFixed(2)}`);
  });
  console.log();
});

const uniqueColors = new Set(testScores.map(item => getColorForScore(item.score)));
console.log(`Total unique colors: ${uniqueColors.size}/5 colors displayed\n`);
