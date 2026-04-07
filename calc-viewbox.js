const scale = 2800;
const center = [-3.5, 40];

// Известные границы Испании  
const bounds = {
  minLon: -17.5, maxLon: 4.5,
  minLat: 26, maxLat: 43.8
};

const points = [
  [bounds.minLon, bounds.minLat],  // SW
  [bounds.maxLon, bounds.minLat],  // SE  
  [bounds.minLon, bounds.maxLat],  // NW
  [bounds.maxLon, bounds.maxLat],  // NE
];

let minX = Infinity, maxX = -Infinity;
let minY = Infinity, maxY = -Infinity;

points.forEach(([lon, lat]) => {
  const rlon = (lon - center[0]) * Math.PI / 180;
  const rlat = (lat - center[1]) * Math.PI / 180;
  
  const x = scale * rlon;
  const sinLat = Math.sin(rlat);
  const y = scale * Math.log((1 + sinLat) / (1 - sinLat)) / 2;
  
  minX = Math.min(minX, x);
  maxX = Math.max(maxX, x);
  minY = Math.min(minY, y);
  maxY = Math.max(maxY, y);
});

const projWidth = Math.ceil(maxX - minX);
const projHeight = Math.ceil(maxY - minY);
const margin = 50;
const viewBoxWidth = projWidth + 2*margin;
const viewBoxHeight = projHeight + 2*margin;

console.log('Спроектированные границы:');
console.log('X: от', minX.toFixed(0), 'до', maxX.toFixed(0));
console.log('Y: от', minY.toFixed(0), 'до', maxY.toFixed(0));
console.log('');
console.log('РЕКОМЕНДУЕМЫЕ ЗНАЧЕНИЯ:');
console.log('viewBox: 0 0 ' + viewBoxWidth + ' ' + viewBoxHeight);
console.log('width: ' + viewBoxWidth);
console.log('height: ' + viewBoxHeight);
console.log('translate: [' + (viewBoxWidth/2).toFixed(0) + ', ' + (viewBoxHeight/2).toFixed(0) + ']');
