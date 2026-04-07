// ============================================================
// app.js — основная логика приложения
// ============================================================

// ---- INITIALIZATION ----
document.addEventListener('DOMContentLoaded', () => {
  // Set default language based on browser
  const browserLang = (navigator.language || 'en').toLowerCase();
  const defaultLang = browserLang.startsWith('es') ? 'es'
                    : browserLang.startsWith('ru') ? 'ru'
                    : 'en';
  setLang(defaultLang);
  
  // Highlight active language button
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  const activeLangBtn = Array.from(document.querySelectorAll('.lang-btn')).find(b => b.textContent === defaultLang.toUpperCase());
  if (activeLangBtn) activeLangBtn.classList.add('active');
  
  // Update footer with dynamic data
  document.getElementById('data-sources').textContent = DATA_SOURCES;
  document.getElementById('data-updated').textContent = DATA_UPDATED;
  initMarketTable();

  // Initialize map widget for default market page
  initMapWidget();
});

// ---- NAVIGATION ----
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  btn.classList.add('active');
  document.getElementById('hero-block').style.display = id === 'market' ? 'block' : 'none';
  if (id === 'market')  { setTimeout(() => initMapWidget(), 50); }
  if (id === 'heatmap') renderHeatmaps();
  if (id === 'pr')      renderPRPage();
  if (id === 'calc')    { initCalc1(); loadCalc1FromURL(); calc1Update(); }
  if (id === 'rental')  initRentalCalc();
  if (id === 'compare') initCompare();
  if (id === 'flip')    initFlipAnalyzer().catch(err => console.error('Error initializing flip analyzer:', err));
  if (id === 'guide')   renderGuide();
}

function switchTab(group, id, btn) {
  const scope = btn.closest('.page') || btn.closest('.card') || document;
  scope.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  scope.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(group + '-' + id).classList.add('active');
}

// ---- CALC 1 STATE ----
let c1Chart = null;
let c1Horizon = 20;
let c1PriceMode = 'nominal';
let c1PropertyType = 'secondary';

// ---- MARKET TABLE ----
// D3 + TopoJSON карта Испании

// Маппинг провинций (из TopoJSON) на автономные сообщества (регионы)
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
  
  // Sin región (игнорировать)
  'Ceuta': null,
  'Melilla': null,
  
  // Остальные провинции (однопровинцийные регионы)
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

// Маппинг названий регионов из TopoJSON на наши ID (оставляю для совместимости)
const REGION_NAME_MAP = {
  'Andalucía': 'andalucia',
  'Aragón': 'aragon',
  'Asturias': 'asturias',
  'Baleares': 'baleares',
  'Canarias': 'canarias',
  'Cantabria': 'cantabria',
  'Castilla y León': 'castilla_leon',
  'Castilla-La Mancha': 'clm',
  'Cataluña': 'cataluna',
  'Extremadura': 'extremadura',
  'Galicia': 'galicia',
  'La Rioja': 'la_rioja',
  'Madrid': 'madrid',
  'Murcia': 'murcia',
  'Navarra': 'navarra',
  'País Vasco': 'pais_vasco',
  'Valencia': 'valencia',
};

let topoData = null, d3Map = null;

// Загрузить TopoJSON и инициализировать карту
async function loadD3Map() {
  if (topoData) return; // Уже загружен
  try {
    const response = await fetch('https://cdn.jsdelivr.net/npm/datamaps@0.5.10/src/js/data/esp.topo.json');
    topoData = await response.json();
    console.log('TopoJSON загружен. Ключи:', Object.keys(topoData.objects));
    
    // Вывести ВСЕ названия регионов для отладки
    if (topoData.objects.esp) {
      const features = topojson.feature(topoData, topoData.objects.esp).features;
      console.log('Всего регионов:', features.length);
      console.log('ВСЕ названия регионов:');
      features.forEach((f, i) => {
        console.log(`${i + 1}. ${f.properties.name} (id: ${f.id})`);
      });
    }
  } catch (e) {
    console.error('Ошибка загрузки TopoJSON:', e);
  }
}

// Функция для загрузки и вывода структуры TopoJSON
window.debugTopoJSON = async function() {
  await loadD3Map();
  if (topoData && topoData.objects.esp) {
    const features = topojson.feature(topoData, topoData.objects.esp).features;
    const names = features.map(f => f.properties.name);
    console.table(names);
    return names;
  }
};

let regionsByNameGlobal = {};

const PALETTES = {
  price:  {fn:r=>r.price,  fmt:v=>'€'+Math.round(v).toLocaleString('ru'), title:'Цена €/м²',
    stops:[{v:900,c:'#E6F1FB'},{v:1700,c:'#85B7EB'},{v:2500,c:'#378ADD'},{v:3500,c:'#185FA5'},{v:9999,c:'#042C53'}]},
  rent:   {fn:r=>r.rent,   fmt:v=>'€'+v.toFixed(1), title:'Аренда €/м²/мес',
    stops:[{v:7,c:'#E1F5EE'},{v:10,c:'#5DCAA5'},{v:14,c:'#1D9E75'},{v:18,c:'#0F6E56'},{v:99,c:'#04342C'}]},
  pr:     {fn:r=>(r.rent*12)/r.price*100, fmt:v=>v.toFixed(1)+'%', title:'Доходность аренды',
    stops:[{v:3.5,c:'#EAF3DE'},{v:4.5,c:'#97C459'},{v:5.5,c:'#639922'},{v:6.5,c:'#3B6D11'},{v:99,c:'#173404'}]},
  growth: {fn:r=>r.growth1, fmt:v=>'+'+v.toFixed(1)+'%', title:'Рост цен за год',
    stops:[{v:10,c:'#FAEEDA'},{v:11,c:'#EF9F27'},{v:12,c:'#BA7517'},{v:13,c:'#854F0B'},{v:99,c:'#412402'}]},
};

const MAP_SVG_SHAPES = {
  galicia:      'M55,55 L110,50 L125,75 L115,105 L80,115 L58,95 Z',
  asturias:     'M110,50 L178,46 L188,70 L165,85 L125,75 Z',
  cantabria:    'M178,46 L220,44 L226,68 L188,70 Z',
  pais_vasco:   'M220,44 L268,38 L274,66 L240,70 L226,68 Z',
  navarra:      'M268,38 L308,42 L306,82 L274,84 L274,66 Z',
  la_rioja:     'M226,68 L274,66 L274,84 L255,90 L232,84 Z',
  aragon:       'M274,84 L306,82 L328,88 L334,170 L280,175 L270,145 L274,118 Z',
  cataluna:     'M306,82 L388,65 L398,96 L380,140 L334,170 L328,88 Z',
  castilla_leon:'M58,95 L80,115 L118,134 L165,150 L212,155 L258,150 L270,145 L232,84 L226,68 L188,70 L165,85 L115,105 Z',
  madrid:       'M212,155 L258,150 L264,180 L242,195 L212,190 Z',
  clm:          'M118,134 L165,150 L212,155 L212,190 L242,195 L264,180 L280,205 L336,170 L304,215 L284,264 L242,274 L185,260 L136,230 L116,196 Z',
  extremadura:  'M62,156 L118,134 L116,196 L136,230 L118,264 L78,270 L54,236 L58,192 Z',
  valencia:     'M334,170 L380,140 L405,166 L412,225 L388,274 L354,290 L334,260 L304,215 Z',
  murcia:       'M354,290 L388,274 L412,248 L398,330 L365,336 L340,310 Z',
  andalucia:    'M78,270 L118,264 L136,230 L185,260 L242,274 L284,264 L340,260 L340,310 L365,336 L344,364 L296,390 L225,400 L152,386 L94,352 L68,307 Z',
  baleares:     'M390,152 L428,148 L436,162 L422,172 L396,170 Z',
  canarias:     'M48,344 L178,344 L178,395 L48,395 Z',
};

const MAP_LABELS = {
  galicia:'88,86',asturias:'150,68',cantabria:'202,59',pais_vasco:'248,56',
  navarra:'290,65',la_rioja:'252,80',aragon:'305,130',cataluna:'360,114',
  castilla_leon:'170,128',madrid:'238,176',clm:'215,222',extremadura:'92,212',
  valencia:'368,222',murcia:'378,310',andalucia:'212,338',
  baleares:'413,162',canarias:'113,368',
};

let mapMode='price', mapSel=null, mapSvgBuilt=false;

function isLightColor(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return (r*299+g*587+b*114)/1000>140;
}

function getMapColor(r){
  const v=PALETTES[mapMode].fn(r);
  for(const s of PALETTES[mapMode].stops) if(v<=s.v) return s.c;
  return PALETTES[mapMode].stops.at(-1).c;
}

// Цвет текста: индекс стопа 0 (светлый диапазон) → чёрный, иначе → белый
function getMapTextColor(regionId){
  const region = regionsByNameGlobal[regionId];
  if(!region) return '#ffffff';
  const palette = PALETTES[mapMode];
  const value = palette.fn(region);
  const stopIdx = palette.stops.findIndex(s => value <= s.v);
  return stopIdx === 0 ? '#111111' : '#ffffff';
}

function buildMapSVG(){
  const svg=document.getElementById('map-svg');
  if(!svg) return;
  svg.innerHTML='';
  const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');
  bg.setAttribute('width','500');
  bg.setAttribute('height','420');
  bg.setAttribute('fill','#0e0f11');
  svg.appendChild(bg);
  REGIONS.forEach(r=>{
    const p=document.createElementNS('http://www.w3.org/2000/svg','path');
    p.setAttribute('d',MAP_SVG_SHAPES[r.id]||'');
    p.setAttribute('stroke','#0e0f11');
    p.setAttribute('stroke-width','2');
    p.setAttribute('stroke-linejoin','miter');
    p.setAttribute('stroke-linecap','round');
    p.style.cursor='pointer';
    p.style.transition='opacity 0.15s';
    p.dataset.id=r.id;
    p.addEventListener('mouseenter',e=>{p.setAttribute('stroke-width','2.5');showMapTooltip(e,r);});
    p.addEventListener('mousemove',e=>moveMapTooltip(e));
    p.addEventListener('mouseleave',()=>{p.setAttribute('stroke-width',r.id===mapSel?'3':'1.5');hideMapTooltip();});
    p.addEventListener('click',()=>selectMapRegion(r));
    svg.appendChild(p);
    const pos=MAP_LABELS[r.id].split(',');
    const t=document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',pos[0]);t.setAttribute('y',pos[1]);
    t.setAttribute('text-anchor','middle');t.setAttribute('font-size','8.5');
    t.setAttribute('font-weight','500');t.setAttribute('pointer-events','none');
    t.textContent=r.name.split(' ')[0];
    svg.appendChild(t);
  });
  paintMapSVG();
}

function buildD3MapSVG(){
  const svg=d3.select('#map-svg');
  const width=700, height=550;
  svg.selectAll('*').remove();
  
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#0e0f11');
  
  svg.attr('viewBox', `0 0 ${width} ${height}`);

  if (!topoData || !topoData.objects.esp) {
    console.error('TopoJSON не загружен');
    return;
  }

  const features = topojson.feature(topoData, topoData.objects.esp).features;
  console.log('Всего провинций:', features.length);

  // Отделяем Канары — врезка отдельно, не влияет на масштаб основной карты
  const CANARIAS_PROVS = new Set(['Las Palmas', 'Santa Cruz de Tenerife']);
  const peninsulaFeatures = features.filter(f => !CANARIAS_PROVS.has(f.properties.name));
  const projection = d3.geoMercator()
    .fitExtent([[12, 8], [width - 12, height - 12]], { type: 'FeatureCollection', features: peninsulaFeatures });
  const pathGenerator = d3.geoPath().projection(projection);
  
  regionsByNameGlobal = {};
  REGIONS.forEach(r => regionsByNameGlobal[r.id] = r);
  
  svg.selectAll('path').data(features).enter().append('path')
    .attr('d', pathGenerator)
    .attr('stroke', '#0e0f11').attr('stroke-width', 2)
    .attr('stroke-linejoin', 'miter').attr('stroke-linecap', 'round')
    .attr('fill', '#555').attr('data-province-name', d => d.properties.name)
    .style('cursor', 'pointer').style('transition', 'opacity 0.15s')
    .on('mouseenter', function(e, d) {
      const pName = d.properties.name, regionId = PROVINCE_TO_REGION[pName];
      if (!regionId) return;
      const reg = regionsByNameGlobal[regionId];
      if (!reg) return;
      d3.select(this).attr('stroke-width', 3);
      showMapTooltip(e, reg);
    })
    .on('mousemove', moveMapTooltip)
    .on('mouseleave', function(e, d) {
      const pName = d.properties.name, regionId = PROVINCE_TO_REGION[pName];
      if (!regionId) return;
      d3.select(this).attr('stroke-width', regionId === mapSel ? 3 : 2);
      hideMapTooltip();
    })
    .on('click', function(e, d) {
      const pName = d.properties.name, regionId = PROVINCE_TO_REGION[pName];
      if (!regionId) return;
      const reg = regionsByNameGlobal[regionId];
      if (reg) selectMapRegion(reg);
    });
  
  const regionFeatures = {};
  features.forEach(d => {
    const pName = d.properties.name, regionId = PROVINCE_TO_REGION[pName];
    if (!regionId) return;
    if (!regionFeatures[regionId]) regionFeatures[regionId] = [];
    regionFeatures[regionId].push(d);
  });
  
  const REGION_LABELS = {
    'galicia': 'Galicia', 'asturias': 'Asturias', 'cantabria': 'Cantabria', 'pais_vasco': 'País Vasco',
    'navarra': 'Navarra', 'la_rioja': 'La Rioja', 'aragon': 'Aragón', 'cataluna': 'Cataluña',
    'madrid': 'Madrid', 'castilla_leon': 'Castilla y León', 'clm': 'Castilla-La Mancha',
    'extremadura': 'Extremadura', 'valencia': 'Valencia', 'murcia': 'Murcia', 'andalucia': 'Andalucía',
    'baleares': 'Islas Baleares', 'canarias': 'Canarias'
  };
  
  Object.entries(REGION_LABELS).forEach(([regionId, label]) => {
    if (regionId === 'canarias') return; // Канары — только во врезке
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
      let x=0, y=0, n=0;
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
    svg.append('text').attr('x', centroid[0]).attr('y', labelY)
      .attr('data-region', regionId)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('font-size', '12').attr('font-weight', '600')
      .attr('fill', getMapTextColor(regionId)).attr('pointer-events', 'none')
      .text(label.toUpperCase());
  });
  
  paintD3MapSVG();
}

function paintD3MapSVG(){
  const svg = d3.select('#map-svg');

  svg.selectAll('path').attr('fill', function(d) {
    const provinceName = d.properties.name;
    const regionId = PROVINCE_TO_REGION[provinceName];
    if (!regionId) return '#333';
    const region = regionsByNameGlobal[regionId];
    if (!region) return '#333';
    return getMapColor(region);
  });

  // Обновить цвет текста: стоп 0 (светлый) → чёрный, остальные → белый
  svg.selectAll('text[data-region]').each(function() {
    const regionId = d3.select(this).attr('data-region');
    d3.select(this).attr('fill', getMapTextColor(regionId));
  });

  renderCanarias();
  buildMapLegend();
}

function paintMapSVG(){
  const svg=document.getElementById('map-svg');
  if(!svg) return;
  REGIONS.forEach(r=>{
    const p=svg.querySelector(`path[data-id="${r.id}"]`);
    if(!p)return;
    const c=getMapColor(r);
    p.setAttribute('fill',c);
    const pos=MAP_LABELS[r.id].split(',');
    const txts=[...svg.querySelectorAll('text')];
    const t=txts.find(tx=>tx.getAttribute('x')===pos[0]&&tx.getAttribute('y')===pos[1]);
    if(t)t.setAttribute('fill',isLightColor(c)?'#111':'#fff');
  });
  renderCanarias();
  buildMapLegend();
}

function buildMapLegend(){
  const stops=PALETTES[mapMode].stops;
  const fmt=PALETTES[mapMode].fmt;
  const prev=[0,...stops.map(s=>s.v)];
  const html=stops.map((s,i)=>{
    const lbl=i===0?'< '+fmt(s.v):fmt(prev[i])+'–'+fmt(s.v);
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:${s.c};"><span style="font-size:12px;color:${isLightColor(s.c)?'#1a1a1a':'#eee'};">${lbl}</span></div>`;
  }).join('');
  const legend=document.getElementById('map-legend-box');
  if(legend)legend.innerHTML=html;
}

function renderCanarias(){
  const svg = d3.select('#map-svg');
  svg.selectAll('.canarias-inset').remove();

  if (!topoData || !topoData.objects.esp) return;
  const features = topojson.feature(topoData, topoData.objects.esp).features;
  const canariasFeatures = features.filter(f =>
    f.properties.name === 'Las Palmas' || f.properties.name === 'Santa Cruz de Tenerife'
  );
  if (canariasFeatures.length === 0) return;

  const region = REGIONS.find(r => r.id === 'canarias');
  if (!region) return;
  const color = getMapColor(region);

  // Инсет: правый нижний угол — под Балеарами, в пространстве Средиземного моря
  const insetX = 490, insetY = 365, insetW = 200, insetH = 175;
  const labelH = 18; // высота строки подписи сверху

  const insetGroup = svg.append('g').attr('class', 'canarias-inset');

  // Фон
  insetGroup.append('rect')
    .attr('x', insetX).attr('y', insetY)
    .attr('width', insetW).attr('height', insetH)
    .attr('fill', '#0a0b0d').attr('rx', 3).attr('ry', 3);

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

  // fitExtent: все острова вписываются в область под подписью
  const canariasCollection = { type: 'FeatureCollection', features: canariasFeatures };
  const insetProjection = d3.geoMercator()
    .fitExtent(
      [[insetX + 6, insetY + labelH + 4], [insetX + insetW - 6, insetY + insetH - 6]],
      canariasCollection
    );
  const insetPathGen = d3.geoPath().projection(insetProjection);

  // Острова
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

  // Рамка инсета
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
      showMapTooltip(e, region);
    })
    .on('mousemove', e => moveMapTooltip(e))
    .on('mouseleave', function() {
      borderRect.attr('stroke', '#666').attr('stroke-width', 1);
      hideMapTooltip();
    })
    .on('click', function() { selectMapRegion(region); });
}

function selectMapRegion(r){
  const prevSel=mapSel;
  mapSel=r.id===mapSel?null:r.id;
  
  // Для D3 карты - обновить обводку всех провинций этого региона
  if(topoData) {
    const svg = d3.select('#map-svg');
    svg.selectAll('path').attr('stroke-width', function(d) {
      const provinceName = d.properties.name;
      const regionId = PROVINCE_TO_REGION[provinceName];
      return (regionId === mapSel) ? 3 : 2;
    }).attr('stroke', function(d) {
      const provinceName = d.properties.name;
      const regionId = PROVINCE_TO_REGION[provinceName];
      return (regionId === mapSel) ? '#c9a84c' : '#0e0f11';
    });
  } else {
    // Для старой карты - ничего не делать
    const svg=document.getElementById('map-svg');
    if(prevSel){const p=svg.querySelector(`path[data-id="${prevSel}"]`);if(p){p.setAttribute('stroke-width','1.5');p.setAttribute('stroke','#0e0f11');}}
    if(mapSel){const p=svg.querySelector(`path[data-id="${mapSel}"]`);if(p){p.setAttribute('stroke-width','3');p.setAttribute('stroke','#c9a84c');}}
  }
}

function showMapTooltip(e,r){
  const t=document.getElementById('map-tooltip');
  if(!t)return;
  const val=PALETTES[mapMode].fmt(PALETTES[mapMode].fn(r));
  let valueRow='';
  let hint='';
  if(mapMode==='pr'){
    const yld=(r.rent*12)/r.price*100;
    valueRow=`<div style="font-size:20px;font-weight:700;color:#f0ede8;margin:4px 0;">${val}</div>`;
    if(yld<3.5) hint='<div style="color:#f97;font-size:12px;margin-top:2px;">⚠ Покупать невыгодно — ниже уровня гособлигаций</div>';
    else if(yld<5) hint='<div style="color:#f0c040;font-size:12px;margin-top:2px;">~ Только с расчётом на рост цен</div>';
    else if(yld<6.5) hint='<div style="color:#8de;font-size:12px;margin-top:2px;">✓ Покупка может быть оправдана</div>';
    else hint='<div style="color:#7edb7e;font-size:12px;margin-top:2px;">✓✓ Покупка финансово выгодна</div>';
  } else {
    valueRow=`<div style="color:#aaa;font-size:12px;margin-top:3px;">${PALETTES[mapMode].title}: <strong style="color:#f0ede8;">${val}</strong></div>`;
  }
  t.innerHTML=`<div style="font-weight:600;font-size:13px;">${r.name}</div>${valueRow}${hint}`;
  t.style.display='block';moveMapTooltip(e);
}
function moveMapTooltip(e){
  const t=document.getElementById('map-tooltip');
  if(!t)return;
  
  // Получить позицию SVG элемента на странице
  const svg = document.getElementById('map-svg');
  const svgRect = svg ? svg.getBoundingClientRect() : { left: 0, top: 0 };
  
  // Вычислить координаты относительно SVG контейнера
  const tooltipX = e.clientX - svgRect.left + 12;
  const tooltipY = e.clientY - svgRect.top - 10;
  
  t.style.left = tooltipX + 'px';
  t.style.top = tooltipY + 'px';
}
function hideMapTooltip(){
  const t=document.getElementById('map-tooltip');
  if(t)t.style.display='none';
}

function setMapMode(m,btn){
  mapMode=m;
  document.querySelectorAll('.map-mode-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const isPr = m === 'pr';
  const formulaBlock = document.getElementById('map-info-formula');
  if(formulaBlock) formulaBlock.style.display = isPr ? '' : 'none';
  const benchBlock = document.getElementById('map-info-benchmarks');
  if(benchBlock) benchBlock.style.display = isPr ? '' : 'none';
  if(topoData) paintD3MapSVG();
  else paintMapSVG();
}


function initMapWidget(){
  if(mapSvgBuilt)return;
  mapSvgBuilt=true;
  
  // Загрузить TopoJSON и построить D3 карту
  loadD3Map().then(() => {
    buildD3MapSVG();
    setMapMode('price');
  }).catch(err => {
    console.error('Ошибка при инициализации карты:', err);
    // Fallback на старую карту если D3 не работает
    buildMapSVG();
    setMapMode('price');
  });
}

// ---- MARKET TABLE ----
let marketSortCol  = 'yield';
let marketSortDir  = 'desc';

function getRegionValue(r, col) {
  if (col === 'name')   return r.name;
  if (col === 'price')  return r.price;
  if (col === 'rent')   return r.rent;
  if (col === 'itp')    return r.itp;
  if (col === 'yield')  return r.yield;
  if (col === 'pr')     return r.pr;
  if (col === 'prAdj')  return r.prAdj;
  if (col === 'growth1')return r.growth1;
  if (col === 'cagr10') return (Math.pow(1 + r.growth10 / 100, 1 / 10) - 1) * 100;
  return 0;
}

function initMarketSort() {
  document.querySelectorAll('#market-table .col-sortable').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (marketSortCol === col) {
        marketSortDir = marketSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        marketSortCol = col;
        marketSortDir = col === 'name' ? 'asc' : 'desc';
      }
      updateMarketSortHeaders();
      renderMarket();
    });
  });
}

function updateMarketSortHeaders() {
  document.querySelectorAll('#market-table .col-sortable').forEach(th => {
    const isActive = th.dataset.col === marketSortCol;
    th.classList.toggle('col-active', isActive);
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) {
      if (isActive) {
        arrow.textContent = marketSortDir === 'desc' ? ' ↓' : ' ↑';
        arrow.style.opacity = '1';
      } else {
        arrow.textContent = ' ↕';
        arrow.style.opacity = '0.3';
      }
    }
  });
}

function renderMarket() {
  const tbody = document.getElementById('market-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Сортировка
  const sorted = [...REGIONS].sort((a, b) => {
    const va = getRegionValue(a, marketSortCol);
    const vb = getRegionValue(b, marketSortCol);
    if (typeof va === 'string') return marketSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return marketSortDir === 'asc' ? va - vb : vb - va;
  });

  sorted.forEach(r => {
    // Цвет строки по цене
    let rowBg = '';
    if (r.price < 1500)      rowBg = 'background:rgba(46,125,50,0.13);';
    else if (r.price > 2500) rowBg = 'background:rgba(183,28,28,0.10);';

    const cagr10 = (Math.pow(1 + r.growth10 / 100, 1 / 10) - 1) * 100;

    // Цвет доходности
    const yColor = r.yield > 6.5 ? '#7edb7e'
                 : r.yield > 5   ? '#8de'
                 : r.yield > 3.5 ? '#f0c040'
                 : '#f97';

    // Цвет роста за год
    const g1Color = r.growth1 >= 12 ? '#f0c040'
                  : r.growth1 >= 8  ? '#c8e6c9'
                  : '#aaa';

    const tr = document.createElement('tr');
    tr.style.cssText = rowBg + 'cursor:pointer;transition:filter 0.12s;';
    tr.onmouseenter = () => tr.style.filter = 'brightness(1.15)';
    tr.onmouseleave = () => tr.style.filter = '';
    tr.onclick = () => showPRDetailFor(r.name);
    tr.innerHTML = `
      <td class="col-sticky" style="font-weight:500;${rowBg}">${r.name}</td>
      <td>${r.price.toLocaleString('ru')} €</td>
      <td>${r.rent.toFixed(1)} €</td>
      <td>${(r.itp * 100).toFixed(0)}%</td>
      <td style="color:${yColor};font-weight:600;">${r.yield.toFixed(1)}%</td>
      <td style="color:var(--muted);">${r.pr.toFixed(1)}</td>
      <td style="color:var(--muted);">${r.prAdj.toFixed(1)}</td>
      <td style="color:${g1Color};">${r.growth1 >= 0 ? '+' : ''}${r.growth1.toFixed(1)}%</td>
      <td style="color:var(--muted);">+${cagr10.toFixed(1)}%</td>
    `;
    tbody.appendChild(tr);
  });
}

function initMarketTable() {
  initMarketSort();
  updateMarketSortHeaders();
  renderMarket();
}

// ---- HEATMAPS ----
function growthColor(v) {
  if (v <  0) return ['#4a1515', '#e05c5c'];
  if (v <  3) return ['#1a2a3a', '#6a9ab8'];
  if (v <  6) return ['#1a3050', '#4a80b0'];
  if (v <  9) return ['#1a4070', '#4a90d4'];
  if (v < 12) return ['#1a5080', '#5ab0f0'];
  return ['#3a2a00', '#c9a84c'];
}
function absColor(v) {
  const mn = 850, mx = 4905;
  const t = (v - mn) / (mx - mn);
  return [`rgb(${Math.round(30 + t*180)},${Math.round(60 - t*20)},${Math.round(180 - t*140)})`, t > 0.6 ? '#fff' : '#ccc'];
}

let hmRendered = false;
function renderHeatmaps() {
  if (hmRendered) return;
  hmRendered = true;

  // Render growth bar chart (BLOCK 2.1)
  renderGrowthBarChart();

  const makeYearRow = () => {
    const d = document.createElement('div'); d.className = 'hm-year-row';
    YEARS.forEach(y => { const s = document.createElement('span'); s.className = 'hm-year'; s.textContent = y; d.appendChild(s); });
    return d;
  };

  ['hm-growth-content', 'hm-abs-content'].forEach((cid, mode) => {
    const cont = document.getElementById(cid);
    cont.appendChild(makeYearRow());
    REGIONS.forEach(r => {
      const row = document.createElement('div'); row.className = 'hm-row';
      const lbl = document.createElement('div'); lbl.className = 'hm-label'; lbl.textContent = r.name;
      row.appendChild(lbl);

      const gdata = GROWTH_DATA[r.name];
      let p = r.price;
      const abs = [];
      for (let i = YEARS.length - 1; i >= 0; i--) { p = p / (1 + (gdata[i] || 0) / 100); abs.unshift(Math.round(p * (1 + (gdata[i] || 0) / 100))); }
      abs[YEARS.length - 1] = r.price;

      YEARS.forEach((y, i) => {
        const v = mode === 0 ? gdata[i] : abs[i];
        const [bg, tc] = mode === 0 ? growthColor(gdata[i]) : absColor(abs[i]);
        const cell = document.createElement('div'); cell.className = 'hm-cell';
        cell.style.background = bg; cell.style.color = tc;
        cell.textContent = mode === 0
          ? (gdata[i] > 0 ? '+' : '') + gdata[i].toFixed(1)
          : (abs[i] >= 1000 ? (abs[i] / 1000).toFixed(1) + 'k' : abs[i]);
        cell.title = `${r.name} ${y}: ${mode === 0 ? (gdata[i] > 0 ? '+' : '') + gdata[i] + '%' : abs[i] + ' €/м²'}`;
        row.appendChild(cell);
      });
      cont.appendChild(row);
    });
  });

  const sel = document.getElementById('trend-select');
  REGIONS.forEach(r => { const o = document.createElement('option'); o.value = r.name; o.textContent = r.name; sel.appendChild(o); });
  activeTrendLines = ['Madrid'];
  renderTrendChart();
}

// Growth bar chart (BLOCK 2.1)
function renderGrowthBarChart() {
  const sorted = [...REGIONS].sort((a, b) => b.growth1 - a.growth1);
  const height = (sorted.length * 38) + 80;
  
  const canvas = document.getElementById('growthBarChart');
  if (!canvas) return;
  if (growthBarChartInst) { growthBarChartInst.destroy(); growthBarChartInst = null; }

  const minGrowth = Math.min(...sorted.map(r => r.growth1));
  const maxGrowth = Math.max(...sorted.map(r => r.growth1));

  growthBarChartInst = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: sorted.map(r => r.name),
      datasets: [{
        label: 'Рост %',
        data: sorted.map(r => r.growth1),
        backgroundColor: sorted.map(r => {
          const t = (r.growth1 - minGrowth) / (maxGrowth - minGrowth);
          const hue = 100 - (t * 100);
          const lightness = 60 - (t * 20);
          return `hsl(${hue}, 70%, ${lightness}%)`;
        }),
        borderRadius: 4,
        borderWidth: 0,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` +${ctx.raw.toFixed(1)}%`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8a8f9e', font: { size: 10 }, callback: v => v + '%' },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          ticks: { color: '#8a8f9e', font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
  canvas.parentElement.style.height = height + 'px';
}

let trendChartInst = null, activeTrendLines = ['Madrid'], growthBarChartInst = null;

function renderTrendChart() {
  const sel = document.getElementById('trend-select').value;
  if (!activeTrendLines.includes(sel)) activeTrendLines = [sel];
  drawTrendChart();
}

function addTrendLine() {
  const sel = document.getElementById('trend-select').value;
  if (activeTrendLines.length >= 5) {
    alert('Максимум 5 регионов одновременно');
    return;
  }
  if (!activeTrendLines.includes(sel)) activeTrendLines.push(sel);
  drawTrendChart();
}

function removeTrendLine(name) {
  if (activeTrendLines.length === 1) {
    alert('Остаётся минимум 1 регион');
    return;
  }
  activeTrendLines = activeTrendLines.filter(x => x !== name);
  drawTrendChart();
}

function clearTrendLines() { 
  activeTrendLines = [document.getElementById('trend-select').value]; 
  drawTrendChart(); 
}

function drawTrendChart() {
  if (trendChartInst) { trendChartInst.destroy(); trendChartInst = null; }
  const legend = document.getElementById('trend-legend');
  legend.innerHTML = activeTrendLines.map(n => {
    const r = REGIONS.find(x => x.name === n);
    return `<div class="legend-item" style="display:flex;align-items:center;gap:6px;">
      <div class="legend-dot" style="background:${r.color};border-radius:50%;"></div>
      <span>${n}</span>
      ${activeTrendLines.length > 1 ? `<button onclick="removeTrendLine('${n.replace(/'/g, "\\'")}')" style="margin-left:4px;padding:2px 6px;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:3px;cursor:pointer;font-size:11px;">×</button>` : ''}
    </div>`;
  }).join('');
  trendChartInst = new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels: YEARS,
      datasets: activeTrendLines.map(n => {
        const r = REGIONS.find(x => x.name === n);
        return { label: n, data: GROWTH_DATA[n], borderColor: r.color, backgroundColor: 'transparent', tension: 0.35, pointRadius: 3, borderWidth: 2 };
      })
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.raw > 0 ? '+' : ''}${ctx.raw.toFixed(1)}%` } } },
      scales: {
        x: { ticks: { color: '#8a8f9e', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#8a8f9e', font: { size: 11 }, callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

// ---- P/R PAGE ----
function renderPRPage() {
  const sorted = [...REGIONS].sort((a, b) => a.prAdj - b.prAdj);
  const maxPR  = Math.max(...REGIONS.map(r => r.prAdj));
  const med    = sorted.map(r => r.prAdj).sort((a, b) => a - b);

  document.getElementById('pr-best-val').textContent  = sorted[0].prAdj.toFixed(1) + ' лет';
  document.getElementById('pr-best-name').textContent = sorted[0].name;
  document.getElementById('pr-worst-val').textContent  = sorted[sorted.length-1].prAdj.toFixed(1) + ' лет';
  document.getElementById('pr-worst-name').textContent = sorted[sorted.length-1].name;
  document.getElementById('pr-median').textContent    = med[Math.floor(med.length/2)].toFixed(1);

  const list = document.getElementById('pr-ranking'); list.innerHTML = '';
  sorted.forEach((r, i) => {
    const bw = Math.round(r.prAdj / maxPR * 100);
    const c  = r.prAdj < 16 ? 'var(--green)' : r.prAdj < 20 ? 'var(--accent)' : 'var(--red)';
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px solid rgba(42,45,53,0.5);cursor:pointer;';
    div.onmouseenter = e => e.currentTarget.style.background = 'var(--bg3)';
    div.onmouseleave = e => e.currentTarget.style.background = '';
    div.onclick = () => { document.getElementById('pr-detail-select').value = r.name; renderPRDetail(); };
    div.innerHTML = `
      <span style="width:20px;font-size:11px;color:var(--muted);text-align:right;">${i+1}</span>
      <span style="width:130px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.name}</span>
      <div style="flex:1;background:var(--border);border-radius:2px;overflow:hidden;height:8px;">
        <div style="width:${bw}%;height:100%;background:${c};border-radius:2px;"></div>
      </div>
      <span style="font-size:12px;color:var(--muted);width:28px;text-align:right;">${(r.itp*100).toFixed(0)}%</span>
      <span style="font-size:12px;color:var(--muted);width:36px;text-align:right;">${r.pr.toFixed(1)}</span>
      <span style="font-size:13px;font-weight:500;color:${c};width:36px;text-align:right;">${r.prAdj.toFixed(1)}</span>
      <span style="font-size:12px;color:var(--muted);width:44px;text-align:right;">${r.yield.toFixed(1)}%</span>
    `;
    list.appendChild(div);
  });

  const sel = document.getElementById('pr-detail-select');
  if (!sel.children.length) REGIONS.forEach(r => { const o = document.createElement('option'); o.value = r.name; o.textContent = r.name; sel.appendChild(o); });
  renderPRDetail();
}

function showPRDetailFor(name) {
  showPage('pr', document.querySelectorAll('.nav-btn')[2]);
  setTimeout(() => {
    if (!document.getElementById('pr-detail-select').children.length) renderPRPage();
    document.getElementById('pr-detail-select').value = name;
    renderPRDetail();
  }, 100);
}

function renderPRDetail() {
  const name = document.getElementById('pr-detail-select').value;
  const r = REGIONS.find(x => x.name === name);
  if (!r) return;
  const sqm = 70;
  const totalBuy  = Math.round(r.totalCost * sqm);
  const itpAmt    = Math.round(r.price * sqm * r.itp);
  const notaryAmt = Math.round(r.price * sqm * NOTARY_RATE);
  const verdict   = r.prAdj < 16 ? 'выгодно покупать' : r.prAdj < 20 ? 'норма рынка' : r.prAdj < 24 ? 'дорого' : 'очень дорого';
  const vc        = r.prAdj < 16 ? 'var(--green)' : r.prAdj < 20 ? 'var(--accent)' : 'var(--red)';

  document.getElementById('pr-detail-content').innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <div style="font-size:18px;font-weight:500;">${r.name}</div>
          <span class="pill" style="background:rgba(255,255,255,0.06);color:${vc};">${verdict}</span>
        </div>
        <p style="font-size:12px;color:var(--muted);margin-bottom:14px;">Квартира 70 м²</p>
        <div class="grid-2" style="gap:10px;margin-bottom:14px;">
          <div class="card-sm"><div class="metric-label">Цена покупки</div><div style="font-size:16px;font-weight:500;">${(r.price*sqm).toLocaleString('ru')} €</div></div>
          <div class="card-sm"><div class="metric-label">Аренда / мес</div><div style="font-size:16px;font-weight:500;">${Math.round(r.rent*sqm).toLocaleString('ru')} €</div></div>
        </div>
        <div style="font-size:13px;">
          <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);"><span style="color:var(--muted);">ITP (${(r.itp*100).toFixed(0)}%)</span><span>${itpAmt.toLocaleString('ru')} €</span></div>
          <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);"><span style="color:var(--muted);">Нотариус + реестр (1.5%)</span><span>${notaryAmt.toLocaleString('ru')} €</span></div>
          <div style="display:flex;justify-content:space-between;padding:7px 0;font-weight:500;"><span>Итого с расходами</span><span style="color:var(--accent2);">${totalBuy.toLocaleString('ru')} €</span></div>
        </div>
      </div>
      <div class="card">
        <div class="grid-3" style="gap:10px;margin-bottom:16px;">
          <div class="card-sm" style="text-align:center;"><div class="metric-label">P/R базовый</div><div style="font-size:22px;font-weight:500;">${r.pr.toFixed(1)}</div><div style="font-size:11px;color:var(--muted);">лет</div></div>
          <div class="card-sm" style="text-align:center;border:1px solid ${vc}40;"><div class="metric-label">P/R<sub>adj</sub></div><div style="font-size:26px;font-weight:500;color:${vc};">${r.prAdj.toFixed(1)}</div><div style="font-size:11px;color:var(--muted);">с налогами</div></div>
          <div class="card-sm" style="text-align:center;"><div class="metric-label">Rental yield</div><div style="font-size:22px;font-weight:500;">${r.yield.toFixed(1)}%</div><div style="font-size:11px;color:var(--muted);">валовая</div></div>
        </div>
        <div style="font-size:13px;color:var(--muted);line-height:1.8;">
          <div>• Норма для Европы: <span style="color:var(--text);">15–20 лет</span></div>
          <div>• Ваш регион: <span style="color:${vc};font-weight:500;">${r.prAdj.toFixed(1)} лет (${verdict})</span></div>
          <div>• Разница с базовым: <span style="color:var(--text);">+${(r.prAdj - r.pr).toFixed(1)} лет</span> из-за налогов</div>
          <div>• Рост цен за 10 лет: <span style="color:var(--text);">+${r.growth10}%</span></div>
        </div>
      </div>
    </div>
  `;
}

// ================================================================
// CALCULATOR 1 — КУПИТЬ ИЛИ СНЯТЬ? (v11)
// ================================================================

function toggleCalcSection(contentId, arrowId) {
  const content = document.getElementById(contentId);
  const arrow   = document.getElementById(arrowId);
  if (!content) return;
  const isOpen = content.classList.contains('open');
  content.classList.toggle('open', !isOpen);
  if (arrow) arrow.classList.toggle('open', !isOpen);
}

function initCalc1() {
  const sel = document.getElementById('c1-region');
  if (!sel) return;
  // Only populate once
  if (sel.options.length <= 1) {
    REGIONS.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      sel.appendChild(opt);
    });
  }
}

function onCalc1RegionChange() {
  const id = document.getElementById('c1-region').value;
  if (!id) return;
  const r = REGIONS.find(x => x.id === id);
  if (!r) return;
  const sqm = 70;
  document.getElementById('c1-price').value = Math.round(r.price * sqm / 5000) * 5000;
  document.getElementById('c1-rent').value  = Math.round(r.rent * sqm / 50) * 50;
  // Set tax based on property type
  const tax = c1PropertyType === 'new' ? 12.5 : (r.itp + 0.015) * 100;
  document.getElementById('c1-tax').value = tax.toFixed(1);
  calc1Update();
}

function resetCalc1ToRegion() {
  onCalc1RegionChange();
}

function setPropertyType1(type, btn) {
  c1PropertyType = type;
  document.querySelectorAll('#c1-proptype-btns .calc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Re-apply tax rate
  const id = document.getElementById('c1-region').value;
  if (id) {
    const r = REGIONS.find(x => x.id === id);
    if (r) {
      const tax = type === 'new' ? 12.5 : (r.itp + 0.015) * 100;
      document.getElementById('c1-tax').value = tax.toFixed(1);
    }
  } else {
    document.getElementById('c1-tax').value = type === 'new' ? '12.5' : '7.5';
  }
  calc1Update();
}

function applyCalc1Preset(preset, btn) {
  document.querySelectorAll('#c1-preset-btns .calc-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (preset === 'mortgage') {
    document.getElementById('c1-down').value  = 20;
    document.getElementById('c1-rate').value  = 3.2;
    document.getElementById('c1-inv').value   = 7;
  } else if (preset === 'cash') {
    document.getElementById('c1-down').value  = 100;
    document.getElementById('c1-rate').value  = 0;
    document.getElementById('c1-inv').value   = 7;
  } else if (preset === 'noninv') {
    document.getElementById('c1-down').value  = 20;
    document.getElementById('c1-rate').value  = 3.2;
    document.getElementById('c1-inv').value   = 0;
  }
  calc1Update();
}

function setPriceMode1(mode, btn) {
  c1PriceMode = mode;
  document.querySelectorAll('#c1-mode-btns .calc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  calc1Update();
}

function setHorizon1(years, btn) {
  c1Horizon = years;
  document.querySelectorAll('#c1-horizon-btns .calc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  calc1Update();
}

function setStressTest1(scenario, btn) {
  document.querySelectorAll('#c1-stress-btns .calc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const base = {
    rate:  +document.getElementById('c1-rate').value,
    appr:  +document.getElementById('c1-appr').value,
    rentg: +document.getElementById('c1-rentg').value,
  };
  if (scenario === 'opt') {
    document.getElementById('c1-rate').value  = Math.max(1, base.rate - 1);
    document.getElementById('c1-appr').value  = Math.min(10, base.appr + 1);
    document.getElementById('c1-rentg').value = Math.min(8, base.rentg + 1);
  } else if (scenario === 'base') {
    document.getElementById('c1-rate').value  = 3.2;
    document.getElementById('c1-appr').value  = 3;
    document.getElementById('c1-rentg').value = 3;
  } else if (scenario === 'pess') {
    document.getElementById('c1-rate').value  = Math.min(10, base.rate + 2);
    document.getElementById('c1-appr').value  = Math.max(-2, base.appr - 1);
    document.getElementById('c1-rentg').value = Math.max(0, base.rentg - 1.5);
  }
  calc1Update();
}

function calc1Update() {
  const price      = +document.getElementById('c1-price').value;
  const downPct    = +document.getElementById('c1-down').value / 100;
  const annRate    = +document.getElementById('c1-rate').value / 100;
  const termYears  = +document.getElementById('c1-term').value;
  const taxPct     = +document.getElementById('c1-tax').value / 100;
  const appr       = +document.getElementById('c1-appr').value / 100;
  const maint      = +document.getElementById('c1-maint').value / 100;
  const rent0      = +document.getElementById('c1-rent').value;
  const rentGrowth = +document.getElementById('c1-rentg').value / 100;
  const invRate    = +document.getElementById('c1-inv').value / 100;
  const inflation  = +document.getElementById('c1-inflation').value / 100;
  const horizon    = c1Horizon;

  // ---- Display updates ----
  const fmt = v => Math.round(v).toLocaleString('ru');

  document.getElementById('c1v-price').textContent    = fmt(price) + ' €';
  document.getElementById('c1v-down').textContent     = (downPct*100).toFixed(0) + '%';
  document.getElementById('c1v-rate').textContent     = (annRate*100).toFixed(1) + '%';
  document.getElementById('c1v-term').textContent     = termYears + ' лет';
  document.getElementById('c1v-tax').textContent      = (taxPct*100).toFixed(1) + '%';
  document.getElementById('c1v-appr').textContent     = (appr*100).toFixed(1) + '%';
  document.getElementById('c1v-maint').textContent    = (maint*100).toFixed(1) + '%';
  document.getElementById('c1v-rent').textContent     = fmt(rent0) + ' €';
  document.getElementById('c1v-rentg').textContent    = (rentGrowth*100).toFixed(1) + '%';
  document.getElementById('c1v-inv').textContent      = (invRate*100).toFixed(1) + '%';
  document.getElementById('c1v-inflation').textContent= (inflation*100).toFixed(1) + '%';

  const downAmt = price * downPct;
  const taxAmt  = price * taxPct;
  document.getElementById('c1v-down-amt').textContent  = '= ' + fmt(downAmt) + ' €';
  document.getElementById('c1v-tax-amt').textContent   = '= ' + fmt(taxAmt) + ' €';
  document.getElementById('c1v-maint-amt').textContent = '= ' + fmt(price * maint) + ' €/год';

  // Mortgage
  const loan  = price * (1 - downPct);
  const mRate = annRate / 12;
  const nPay  = termYears * 12;
  let monthlyMortgage = 0;
  if (annRate > 0 && loan > 0) {
    monthlyMortgage = loan * (mRate * Math.pow(1+mRate,nPay)) / (Math.pow(1+mRate,nPay) - 1);
  } else if (loan > 0) {
    monthlyMortgage = loan / nPay;
  }
  document.getElementById('c1v-rate-pmt').textContent = '≈ ' + fmt(monthlyMortgage) + ' €/мес';

  // ---- Simulation ----
  // Initial investment: down + tax (money out of pocket on day 1)
  const initialCash = downAmt + taxAmt;

  const buyData  = [];
  const rentData = [];
  const labels   = [];

  let propVal   = price;
  let loanBal   = loan;
  let portfolio = initialCash; // renter invests this initial lump sum
  let rent      = rent0;
  let totalMortgagePaid = 0;

  for (let y = 0; y <= horizon; y++) {
    const inflFactor = c1PriceMode === 'real' ? Math.pow(1 + inflation, y) : 1;
    labels.push(y === 0 ? t('c1_now') || 'Сейчас' : `${t('c1_year')||'Год'} ${y}`);
    buyData.push(Math.round((propVal - loanBal) / inflFactor));
    rentData.push(Math.round(portfolio / inflFactor));

    if (y < horizon) {
      for (let m = 0; m < 12; m++) {
        const mo = y * 12 + m;
        // Mortgage
        let payment = 0;
        if (mo < nPay && loanBal > 0) {
          const interest  = loanBal * mRate;
          const principal = Math.min(monthlyMortgage - interest, loanBal);
          loanBal = Math.max(0, loanBal - principal);
          payment = monthlyMortgage;
        }
        // Maintenance monthly (% of property value)
        const maintMonthly = propVal * maint / 12;
        const buyerTotal   = payment + maintMonthly;

        // Renter: compound invest, then add monthly diff if buyer costs > rent
        portfolio *= (1 + invRate / 12);
        const diff = buyerTotal - rent;
        portfolio += Math.max(0, diff); // renter invests saved difference
        totalMortgagePaid += payment;
      }
      propVal *= (1 + appr);
      rent    *= (1 + rentGrowth);
    }
  }

  const buyFinal  = buyData[horizon];
  const rentFinal = rentData[horizon];
  const diff      = buyFinal - rentFinal;
  const winner    = diff >= 0 ? 'buy' : 'rent';

  // Parity year
  let parityYear = null;
  for (let y = 1; y <= horizon; y++) {
    if (winner === 'buy' && buyData[y] >= rentData[y]) { parityYear = y; break; }
    if (winner === 'rent' && rentData[y] >= buyData[y]) { parityYear = y; break; }
  }

  // ROI on down payment (annualised)
  const roiTotal = (buyFinal - initialCash) / initialCash;
  const roiAnn   = (Math.pow(1 + roiTotal, 1 / horizon) - 1) * 100;

  // ---- Summary cards ----
  const winLabel = winner === 'buy' ? (t('c1_buy')||'Покупка') : (t('c1_rent_word')||'Аренда');
  document.getElementById('c1-winner').textContent     = '🏆 ' + winLabel;
  document.getElementById('c1-winner-sub').textContent = t('c1_diff_label')||'Разница: ' + fmt(Math.abs(diff)) + ' €';
  document.getElementById('c1-parity').textContent     = parityYear ? parityYear + ' ' + (t('c1_years')||'лет') : '>' + horizon;
  document.getElementById('c1-roi').textContent        = roiAnn.toFixed(1) + '%';
  document.getElementById('c1-roi-sub').textContent    = (t('c1_roi_per_year')||'годовых на взнос') + ' / ' + horizon + ' ' + (t('c1_years')||'лет');

  // ---- Chart ----
  drawCalc1Chart(labels, buyData, rentData, parityYear);

  // ---- Auto-summary text ----
  buildCalc1Summary(winner, buyFinal, rentFinal, parityYear, roiAnn, horizon, downAmt, taxAmt, monthlyMortgage, rent0);
}

function drawCalc1Chart(labels, buyData, rentData, parityYear) {
  const canvas = document.getElementById('calcChart');
  if (!canvas) return;
  if (c1Chart) { c1Chart.destroy(); c1Chart = null; }

  // Crossover annotation plugin (manual)
  const crossoverIdx = parityYear !== null ? parityYear : null;

  c1Chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: t('c1_buy') || 'Покупка',
          data: buyData,
          borderColor: '#4a90d9',
          backgroundColor: 'rgba(74,144,217,0.10)',
          fill: false,
          tension: 0.35,
          pointRadius: 2,
          borderWidth: 2.5,
        },
        {
          label: t('c1_rent_word') || 'Аренда',
          data: rentData,
          borderColor: '#5cb88a',
          backgroundColor: 'rgba(92,184,138,0.10)',
          fill: false,
          tension: 0.35,
          pointRadius: 2,
          borderWidth: 2.5,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: '#8a8f9e', boxWidth: 12, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString('ru')} €`
          }
        },
        annotation: crossoverIdx ? {
          annotations: {
            cross: {
              type: 'line',
              xMin: crossoverIdx,
              xMax: crossoverIdx,
              borderColor: 'rgba(201,168,76,0.6)',
              borderWidth: 1.5,
              borderDash: [4,4],
              label: { display: true, content: t('c1_crossover')||'Паритет', color: '#c9a84c', font: { size: 11 } }
            }
          }
        } : {}
      },
      scales: {
        x: {
          ticks: { color: '#8a8f9e', font: { size: 11 }, maxTicksLimit: 8 },
          grid:  { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          ticks: {
            color: '#8a8f9e', font: { size: 11 },
            callback: v => v >= 1000000 ? (v/1000000).toFixed(1)+'M €' : v >= 1000 ? (v/1000).toFixed(0)+'k €' : v+'€'
          },
          grid: { color: 'rgba(255,255,255,0.04)' }
        }
      }
    }
  });
}

function buildCalc1Summary(winner, buyFinal, rentFinal, parityYear, roiAnn, horizon, downAmt, taxAmt, mortgagePmt, rent0) {
  const el = document.getElementById('c1-summary-text');
  if (!el) return;
  const fmt = v => Math.round(v).toLocaleString('ru');
  const winWord = winner === 'buy' ? (t('c1_buy')||'покупка') : (t('c1_rent_word')||'аренда');
  const diff = Math.abs(buyFinal - rentFinal);
  const parStr = parityYear ? `${t('c1_parity_year_at')||'Точка паритета'} — год ${parityYear}.` : '';
  el.innerHTML = `<strong>${t('c1_sum_intro')||'Вывод:'}</strong> ${t('c1_sum_winner')||'Стратегия'}
    <strong>${winWord}</strong> ${t('c1_sum_better')||'выгоднее через'} <strong>${horizon} ${t('c1_years')||'лет'}</strong>
    ${t('c1_sum_diff')||'— разница'} <strong>${fmt(diff)} €</strong>. ${parStr}
    ${t('c1_sum_roi')||'ROI на первоначальный взнос (покупка):'} <strong>${roiAnn.toFixed(1)}% ${t('c1_per_year')||'годовых'}</strong>.
    ${t('c1_sum_inputs')||'Начальные вложения:'} ${fmt(downAmt + taxAmt)} €
    (${t('c1_down')||'взнос'} ${fmt(downAmt)} + ${t('c1_taxes_fees')||'налоги/сборы'} ${fmt(taxAmt)}).`;
}

function shareCalc1() {
  const fields = ['c1-price','c1-down','c1-rate','c1-term','c1-tax','c1-appr','c1-maint','c1-rent','c1-rentg','c1-inv','c1-inflation'];
  const params = new URLSearchParams({ page: 'calc' });
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) params.set(id, el.value);
  });
  params.set('c1horizon', c1Horizon);
  params.set('c1mode', c1PriceMode);
  const url = location.origin + location.pathname + '?' + params.toString();
  // Save to localStorage too
  try { localStorage.setItem('c1params', params.toString()); } catch(e) {}
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('c1-share-btn');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '✓ ' + (t('c1_copied')||'Ссылка скопирована');
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    }
  }).catch(() => { prompt('URL:', url); });
}

function loadCalc1FromURL() {
  const params = new URLSearchParams(location.search);
  const fields = ['c1-price','c1-down','c1-rate','c1-term','c1-tax','c1-appr','c1-maint','c1-rent','c1-rentg','c1-inv','c1-inflation'];
  let hasParams = false;
  fields.forEach(id => {
    const val = params.get(id);
    if (val !== null) {
      const el = document.getElementById(id);
      if (el) { el.value = val; hasParams = true; }
    }
  });
  if (params.get('c1horizon')) { c1Horizon = +params.get('c1horizon'); }
  if (params.get('c1mode'))    { c1PriceMode = params.get('c1mode'); }
  // Fallback: localStorage
  if (!hasParams) {
    try {
      const stored = localStorage.getItem('c1params');
      if (stored) {
        const sp = new URLSearchParams(stored);
        fields.forEach(id => {
          const val = sp.get(id);
          if (val !== null) {
            const el = document.getElementById(id);
            if (el) el.value = val;
          }
        });
        if (sp.get('c1horizon')) c1Horizon = +sp.get('c1horizon');
        if (sp.get('c1mode'))    c1PriceMode = sp.get('c1mode');
      }
    } catch(e) {}
  }
  // Sync UI buttons
  document.querySelectorAll('#c1-horizon-btns .calc-btn').forEach(b => {
    const yr = parseInt(b.textContent);
    b.classList.toggle('active', yr === c1Horizon);
  });
  document.querySelectorAll('#c1-mode-btns .calc-btn').forEach((b, i) => {
    b.classList.toggle('active', (i === 0 && c1PriceMode === 'nominal') || (i === 1 && c1PriceMode === 'real'));
  });
}

// ---- EMAIL SUBSCRIPTION ----
function subscribeEmail() {
  const emailInput = document.getElementById('email-subscribe');
  const messageEl = document.getElementById('email-message');
  const email = emailInput.value.trim();
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    messageEl.textContent = t('subscribe_error');
    messageEl.style.color = 'var(--red)';
    return;
  }
  
  messageEl.textContent = t('subscribe_success');
  messageEl.style.color = 'var(--green)';
  emailInput.value = '';
  setTimeout(() => { messageEl.textContent = ''; }, 3000);
  
  // TODO: In production, send to Mailchimp API or backend service
  console.log('Email to subscribe:', email);
}

// ---- GUIDE ----
function renderGuide() {
  const costsSecondary = [
    ['ITP (налог на передачу)', '6–10%', 'зависит от региона'],
    ['Нотариус',                '0.5–1%', 'от цены сделки'],
    ['Регистр собственности',   '0.2–0.5%', ''],
    ['Gestoria (агент)',        '300–500 €', 'разовый'],
    ['Итого',                   '~8–12%', ''],
  ];
  const costsNew = [
    ['IVA (НДС)',               '10%', 'для жилья'],
    ['AJD (гербовый сбор)',     '0.5–1.5%', 'зависит от региона'],
    ['Нотариус + регистр',      '0.7–1.5%', ''],
    ['Gestoria',                '300–500 €', 'разовый'],
    ['Итого',                   '~12–13%', ''],
  ];

  const makeTable = data => data.map(([k,v,n]) =>
    `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px;">
      <span style="color:var(--muted);">${k}</span>
      <span style="font-weight:500;">${v} <span style="font-size:11px;color:var(--muted);">${n}</span></span>
    </div>`
  ).join('');

  document.getElementById('costs-table').innerHTML     = makeTable(costsSecondary);
  document.getElementById('costs-table-new').innerHTML = makeTable(costsNew);

  // Группировка провинций по регионам
  if (!topoData) return; // карта ещё не загружена
  const features = topojson.feature(topoData, topoData.objects.esp).features;
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
    if (regionId === 'canarias') return; // Канары — только во врезке
    const feats = regionFeatures[regionId];
    if (!feats) return;
    let centroid = [0, 0];
    try {
      const multi = { type: 'MultiPolygon', coordinates: [] };
      feats.forEach(f => {
        const geom = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        multi.coordinates.push(...geom);
      });
      centroid = pathGenerator.centroid(multi);
      if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) throw new Error('bad centroid');
    } catch {
      let x = 0, y = 0, n = 0;
      feats.forEach(f => {
        const b = pathGenerator.bounds(f);
        x += (b[0][0] + b[1][0]) / 2;
        y += (b[0][1] + b[1][1]) / 2;
        n++;
      });
      centroid = [x/n, y/n];
    }
    svg.append('text')
      .attr('x', centroid[0])
      .attr('y', centroid[1])
      .attr('data-region', regionId)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12')
      .attr('font-weight', '600')
      .attr('fill', getMapTextColor(regionId))
      .attr('pointer-events', 'none')
      .text(label.toUpperCase());
  });

  paintD3MapSVG();
}

function paintD3MapSVG(){
  const svg = d3.select('#map-svg');
  svg.selectAll('path').attr('fill', function(d) {
    const pName = d.properties.name, regionId = PROVINCE_TO_REGION[pName];
    if (!regionId) return '#333';
    const reg = regionsByNameGlobal[regionId];
    if (!reg) return '#333';
    return getMapColor(reg);
  });
  // Обновить цвет текста по индексу стопа
  svg.selectAll('text[data-region]').each(function() {
    const regionId = d3.select(this).attr('data-region');
    d3.select(this).attr('fill', getMapTextColor(regionId));
  });
  renderCanarias();
  buildMapLegend();
}

function setMapMode(mode, btn) {
  mapMode = mode;
  if (btn) {
    document.querySelectorAll('.map-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const isPr = mode === 'pr';
  const formulaBlock = document.getElementById('map-info-formula');
  if (formulaBlock) formulaBlock.style.display = isPr ? '' : 'none';
  const benchBlock = document.getElementById('map-info-benchmarks');
  if (benchBlock) benchBlock.style.display = isPr ? '' : 'none';
  const titleEl = document.getElementById('map-legend-title');
  if (titleEl) {
    if (mode === 'pr') {
      titleEl.innerHTML = 'Доходность от аренды<a href="#map-yield-footnote" style="color:#f0c040;text-decoration:none;cursor:pointer;">*</a>, %';
    } else {
      titleEl.textContent = PALETTES[mode].title;
    }
  }
  if (topoData) {
    paintD3MapSVG();
  } else {
    paintMapSVG();
  }
}

function selectMapRegion(r) {
  const prevSel = mapSel;
  mapSel = r.id === mapSel ? null : r.id;
  if (topoData) {
    const svg = d3.select('#map-svg');
    svg.selectAll('path').attr('stroke-width', function(d) {
      const pName = d.properties.name, regionId = PROVINCE_TO_REGION[pName];
      return (regionId === mapSel) ? 3 : 2;
    }).attr('stroke', function(d) {
      const pName = d.properties.name, regionId = PROVINCE_TO_REGION[pName];
      return (regionId === mapSel) ? '#c9a84c' : '#0e0f11';
    });
  } else {
    if (prevSel) {
      const p = svg.querySelector(`path[data-id="${prevSel}"]`);
      if (p) {
        p.setAttribute('stroke-width', '1.5');
        p.setAttribute('stroke', '#0e0f11');
      }
    }
    if (mapSel) {
      const p = svg.querySelector(`path[data-id="${mapSel}"]`);
      if (p) {
        p.setAttribute('stroke-width', '3');
        p.setAttribute('stroke', '#c9a84c');
      }
    }
  }
}

function showMapTooltip(e, r) {
  const t = document.getElementById('map-tooltip');
  if (!t) return;
  const val = PALETTES[mapMode].fmt(PALETTES[mapMode].fn(r));
  let valueRow = '';
  let hint = '';
  if (mapMode === 'pr') {
    const yld = (r.rent * 12) / r.price * 100;
    valueRow = `<div style="font-size:20px;font-weight:700;color:#f0ede8;margin:4px 0;">${val}</div>`;
    if (yld < 3.5) hint = '<div style="color:#f97;font-size:12px;margin-top:2px;">⚠ Покупать невыгодно — ниже уровня гособлигаций</div>';
    else if (yld < 5) hint = '<div style="color:#f0c040;font-size:12px;margin-top:2px;">~ Только с расчётом на рост цен</div>';
    else if (yld < 6.5) hint = '<div style="color:#8de;font-size:12px;margin-top:2px;">✓ Покупка может быть оправдана</div>';
    else hint = '<div style="color:#7edb7e;font-size:12px;margin-top:2px;">✓✓ Покупка финансово выгодна</div>';
  } else {
    valueRow = `<div style="color:#aaa;font-size:12px;margin-top:3px;">${PALETTES[mapMode].title}: <strong style="color:#f0ede8;">${val}</strong></div>`;
  }
  t.innerHTML = `<div style="font-weight:600;font-size:13px;">${r.name}</div>${valueRow}${hint}`;
  t.style.display = 'block';
  moveMapTooltip(e);
}

function moveMapTooltip(e) {
  const t = document.getElementById('map-tooltip');
  if (!t) return;
  const svg = document.getElementById('map-svg');
  const svgRect = svg ? svg.getBoundingClientRect() : { left: 0, top: 0 };
  t.style.left = (e.clientX - svgRect.left + 12) + 'px';
  t.style.top = (e.clientY - svgRect.top - 10) + 'px';
}

function hideMapTooltip() {
  const t = document.getElementById('map-tooltip');
  if (t) t.style.display = 'none';
}

function getMapColor(r) {
  const palette = PALETTES[mapMode];
  const v = palette.fn(r);
  const stops = palette.stops;
  for (const s of stops) if (v <= s.v) return s.c;
  return stops[stops.length - 1].c;
}

function buildMapLegend() {
  const palette = PALETTES[mapMode];
  if (!palette) return;
  const legend = document.getElementById('map-legend-box');
  if (!legend) return;
  const html = palette.stops.map((s, i) => {
    const prev = i > 0 ? palette.stops[i - 1].v : 0;
    const lbl = i === 0 ? '< ' + palette.fmt(s.v) : palette.fmt(prev) + '–' + palette.fmt(s.v);
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:${s.c};"><span style="font-size:12px;color:${isLightColor(s.c) ? '#1a1a1a' : '#eee'};">${lbl}</span></div>`;
  }).join('');
  legend.innerHTML = html;
}

function paintMapSVG() {
  const svg = document.getElementById('map-svg');
  if (!svg) return;
  REGIONS.forEach(r => {
    const p = svg.querySelector(`path[data-id="${r.id}"]`);
    if (!p) return;
    const c = getMapColor(r);
    p.setAttribute('fill', c);
  });
  buildMapLegend();
}

function initMapWidget() {
  if (mapSvgBuilt) return;
  mapSvgBuilt = true;
  loadD3Map().then(() => {
    buildD3MapSVG();
    setMapMode('price');
  }).catch(err => {
    console.error('Ошибка при инициализации карты:', err);
    buildMapSVG();
    setMapMode('price');
  });
}


