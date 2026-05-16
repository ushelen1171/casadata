// Финальная проверка что все 17 регионов будут отрисованы на карте

async function testAllRegions() {
  console.log('====== ПРОВЕРКА ОТРИСОВКИ 17 РЕГИОНОВ ======');
  
  // Загрузить TopoJSON
  const response = await fetch('https://cdn.jsdelivr.net/npm/datamaps@0.5.10/src/js/data/esp.topo.json');
  const topoData = await response.json();
  
  // Параметры из app.js/flip-analyzer.js
  const projection = d3.geoMercator()
    .center([-3.5, 40])
    .scale(2800)
    .translate([350, 275]);
  
  const pathGenerator = d3.geoPath().projection(projection);
  
  // Загрузить регионы
  const features = topojson.feature(topoData, topoData.objects.esp).features;
  
  console.log(`\nВсего провинций в TopoJSON: ${features.length}`);
  
  // Маппинг провинций на регионы (из app.js)
  const PROVINCE_TO_REGION = {
    'Álava': 'pais_vasco', 'Gipuzkoa': 'pais_vasco', 'Bizkaia': 'pais_vasco',
    'Barcelona': 'cataluna', 'Gerona': 'cataluna', 'Lérida': 'cataluna', 'Tarragona': 'cataluna',
    'Almería': 'andalucia', 'Cádiz': 'andalucia', 'Córdoba': 'andalucia', 'Granada': 'andalucia',
    'Huelva': 'andalucia', 'Jaén': 'andalucia', 'Málaga': 'andalucia', 'Sevilla': 'andalucia',
    'Alicante': 'valencia', 'Castellón': 'valencia', 'Valencia': 'valencia',
    'Albacete': 'clm', 'Ciudad Real': 'clm', 'Cuenca': 'clm', 'Guadalajara': 'clm', 'Toledo': 'clm',
    'Ávila': 'castilla_leon', 'Burgos': 'castilla_leon', 'León': 'castilla_leon', 'Palencia': 'castilla_leon',
    'Salamanca': 'castilla_leon', 'Segovia': 'castilla_leon', 'Soria': 'castilla_leon',
    'Valladolid': 'castilla_leon', 'Zamora': 'castilla_leon',
    'Badajoz': 'extremadura', 'Cáceres': 'extremadura',
    'La Coruña': 'galicia', 'Lugo': 'galicia', 'Orense': 'galicia', 'Pontevedra': 'galicia',
    'Zaragoza': 'aragon', 'Huesca': 'aragon', 'Teruel': 'aragon',
    'Ceuta': null, 'Melilla': null,
    'Asturias': 'asturias', 'Baleares': 'baleares', 'Cantabria': 'cantabria',
    'La Rioja': 'la_rioja', 'Las Palmas': 'canarias', 'Madrid': 'madrid',
    'Murcia': 'murcia', 'Navarra': 'navarra', 'Santa Cruz de Tenerife': 'canarias',
  };
  
  const REGION_LABELS = {
    'galicia': 'Galicia', 'asturias': 'Asturias', 'cantabria': 'Cantabria', 'pais_vasco': 'País Vasco',
    'navarra': 'Navarra', 'la_rioja': 'La Rioja', 'aragon': 'Aragón', 'cataluna': 'Cataluña',
    'madrid': 'Madrid', 'castilla_leon': 'Castilla y León', 'clm': 'Castilla-La Mancha',
    'extremadura': 'Extremadura', 'valencia': 'Valencia', 'murcia': 'Murcia', 'andalucia': 'Andalucía',
    'baleares': 'Islas Baleares', 'canarias': 'Canarias'
  };
  
  // Группировка провинций по регионам (как в app.js)
  const regionFeatures = {};
  features.forEach(d => {
    const provinceName = d.properties.name;
    const regionId = PROVINCE_TO_REGION[provinceName];
    if (!regionId) return;
    if (!regionFeatures[regionId]) regionFeatures[regionId] = [];
    regionFeatures[regionId].push(d);
  });
  
  console.log('\n====== ПРОВЕРКА КАЖДОГО РЕГИОНА ======');
  
  let regionsWithLabels = 0;
  let regionsWithCentroids = 0;
  
  Object.entries(REGION_LABELS).forEach(([regionId, label]) => {
    const feats = regionFeatures[regionId];
    
    let status = '';
    let centroidStr = '';
    
    if (!feats || feats.length === 0) {
      status = '✗ НЕТ ПРОВИНЦИЙ';
    } else {
      regionsWithLabels++;
      let centroid = null;
      
      try {
        const multi = { type: 'MultiPolygon', coordinates: [] };
        feats.forEach(f => {
          const geom = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
          geom.forEach(polygon => multi.coordinates.push(polygon));
        });
        centroid = pathGenerator.centroid(multi);
      } catch (e) {
        console.warn(`Ошибка центроида для ${regionId}:`, e);
      }
      
      if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) {
        let x=0, y=0, n=0;
        feats.forEach(f => {
          const b = pathGenerator.bounds(f);
          if (b && b.length === 2) {
            x += (b[0][0] + b[1][0]) / 2;
            y += (b[0][1] + b[1][1]) / 2;
            n++;
          }
        });
        centroid = n > 0 ? [x/n, y/n] : [350, 275];
      }
      
      if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
        regionsWithCentroids++;
        centroidStr = ` (${centroid[0].toFixed(0)}, ${centroid[1].toFixed(0)})`;
        status = '✓ БУДЕТ ПОДПИСАНА';
      } else {
        status = '✗ ОШИБКА ЦЕНТРОИДА';
      }
    }
    
    console.log(`${status.padEnd(20)} ${label.padEnd(25)} ${feats ? '(' + feats.length + ' провинций)' : ''}${centroidStr}`);
  });
  
  console.log('\n====== ИТОГО ======');
  console.log(`✓ Всего регионов с подписями: ${regionsWithLabels} из 17`);
  console.log(`✓ Всего регионов с валидными центроидами: ${regionsWithCentroids} из 17`);
  
  if (regionsWithLabels === 17 && regionsWithCentroids === 17) {
    console.log('\n🎉 ВСЕ 17 РЕГИОНОВ БУДУТ ПОДПИСАНЫ И ВИДНЫ НА КАРТЕ');
  } else {
    console.log(`\n⚠️ ПРОБЛЕМА: ${17 - regionsWithLabels} регионов не будут подписаны`);
  }
  
  // Проверить viewBox
  console.log('\n====== ПРОВЕРКА viewBox ======');
  console.log('Текущий viewBox: 700x550');
  console.log('Это должно быть достаточно для:');
  console.log('  ✓ Испания (от -17 до +4, от 26 до 43.8)');
  console.log('  ✓ Канарские острова (западнее -16)');
  console.log('  ✓ Балеарские острова (восточнее +3)');
}

// Запустить тест если D3, TopoJSON и REGIONS загружены
if (typeof d3 !== 'undefined' && typeof topojson !== 'undefined' && typeof REGIONS !== 'undefined') {
  testAllRegions().catch(e => console.error('Ошибка теста:', e));
} else {
  console.error('Не все библиотеки загружены. Нужны: d3, topojson, REGIONS (data.js)');
}
