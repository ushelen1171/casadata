// ============================================================
// flip-analyzer.js — калькулятор Fix & Flip сделок
// ============================================================

let currentFlipMode = 'growth';
let selectedRegion = null;
let flipChart = null;

// SVG paths for Spain regions (from spain-map-widget.html)
const SHAPES = {
  galicia: 'M55,55 L110,50 L125,75 L115,105 L80,115 L58,95 Z',
  asturias: 'M110,50 L178,46 L188,70 L165,85 L125,75 Z',
  cantabria: 'M178,46 L220,44 L226,68 L188,70 Z',
  pais_vasco: 'M220,44 L268,38 L274,66 L240,70 L226,68 Z',
  navarra: 'M268,38 L308,42 L306,82 L274,84 L274,66 Z',
  la_rioja: 'M226,68 L274,66 L274,84 L255,90 L232,84 Z',
  aragon: 'M274,84 L306,82 L328,88 L334,170 L280,175 L270,145 L274,118 Z',
  cataluna: 'M306,82 L388,65 L398,96 L380,140 L334,170 L328,88 Z',
  castilla_leon: 'M58,95 L80,115 L118,134 L165,150 L212,155 L258,150 L270,145 L232,84 L226,68 L188,70 L165,85 L115,105 Z',
  castilla_y_leon: 'M58,95 L80,115 L118,134 L165,150 L212,155 L258,150 L270,145 L232,84 L226,68 L188,70 L165,85 L115,105 Z',
  madrid: 'M212,155 L258,150 L264,180 L242,195 L212,190 Z',
  clm: 'M118,134 L165,150 L212,155 L212,190 L242,195 L264,180 L280,205 L336,170 L304,215 L284,264 L242,274 L185,260 L136,230 L116,196 Z',
  c_la_mancha: 'M118,134 L165,150 L212,155 L212,190 L242,195 L264,180 L280,205 L336,170 L304,215 L284,264 L242,274 L185,260 L136,230 L116,196 Z',
  extremadura: 'M62,156 L118,134 L116,196 L136,230 L118,264 L78,270 L54,236 L58,192 Z',
  valencia: 'M334,170 L380,140 L405,166 L412,225 L388,274 L354,290 L334,260 L304,215 Z',
  murcia: 'M354,290 L388,274 L412,248 L398,330 L365,336 L340,310 Z',
  andalucia: 'M78,270 L118,264 L136,230 L185,260 L242,274 L284,264 L340,260 L340,310 L365,336 L344,364 L296,390 L225,400 L152,386 L94,352 L68,307 Z',
  baleares: 'M390,152 L428,148 L436,162 L422,172 L396,170 Z',
  canarias: 'M20,320 L200,320 L200,400 L20,400 Z',
};

// Стоимость ремонта €/м² (Idealista, Terreta Spain 2025)
const RENOVATION_COSTS = {
  light: 350,     // Лёгкий
  standard: 700,  // Стандарт
  premium: 1100   // Премиум
};

// ---- ИНИЦИАЛИЗАЦИЯ ----
async function initFlipAnalyzer() {
  await buildFlipMap();
  renderFlipCalcContent();
  renderFlipComparison();
  setFlipMode('growth');
  // Установить начальный регион для первой вкладки
  setTimeout(() => {
    const select = document.getElementById('flip-region-select');
    if (select) {
      select.value = 'Madrid';
      onFlipRegionChange();
    }
    // Установить начальный регион для второй вкладки
    const targetSelect = document.getElementById('flip-target-region-select');
    if (targetSelect) {
      targetSelect.value = 'Madrid';
      onFlipTargetRegionChange();
    }
  }, 100);
}

// ---- ОБРАБОТЧИКИ ИЗМЕНЕНИЙ ----
function onFlipRegionChange() {
  const regionName = document.getElementById('flip-region-select').value;
  const region = REGIONS.find(r => r.name === regionName);
  if (!region) return;

  // Автозаполнение ITP из данных региона
  const itpField = document.getElementById('flip-itp-pct');
  if (itpField) {
    itpField.value = (region.itp * 100).toFixed(1);
  }

  // Пересчет стоимости ремонта
  onFlipRenovationTypeChange();

  // Пересчет сделки
  calcFlipDeal();
}

function onFlipRenovationTypeChange() {
  const regionName = document.getElementById('flip-region-select').value;
  const renovationType = document.getElementById('flip-renovation-type').value;
  const area = +document.getElementById('flip-area').value || 70;

  const costPerSqm = RENOVATION_COSTS[renovationType];
  const totalCost = costPerSqm * area;

  const renovationField = document.getElementById('flip-renovation');
  if (renovationField) {
    renovationField.value = totalCost;
  }

  // Пересчет сделки
  calcFlipDeal();
}

function onFlipTargetRegionChange() {
  const regionName = document.getElementById('flip-target-region-select').value;
  const region = REGIONS.find(r => r.name === regionName);
  if (!region) return;

  // Автозаполнение ITP из данных региона
  const itpField = document.getElementById('flip-target-itp');
  if (itpField) {
    itpField.value = (region.itp * 100).toFixed(1);
  }

  // Пересчет стоимости ремонта
  onFlipTargetRenovationTypeChange();

  // Пересчет
  calcMaxBuyPrice();
}

function onFlipTargetRenovationTypeChange() {
  const renovationType = document.getElementById('flip-target-renovation-type').value;
  const area = 70; // Предполагаем стандартную площадь для второй вкладки

  const costPerSqm = RENOVATION_COSTS[renovationType];
  const totalCost = costPerSqm * area;

  const renovationField = document.getElementById('flip-target-renovation');
  if (renovationField) {
    renovationField.value = totalCost;
  }

  // Пересчет
  calcMaxBuyPrice();
}

// ---- КАРТА РЕГИОНОВ ФЛИППИНГА ----
let flipMapMode='growth', flipMapSel=null, flipTopoData=null, flipRegionsByNameGlobal={};

async function buildFlipMap(){
  // Убедиться что TopoJSON загружена
  if (!topoData) {
    console.log('Ожидание загрузки TopoJSON...');
    // Попробовать несколько раз с задержкой
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (topoData) break;
    }
    if (!topoData) {
      console.error('TopoJSON не загружена');
      return;
    }
  }
  
  const svg = d3.select('#flip-spain-svg');
  if(svg.empty()) return;
  svg.html('');
  const width = 700, height = 560;
  svg.attr('viewBox', `0 0 ${width} ${height}`);
  const background = svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#0e0f11');

  flipTopoData = topoData;
  const features = topojson.feature(flipTopoData, flipTopoData.objects.esp).features;

  // Отделяем Канары — они рисуются как врезка, не участвуют в подгонке проекции
  const CANARIAS_PROVINCES = new Set(['Las Palmas', 'Santa Cruz de Tenerife']);
  const peninsulaFeatures = features.filter(f => !CANARIAS_PROVINCES.has(f.properties.name));

  // fitExtent: материк + Балеары заполняют весь viewBox
  const projection = d3.geoMercator()
    .fitExtent([[12, 8], [width - 12, height - 12]], { type: 'FeatureCollection', features: peninsulaFeatures });
  const pathGenerator = d3.geoPath().projection(projection);
  
  // Создать маппинг: id → region data
  flipRegionsByNameGlobal = {};
  REGIONS.forEach(r => {
    flipRegionsByNameGlobal[r.id] = r;
  });
  
  // Карта сокращенных названий для регионов
  const REGION_SHORT_NAMES = {
    'baleares': 'Baleares',
    'madrid': 'Madrid',
    'pais_vasco': 'P. Vasco',
    'canarias': 'Canarias',
    'cataluna': 'Cataluña',
    'andalucia': 'Andalucía',
    'valencia': 'Valencia',
    'cantabria': 'Cantabria',
    'navarra': 'Navarra',
    'galicia': 'Galicia',
    'aragon': 'Aragón',
    'asturias': 'Asturias',
    'murcia': 'Murcia',
    'la_rioja': 'La Rioja',
    'castilla_leon': 'Cast. y León',
    'extremadura': 'Extremadura',
    'clm': 'C. Mancha'
  };
  
  // Рендерить провинции
  svg.selectAll('path')
    .data(features)
    .enter()
    .append('path')
    .attr('d', pathGenerator)
    .attr('stroke', '#0e0f11')
    .attr('stroke-width', 2)
    .attr('stroke-linejoin', 'miter')
    .attr('stroke-linecap', 'round')
    .attr('fill', '#555')
    .style('cursor', 'pointer')
    .on('mouseenter', function(e, d) {
      const provinceName = d.properties.name;
      const regionId = PROVINCE_TO_REGION[provinceName];
      if (!regionId) return;
      const region = flipRegionsByNameGlobal[regionId];
      if (!region) return;
      d3.select(this).attr('stroke-width', 3);
      showFlipTooltip(e, region);
    })
    .on('mousemove', moveFlipTooltip)
    .on('mouseleave', function(e, d) {
      const provinceName = d.properties.name;
      const regionId = PROVINCE_TO_REGION[provinceName];
      if (!regionId) return;
      d3.select(this).attr('stroke-width', regionId === flipMapSel ? 3 : 2);
      hideFlipTooltip();
    })
    .on('click', function(e, d) {
      const provinceName = d.properties.name;
      const regionId = PROVINCE_TO_REGION[provinceName];
      if (!regionId) return;
      const region = flipRegionsByNameGlobal[regionId];
      if (region) selectFlipRegion(region);
    });
  
  // Группировка провинций по регионам
  const regionFeatures = {};
  features.forEach(d => {
    const provinceName = d.properties.name;
    const regionId = PROVINCE_TO_REGION[provinceName];
    if (!regionId) return;
    if (!regionFeatures[regionId]) regionFeatures[regionId] = [];
    regionFeatures[regionId].push(d);
  });

  // Список всех 17 регионов
  const REGION_LABELS = {
    'galicia': 'Galicia', 'asturias': 'Asturias', 'cantabria': 'Cantabria', 'pais_vasco': 'País Vasco',
    'navarra': 'Navarra', 'la_rioja': 'La Rioja', 'aragon': 'Aragón', 'cataluna': 'Cataluña',
    'madrid': 'Madrid', 'castilla_leon': 'Castilla y León', 'clm': 'Castilla-La Mancha',
    'extremadura': 'Extremadura', 'valencia': 'Valencia', 'murcia': 'Murcia', 'andalucia': 'Andalucía',
    'baleares': 'Islas Baleares', 'canarias': 'Canarias'
  };

  Object.entries(REGION_LABELS).forEach(([regionId, label]) => {
    // Канары — только во врезке, не на основной карте
    if (regionId === 'canarias') return;
    const feats = regionFeatures[regionId];
    if (!feats || feats.length === 0) {
      console.warn('Регион не найден:', regionId, label);
      return;
    }
    let centroid = null;
    try {
      const multi = { type: 'MultiPolygon', coordinates: [] };
      feats.forEach(f => {
        const geom = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        geom.forEach(polygon => multi.coordinates.push(polygon));
      });
      centroid = pathGenerator.centroid(multi);
    } catch (e) {
      console.error('Ошибка centroid для', regionId, e);
    }
    if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) {
      let x = 0, y = 0, n = 0;
      feats.forEach(f => {
        const b = pathGenerator.bounds(f);
        if (b && b.length === 2) {
          x += (b[0][0] + b[1][0]) / 2;
          y += (b[0][1] + b[1][1]) / 2;
          n++;
        }
      });
      centroid = n > 0 ? [x/n, y/n] : [width/2, height/2];
    }
    const labelY = regionId === 'extremadura' ? centroid[1] - 12 : centroid[1];
    svg.append('text')
      .attr('x', centroid[0])
      .attr('y', labelY)
      .attr('data-region', regionId)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12')
      .attr('font-weight', '600')
      .attr('fill', getFlipTextColor(regionId))
      .attr('pointer-events', 'none')
      .text(label.toUpperCase());
  });

  // Вернуть легенду
  if (document.getElementById('flip-legend-box')) {
    document.getElementById('flip-legend-box').style.display = 'block';
  }
  
  paintFlipMap();
}

function paintFlipMap(){
  const svg = d3.select('#flip-spain-svg');

  svg.selectAll('path').attr('fill', function(d) {
    const provinceName = d.properties.name;
    const regionId = PROVINCE_TO_REGION[provinceName];
    if (!regionId) return '#333';
    const region = flipRegionsByNameGlobal[regionId];
    if (!region) return '#333';
    return getFlipMapColor(region);
  });

  // Обновить цвет текста: стоп 0 (светлый) → чёрный, остальные → белый
  svg.selectAll('text[data-region]').each(function() {
    const regionId = d3.select(this).attr('data-region');
    d3.select(this).attr('fill', getFlipTextColor(regionId));
  });

  renderFlipCanarias();
  buildFlipLegend();
}

function renderFlipCanarias(){
  const svg = d3.select('#flip-spain-svg');

  // Удалить старый инсет
  svg.selectAll('.canarias-inset').remove();

  if (!flipTopoData || !flipTopoData.objects.esp) return;
  const features = topojson.feature(flipTopoData, flipTopoData.objects.esp).features;
  const canariasFeatures = features.filter(f =>
    f.properties.name === 'Las Palmas' || f.properties.name === 'Santa Cruz de Tenerife'
  );
  if (canariasFeatures.length === 0) return;

  const region = flipRegionsByNameGlobal['canarias'];
  if (!region) return;
  const color = getFlipMapColor(region);

  // Инсет: правый нижний угол — под Балеарами, в пространстве Средиземного моря
  const insetX = 490, insetY = 365, insetW = 200, insetH = 175;
  const labelH = 18; // высота строки подписи внутри блока

  const insetGroup = svg.append('g').attr('class', 'canarias-inset');

  // Фон инсета
  insetGroup.append('rect')
    .attr('x', insetX).attr('y', insetY)
    .attr('width', insetW).attr('height', insetH)
    .attr('fill', '#0a0b0d')
    .attr('rx', 3).attr('ry', 3);

  // Подпись СВЕРХУ (до островов)
  insetGroup.append('text')
    .attr('x', insetX + insetW / 2)
    .attr('y', insetY + labelH - 4)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12')
    .attr('font-weight', '600')
    .attr('fill', '#fff')
    .attr('pointer-events', 'none')
    .text('CANARIAS');

  // fitExtent: острова вписываются в область ПОД подписью
  const canariasCollection = { type: 'FeatureCollection', features: canariasFeatures };
  const insetProjection = d3.geoMercator()
    .fitExtent(
      [[insetX + 6, insetY + labelH + 4], [insetX + insetW - 6, insetY + insetH - 6]],
      canariasCollection
    );
  const insetPathGen = d3.geoPath().projection(insetProjection);

  // Рисуем острова
  insetGroup.selectAll('.canarias-island')
    .data(canariasFeatures)
    .enter()
    .append('path')
    .attr('class', 'canarias-island')
    .attr('d', insetPathGen)
    .attr('fill', color)
    .attr('stroke', '#0e0f11')
    .attr('stroke-width', 0.5)
    .style('pointer-events', 'none');

  // Рамка инсета (поверх карты, видна)
  const borderRect = insetGroup.append('rect')
    .attr('x', insetX).attr('y', insetY)
    .attr('width', insetW).attr('height', insetH)
    .attr('fill', 'none')
    .attr('stroke', '#666').attr('stroke-width', 1)
    .attr('rx', 3).attr('ry', 3)
    .attr('pointer-events', 'none');

  // Невидимый оверлей для hover/click
  insetGroup.append('rect')
    .attr('x', insetX).attr('y', insetY)
    .attr('width', insetW).attr('height', insetH)
    .attr('fill', 'transparent').attr('stroke', 'none')
    .style('cursor', 'pointer')
    .on('mouseenter', function(e) {
      borderRect.attr('stroke', '#aaa').attr('stroke-width', 1.5);
      showFlipTooltip(e, region);
    })
    .on('mousemove', moveFlipTooltip)
    .on('mouseleave', function() {
      borderRect.attr('stroke', '#666').attr('stroke-width', 1);
      hideFlipTooltip();
    })
    .on('click', function() {
      selectFlipRegion(region);
    });
}


function getFlipMapColor(r){
  const palette = getFlipColorPalette(currentFlipMode);
  const value = palette.fn(r);
  for (const stop of palette.stops) {
    if (value <= stop.v) return stop.c;
  }
  return palette.stops[palette.stops.length - 1].c;
}

// Цвет текста: стоп 0 (светлый) → чёрный, иначе → белый
function getFlipTextColor(regionId){
  const region = flipRegionsByNameGlobal[regionId];
  if(!region) return '#ffffff';
  const palette = getFlipColorPalette(currentFlipMode);
  const value = palette.fn(region);
  const stopIdx = palette.stops.findIndex(s => value <= s.v);
  return stopIdx === 0 ? '#111111' : '#ffffff';
}

function getFlipColorPalette(mode) {
  const palettes = {
    growth: {
      fn: r => r.growth10,
      stops: [{v:30,c:'#FAEEDA'},{v:45,c:'#EF9F27'},{v:70,c:'#BA7517'},{v:90,c:'#854F0B'},{v:999,c:'#412402'}]
    },
    secondary_vs_new: {
      fn: r => Math.max(0, r.price * 0.3),
      stops: [{v:100,c:'#E1F5EE'},{v:200,c:'#5DCAA5'},{v:300,c:'#1D9E75'},{v:400,c:'#0F6E56'},{v:9999,c:'#04342C'}]
    },
    flip_score: {
      fn: r => calculateFlipScore(r),
      stops: [{v:3.5,c:'#FAEEDA'},{v:4.4,c:'#EF9F27'},{v:4.66,c:'#BA7517'},{v:5.17,c:'#854F0B'},{v:999,c:'#412402'}]
    }
  };
  return palettes[mode] || palettes.growth;
}

function selectFlipRegion(r){
  flipMapSel=r.id===flipMapSel?null:r.id;
  
  // Для D3 карты - обновить обводку всех провинций этого региона
  if(flipTopoData) {
    const svg = d3.select('#flip-spain-svg');
    svg.selectAll('path').attr('stroke-width', function(d) {
      const provinceName = d.properties.name;
      const regionId = PROVINCE_TO_REGION[provinceName];
      return (regionId === flipMapSel) ? 3 : 2;
    }).attr('stroke', function(d) {
      const provinceName = d.properties.name;
      const regionId = PROVINCE_TO_REGION[provinceName];
      return (regionId === flipMapSel) ? '#c9a84c' : '#0e0f11';
    });
    if(flipMapSel) {
      onFlipRegionChange();
    } else {
      document.querySelectorAll('.reg-row').forEach(el=>el.classList.remove('selected'));
    }
  }
}


function moveFlipTooltip(e){
  const t=document.getElementById('flip-tooltip');
  if(!t || !e) return;
  positionFlipTooltip(e);
}

function positionFlipTooltip(e) {
  const tooltip = document.getElementById('flip-tooltip');
  if (!tooltip) return;
  const rect = tooltip.getBoundingClientRect();
  let x = e.clientX + 10;
  let y = e.clientY + 10;
  if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - 10;
  if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - 10;
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}
function hideFlipTooltip(){
  const t=document.getElementById('flip-tooltip');
  if(t)t.style.display='none';
}

function isLightColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

function getFlipColor(region) {
  const palettes = {
    growth: {
      fn: r => r.growth10,
      stops: [
        { v: 15, c: '#E6F1FB' }, { v: 30, c: '#85B7EB' }, { v: 45, c: '#378ADD' },
        { v: 60, c: '#185FA5' }, { v: 999, c: '#042C53' }
      ]
    },
    secondary_vs_new: {
      fn: r => Math.max(0, r.price * 1.3 - r.price), // Примерная разница
      stops: [
        { v: 200, c: '#E1F5EE' }, { v: 400, c: '#5DCAA5' }, { v: 600, c: '#1D9E75' },
        { v: 800, c: '#0F6E56' }, { v: 9999, c: '#04342C' }
      ]
    },
    flip_score: {
      fn: r => calculateFlipScore(r),
      stops: [
        { v: 3, c: '#FAEEDA' }, { v: 6, c: '#EF9F27' }, { v: 8, c: '#BA7517' },
        { v: 10, c: '#854F0B' }, { v: 999, c: '#412402' }
      ]
    }
  };

  const palette = palettes[currentFlipMode];
  const value = palette.fn(region);

  for (const stop of palette.stops) {
    if (value <= stop.v) return stop.c;
  }
  return palette.stops[palette.stops.length - 1].c;
}

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

function buildFlipLegend() {
  const legendBox = document.getElementById('flip-legend-box');
  if (!legendBox) return;

  const palettes = {
    growth: {
      fmt: v => v.toFixed(0) + '%',
      stops: [{v:30,c:'#FAEEDA'},{v:45,c:'#EF9F27'},{v:70,c:'#BA7517'},{v:90,c:'#854F0B'},{v:999,c:'#412402'}]
    },
    secondary_vs_new: {
      fmt: v => '€' + Math.round(v),
      stops: [{v:100,c:'#E1F5EE'},{v:200,c:'#5DCAA5'},{v:300,c:'#1D9E75'},{v:400,c:'#0F6E56'},{v:9999,c:'#04342C'}]
    },
    flip_score: {
      fmt: v => v.toFixed(1),
      stops: [{v:3.5,c:'#FAEEDA'},{v:4.4,c:'#EF9F27'},{v:4.66,c:'#BA7517'},{v:5.17,c:'#854F0B'},{v:999,c:'#412402'}]
    }
  };

  const palette = palettes[currentFlipMode];
  if (!palette) return;
  
  const prev = [0, ...palette.stops.slice(0, -1).map(s => s.v)];

  legendBox.innerHTML = palette.stops.map((stop, i) => {
    const label = i === 0 ? '< ' + palette.fmt(stop.v) : palette.fmt(prev[i]) + '–' + palette.fmt(stop.v);
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:${stop.c};">
      <span style="font-size:12px;color:${isLightColor(stop.c) ? '#1a1a1a' : '#eee'};">${label}</span>
    </div>`;
  }).join('');
}

function setFlipMode(mode, btn) {
  currentFlipMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  paintFlipMap();
}

function selectFlipRegion(name) {
  const prevSel = selectedRegion;
  selectedRegion = name === selectedRegion ? null : name;

  const svg = document.getElementById('flip-spain-svg');
  if (prevSel) {
    const prevPath = svg.querySelector(`path[data-region="${prevSel}"]`);
    if (prevPath) {
      prevPath.setAttribute('stroke-width', '1.5');
      prevPath.setAttribute('stroke', '#0e0f11');
    }
  }

  if (selectedRegion) {
    const path = svg.querySelector(`path[data-region="${selectedRegion}"]`);
    if (path) {
      path.setAttribute('stroke-width', '3');
      path.setAttribute('stroke', '#c9a84c');
    }
  }

  updateFlipInfoPanel();
}

function updateFlipInfoPanel() {
  const panel = document.getElementById('flip-info-panel');
  if (!panel) return;

  if (!selectedRegion) {
    panel.innerHTML = `<p style="font-size:13px;color:#8a8f9e;margin:0;">${t('flip_map_click')}</p>`;
    return;
  }

  const region = REGIONS.find(r => r.name === selectedRegion);
  if (!region) return;

  let info = '';
  switch (currentFlipMode) {
    case 'growth':
      info = `<div style="font-size:15px;font-weight:500;margin-bottom:10px;">${region.name}</div>
        <div style="font-size:13px;">${t('col_growth10')}: <strong>${region.growth10}%</strong></div>
        <div style="font-size:13px;">${t('col_price')}: <strong>€${region.price}/m²</strong></div>`;
      break;
    case 'secondary_vs_new':
      const diff = Math.round(region.price * 0.3);
      info = `<div style="font-size:15px;font-weight:500;margin-bottom:10px;">${region.name}</div>
        <div style="font-size:13px;">${t('flip_mode_secondary')}: <strong>€${diff}/m²</strong></div>`;
      break;
    case 'flip_score':
      const score = calculateFlipScore(region);
      info = `<div style="font-size:15px;font-weight:500;margin-bottom:10px;">${region.name}</div>
        <div style="font-size:13px;">${t('flip_mode_score')}: <strong>${score.toFixed(1)}</strong></div>`;
      break;
  }

  panel.innerHTML = info;
}

function showFlipTooltip(e, region) {
  const tooltip = document.getElementById('flip-tooltip');
  if (!tooltip) return;

  let content = `<div style="font-weight:500;margin-bottom:4px;">${region.name}</div>`;

  switch (currentFlipMode) {
    case 'growth':
      content += `<div>${t('col_growth10')}: ${region.growth10}%</div>`;
      break;
    case 'secondary_vs_new':
      content += `<div>${t('flip_mode_secondary')}: €${Math.round(region.price * 0.3)}/m²</div>`;
      break;
    case 'flip_score':
      content += `<div>${t('flip_mode_score')}: ${calculateFlipScore(region).toFixed(1)}</div>`;
      break;
  }

  tooltip.innerHTML = content;
  tooltip.style.display = 'block';
  positionFlipTooltip(e);
}

function positionFlipTooltip(e) {
  const tooltip = document.getElementById('flip-tooltip');
  if (!tooltip) return;

  const rect = tooltip.getBoundingClientRect();
  let x = e.clientX + 10;
  let y = e.clientY + 10;

  if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - 10;
  if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - 10;

  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}

function moveFlipTooltip(e) {
  positionFlipTooltip(e);
}

function hideFlipTooltip() {
  const tooltip = document.getElementById('flip-tooltip');
  if (tooltip) tooltip.style.display = 'none';
}

// ---- КАЛЬКУЛЯТОР СДЕЛКИ ----
function renderFlipCalcContent() {
  const container = document.getElementById('flip-calc-content');
  if (!container) return;

  container.innerHTML = `
    <div id="flip-calc-tab" class="tab-content active">
      ${renderCalcDealTab()}
    </div>
    <div id="flip-find-price-tab" class="tab-content">
      ${renderFindPriceTab()}
    </div>
  `;
}

function renderCalcDealTab() {
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <!-- Левая колонка: Ввод данных -->
      <div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div class="input-group">
            <label data-i18n="flip_buy_price">Цена покупки</label>
            <input type="number" id="flip-buy-price" value="200000" onchange="calcFlipDeal()">
            <span class="input-val" id="flip-buy-price-val">200 000 €</span>
          </div>
          <div class="input-group">
            <label data-i18n="flip_sell_price">Цена продажи</label>
            <input type="number" id="flip-sell-price" value="250000" onchange="calcFlipDeal()">
            <span class="input-val" id="flip-sell-price-val">250 000 €</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div class="input-group">
            <label>Регион</label>
            <select id="flip-region-select" onchange="onFlipRegionChange()">
              ${REGIONS.map(r => `<option value="${r.name}">${r.name}</option>`).join('')}
            </select>
          </div>
          <div class="input-group">
            <label data-i18n="reno_type">Тип ремонта</label>
            <select id="flip-renovation-type" onchange="onFlipRenovationTypeChange()">
              <option value="light" data-i18n="reno_light">Лёгкий</option>
              <option value="standard" selected data-i18n="reno_standard">Стандарт</option>
              <option value="premium" data-i18n="reno_premium">Премиум</option>
            </select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div class="input-group">
            <label>Площадь (м²)</label>
            <input type="number" id="flip-area" value="70" onchange="calcFlipDeal()">
            <span class="input-val" id="flip-area-val">70 м²</span>
          </div>
          <div class="input-group">
            <label data-i18n="flip_renovation">Стоимость ремонта</label>
            <input type="number" id="flip-renovation" value="49000" onchange="calcFlipDeal()">
            <span class="input-val" id="flip-renovation-val">49 000 €</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div class="input-group">
            <label>ITP (%)</label>
            <input type="number" id="flip-itp-pct" value="8" step="0.1" onchange="calcFlipDeal()">
            <span class="input-val" id="flip-itp-pct-val">8%</span>
          </div>
          <div class="input-group">
            <label data-i18n="flip_notary_buy">Нотариус + реестр (покупка)</label>
            <input type="number" id="flip-notary-buy" value="1500" onchange="calcFlipDeal()">
            <span class="input-val" id="flip-notary-buy-val">1 500 €</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div class="input-group">
            <label data-i18n="flip_agent_buy">Агент (покупка)</label>
            <input type="number" id="flip-agent-buy" value="6000" onchange="calcFlipDeal()">
            <span class="input-val" id="flip-agent-buy-val">6 000 €</span>
          </div>
          <div class="input-group">
            <label data-i18n="flip_other_costs">Другие расходы</label>
            <input type="number" id="flip-other-costs" value="2000" onchange="calcFlipDeal()">
            <span class="input-val" id="flip-other-costs-val">2 000 €</span>
          </div>
        </div>
      </div>

      <!-- Правая колонка: Результаты -->
      <div>
        <div id="flip-results" style="background:#16181c;border-radius:10px;padding:20px;margin-bottom:20px;">
          <h4 style="margin:0 0 16px 0;color:#c9a84c;" data-i18n="flip_profit">Прибыль</h4>
          <div id="flip-profit-display" style="font-size:24px;font-weight:500;margin-bottom:16px;">€0</div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
            <div>
              <div style="font-size:12px;color:#8a8f9e;" data-i18n="flip_roi">ROI</div>
              <div id="flip-roi-display" style="font-size:16px;font-weight:500;">0%</div>
            </div>
            <div>
              <div style="font-size:12px;color:#8a8f9e;" data-i18n="flip_payback">Окупаемость</div>
              <div id="flip-payback-display" style="font-size:16px;font-weight:500;">0 мес</div>
            </div>
          </div>

          <div style="padding-top:16px;">
            <h5 style="margin:0 0 12px 0;font-size:14px;" data-i18n="flip_max_buy">Макс. цена покупки (правило 70%)</h5>
            <div id="flip-max-buy-display" style="font-size:18px;font-weight:500;color:#5cb88a;">€0</div>
          </div>
        </div>

        <!-- Сценарии рисков -->
        <div>
          <h4 style="margin:0 0 12px 0;" data-i18n="flip_risk_title">Риски и сценарии</h4>
          <div id="flip-scenarios"></div>
        </div>
      </div>
    </div>
  `;
}

function renderFindPriceTab() {
  return `
    <div style="max-width:600px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div class="input-group">
          <label>Регион</label>
          <select id="flip-target-region-select" onchange="onFlipTargetRegionChange()">
            ${REGIONS.map(r => `<option value="${r.name}">${r.name}</option>`).join('')}
          </select>
        </div>
        <div class="input-group">
          <label data-i18n="reno_type">Тип ремонта</label>
          <select id="flip-target-renovation-type" onchange="onFlipTargetRenovationTypeChange()">
            <option value="light" data-i18n="reno_light">Лёгкий</option>
            <option value="standard" selected data-i18n="reno_standard">Стандарт</option>
            <option value="premium" data-i18n="reno_premium">Премиум</option>
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div class="input-group">
          <label data-i18n="flip_sell_price">Цена продажи</label>
          <input type="number" id="flip-target-sell-price" value="250000" onchange="calcMaxBuyPrice()">
          <span class="input-val" id="flip-target-sell-price-val">250 000 €</span>
        </div>
        <div class="input-group">
          <label data-i18n="flip_renovation">Стоимость ремонта</label>
          <input type="number" id="flip-target-renovation" value="49000" onchange="calcMaxBuyPrice()">
          <span class="input-val" id="flip-target-renovation-val">49 000 €</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px;">
        <div class="input-group">
          <label>ITP (%)</label>
          <input type="number" id="flip-target-itp" value="8" step="0.1" onchange="calcMaxBuyPrice()">
          <span class="input-val" id="flip-target-itp-val">8%</span>
        </div>
        <div class="input-group">
          <label data-i18n="flip_notary_buy">Нотариус покупка</label>
          <input type="number" id="flip-target-notary" value="1500" onchange="calcMaxBuyPrice()">
          <span class="input-val" id="flip-target-notary-val">1 500 €</span>
        </div>
        <div class="input-group">
          <label data-i18n="flip_agent_buy">Агент покупка</label>
          <input type="number" id="flip-target-agent" value="6000" onchange="calcMaxBuyPrice()">
          <span class="input-val" id="flip-target-agent-val">6 000 €</span>
        </div>
      </div>

      <div class="input-group" style="margin-bottom:20px;">
        <label data-i18n="flip_other_costs">Другие расходы</label>
        <input type="number" id="flip-target-other" value="2000" onchange="calcMaxBuyPrice()">
        <span class="input-val" id="flip-target-other-val">2 000 €</span>
      </div>

      <div style="background:#16181c;border-radius:10px;padding:20px;">
        <h4 style="margin:0 0 16px 0;color:#c9a84c;" data-i18n="flip_find_buy_price">Максимальная цена покупки</h4>
        <div id="flip-max-buy-result" style="font-size:24px;font-weight:500;margin-bottom:12px;">€0</div>
        <div style="font-size:14px;color:#8a8f9e;">
          По правилу 70%: Цена продажи × 0.7 − Стоимость ремонта − Расходы
        </div>
      </div>
    </div>
  `;
}

function switchFlipTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('flip-' + tab + '-tab').classList.add('active');

  if (tab === 'calc') {
    calcFlipDeal();
  } else if (tab === 'find_price') {
    calcMaxBuyPrice();
  }
}

function calcFlipDeal() {
  // Получаем значения
  const buyPrice = +document.getElementById('flip-buy-price').value || 0;
  const baseSellPrice = +document.getElementById('flip-sell-price').value || 0;
  const renovation = +document.getElementById('flip-renovation').value || 0;
  const itpPct = (+document.getElementById('flip-itp-pct').value || 0) / 100;
  const notaryBuy = +document.getElementById('flip-notary-buy').value || 0;
  const agentBuy = +document.getElementById('flip-agent-buy').value || 0;
  const otherCosts = +document.getElementById('flip-other-costs').value || 0;

  // Получаем регион и рассчитываем рост цены после ремонта
  const regionName = document.getElementById('flip-region-select').value;
  const uplift = RENOVATION_UPLIFT[regionName] || RENOVATION_UPLIFT['default'];
  const renovationValueAdd = buyPrice * uplift; // Рост стоимости объекта после ремонта
  const sellPrice = baseSellPrice + renovationValueAdd; // Итоговая цена продажи с учетом роста

  // Расходы при покупке
  const itpBuy = buyPrice * itpPct;
  const totalBuyCosts = itpBuy + notaryBuy + agentBuy + otherCosts;

  // Расходы при продаже (примерно 8-10% от цены продажи)
  const notarySell = sellPrice * 0.015; // 1.5%
  const agentSell = sellPrice * 0.04; // 4%
  const capitalGainsTax = (sellPrice - buyPrice - renovation) * 0.19; // 19% для физлиц
  const totalSellCosts = notarySell + agentSell + (capitalGainsTax > 0 ? capitalGainsTax : 0);

  // Итого расходов
  const totalCosts = renovation + totalBuyCosts + totalSellCosts;

  // Прибыль
  const profit = sellPrice - buyPrice - totalCosts;

  // ROI
  const totalInvestment = buyPrice + renovation + totalBuyCosts;
  const roi = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;

  // Окупаемость (предполагаем 6 месяцев)
  const paybackMonths = 6;

  // Правило 70%
  const maxBuyPrice = (sellPrice * 0.7) - renovation - totalBuyCosts;

  // Обновляем дисплей
  updateVal('flip-buy-price', Math.round(buyPrice).toLocaleString('ru') + ' €');
  updateVal('flip-sell-price', Math.round(sellPrice).toLocaleString('ru') + ' €');
  updateVal('flip-renovation', Math.round(renovation).toLocaleString('ru') + ' €');
  updateVal('flip-itp-pct', itpPct * 100 + '%');
  updateVal('flip-notary-buy', Math.round(notaryBuy).toLocaleString('ru') + ' €');
  updateVal('flip-agent-buy', Math.round(agentBuy).toLocaleString('ru') + ' €');
  updateVal('flip-other-costs', Math.round(otherCosts).toLocaleString('ru') + ' €');
  updateVal('flip-area', (+document.getElementById('flip-area').value || 70) + ' м²');

  document.getElementById('flip-profit-display').textContent = Math.round(profit).toLocaleString('ru') + ' €';
  document.getElementById('flip-profit-display').style.color = profit >= 0 ? '#5cb88a' : '#e94b3c';

  document.getElementById('flip-roi-display').textContent = roi.toFixed(1) + '%';
  document.getElementById('flip-roi-display').style.color = roi >= 20 ? '#5cb88a' : roi >= 10 ? '#c9a84c' : '#e94b3c';

  document.getElementById('flip-payback-display').textContent = paybackMonths + ' мес';

  document.getElementById('flip-max-buy-display').textContent = Math.round(maxBuyPrice).toLocaleString('ru') + ' €';

  // Сценарии рисков
  renderFlipScenarios(buyPrice, sellPrice, renovation, totalBuyCosts);
}

function renderFlipScenarios(buyPrice, sellPrice, renovation, buyCosts) {
  const scenarios = [
    {
      name: t('flip_scenario_base'),
      sellPrice: sellPrice,
      renovation: renovation,
      delay: 0,
      color: '#5cb88a'
    },
    {
      name: t('flip_scenario_worst'),
      sellPrice: sellPrice * 0.9, // -10%
      renovation: renovation * 1.2, // +20%
      delay: 3, // +3 месяца
      color: '#e94b3c'
    },
    {
      name: t('flip_scenario_best'),
      sellPrice: sellPrice * 1.05, // +5%
      renovation: renovation * 0.9, // -10%
      delay: 0,
      color: '#4a90d9'
    }
  ];

  const container = document.getElementById('flip-scenarios');
  if (!container) return;

  container.innerHTML = scenarios.map(scenario => {
    const sellCosts = scenario.sellPrice * 0.055; // 5.5% расходы на продажу
    const totalCosts = scenario.renovation + buyCosts + sellCosts;
    const profit = scenario.sellPrice - buyPrice - totalCosts;
    const roi = (buyPrice + scenario.renovation + buyCosts) > 0 ? (profit / (buyPrice + scenario.renovation + buyCosts)) * 100 : 0;

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#1a1d23;border-radius:6px;margin-bottom:8px;">
        <span style="font-size:13px;color:${scenario.color};">${scenario.name}</span>
        <span style="font-size:13px;font-weight:500;">${Math.round(profit).toLocaleString('ru')} € (${roi.toFixed(0)}%)</span>
      </div>
    `;
  }).join('');
}

function calcMaxBuyPrice() {
  const sellPrice = +document.getElementById('flip-target-sell-price').value || 0;
  const renovation = +document.getElementById('flip-target-renovation').value || 0;
  const itpPct = (+document.getElementById('flip-target-itp').value || 0) / 100;
  const notary = +document.getElementById('flip-target-notary').value || 0;
  const agent = +document.getElementById('flip-target-agent').value || 0;
  const other = +document.getElementById('flip-target-other').value || 0;

  // Правило 70%: Макс цена покупки = (Цена продажи × 0.7) - Ремонт - Расходы
  const buyCosts = (sellPrice * itpPct) + notary + agent + other;
  const maxBuyPrice = (sellPrice * 0.7) - renovation - buyCosts;

  // Обновляем дисплей
  updateVal('flip-target-sell-price', Math.round(sellPrice).toLocaleString('ru') + ' €');
  updateVal('flip-target-renovation', Math.round(renovation).toLocaleString('ru') + ' €');
  updateVal('flip-target-itp', itpPct * 100 + '%');
  updateVal('flip-target-notary', Math.round(notary).toLocaleString('ru') + ' €');
  updateVal('flip-target-agent', Math.round(agent).toLocaleString('ru') + ' €');
  updateVal('flip-target-other', Math.round(other).toLocaleString('ru') + ' €');

  document.getElementById('flip-max-buy-result').textContent = Math.round(maxBuyPrice).toLocaleString('ru') + ' €';
}

// ---- СРАВНЕНИЕ СТРАТЕГИЙ ----
function renderFlipComparison() {
  const container = document.getElementById('flip-comparison-table');
  if (!container) return;

  const capital = 100000; // €100k стартовый капитал
  const months = 12;

  // Стратегия 1: Флиппинг
  const flipBuyPrice = 180000;
  const flipSellPrice = 230000;
  const flipRenovation = 25000;
  const flipCosts = flipBuyPrice * 0.08 + 8000; // ITP + нотариус + агент
  const flipProfit = flipSellPrice - flipBuyPrice - flipRenovation - flipCosts;
  const flipROI = (flipProfit / (flipBuyPrice + flipRenovation)) * 100;

  // Стратегия 2: Buy & Hold
  const holdPrice = 200000;
  const holdCosts = holdPrice * 0.08 + 8000;
  const holdRent = 1200; // €/месяц
  const holdNetIncome = holdRent - 200; // минус расходы
  const holdTotalIncome = holdNetIncome * months;
  const holdROI = (holdTotalIncome / (holdPrice + holdCosts)) * 100;

  // Стратегия 3: Инвестиции
  const investReturn = 0.07; // 7% годовых
  const investProfit = capital * investReturn;
  const investROI = investReturn * 100;

  const strategies = [
    {
      name: t('flip_compare_flip'),
      capital: flipBuyPrice + flipRenovation,
      profit: flipProfit,
      roi: flipROI,
      color: '#c9a84c'
    },
    {
      name: t('flip_compare_buy_hold'),
      capital: holdPrice,
      profit: holdTotalIncome,
      roi: holdROI,
      color: '#5cb88a'
    },
    {
      name: t('flip_compare_invest'),
      capital: capital,
      profit: investProfit,
      roi: investROI,
      color: '#4a90d9'
    }
  ];

  container.innerHTML = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#1a1d23;">
          <th style="padding:12px;text-align:left;" data-i18n="flip_compare_capital">Капитал</th>
          <th style="padding:12px;text-align:left;" data-i18n="flip_compare_profit">Прибыль</th>
          <th style="padding:12px;text-align:left;" data-i18n="flip_compare_roi">ROI</th>
        </tr>
      </thead>
      <tbody>
        ${strategies.map(strategy => `
          <tr>
            <td style="padding:12px;font-weight:500;">
              <span style="color:${strategy.color};">${strategy.name}</span><br>
              <span style="font-size:12px;color:#8a8f9e;">${Math.round(strategy.capital).toLocaleString('ru')} €</span>
            </td>
            <td style="padding:12px;">
              ${Math.round(strategy.profit).toLocaleString('ru')} €
            </td>
            <td style="padding:12px;">
              ${strategy.roi.toFixed(1)}%
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ---- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----
function updateVal(id, val) {
  const el = document.getElementById(id + '-val');
  if (el) el.textContent = val;
}

function toggleCollapsible(header) {
  const content = header.nextElementSibling;
  const arrow = header.querySelector('.collapsible-arrow');
  const isOpen = content.style.display !== 'none';

  content.style.display = isOpen ? 'none' : 'block';
  arrow.textContent = isOpen ? '▶' : '▼';
}