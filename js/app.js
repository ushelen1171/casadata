// ============================================================
// app.js — основная логика приложения
// ============================================================

// ---- INITIALIZATION ----
document.addEventListener('DOMContentLoaded', () => {
  initGlobalTooltips();

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

  // Когда история догрузится — обновить Cycle-карточку (если Calc 1 уже открыт).
  document.addEventListener('historyLoaded', () => {
    if (document.getElementById('c1-cycle-card')) {
      updateC1CycleCard(getCurrentC1Region());
    }
  });

  // Веб-шрифты (DM Sans, Playfair) загружаются с Google Fonts async — первая
  // отрисовка canvas происходит с системным fallback, что в Chrome на retina
  // выглядит размыто. После готовности шрифтов перерисовываем все активные графики.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      [c1Chart, c1CycleChart, growthBarChartInst, trendChartInst].forEach(ch => {
        if (ch && typeof ch.update === 'function') ch.update('none');
      });
    });
  }
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

// ---- PLURAL YEARS (i18n) ----
function pluralYears(n) {
  if (currentLang === 'ru') {
    if (n % 10 === 1 && n % 100 !== 11) return n + ' год';
    if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return n + ' года';
    return n + ' лет';
  }
  if (currentLang === 'es') {
    return n === 1 ? '1 año' : n + ' años';
  }
  // en
  return n === 1 ? '1 year' : n + ' years';
}

// ---- CALC 1 STATE ----
let c1Chart = null;
let c1FlowChart = null;

// Общий стиль осей для графиков Калк 1 — единый шрифт и цвет тиков/сетки
// на основном графике капитала и графике потоков.
const C1_AXIS_TICK = { color: '#8a8f9e', font: { size: 13 } };
const C1_AXIS_GRID = { color: 'rgba(255,255,255,0.04)' };

// Единый источник ролевых цветов Калк 1. Базовые тона читаются из CSS
// (:root --blue / --green). Fallback — техническая страховка на случай
// сбоя загрузки CSS. При смене дизайна правится ОДНО место — CSS.
// buyerLight = осветлённый (не прозрачный) buyer для сегмента «burn»:
// прозрачность на тёмном фоне даёт мутный цвет, осветление тона —
// чистый голубой, чётко отличимый от насыщенного buyer.
function c1RoleColors() {
  const cs = getComputedStyle(document.documentElement);
  const buyer  = cs.getPropertyValue('--blue').trim()  || '#4a90d9';
  const renter = cs.getPropertyValue('--green').trim() || '#5cb88a';
  const lighten = (hex, f) => {
    const h = hex.replace('#','');
    const r = parseInt(h.substr(0,2),16);
    const g = parseInt(h.substr(2,2),16);
    const b = parseInt(h.substr(4,2),16);
    return `rgb(${Math.round(r+(255-r)*f)},${Math.round(g+(255-g)*f)},${Math.round(b+(255-b)*f)})`;
  };
  return {
    buyer,
    renter,
    buyerLight: lighten(buyer, 0.55),
  };
}
let c1CycleChart = null;
let c1Horizon = DEFAULTS.horizonYears;
let c1PriceMode = 'nominal';
let c1IsCash = false;
let c1ChartTitleText = '';
let c1PropertyType = 'secondary';
let c1PrimeraVivienda = true;
let c1NotaryPct = DEFAULTS.notaryPct;
let c1ComparisonModel = DEFAULTS.comparisonModelDefault;
let c1MeanReversionEnabled = false;

// Returns effective combined tax rate (ITP/itpInv + notary) in percent
function getC1AutoTaxRate(r) {
  if (c1PropertyType === 'new') return getNewBuildTaxPct(r, c1NotaryPct);
  const itpBase = c1PrimeraVivienda ? (r.itpHab ?? r.itp) : (r.itpInv ?? r.itp);
  return (itpBase * 100) + c1NotaryPct;
}

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
  growth: {fn:r=>r.growth1, fmt:v=>v != null ? '+'+v.toFixed(1)+'%' : '—', title:'Рост цен за год',
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
  if(v==null) return '#6b7280';
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
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
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
    const g1Color = r.growth1 != null && r.growth1 >= 12 ? '#f0c040'
                  : r.growth1 != null && r.growth1 >= 8  ? '#c8e6c9'
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
      <td style="color:${g1Color};">${r.growth1 != null ? (r.growth1 >= 0 ? '+' : '') + r.growth1.toFixed(1) + '%' : '—'}</td>
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
  const sorted = [...REGIONS].sort((a, b) => {
    if (a.growth1 == null && b.growth1 == null) return 0;
    if (a.growth1 == null) return 1;
    if (b.growth1 == null) return -1;
    return b.growth1 - a.growth1;
  });
  const height = (sorted.length * 38) + 80;
  
  const canvas = document.getElementById('growthBarChart');
  if (!canvas) return;
  if (growthBarChartInst) { growthBarChartInst.destroy(); growthBarChartInst = null; }

  const validGrowths = sorted.map(r => r.growth1).filter(v => v != null);
  const minGrowth = validGrowths.length ? Math.min(...validGrowths) : 0;
  const maxGrowth = validGrowths.length ? Math.max(...validGrowths) : 10;

  growthBarChartInst = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: sorted.map(r => r.name),
      datasets: [{
        label: 'Рост %',
        data: sorted.map(r => r.growth1),
        backgroundColor: sorted.map(r => {
          if (r.growth1 == null) return '#ccc';
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
      devicePixelRatio: window.devicePixelRatio || 2,
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
      devicePixelRatio: window.devicePixelRatio || 2,
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
  const sqm = DEFAULTS.defaultSqm;
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
        <p style="font-size:12px;color:var(--muted);margin-bottom:14px;">Квартира ${sqm} м²</p>
        <div class="grid-2" style="gap:10px;margin-bottom:14px;">
          <div class="card-sm"><div class="metric-label">Цена покупки</div><div style="font-size:16px;font-weight:500;">${(r.price*sqm).toLocaleString('ru')} €</div></div>
          <div class="card-sm"><div class="metric-label">Аренда / мес</div><div style="font-size:16px;font-weight:500;">${Math.round(r.rent*sqm).toLocaleString('ru')} €</div></div>
        </div>
        <div style="font-size:13px;">
          <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);"><span style="color:var(--muted);">ITP (${(r.itp*100).toFixed(0)}%)</span><span>${itpAmt.toLocaleString('ru')} €</span></div>
          <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);"><span style="color:var(--muted);">Нотариус + реестр (${DEFAULTS.notaryPct}%)</span><span>${notaryAmt.toLocaleString('ru')} €</span></div>
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

// ---- Global tooltip (info-icons) ----
function initGlobalTooltips() {
  const tip = document.getElementById('global-tip');
  if (!tip) return;

  let pinnedEl = null; // element whose tooltip is pinned (click/tap)

  function positionNearEl(el) {
    const r = el.getBoundingClientRect();
    void tip.offsetWidth; // force reflow so dimensions are current
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    // Prefer above the element to avoid covering content below (e.g. charts)
    let top = r.top - th - 8;
    if (top < 8) top = r.bottom + 8; // not enough space above → go below
    let left = Math.round(r.left + r.width / 2 - tw / 2);
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    tip.style.transform = '';
    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
  }

  function positionAtCursor(clientX, clientY) {
    tip.style.transform = '';
    tip.style.left = (clientX + 16) + 'px';
    tip.style.top  = (clientY - 8)  + 'px';
    void tip.offsetWidth; // force reflow so getBoundingClientRect reflects current content
    const r = tip.getBoundingClientRect();
    if (r.right  > window.innerWidth  - 8) tip.style.left = Math.max(8, clientX - tip.offsetWidth - 16) + 'px';
    if (r.bottom > window.innerHeight - 8) tip.style.top  = Math.max(8, clientY - tip.offsetHeight - 8) + 'px';
  }

  function showTip(text, el) {
    tip.textContent = text;
    tip.style.display = 'block';
    positionNearEl(el);
  }

  function hideTip() {
    tip.style.display = 'none';
    pinnedEl = null;
  }

  // Hover (desktop)
  document.addEventListener('mouseover', e => {
    if (pinnedEl) return; // don't override pinned tooltip
    const el = e.target.closest('[data-tip]');
    if (!el) return;
    const text = el.getAttribute('data-tip');
    if (!text) return;
    tip.textContent = text;
    tip.style.display = 'block';
    positionAtCursor(e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', e => {
    if (pinnedEl) return;
    if (tip.style.display === 'none') return;
    if (!e.target.closest('[data-tip]')) { tip.style.display = 'none'; return; }
    positionAtCursor(e.clientX, e.clientY);
  });
  document.addEventListener('mouseout', e => {
    if (pinnedEl) return;
    const el = e.target.closest('[data-tip]');
    if (el && !el.contains(e.relatedTarget)) tip.style.display = 'none';
  });

  // Click / tap — toggle pin
  document.addEventListener('click', e => {
    if (e.target.closest('#global-tip')) return; // click inside tooltip — keep open
    const el = e.target.closest('[data-tip]');
    if (el) {
      const text = el.getAttribute('data-tip');
      if (!text) return;
      if (pinnedEl === el) { hideTip(); return; } // second tap same element → close
      pinnedEl = el;
      showTip(text, el);
    } else {
      if (pinnedEl) hideTip();
    }
  });
}

// ---- Calc1 "How it works" popup ----
let c1PopupOutsideHandler = null;

function openC1Popup(e) {
  if (e) e.stopPropagation();
  const popup = document.getElementById('c1-popup');
  if (!popup) return;
  popup.classList.add('visible');
  // Close when clicking outside
  setTimeout(() => {
    c1PopupOutsideHandler = ev => {
      if (!popup.contains(ev.target)) closeC1Popup();
    };
    document.addEventListener('click', c1PopupOutsideHandler);
  }, 0);
}
function closeC1Popup() {
  const popup = document.getElementById('c1-popup');
  if (popup) popup.classList.remove('visible');
  if (c1PopupOutsideHandler) {
    document.removeEventListener('click', c1PopupOutsideHandler);
    c1PopupOutsideHandler = null;
  }
}

// ---- Popup для выбора модели сравнения (Realistic vs Symmetric) ----
let c1ModelPopupOutsideHandler = null;

function openC1ModelPopup(e) {
  if (e) e.stopPropagation();
  const popup = document.getElementById('c1-model-popup');
  if (!popup) return;
  // Текст подсказки длинный с переносами строк — собираем innerHTML каждый раз
  // на текущем языке (\n → <br>, двойные \n → новый абзац).
  const body = popup.querySelector('.c1-model-popup-body');
  if (body) {
    const raw = t('c1_model_tip') || '';
    body.innerHTML = raw
      .split(/\n\n+/)
      .map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>')
      .join('');
  }
  popup.classList.add('visible');
  setTimeout(() => {
    c1ModelPopupOutsideHandler = ev => {
      if (!popup.contains(ev.target)) closeC1ModelPopup();
    };
    document.addEventListener('click', c1ModelPopupOutsideHandler);
  }, 0);
}
function closeC1ModelPopup() {
  const popup = document.getElementById('c1-model-popup');
  if (popup) popup.classList.remove('visible');
  if (c1ModelPopupOutsideHandler) {
    document.removeEventListener('click', c1ModelPopupOutsideHandler);
    c1ModelPopupOutsideHandler = null;
  }
}

// ─── Mean reversion: переключатель в Advanced + ⓘ-popup ─────────────────────
let c1MeanReversionPopupOutsideHandler = null;

function onC1MeanReversionChange() {
  c1MeanReversionEnabled = document.getElementById('c1-mean-reversion').checked;
  calc1Update();
}

function openC1MeanReversionPopup(e) {
  if (e) e.stopPropagation();
  const popup = document.getElementById('c1-mean-reversion-popup');
  if (!popup) return;
  const body = popup.querySelector('.c1-mean-reversion-popup-body');
  if (body) {
    const raw = t('c1_mean_reversion_tip') || '';
    body.innerHTML = raw
      .split(/\n\n+/)
      .map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>')
      .join('');
  }
  popup.classList.add('visible');
  setTimeout(() => {
    c1MeanReversionPopupOutsideHandler = ev => {
      if (!popup.contains(ev.target)) closeC1MeanReversionPopup();
    };
    document.addEventListener('click', c1MeanReversionPopupOutsideHandler);
  }, 0);
}
function closeC1MeanReversionPopup() {
  const popup = document.getElementById('c1-mean-reversion-popup');
  if (popup) popup.classList.remove('visible');
  if (c1MeanReversionPopupOutsideHandler) {
    document.removeEventListener('click', c1MeanReversionPopupOutsideHandler);
    c1MeanReversionPopupOutsideHandler = null;
  }
}

// Дрейф темпа аренды (доля, не проценты), нужный для возврата yield к среднему
// за horizonYears лет. Возвращает 0 если данные истории недоступны.
function computeMeanReversionDrift(region, horizonYears) {
  if (!region || typeof region.yieldMean !== 'number' || !region.yield) return 0;
  return Math.pow(region.yieldMean / region.yield, 1 / horizonYears) - 1;
}

// ─── Cycle Position popup (модальный, кликабельная карточка) ────────────────
let c1CycleImpact = 0;   // Текущая денежная оценка возврата к среднему (€).
let c1CycleBigChart = null;

function c1ComputeCycleImpact() {
  const region = getCurrentC1Region();
  if (!region || typeof region.yieldMean !== 'number') return 0;
  // Доп. годовой темп аренды, нужный для возврата yield к среднему за horizon.
  // yield = annualRent/price. mean/current = ratio; нужно `(1+drift)^N = ratio`.
  const ratio = region.yieldMean / region.yield;
  const drift = Math.pow(ratio, 1 / c1Horizon) - 1;
  // Когда переключатель ВКЛЮЧЁН — основная симуляция уже считает с drift в
  // выбранной пользователем модели. Импакт = реальная delta в той же модели,
  // чтобы число в popup совпало с тем, что видно в карточках/графике.
  // Когда ВЫКЛЮЧЕН — символическая «sensitivity», считается в symmetric
  // (в realistic для регионов с rent > buyerTotal импакт тождественно 0,
  // не давая полезной информации о фазе цикла).
  const model = c1MeanReversionEnabled ? c1ComparisonModel : 'symmetric';
  const base   = c1SimulateFinalDiff(0,     model);
  const withDr = c1SimulateFinalDiff(drift, model);
  return withDr - base;
}

function openC1CyclePopup() {
  const region = getCurrentC1Region();
  if (!region || typeof region.yieldMean !== 'number') return;

  // Стрелка тренда цены у заголовка popup — та же логика что на свёрнутой
  // карточке: символ из priceDirection, цвет нейтральный (CSS .c1-cycle-trend-arrow).
  const trendEl = document.getElementById('cy-popup-trend');
  if (trendEl) {
    trendEl.textContent = region.priceDirection
      ? { up: '↑', flat: '→', down: '↓' }[region.priceDirection]
      : '';
  }

  // Большой график + сетка «Где рынок сейчас» (Уровень / Изменение / Вывод)
  drawCycleBigChart(region);
  fillCyclePhaseBlock(region);

  const popup = document.getElementById('c1-cycle-popup');
  if (popup) popup.style.display = 'flex';
}

function closeC1CyclePopup() {
  const popup = document.getElementById('c1-cycle-popup');
  if (popup) popup.style.display = 'none';
  if (c1CycleBigChart) { c1CycleBigChart.destroy(); c1CycleBigChart = null; }
}

function drawCycleBigChart(region) {
  const canvas = document.getElementById('cy-bigchart');
  if (!canvas || !region?.yieldHistory?.length) return;
  if (c1CycleBigChart) { c1CycleBigChart.destroy(); c1CycleBigChart = null; }

  const labels = region.yieldHistory.map(p => p.mes);
  const data   = region.yieldHistory.map(p => p.yield);
  const color  = C1_CYCLE_COLORS[region.cyclePhase] || C1_CYCLE_COLORS.neutral;
  // Точка-маркер «сейчас» — только на последней точке
  const pointRadius = data.map((_, i) => i === data.length - 1 ? 5 : 0);

  c1CycleBigChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: t('c1_cycle_current') || 'Доходность аренды',
          data, borderColor: color, backgroundColor: 'transparent',
          borderWidth: 1.5, tension: 0.25, pointRadius, pointBackgroundColor: color,
          pointBorderColor: color, fill: false,
        },
        {
          label: (t('c1_cycle_mean') || 'Среднее') + ': ' + region.yieldMean.toFixed(2) + '%',
          data: data.map(() => region.yieldMean),
          borderColor: 'rgba(180,180,180,0.55)', backgroundColor: 'transparent',
          borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false,
        },
      ],
    },
    options: {
      devicePixelRatio: window.devicePixelRatio || 2,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: '#8a8f9e', font: { size: 11 }, boxWidth: 12 } },
        tooltip: {
          enabled: true,
          callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.raw.toFixed(2) + '%' },
        },
      },
      scales: {
        x: {
          ticks: { color: '#8a8f9e', font: { size: 10 }, maxTicksLimit: 8, autoSkip: true },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          ticks: { color: '#8a8f9e', font: { size: 10 }, callback: v => v.toFixed(1) + '%' },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
      },
    },
  });
}

// Строка денежной оценки mean reversion под чекбоксом в Advanced.
// OFF — скрыта; ON — показывает c1CycleImpact:
//   impact > 0: импакт увеличивает разницу buyer−renter → «в пользу покупки»
//   impact < 0: импакт уменьшает разницу → «в пользу аренды»
//   |impact| < 1000: «Разница менее 1000 €»
function updateMeanReversionAdvancedRow() {
  const row = document.getElementById('c1-mean-rev-impact');
  if (!row) return;
  if (!c1MeanReversionEnabled) {
    row.style.display = 'none';
    return;
  }
  row.style.display = '';
  const impactAbs = Math.abs(c1CycleImpact);
  if (impactAbs < 1000) {
    row.textContent = t('c1_mean_rev_minimal') || 'Разница менее 1000 €';
    return;
  }
  const absStr = '+' + Math.round(impactAbs).toLocaleString('ru').replace(/,/g, ' ') + ' €';
  const key = c1CycleImpact > 0 ? 'c1_mean_rev_favors_buy' : 'c1_mean_rev_favors_rent';
  const tpl = t(key) || (c1CycleImpact > 0 ? '{X} в пользу покупки' : '{X} в пользу аренды');
  row.innerHTML = tpl.replace('{X}', `<strong>${absStr}</strong>`);
}

let c2EquityPopupCloseTimer = null;
let c2EquityPopupOutsideHandler = null;
function openC2EquityPopup(e) {
  if (e) e.stopPropagation();
  if (c2EquityPopupCloseTimer) { clearTimeout(c2EquityPopupCloseTimer); c2EquityPopupCloseTimer = null; }
  const popup = document.getElementById('c2-equity-popup');
  if (!popup) return;
  popup.classList.add('visible');
  setTimeout(() => {
    c2EquityPopupOutsideHandler = ev => { if (!popup.contains(ev.target)) closeC2EquityPopup(); };
    document.addEventListener('click', c2EquityPopupOutsideHandler);
  }, 0);
}
function closeC2EquityPopup() {
  const popup = document.getElementById('c2-equity-popup');
  if (popup) popup.classList.remove('visible');
  if (c2EquityPopupOutsideHandler) {
    document.removeEventListener('click', c2EquityPopupOutsideHandler);
    c2EquityPopupOutsideHandler = null;
  }
}
function closeC2EquityPopupDelayed() {
  c2EquityPopupCloseTimer = setTimeout(closeC2EquityPopup, 150);
}
function cancelCloseC2EquityPopup() {
  if (c2EquityPopupCloseTimer) { clearTimeout(c2EquityPopupCloseTimer); c2EquityPopupCloseTimer = null; }
}

let c2IndexTipCloseTimer = null;
let c2IndexTipOutsideHandler = null;
function openC2IndexTip(e) {
  if (e) e.stopPropagation();
  if (c2IndexTipCloseTimer) { clearTimeout(c2IndexTipCloseTimer); c2IndexTipCloseTimer = null; }
  const popup = document.getElementById('c2-index-tip');
  if (!popup) return;
  popup.classList.add('visible');
  setTimeout(() => {
    c2IndexTipOutsideHandler = ev => { if (!popup.contains(ev.target)) closeC2IndexTip(); };
    document.addEventListener('click', c2IndexTipOutsideHandler);
  }, 0);
}
function closeC2IndexTip() {
  const popup = document.getElementById('c2-index-tip');
  if (popup) popup.classList.remove('visible');
  if (c2IndexTipOutsideHandler) {
    document.removeEventListener('click', c2IndexTipOutsideHandler);
    c2IndexTipOutsideHandler = null;
  }
}
function closeC2IndexTipDelayed() {
  c2IndexTipCloseTimer = setTimeout(closeC2IndexTip, 150);
}
function cancelCloseC2IndexTip() {
  if (c2IndexTipCloseTimer) { clearTimeout(c2IndexTipCloseTimer); c2IndexTipCloseTimer = null; }
}

function initCalc1() {
  const sel = document.getElementById('c1-region');
  if (!sel) return;
  // Only populate once
  const firstInit = sel.options.length <= 1;
  if (firstInit) {
    REGIONS.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      sel.appendChild(opt);
    });
    // Apply slider defaults from DEFAULTS (overrides HTML fallback values)
    document.getElementById('c1-down').value      = DEFAULTS.downPaymentPct;
    document.getElementById('c1-rate').value      = DEFAULTS.mortgageRate;
    document.getElementById('c1-term').value      = DEFAULTS.mortgageTerm;
    document.getElementById('c1-maint').value     = DEFAULTS.maintenancePct;
    // По умолчанию режим nominal — берём *Nominal значения.
    document.getElementById('c1-inv').value       = DEFAULTS.investmentReturn;
    document.getElementById('c1-appr').value      = DEFAULTS.apprDefault;
    document.getElementById('c1-rentg').value     = DEFAULTS.rentGrowthDefault;
    document.getElementById('c1-inflation').value = DEFAULTS.inflation;
    document.getElementById('c1-tax').value       = DEFAULTS.defaultTaxFallbackSecondary;
  }
  // Активная кнопка модели сравнения — по DEFAULTS.comparisonModelDefault.
  document.querySelectorAll('#c1-model-btns .calc-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.model === c1ComparisonModel);
  });
  // Default to Madrid
  if (!sel.value) {
    sel.value = 'madrid';
    onCalc1RegionChange();
  }
}

function updateC1ChartTitle() {
  const regionId = document.getElementById('c1-region')?.value;
  const region = REGIONS.find(r => r.id === regionId);
  const regionName = region ? region.name : '—';
  const tpl = t('c1_chart_title') || 'Чистый капитал по годам · {region} · {horizon} лет';
  c1ChartTitleText = tpl.replace('{region}', regionName).replace('{horizon}', c1Horizon);
  if (c1Chart) {
    if (c1Chart.options?.scales?.x?.title) c1Chart.options.scales.x.title.text = t('c1_chart_x_axis') || 'Срок владения, лет';
    if (c1Chart.options?.scales?.y?.title) c1Chart.options.scales.y.title.text = t('c1_chart_y_axis') || 'Чистый капитал, €';
    c1Chart.update('none');
  }
}

function onCalc1RegionChange() {
  const id = document.getElementById('c1-region').value;
  if (!id) return;
  const r = REGIONS.find(x => x.id === id);
  if (!r) return;
  const sqm = DEFAULTS.defaultSqm;
  document.getElementById('c1-price').value = Math.round(r.price * sqm / 5000) * 5000;
  document.getElementById('c1-rent').value  = Math.round(r.rent * sqm / 50) * 50;
  // Темпы роста (c1-appr, c1-rentg) при смене региона НЕ перезаписываются —
  // используются дефолты из DEFAULTS или ручной ввод пользователя.
  // Reset manual tax override on region change
  const manualEl = document.getElementById('c1-tax-manual');
  if (manualEl) manualEl.value = '';
  document.getElementById('c1-tax').value = getC1AutoTaxRate(r).toFixed(2);
  calc1Update();
}

function resetCalc1ToRegion() {
  onCalc1RegionChange();
}

function resetCalc1() {
  // Reset all sliders to defaults (режим сбрасывается в 'nominal' ниже, значит ставим *Nominal)
  document.getElementById('c1-down').value      = DEFAULTS.downPaymentPct;
  document.getElementById('c1-rate').value      = DEFAULTS.mortgageRate;
  document.getElementById('c1-term').value      = DEFAULTS.mortgageTerm;
  document.getElementById('c1-appr').value      = DEFAULTS.apprDefault;
  document.getElementById('c1-rentg').value     = DEFAULTS.rentGrowthDefault;
  document.getElementById('c1-maint').value     = DEFAULTS.maintenancePct;
  document.getElementById('c1-inflation').value = DEFAULTS.inflation;
  document.getElementById('c1-inv').value       = DEFAULTS.investmentReturn;

  // Reset Primera vivienda
  const cbPrimera = document.getElementById('c1-primera');
  if (cbPrimera) { cbPrimera.checked = true; c1PrimeraVivienda = true; }

  // Clear manual tax override
  const manualEl = document.getElementById('c1-tax-manual');
  if (manualEl) manualEl.value = '';

  // Reset button group states
  c1Horizon   = DEFAULTS.horizonYears;
  c1PriceMode = 'nominal';
  c1ComparisonModel = DEFAULTS.comparisonModelDefault;
  document.querySelectorAll('#c1-horizon-btns .calc-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.textContent) === DEFAULTS.horizonYears);
  });
  document.querySelectorAll('#c1-model-btns .calc-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.model === c1ComparisonModel);
  });
  document.querySelectorAll('#c1-mode-btns    .calc-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  document.querySelectorAll('#c1-preset-btns  .calc-btn').forEach((b, i) => b.classList.toggle('active', i === 0));

  // Сброс mean reversion: и переменная, и чекбокс.
  c1MeanReversionEnabled = false;
  const mrEl = document.getElementById('c1-mean-reversion');
  if (mrEl) mrEl.checked = false;

  // Re-apply region-based values (price, rent, tax) and recalculate
  onCalc1RegionChange();
}

// UI-эффект типа объекта (вторичка/новостройка): текст подписи налога и
// видимость чекбокса «основное жильё». Расчёт и ставки не трогает — только
// data-i18n лейбла (setLang потом сам подставит нужный язык) и display чекбокса.
function applyC1PropertyTypeUI(type) {
  const taxLabelEl = document.getElementById('c1-tax-label');
  if (taxLabelEl) {
    const key = type === 'new' ? 'c1_tax_label_new' : 'c1_tax_label_secondary';
    taxLabelEl.setAttribute('data-i18n', key);
    taxLabelEl.textContent = t(key);
  }
  // Чекбокс основного жилья влияет только на ITP (вторичка). У новостройки (IVA)
  // льготы основного жилья нет — скрываем блок, состояние галочки не сбрасываем.
  const primeraRow = document.getElementById('c1-primera-row');
  if (primeraRow) primeraRow.style.display = type === 'new' ? 'none' : '';
}

function setPropertyType1(type, btn) {
  c1PropertyType = type;
  document.querySelectorAll('#c1-proptype-btns .calc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyC1PropertyTypeUI(type);
  // Re-apply auto tax rate (clears manual override)
  const manualEl = document.getElementById('c1-tax-manual');
  if (manualEl) manualEl.value = '';
  const id = document.getElementById('c1-region').value;
  if (id) {
    const r = REGIONS.find(x => x.id === id);
    if (r) {
      document.getElementById('c1-tax').value = getC1AutoTaxRate(r).toFixed(2);
    }
  } else {
    document.getElementById('c1-tax').value = type === 'new'
      ? String(DEFAULTS.newPropertyTaxPct)
      : String(DEFAULTS.defaultTaxFallbackSecondary);
  }
  calc1Update();
}

function onC1PrimeraChange() {
  const cb = document.getElementById('c1-primera');
  c1PrimeraVivienda = cb ? cb.checked : true;
  // Reset manual override and recalculate auto rate
  const manualEl = document.getElementById('c1-tax-manual');
  if (manualEl) manualEl.value = '';
  const id = document.getElementById('c1-region').value;
  if (id) {
    const r = REGIONS.find(x => x.id === id);
    if (r) document.getElementById('c1-tax').value = getC1AutoTaxRate(r).toFixed(2);
  }
  calc1Update();
}

function onC1TaxManualChange() {
  const manualEl = document.getElementById('c1-tax-manual');
  if (!manualEl) return;
  const val = parseFloat(manualEl.value);
  if (!isNaN(val) && val >= 0) {
    document.getElementById('c1-tax').value = val.toFixed(1);
  } else {
    // If cleared, restore auto rate
    const id = document.getElementById('c1-region').value;
    if (id) {
      const r = REGIONS.find(x => x.id === id);
      if (r) document.getElementById('c1-tax').value = getC1AutoTaxRate(r).toFixed(2);
    }
  }
  calc1Update();
}


let c1SavedDown = DEFAULTS.downPaymentPct;
let c1SavedRate = DEFAULTS.mortgageRate;
let c1SavedTerm = DEFAULTS.mortgageTerm;

function applyCalc1Preset(preset, btn) {
  document.querySelectorAll('#c1-preset-btns .calc-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const downRow = document.getElementById('c1-down-row');
  const rateRow = document.getElementById('c1-rate-row');
  const termRow = document.getElementById('c1-term-row');

  if (preset === 'cash') {
    // Save current values before hiding
    c1SavedDown = +document.getElementById('c1-down').value;
    c1SavedRate = +document.getElementById('c1-rate').value;
    c1SavedTerm = +document.getElementById('c1-term').value;
    c1IsCash = true;
    if (downRow) downRow.style.display = 'none';
    if (rateRow) rateRow.style.display = 'none';
    if (termRow) termRow.style.display = 'none';
    document.getElementById('c1-down').value = 100;
    document.getElementById('c1-inv').value  = DEFAULTS.investmentReturn;
  } else {
    c1IsCash = false;
    if (downRow) downRow.style.display = '';
    if (rateRow) rateRow.style.display = '';
    if (termRow) termRow.style.display = '';
    // Restore saved values
    document.getElementById('c1-down').value = c1SavedDown;
    document.getElementById('c1-rate').value = c1SavedRate;
    document.getElementById('c1-term').value = c1SavedTerm;
    if (preset === 'noninv') {
      document.getElementById('c1-inv').value = 0;
    } else {
      document.getElementById('c1-inv').value = DEFAULTS.investmentReturn;
    }
  }
  calc1Update();
}

// Переключение режима показа результата (Номинал ↔ Реальные).
// Слайдеры appr / rentg / inv / maint / rate / inflation НЕ изменяются —
// они всегда хранят номинальные значения. В режиме 'real' calc1Update
// дефлирует buyData/rentData на (1+inflation)^y и показывает real-эквивалент
// под слайдером c1-inv.
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
  updateC1ChartTitle();
}

// Переключение модели сравнения покупателя и арендатора (Realistic ↔ Symmetric).
function setComparisonModel(model, btn) {
  c1ComparisonModel = model;
  document.querySelectorAll('#c1-model-btns .calc-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  calc1Update();
}

// Обработчик единого слайдера темпа роста (c1-appr). Синхронизирует скрытый
// c1-rentg с тем же значением — c1RunSimulation читает их как разные параметры,
// дизайн оставляет возможность независимого управления в будущем.
function onC1GrowthChange() {
  const v = parseFloat(document.getElementById('c1-appr').value);
  if (!Number.isFinite(v)) return;
  document.getElementById('c1v-growth').textContent = v.toFixed(1);
  document.getElementById('c1-rentg').value = v;
  calc1Update();
}

// ─── Calc 1 simulation helpers — единая точка истины ────────────────────────
// collectC1Params читает DOM/state в плоский объект, c1RunSimulation выполняет
// чистую симуляцию (без UI), c1SimulateFinalDiff — тонкая обёртка для
// cycle-impact. calc1Update собирает params, вызывает c1RunSimulation, потом
// делает только UI-updates.

/**
 * Собирает текущие параметры Калькулятора 1 из DOM + state в плоский объект.
 * Все процентные значения — в долях (0.029, не 2.9). Можно передать override.
 */
function collectC1Params(override = {}) {
  const p = {
    price:           +document.getElementById('c1-price').value,
    downPct:         +document.getElementById('c1-down').value / 100,
    annRate:         +document.getElementById('c1-rate').value / 100,
    termYears:       +document.getElementById('c1-term').value,
    taxPct:          +document.getElementById('c1-tax').value / 100,
    appr:            +document.getElementById('c1-appr').value / 100,
    maint:           +document.getElementById('c1-maint').value / 100,
    rent0:           +document.getElementById('c1-rent').value,
    rentGrowth:      +document.getElementById('c1-rentg').value / 100,
    invRate:         +document.getElementById('c1-inv').value / 100,
    inflation:       +document.getElementById('c1-inflation').value / 100,
    horizon:         c1Horizon,
    priceMode:       c1PriceMode,
    comparisonModel: c1ComparisonModel,
    sellAtEnd:       document.getElementById('c1-sell-at-end')?.checked || false,
    rentGrowthBonus: 0,
  };
  // Mean reversion: автоматически добавляем дрейф темпа аренды для возврата
  // yield к среднему за горизонт. Применяется к текущему выбранному режиму
  // (realistic/symmetric) без принудительных переключений модели.
  if (c1MeanReversionEnabled) {
    p.rentGrowthBonus = computeMeanReversionDrift(getCurrentC1Region(), p.horizon);
  }
  return Object.assign(p, override);
}

/**
 * Чистая симуляция Калькулятора 1 — без UI-обновлений и без чтения DOM.
 * Возвращает массивы для графика и финальные метрики.
 *
 * @param {Object} p — результат collectC1Params (или его override).
 * @returns {Object} {
 *   buyData, rentData, finalDiff, parityYear, roi,
 *   monthlyMortgage, initialCash, downAmt, taxAmt,
 *   propValFinal, loanBalFinal, renterPortfolioFinal,
 *   totalInterestPaid, totalMaintPaid,
 * }
 */
function c1RunSimulation(p) {
  const {
    price, downPct, annRate, termYears, taxPct, appr, maint,
    rent0, invRate, inflation, horizon,
    priceMode, comparisonModel, sellAtEnd,
  } = p;
  // rentGrowth + опциональный дрейф (cycle-impact).
  const rentGrowth = p.rentGrowth + (p.rentGrowthBonus || 0);

  const downAmt = price * downPct;
  const taxAmt  = price * taxPct;
  const loan    = price * (1 - downPct);
  const mRate   = annRate / 12;
  const nPay    = termYears * 12;
  const initialCash = downAmt + taxAmt;
  const annualMaintInitial = price * maint;

  let monthlyMortgage = 0;
  if (annRate > 0 && loan > 0) {
    monthlyMortgage = loan * (mRate * Math.pow(1+mRate,nPay)) / (Math.pow(1+mRate,nPay) - 1);
  } else if (loan > 0) {
    monthlyMortgage = loan / nPay;
  }

  const buyData = [], rentData = [];
  // Годовые денежные потоки для второго графика. Индекс 0 = «Сейчас» (нулевой
  // старт), индексы 1..horizon = сумма 12 месяцев за соответствующий год.
  // Длина всех трёх массивов совпадает с buyData/rentData (horizon + 1).
  const yBuyerBurn = [0], yBuyerPrincipal = [0], yRenterRent = [0];
  let propVal = price, loanBal = loan;
  let renterPortfolio = initialCash, buyerPortfolio = 0;
  let rent = rent0;
  let totalInterestPaid = 0, totalMaintPaid = 0;
  // Финальные неокруглённые значения — нужны для точного finalDiff (иначе
  // разность двух округлённых даёт ±1 € дрейф в cycle-impact и breakdown).
  let buyFinalRaw = 0, rentFinalRaw = 0;

  for (let y = 0; y <= horizon; y++) {
    const inflFactor = priceMode === 'real' ? Math.pow(1 + inflation, y) : 1;
    const buyRaw  = (propVal - loanBal + buyerPortfolio) / inflFactor;
    const rentRaw = renterPortfolio / inflFactor;
    buyData.push(Math.round(buyRaw));
    rentData.push(Math.round(rentRaw));
    if (y === horizon) { buyFinalRaw = buyRaw; rentFinalRaw = rentRaw; }

    if (y < horizon) {
      let burnAcc = 0, principalAcc = 0, rentAcc = 0;
      for (let m = 0; m < 12; m++) {
        const mo = y * 12 + m;
        propVal *= (1 + appr / 12);
        let payment = 0;
        let interest = 0, principal = 0;
        if (mo < nPay && loanBal > 0) {
          interest  = loanBal * mRate;
          totalInterestPaid += interest;
          principal = Math.min(monthlyMortgage - interest, loanBal);
          loanBal = Math.max(0, loanBal - principal);
          payment = monthlyMortgage;
        }
        const yearsElapsed = mo / 12;
        const maintMonthly = annualMaintInitial * Math.pow(1 + inflation, yearsElapsed) / 12;
        totalMaintPaid += maintMonthly;
        const buyerTotal = payment + maintMonthly;

        // Аккумулятор годовых потоков — используем rent на этом месяце
        // (до её роста в конце итерации).
        burnAcc      += interest + maintMonthly;
        principalAcc += principal;
        rentAcc      += rent;

        renterPortfolio *= (1 + invRate / 12);
        buyerPortfolio  *= (1 + invRate / 12);
        const diff = buyerTotal - rent;
        if (comparisonModel === 'symmetric') {
          if (diff > 0) renterPortfolio += diff;
          else          buyerPortfolio  += (-diff);
        } else {
          if (diff > 0) renterPortfolio += diff;
        }
        rent *= (1 + rentGrowth / 12);
      }
      // Пуш годовых сумм за завершённый год (индекс y+1 в массиве, так как
      // индекс 0 — leading 0 для «Сейчас», согласовано с buyData/rentData).
      // Real: делим на inflFactor конца года (y+1) — совпадает со снимком
      // капитала на следующей итерации по y.
      const yrEndInfl = priceMode === 'real' ? Math.pow(1 + inflation, y + 1) : 1;
      yBuyerBurn.push(burnAcc           / yrEndInfl);
      yBuyerPrincipal.push(principalAcc / yrEndInfl);
      yRenterRent.push(rentAcc          / yrEndInfl);
    }
  }

  // sell-at-end: корректирует только финальную точку (промежуточные годы —
  // «бумажный» капитал, при удержании квартиры налог не платится).
  if (sellAtEnd) {
    const salePrice    = propVal;
    const capitalGain  = Math.max(0, salePrice - price);
    const cgTax        = capitalGain * DEFAULTS.capitalGainsTaxResident;
    const sellingCosts = salePrice * DEFAULTS.sellingCostsPct;
    const inflFactorH  = priceMode === 'real' ? Math.pow(1 + inflation, horizon) : 1;
    const buyRaw      = (salePrice - loanBal - cgTax - sellingCosts + buyerPortfolio) / inflFactorH;
    buyData[horizon]  = Math.round(buyRaw);
    buyFinalRaw       = buyRaw;
  }

  // Две версии финальной разницы: UI берёт разность округлённых точек графика
  // (исторически отображалось так), cycle-impact — round разности неокруглённых
  // (точнее, без ±1 € дрейфа из двойного округления).
  const finalDiff    = buyData[horizon] - rentData[horizon];
  const finalDiffRaw = Math.round(buyFinalRaw - rentFinalRaw);

  let parityYear = null;
  for (let y = 1; y <= horizon; y++) {
    if (buyData[y] >= rentData[y]) { parityYear = y; break; }
  }

  const roiTotal = (buyData[horizon] - initialCash) / initialCash;
  const roi      = (Math.pow(1 + roiTotal, 1 / horizon) - 1) * 100;

  return {
    buyData, rentData, finalDiff, finalDiffRaw, parityYear, roi,
    monthlyMortgage, initialCash, downAmt, taxAmt,
    propValFinal:         propVal,
    loanBalFinal:         loanBal,
    renterPortfolioFinal: renterPortfolio,
    totalInterestPaid, totalMaintPaid,
    yBuyerBurn, yBuyerPrincipal, yRenterRent,
  };
}

/**
 * Тонкая обёртка над c1RunSimulation для расчёта cycle-impact.
 *
 * forceModel='symmetric' (всегда, см. c1ComputeCycleImpact). В realistic для
 * регионов с rent > buyerTotal импакт всегда 0 — diff<0 не двигает портфели.
 * Symmetric даёт меру чувствительности методологии независимо от выбранной
 * пользователем модели.
 */
function c1SimulateFinalDiff(rentGrowthBonus = 0, forceModel = null) {
  const params = collectC1Params({ rentGrowthBonus });
  if (forceModel) params.comparisonModel = forceModel;
  // finalDiffRaw — точная (round разности неокруглённых). cycle-impact = withDr − base
  // компенсирует, поэтому ±1 € дрейф здесь критичен.
  return c1RunSimulation(params).finalDiffRaw;
}

function calc1Update() {
  // 1. Собрать параметры одной командой; c1RunSimulation делает всю математику.
  const params = collectC1Params();
  const {
    price, downPct, annRate, termYears, taxPct, appr, maint,
    rent0, rentGrowth, invRate, inflation, horizon, sellAtEnd,
  } = params;
  const sim = c1RunSimulation(params);
  const {
    buyData, rentData, finalDiff, parityYear, roi,
    monthlyMortgage, initialCash, downAmt, taxAmt,
    propValFinal, loanBalFinal, renterPortfolioFinal,
    totalInterestPaid, totalMaintPaid,
    yBuyerBurn, yBuyerPrincipal, yRenterRent,
  } = sim;
  const winner = finalDiff >= 0 ? 'buy' : 'rent';

  // 2. Слайдер-значения (текст под/рядом со слайдерами).
  const fmt = v => Math.round(v).toLocaleString('ru');
  document.getElementById('c1v-price').textContent = fmt(price) + ' €';
  document.getElementById('c1v-down').textContent  = (downPct*100).toFixed(0) + '%';
  document.getElementById('c1v-rate').textContent  = (annRate*100).toFixed(1) + '%';
  document.getElementById('c1v-term').textContent  = termYears + ' лет';
  document.getElementById('c1v-tax').textContent   = (taxPct*100).toFixed(1) + '%';
  const itpDisplay = document.getElementById('c1-itp-display');
  if (itpDisplay) itpDisplay.textContent = (taxPct*100).toFixed(2) + '% = ' + fmt(price * taxPct) + ' €';
  const apprEl  = document.getElementById('c1v-appr');   if (apprEl)  apprEl.textContent  = (appr*100).toFixed(1) + '%';
  const rentgEl = document.getElementById('c1v-rentg');  if (rentgEl) rentgEl.textContent = (rentGrowth*100).toFixed(1) + '%';
  const inflEl  = document.getElementById('c1v-inflation'); if (inflEl) inflEl.textContent = (inflation*100).toFixed(1) + '%';
  const yrSfx = t('c1_yr_suffix') || '/год';
  document.getElementById('c1v-maint').textContent = (maint*100).toFixed(1) + '%' + yrSfx + ' = ' + fmt(price * maint) + ' €' + yrSfx;
  const maintHint = document.getElementById('c1-maint-hint');
  if (maintHint) maintHint.textContent = (t('c1_maint_composition') || '≈ {X} €/мес').replace('{X}', fmt(price * maint / 12));
  document.getElementById('c1v-rent').textContent  = fmt(rent0) + ' €';
  document.getElementById('c1v-inv').textContent   = (invRate*100).toFixed(1) + '%';
  document.getElementById('c1v-down-amt').textContent = '= ' + fmt(downAmt) + ' €';
  document.getElementById('c1v-tax-amt').textContent  = '= ' + fmt(taxAmt) + ' €';
  document.getElementById('c1v-rate-pmt').textContent = '≈ ' + fmt(monthlyMortgage) + ' €/мес';

  // 3. Подпись «sell-at-end» — видна, когда флажок включён.
  const sellNoteEl = document.getElementById('c1-sell-note');
  if (sellNoteEl) sellNoteEl.style.display = sellAtEnd ? '' : 'none';

  // 4. Подсказка-icon у ROI.
  const tipEl = document.getElementById('c1-roi-tip-icon');
  if (tipEl) {
    tipEl.setAttribute('data-tip', t('c1_roi_tip') || 'Среднегодовая доходность на вложенные деньги.');
    tipEl.title = '';
  }

  // 5. Карточки WINNER / PARITY / ROI.
  const winLabel = winner === 'buy' ? (t('c1_buy')||'Покупка') : (t('c1_rent_word')||'Аренда');
  document.getElementById('c1-winner').textContent     = '🏆 ' + winLabel;
  document.getElementById('c1-winner-sub').textContent = (t('c1_winner_sub_pre')||'выгоднее · разница') + ' +' + fmt(Math.abs(finalDiff)) + ' €';
  document.getElementById('c1-parity').textContent     = parityYear ? pluralYears(parityYear) : '>' + horizon;
  document.getElementById('c1-roi').textContent        = roi.toFixed(1) + '%';
  document.getElementById('c1-roi-sub').textContent    = (t('c1_roi_sub_new')||'среднегодовая за') + ' ' + pluralYears(horizon);

  updateC1ChartSub();
  updateC1SliderHints();
  c1CycleImpact = c1ComputeCycleImpact();
  updateMeanReversionAdvancedRow();
  updateC1CycleCard(getCurrentC1Region());
  fillC1Breakdown(propValFinal, loanBalFinal, renterPortfolioFinal, downAmt, taxAmt, totalInterestPaid, totalMaintPaid, rent0, rentGrowth, horizon);

  // 6. График: лейблы зависят от i18n, поэтому строим здесь.
  const labels = [];
  for (let y = 0; y <= horizon; y++) {
    labels.push(y === 0 ? (t('c1_now') || 'Сейчас') : `${t('c1_year')||'Год'} ${y}`);
  }
  updateC1ChartTitle();
  drawCalc1Chart(labels, buyData, rentData, parityYear, termYears);
  drawCalc1FlowChart(labels, yBuyerBurn, yBuyerPrincipal, yRenterRent, termYears);

  buildCalc1Summary(winner, buyData[horizon], rentData[horizon], parityYear, roi, horizon, downAmt, taxAmt, monthlyMortgage, rent0);
}

function drawCalc1Chart(labels, buyData, rentData, parityYear, termYears) {
  const canvas = document.getElementById('calcChart');
  if (!canvas) return;
  if (c1Chart) { c1Chart.destroy(); c1Chart = null; }

  const crossoverIdx = parityYear !== null ? parityYear : null;

  // Inline title plugin — draws c1ChartTitleText on canvas
  const c1TitlePlugin = {
    id: 'c1Title',
    afterDraw(chart) {
      if (!c1ChartTitleText) return;
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.font = '13px "DM Sans", sans-serif';
      ctx.fillStyle = '#8a8f9e';
      ctx.textAlign = 'left';
      ctx.fillText(c1ChartTitleText, chartArea.left + 8, chartArea.top - 10);
      ctx.restore();
    }
  };

  const roles = c1RoleColors();
  c1Chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: t('c1_buyer') || 'Капитал покупателя',
          data: buyData,
          borderColor: roles.buyer,
          backgroundColor: 'transparent',
          pointBackgroundColor: roles.buyer,
          pointBorderColor: roles.buyer,
          fill: false,
          tension: 0.35,
          pointRadius: 2,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: roles.buyer,
          pointHoverBorderWidth: 2,
          borderWidth: 2.5,
        },
        {
          label: t('c1_renter') || 'Портфель арендатора',
          data: rentData,
          borderColor: roles.renter,
          backgroundColor: 'transparent',
          pointBackgroundColor: roles.renter,
          pointBorderColor: roles.renter,
          fill: false,
          tension: 0.35,
          pointRadius: 2,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: roles.renter,
          pointHoverBorderWidth: 2,
          borderWidth: 2.5,
        },
      ]
    },
    options: {
      devicePixelRatio: window.devicePixelRatio || 2,
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 28 } },
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          xAlign: 'center',
          yAlign: 'bottom',
          caretPadding: 10,
          backgroundColor: 'rgba(22,24,28,0.72)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#8a8f9e',
          bodyColor: '#fff',
          padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString('ru')} €`,
            labelColor: ctx => ({ borderColor: ctx.dataset.borderColor, backgroundColor: ctx.dataset.borderColor, borderWidth: 0 }),
          }
        },
        annotation: (() => {
          const annotations = {};
          if (crossoverIdx) {
            annotations.cross = {
              type: 'line',
              xMin: crossoverIdx,
              xMax: crossoverIdx,
              borderColor: 'rgba(201,168,76,0.6)',
              borderWidth: 1.5,
              borderDash: [4,4],
              label: { display: true, content: (t('c1_year')||'Год') + ' ' + crossoverIdx + ': ' + (t('c1_buy_wins_label')||'купить выгоднее, чем снимать'), color: '#c9a84c', font: { size: 11 }, position: 'end' }
            };
          }
          if (termYears && termYears < labels.length - 1) {
            annotations.mortgagePaid = {
              type: 'line',
              xMin: termYears,
              xMax: termYears,
              borderColor: 'rgba(201,168,76,0.4)',
              borderWidth: 1,
              borderDash: [4,4],
              label: {
                display: true,
                content: t('c1_mortgage_paid') || 'Ипотека выплачена',
                color: '#8a8f9e',
                font: { size: 11 },
                position: 'end'
              }
            };
          }
          return { annotations };
        })()
      },
      scales: {
        x: {
          title: { display: true, text: t('c1_chart_x_axis') || 'Срок владения, лет', color: '#8a8f9e', font: { size: 12 } },
          ticks: { ...C1_AXIS_TICK, maxTicksLimit: 8 },
          grid:  C1_AXIS_GRID,
        },
        y: {
          title: { display: true, text: t('c1_chart_y_axis') || 'Чистый капитал, €', color: '#8a8f9e', font: { size: 12 } },
          ticks: {
            ...C1_AXIS_TICK,
            callback: v => v >= 1000000 ? (v/1000000).toFixed(1)+'M €' : v >= 1000 ? (v/1000).toFixed(0)+'k €' : v+'€'
          },
          grid: C1_AXIS_GRID,
        }
      }
    },
    plugins: [c1TitlePlugin]
  });

  updateC1ChartLegend();
}

// Второй график Калк 1: годовые денежные потоки. Столбец покупателя —
// stacked (проценты+содержание + погашение тела). Столбец арендатора —
// одиночный (аренда за год). Одна пара столбцов на год, side-by-side.
function drawCalc1FlowChart(labels, yBurn, yPrincipal, yRent, termYears) {
  const canvas = document.getElementById('calcFlowChart');
  if (!canvas) return;
  if (c1FlowChart) { c1FlowChart.destroy(); c1FlowChart = null; }

  const roles = c1RoleColors();
  const burnColor      = roles.buyerLight;  // сгорает у покупателя — светлый buyer
  const principalColor = roles.buyer;       // остаётся у покупателя — solid buyer
  const rentColor      = roles.renter;      // аренда — solid renter

  // Срезаем leading-ноль (индекс 0 = «Сейчас», нулевые расходы). График
  // потоков начинается с Года 1, аренда не падает в 0 на старте.
  const flowLabels  = labels.slice(1);
  const flowBurn    = yBurn.slice(1).map(v => Math.round(v));
  const flowPrinc   = yPrincipal.slice(1).map(v => Math.round(v));
  const flowRent    = yRent.slice(1).map(v => Math.round(v));

  const annotations = {};
  if (termYears && termYears < flowLabels.length) {
    // termYears — это индекс в исходном labels (labels[termYears] = "Год N").
    // После slice(1) индекс сдвигается на 1: xMin = termYears - 1.
    annotations.mortgagePaid = {
      type: 'line',
      xMin: termYears - 1, xMax: termYears - 1,
      borderColor: 'rgba(201,168,76,0.35)',
      borderWidth: 1, borderDash: [4, 4],
    };
  }

  const roleBuyer  = t('c1_flow_role_buyer')  || 'Покупатель';
  const roleRenter = t('c1_flow_role_renter') || 'Арендатор';

  c1FlowChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: flowLabels,
      datasets: [
        {
          label: `${roleBuyer} · ${t('c1_flow_burn') || 'проценты + содержание'}`,
          data: flowBurn,
          backgroundColor: burnColor,
          borderWidth: 0,
          stack: 'buyer',
          barPercentage: 0.9,
          categoryPercentage: 0.95,
        },
        {
          label: `${roleBuyer} · ${t('c1_flow_principal') || 'погашение кредита'}`,
          data: flowPrinc,
          backgroundColor: principalColor,
          borderWidth: 0,
          stack: 'buyer',
          barPercentage: 0.9,
          categoryPercentage: 0.95,
        },
        {
          label: `${roleRenter} · ${t('c1_flow_rent') || 'аренда'}`,
          data: flowRent,
          backgroundColor: rentColor,
          borderWidth: 0,
          stack: 'renter',
          barPercentage: 0.9,
          categoryPercentage: 0.95,
        },
      ]
    },
    options: {
      devicePixelRatio: window.devicePixelRatio || 2,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      plugins: {
        legend: { display: false },
        tooltip: {
          xAlign: 'center',
          yAlign: 'bottom',
          caretPadding: 10,
          backgroundColor: 'rgba(22,24,28,0.72)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#8a8f9e',
          bodyColor: '#fff',
          padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString('ru')} €`,
            labelColor: ctx => ({ borderColor: ctx.dataset.backgroundColor, backgroundColor: ctx.dataset.backgroundColor, borderWidth: 0 }),
          },
        },
        annotation: Object.keys(annotations).length ? { annotations } : {},
      },
      scales: {
        x: {
          stacked: true,
          ticks: { ...C1_AXIS_TICK, maxTicksLimit: 8, autoSkip: true },
          grid: C1_AXIS_GRID,
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            ...C1_AXIS_TICK,
            callback: v => v >= 1000 ? (v/1000).toFixed(0) + 'k €' : v + '€',
          },
          grid: C1_AXIS_GRID,
        },
      },
    },
  });

  updateC1FlowLegend();
}

// Кастомная HTML-легенда для графика потоков, сгруппированная по ролям:
// Покупатель — 2 сегмента (погашение + %+содержание), Арендатор — 1 (аренда).
// Цвета маркеров совпадают с датасетами графика пиксельно (через c1RoleColors()).
function updateC1FlowLegend() {
  const el = document.getElementById('c1-flow-legend');
  if (!el) return;
  const c = c1RoleColors();
  const roleBuyer  = t('c1_flow_role_buyer')  || 'Покупатель';
  const roleRenter = t('c1_flow_role_renter') || 'Арендатор';
  const lblBurn   = t('c1_flow_burn')      || 'проценты + содержание';
  const lblPrinc  = t('c1_flow_principal') || 'погашение кредита';
  const lblRent   = t('c1_flow_rent')      || 'аренда';
  el.innerHTML =
    `<span class="c1-flow-role">` +
      `<span class="c1-flow-role-label">${roleBuyer}:</span>` +
      `<span class="c1-flow-item"><span class="c1-flow-swatch" style="background:${c.buyer}"></span>${lblPrinc}</span>` +
      `<span class="c1-flow-item"><span class="c1-flow-swatch" style="background:${c.buyerLight}"></span>${lblBurn}</span>` +
    `</span>` +
    `<span class="c1-flow-role">` +
      `<span class="c1-flow-role-label">${roleRenter}:</span>` +
      `<span class="c1-flow-item"><span class="c1-flow-swatch" style="background:${c.renter}"></span>${lblRent}</span>` +
    `</span>`;
}

function updateC1ChartLegend() {
  const el = document.getElementById('c1-chart-legend');
  if (!el) return;
  const roles = c1RoleColors();
  const datasets = [
    { color: roles.buyer,  key: 'c1_buyer',  fallback: 'Капитал покупателя' },
    { color: roles.renter, key: 'c1_renter', fallback: 'Портфель арендатора' },
  ];
  el.innerHTML = datasets.map(d =>
    `<span class="c1-chart-legend-item">` +
    `<span class="c1-chart-legend-line" style="background:${d.color};"></span>` +
    `<span>${t(d.key) || d.fallback}</span>` +
    `</span>`
  ).join('');
}

// Обновляет real-эквивалент под слайдером c1-inv: "≈ 5.0% реальных при инфляции 2%".
// Вызывается из calc1Update при любом изменении inv или inflation.
// Цвет фазы цикла — те же оттенки, что CSS-переменные проекта.
const C1_CYCLE_COLORS = { above: '#5cb88a', below: '#e05c5c', neutral: '#c9a84c' };

// Обновляет 4-ю карточку (Cycle Position) на основе region.yieldZScore / cyclePhase.
// Если данные истории ещё не загружены (yieldMean undefined) — карточка скрыта.
function updateC1CycleCard(region) {
  const card = document.getElementById('c1-cycle-card');
  if (!card) return;
  if (!region || typeof region.yieldMean !== 'number') {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';

  const phase = region.cyclePhase;
  const phaseColor = C1_CYCLE_COLORS[phase] || C1_CYCLE_COLORS.neutral;
  const emoji = { above: '🟢', below: '🔴', neutral: '🟡' }[phase];
  const statusKey = { above: 'c1_cycle_status_above', below: 'c1_cycle_status_below', neutral: 'c1_cycle_status_neutral' }[phase];

  document.getElementById('c1-cycle-emoji').textContent = emoji;
  const statusEl = document.getElementById('c1-cycle-status-text');
  if (statusEl) {
    statusEl.setAttribute('data-i18n', statusKey);
    statusEl.textContent = t(statusKey);
    statusEl.style.color = phaseColor;
  }

  // Значение z со знаком (+1.76 / −0.51), желтый, подпись на той же строке
  const z = region.yieldZScore;
  const zSign = z > 0 ? '+' : z < 0 ? '−' : '';
  document.getElementById('c1-cycle-zscore').textContent = zSign + Math.abs(z).toFixed(2);

  // Стрелка тренда цены: ↑/→/↓, цвет нейтральный (var(--muted) из CSS)
  const trendEl = document.getElementById('c1-cycle-price-trend');
  if (trendEl) {
    if (!region.priceDirection) {
      trendEl.textContent = '';
    } else {
      trendEl.textContent = { up: '↑', flat: '→', down: '↓' }[region.priceDirection];
    }
  }

  const periodEl = document.getElementById('c1-cycle-period');
  if (periodEl) periodEl.textContent = c1FormatPeriod(region.yieldFirstMonth, region.yieldLastMonth);

  // Divergence-фраза под графиком: abs-число, без минуса в тексте
  const divEl = document.getElementById('c1-cycle-divergence');
  const divider = document.querySelector('#c1-cycle-card .c1-cycle-divider');
  if (divEl) {
    if (region.divergence12m === null || typeof region.divergence12m !== 'number') {
      divEl.style.display = 'none';
      if (divider) divider.style.display = 'none';
    } else {
      divEl.style.display = '';
      if (divider) divider.style.display = '';
      const phraseKey = {
        prices_outpace: 'c1_cycle_div_prices',
        rents_outpace:  'c1_cycle_div_rents',
        synchronous:    'c1_cycle_div_sync',
      }[region.divergenceClass];
      const abs = Math.abs(region.divergence12m).toFixed(1);
      const valHtml = `<span class="c1-cycle-div-num">${abs} ${t('c1_pp_short')}</span>`;
      divEl.innerHTML = (t(phraseKey) || '').replace('{x}', valHtml);
    }
  }

  drawCycleSparkline(region);
}

// Единый блок «Где рынок сейчас»: заголовок + 3 абзаца
// (уровень от cyclePhase / z, движение от divergenceClass, общая оговорка).
// Сетка popup Cycle Position: Уровень + Изменение за год + Вывод.
// Уровень показывается всегда (нужен только yieldMean). Изменение и часть
// вывода про движение скрываются, если divergence12m === null.
function fillCyclePhaseBlock(region) {
  const block = document.getElementById('cy-phase-block');
  if (!block) return;
  block.style.display = '';

  const hasMovement = region.divergence12m !== null && typeof region.divergence12m === 'number';

  // ── Группа 1: Уровень ────────────────────────────────────────────
  const z = region.yieldZScore;
  const zSign = z > 0 ? '+' : z < 0 ? '−' : '';
  const zStr  = zSign + Math.abs(z).toFixed(2);
  const zLabel = t('c1_grid_z_' + region.cyclePhase) || '';
  const norm   = t('c1_grid_norm') || 'норма';

  const levelHTML = `
    <div class="cycle-grid-group">
      <div class="cycle-grid-title">${t('c1_grid_level_title')}</div>
      <div class="cycle-grid-row">
        <span class="cycle-grid-label">${t('c1_grid_price_to_rent')}</span>
        <span class="cycle-grid-value">${region.yield.toFixed(2)}%</span>
        <span class="cycle-grid-explain">${norm} ${region.yieldMean.toFixed(2)}%</span>
      </div>
      <div class="cycle-grid-row">
        <span class="cycle-grid-label">${t('c1_grid_deviation')}</span>
        <span class="cycle-grid-value">z = <strong>${zStr}</strong></span>
        <span class="cycle-grid-explain">
          ${zLabel}
          <span class="cycle-grid-sub-inline">${t('c1_grid_z_range')}</span>
        </span>
      </div>
    </div>`;

  // ── Группа 2: Изменение за год ───────────────────────────────────
  let changeHTML = '';
  if (hasMovement) {
    const pSign = region.priceGrowth12m >= 0 ? '+' : '';
    const rSign = region.rentGrowth12m  >= 0 ? '+' : '';
    const abs   = Math.abs(region.divergence12m).toFixed(1);
    let gapValue, gapExplain;
    if (region.divergenceClass === 'synchronous') {
      gapValue   = '';
      gapExplain = t('c1_grid_gap_sync') || 'вровень';
    } else {
      gapValue   = `<strong>${abs}</strong> ${t('c1_pp_short')}`;
      gapExplain = t(region.divergenceClass === 'prices_outpace'
        ? 'c1_grid_gap_prices' : 'c1_grid_gap_rents');
    }

    changeHTML = `
    <div class="cycle-grid-group">
      <div class="cycle-grid-title">${t('c1_grid_change_title')}</div>
      <div class="cycle-grid-row">
        <span class="cycle-grid-label">${t('c1_grid_price_change')}</span>
        <span class="cycle-grid-value">${pSign}${region.priceGrowth12m.toFixed(1)}%</span>
        <span class="cycle-grid-explain"></span>
      </div>
      <div class="cycle-grid-row">
        <span class="cycle-grid-label">${t('c1_grid_rent_change')}</span>
        <span class="cycle-grid-value">${rSign}${region.rentGrowth12m.toFixed(1)}%</span>
        <span class="cycle-grid-explain"></span>
      </div>
      <div class="cycle-grid-row">
        <span class="cycle-grid-label">${t('c1_grid_gap')}</span>
        <span class="cycle-grid-value">${gapValue}</span>
        <span class="cycle-grid-explain">${gapExplain}</span>
      </div>
    </div>`;
  }

  // ── Вывод: исторический исход по уровню (cyclePhase) + оговорка ─
  // p1 (level-факт) и divergence-факт больше не нужны — уровень покрыт
  // сеткой «Отклонение · zLabel», divergence — строкой «Разрыв».
  const outcomeKey = {
    above:   'c1_market_outcome_above',
    neutral: 'c1_market_outcome_neutral',
    below:   'c1_market_outcome_below',
  }[region.cyclePhase];
  const p1 = t(outcomeKey);
  const p2 = t('c1_market_caveat');
  const concParas = [p1, p2].filter(Boolean).map(p => `<p>${p}</p>`).join('');

  const conclusionHTML = `
    <div class="cycle-grid-conclusion">
      <div class="cycle-grid-title">${t('c1_grid_conclusion_title')}</div>
      ${concParas}
    </div>`;

  block.innerHTML = levelHTML + changeHTML + conclusionHTML;
}

// '2007-04' → '04.2007'
function c1FormatYM(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${m}.${y}`;
}
function c1FormatPeriod(from, to) {
  return `${c1FormatYM(from)} — ${c1FormatYM(to)}`;
}
// Форматирование евро: "+1 234 567 €" или "−45 000 €"
function c1FormatEur(value) {
  const sign = value < 0 ? '−' : (value > 0 ? '+' : '');
  return sign + Math.abs(Math.round(value)).toLocaleString('ru').replace(/,/g, ' ') + ' €';
}

// Sparkline 200×40: линия yield по месяцам, без осей/легенды/тултипа,
// последняя точка крупнее, горизонтальная линия mean.
function drawCycleSparkline(region) {
  const canvas = document.getElementById('c1-cycle-sparkline');
  if (!canvas || !region?.yieldHistory?.length) return;
  if (c1CycleChart) { c1CycleChart.destroy(); c1CycleChart = null; }

  const data = region.yieldHistory.map(p => p.yield);
  const labels = region.yieldHistory.map(p => p.mes);
  const color = C1_CYCLE_COLORS[region.cyclePhase] || C1_CYCLE_COLORS.neutral;
  // Маркер только на последней точке.
  const pointRadius = data.map((_, i) => i === data.length - 1 ? 4 : 0);
  const pointBorderColor = data.map(() => color);

  c1CycleChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        // Yield-линия региона
        {
          data, borderColor: color, backgroundColor: 'transparent',
          borderWidth: 1.5, tension: 0.25, pointRadius, pointBackgroundColor: color,
          pointBorderColor, fill: false,
        },
        // Горизонтальная линия среднего (одинаковое значение во всех точках)
        {
          data: data.map(() => region.yieldMean),
          borderColor: 'rgba(150,150,150,0.5)', backgroundColor: 'transparent',
          borderWidth: 1, borderDash: [3, 3], pointRadius: 0, fill: false,
        },
      ],
    },
    options: {
      devicePixelRatio: window.devicePixelRatio || 2,
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false, grid: { display: false } },
        y: { display: false, grid: { display: false } },
      },
      elements: { point: { hoverRadius: 0 } },
    },
  });
}

// Регион, текущий в выпадающем списке Калькулятора 1.
function getCurrentC1Region() {
  const id = document.getElementById('c1-region')?.value;
  return id ? REGIONS.find(r => r.id === id) : null;
}

function updateC1SliderHints() {
  const inflation = parseFloat(document.getElementById('c1-inflation')?.value);
  const tpl = t('c1_slider_real_hint') || '≈ {real}% реальных при инфляции {infl}%';
  // Универсальный апдейтер для нескольких слайдеров: real-эквивалент = nominal − inflation.
  const updateHint = (sliderId, hintId) => {
    const hintEl = document.getElementById(hintId);
    if (!hintEl) return;
    const nominal = parseFloat(document.getElementById(sliderId)?.value);
    if (!Number.isFinite(nominal) || !Number.isFinite(inflation)) {
      hintEl.textContent = '';
      return;
    }
    const real = (nominal - inflation).toFixed(1);
    hintEl.textContent = tpl.replace('{real}', real).replace('{infl}', inflation.toFixed(1));
  };
  updateHint('c1-inv',  'c1-inv-hint');
  updateHint('c1-appr', 'c1-appr-hint');
  // Подпись над слайдером роста — отображение текущего значения.
  const growthValEl = document.getElementById('c1v-growth');
  const apprVal = parseFloat(document.getElementById('c1-appr')?.value);
  if (growthValEl && Number.isFinite(apprVal)) growthValEl.textContent = apprVal.toFixed(1);
}

function updateC1ChartSub() {
  const el = document.getElementById('c1-chart-sub');
  if (!el) return;
  const appr = parseFloat(document.getElementById('c1-appr')?.value || DEFAULTS.apprDefault).toFixed(1);
  const inv  = parseFloat(document.getElementById('c1-inv')?.value || DEFAULTS.investmentReturn).toFixed(1);
  if (c1IsCash) {
    const tpl = t('c1_chart_sub_cash_tpl') || 'Расчёт при покупке за наличные · рост цен {appr}%/год · доходность инвестиций {inv}%';
    el.textContent = tpl.replace('{appr}', appr).replace('{inv}', inv);
  } else {
    const rate = parseFloat(document.getElementById('c1-rate')?.value || DEFAULTS.mortgageRate).toFixed(1);
    const tpl = t('c1_chart_sub_tpl') || 'Расчёт при росте цен {appr}%/год · ставка ипотеки {rate}% · доходность инвестиций {inv}%';
    el.textContent = tpl.replace('{appr}', appr).replace('{rate}', rate).replace('{inv}', inv);
  }
}

function fillC1Breakdown(finalPropVal, loanBal, portfolio, downAmt, taxAmt, totalInterestPaid, totalMaintPaid, rent0, rentGrowth, horizon) {
  const fmt = v => Math.round(v).toLocaleString('ru');
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  const equity = finalPropVal - loanBal;
  const initialCash = downAmt + taxAmt;

  // Total rent paid (geometric series, monthly compounding)
  const rg12 = rentGrowth / 12;
  const months = horizon * 12;
  const totalRentPaid = rg12 < 0.00001
    ? rent0 * months
    : rent0 * (Math.pow(1 + rg12, months) - 1) / rg12;

  set('c1b-prop-val',   '+' + fmt(finalPropVal) + ' €');
  set('c1b-debt',       loanBal > 1 ? '−' + fmt(loanBal) + ' €' : '0 €');
  set('c1b-equity',     fmt(equity) + ' €');
  set('c1b-down-itp',   '−' + fmt(initialCash) + ' €');
  set('c1b-interest',   '−' + fmt(totalInterestPaid) + ' €');
  set('c1b-maint',      '−' + fmt(totalMaintPaid) + ' €');
  set('c1b-portfolio',  fmt(portfolio) + ' €');
  set('c1b-invested',   '+' + fmt(initialCash) + ' €');
  set('c1b-rent-total', '−' + fmt(totalRentPaid) + ' €');
}

function buildCalc1Summary(winner, buyFinal, rentFinal, parityYear, roiAnn, horizon, downAmt, taxAmt, mortgagePmt, rent0) {
  const el = document.getElementById('c1-summary-text');
  if (!el) return;
  const fmt = v => Math.round(v).toLocaleString('ru');
  const winWord = winner === 'buy' ? (t('c1_buy')||'покупка') : (t('c1_rent_word')||'аренда');
  const diff = Math.abs(buyFinal - rentFinal);
  const parStr = parityYear ? `${t('c1_parity_year_at')||'Точка паритета'} — год ${parityYear}.` : '';
  el.innerHTML = `<strong>${t('c1_sum_intro')||'Вывод:'}</strong> ${t('c1_sum_winner')||'Стратегия'}
    <strong>${winWord}</strong> ${t('c1_sum_better')||'выгоднее через'} <strong>${pluralYears(horizon)}</strong>
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


