// Простой тест для проверки что все 17 регионов будут подписаны

const REGION_LABELS = {
  'galicia': 'Galicia', 'asturias': 'Asturias', 'cantabria': 'Cantabria', 'pais_vasco': 'País Vasco',
  'navarra': 'Navarra', 'la_rioja': 'La Rioja', 'aragon': 'Aragón', 'cataluna': 'Cataluña',
  'madrid': 'Madrid', 'castilla_leon': 'Castilla y León', 'clm': 'Castilla-La Mancha',
  'extremadura': 'Extremadura', 'valencia': 'Valencia', 'murcia': 'Murcia', 'andalucia': 'Andalucía',
  'baleares': 'Islas Baleares', 'canarias': 'Canarias'
};

const PROVINCE_TO_REGION = {
  // País Vasco
  'Álava': 'pais_vasco',
  'Gipuzkoa': 'pais_vasco',
  'Bizkaia': 'pais_vasco',
  
  // Cataluña
  'Barcelona': 'cataluna',
  'Gerona': 'cataluna',
  'Lérida': 'cataluna',
  'Tarragona': 'cataluna',
  
  // Andalucía
  'Almería': 'andalucia',
  'Cádiz': 'andalucia',
  'Córdoba': 'andalucia',
  'Granada': 'andalucia',
  'Huelva': 'andalucia',
  'Jaén': 'andalucia',
  'Málaga': 'andalucia',
  'Sevilla': 'andalucia',
  
  // Valencia
  'Alicante': 'valencia',
  'Castellón': 'valencia',
  'Valencia': 'valencia',
  
  // Castilla-La Mancha
  'Albacete': 'clm',
  'Ciudad Real': 'clm',
  'Cuenca': 'clm',
  'Guadalajara': 'clm',
  'Toledo': 'clm',
  
  // Castilla y León
  'Ávila': 'castilla_leon',
  'Burgos': 'castilla_leon',
  'León': 'castilla_leon',
  'Palencia': 'castilla_leon',
  'Salamanca': 'castilla_leon',
  'Segovia': 'castilla_leon',
  'Soria': 'castilla_leon',
  'Valladolid': 'castilla_leon',
  'Zamora': 'castilla_leon',
  
  // Extremadura
  'Badajoz': 'extremadura',
  'Cáceres': 'extremadura',
  
  // Galicia
  'La Coruña': 'galicia',
  'Lugo': 'galicia',
  'Orense': 'galicia',
  'Pontevedra': 'galicia',
  
  // Aragón
  'Zaragoza': 'aragon',
  'Huesca': 'aragon',
  'Teruel': 'aragon',
  
  // Sin región
  'Ceuta': null,
  'Melilla': null,
  
  // Otro
  'Asturias': 'asturias',
  'Baleares': 'baleares',
  'Cantabria': 'cantabria',
  'La Rioja': 'la_rioja',
  'Las Palmas': 'canarias',
  'Madrid': 'madrid',
  'Murcia': 'murcia',
  'Navarra': 'navarra',
  'Santa Cruz de Tenerife': 'canarias',
};

console.log('=== ПРОВЕРКА 17 РЕГИОНОВ ===');
console.log(`Всего регионов в REGION_LABELS: ${Object.keys(REGION_LABELS).length}`);
console.log('');

// Проверить какие провинции belong к каждому региону
const regionFeatures = {};
Object.entries(PROVINCE_TO_REGION).forEach(([province, regionId]) => {
  if (regionId === null) return; // Skip Ceuta/Melilla
  if (!regionFeatures[regionId]) regionFeatures[regionId] = [];
  regionFeatures[regionId].push(province);
});

console.log('Регионы и их провинции:');
Object.entries(REGION_LABELS).forEach(([regionId, label]) => {
  const provinces = regionFeatures[regionId] || [];
  const status = provinces.length > 0 ? '✓' : '✗ MISSING';
  console.log(`${status} ${regionId.padEnd(20)} "${label}" — ${provinces.length} провинций`);
  if (provinces.length > 0) {
    console.log(`    → ${provinces.join(', ')}`);
  }
});

console.log('');
console.log('=== ИТОГО ===');
const missingRegions = Object.entries(REGION_LABELS)
  .filter(([id]) => !regionFeatures[id] || regionFeatures[id].length === 0)
  .map(([id, label]) => `${id} (${label})`);

if (missingRegions.length === 0) {
  console.log('✓ ВСЕ 17 РЕГИОНОВ ИМЕЮТ ПРОВИНЦИИ И БУДУТ ПОДПИСАНЫ');
} else {
  console.log(`✗ НЕДОСТАЮЩИЕ РЕГИОНЫ (${missingRegions.length}):`);
  missingRegions.forEach(r => console.log(`  - ${r}`));
}
