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
  renderMarket();
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
  if (id === 'calc')    { initCalcRegions(); loadCalcParamsFromURL(); calcBuyRent(); }
  if (id === 'rental')  initRentalCalc();
  if (id === 'compare') initCompare();
  if (id === 'guide')   renderGuide();
}

function switchTab(group, id, btn) {
  const scope = btn.closest('.page') || btn.closest('.card') || document;
  scope.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  scope.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(group + '-' + id).classList.add('active');
}

// ---- SHARE URL ----
function shareCalcParams() {
  const price       = document.getElementById('c-price').value;
  const down        = document.getElementById('c-down').value;
  const rate        = document.getElementById('c-rate').value;
  const term        = document.getElementById('c-term').value;
  const itp         = document.getElementById('c-itp').value;
  const appr        = document.getElementById('c-appr').value;
  const maint       = document.getElementById('c-maint').value;
  const rent        = document.getElementById('c-rent').value;
  const rentg       = document.getElementById('c-rentg').value;
  const inv         = document.getElementById('c-inv').value;
  const hor         = document.getElementById('c-hor').value;

  const params = new URLSearchParams({
    price, down, rate, term, itp, appr, maint, rent, rentg, inv, hor
  });
  
  const url = window.location.origin + window.location.pathname + '?' + params.toString();
  
  navigator.clipboard.writeText(url).then(() => {
    alert('🔗 Ссылка скопирована в буфер обмена! Поделитесь ей с друзьями.');
  }).catch(() => {
    alert('Ошибка при копировании. Попробуйте вручную: ' + url);
  });
}

// Load calc params from URL on page load
function loadCalcParamsFromURL() {
  const params = new URLSearchParams(window.location.search);
  const price   = params.get('price');
  const down    = params.get('down');
  const rate    = params.get('rate');
  const term    = params.get('term');
  const itp     = params.get('itp');
  const appr    = params.get('appr');
  const maint   = params.get('maint');
  const rent    = params.get('rent');
  const rentg   = params.get('rentg');
  const inv     = params.get('inv');
  const hor     = params.get('hor');

  if (price)  document.getElementById('c-price').value = price;
  if (down)   document.getElementById('c-down').value = down;
  if (rate)   document.getElementById('c-rate').value = rate;
  if (term)   document.getElementById('c-term').value = term;
  if (itp)    document.getElementById('c-itp').value = itp;
  if (appr)   document.getElementById('c-appr').value = appr;
  if (maint)  document.getElementById('c-maint').value = maint;
  if (rent)   document.getElementById('c-rent').value = rent;
  if (rentg)  document.getElementById('c-rentg').value = rentg;
  if (inv)    document.getElementById('c-inv').value = inv;
  if (hor)    document.getElementById('c-hor').value = hor;

  // trigger calculation if any params were set
  if (params.size > 0) {
    setTimeout(() => calcBuyRent(), 100);
  }
}

// ---- MARKET TABLE ----
// Map widget data and functions
const MAP_SVG_SHAPES = {
  galicia: 'M55,55 L110,50 L125,75 L115,105 L80,115 L58,95 Z',
  asturias: 'M110,50 L178,46 L188,70 L165,85 L125,75 Z',
  cantabria: 'M178,46 L220,44 L226,68 L188,70 Z',
  pais_vasco: 'M220,44 L268,38 L274,66 L240,70 L226,68 Z',
  navarra: 'M268,38 L308,42 L306,82 L274,84 L274,66 Z',
  la_rioja: 'M226,68 L274,66 L274,84 L255,90 L232,84 Z',
  aragon: 'M274,84 L306,82 L328,88 L334,170 L280,175 L270,145 L274,118 Z',
  cataluna: 'M306,82 L388,65 L398,96 L380,140 L334,170 L328,88 Z',
  castilla_leon: 'M58,95 L80,115 L118,134 L165,150 L212,155 L258,150 L270,145 L232,84 L226,68 L188,70 L165,85 L115,105 Z',
  madrid: 'M212,155 L258,150 L264,180 L242,195 L212,190 Z',
  clm: 'M118,134 L165,150 L212,155 L212,190 L242,195 L264,180 L280,205 L336,170 L304,215 L284,264 L242,274 L185,260 L136,230 L116,196 Z',
  extremadura: 'M62,156 L118,134 L116,196 L136,230 L118,264 L78,270 L54,236 L58,192 Z',
  valencia: 'M334,170 L380,140 L405,166 L412,225 L388,274 L354,290 L334,260 L304,215 Z',
  murcia: 'M354,290 L388,274 L412,248 L398,330 L365,336 L340,310 Z',
  andalucia: 'M78,270 L118,264 L136,230 L185,260 L242,274 L284,264 L340,260 L340,310 L365,336 L344,364 L296,390 L225,400 L152,386 L94,352 L68,307 Z',
  baleares: 'M390,152 L428,148 L436,162 L422,172 L396,170 Z',
  canarias: 'M48,344 L178,344 L178,395 L48,395 Z',
};

const MAP_LABELS = {
  galicia: '88,86', asturias: '150,68', cantabria: '202,59', pais_vasco: '248,56',
  navarra: '290,65', la_rioja: '252,80', aragon: '305,130', cataluna: '360,114',
  castilla_leon: '170,128', madrid: '238,176', clm: '215,222', extremadura: '92,212',
  valencia: '368,222', murcia: '378,310', andalucia: '212,338',
  baleares: '413,162', canarias: '113,368',
};

const MAP_PALETTES = {
  price: {
    stops: [{ v: 900, c: '#E6F1FB' }, { v: 1700, c: '#85B7EB' }, { v: 2500, c: '#378ADD' }, { v: 3500, c: '#185FA5' }, { v: 9999, c: '#042C53' }],
    title: 'Цена €/м²',
    fmt: v => '€' + Math.round(v).toLocaleString('ru'),
    fn: r => r.price
  },
  rent: {
    stops: [{ v: 7, c: '#E1F5EE' }, { v: 10, c: '#5DCAA5' }, { v: 14, c: '#1D9E75' }, { v: 18, c: '#0F6E56' }, { v: 99, c: '#04342C' }],
    title: 'Аренда €/м²/мес',
    fmt: v => '€' + v.toFixed(1),
    fn: r => r.rent
  },
  pr: {
    stops: [{ v: 14, c: '#EAF3DE' }, { v: 16, c: '#97C459' }, { v: 18, c: '#639922' }, { v: 20, c: '#3B6D11' }, { v: 99, c: '#173404' }],
    title: 'P/R (меньше = выгоднее)',
    fmt: v => v.toFixed(1) + ' лет',
    fn: r => r.prAdj
  },
  growth: {
    stops: [{ v: 10, c: '#FAEEDA' }, { v: 11, c: '#EF9F27' }, { v: 12, c: '#BA7517' }, { v: 13, c: '#854F0B' }, { v: 99, c: '#412402' }],
    title: 'Рост цен за год',
    fmt: v => '+' + v.toFixed(1) + '%',
    fn: r => r.growth1
  }
};

let mapMode = 'price', mapSelected = null, mapSvgBuilt = false;

function isLightColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

function getMapColor(r) {
  const v = MAP_PALETTES[mapMode].fn(r);
  for (const s of MAP_PALETTES[mapMode].stops) if (v <= s.v) return s.c;
  return MAP_PALETTES[mapMode].stops.at(-1).c;
}

function initMapWidget() {
  if (mapSvgBuilt) return;
  mapSvgBuilt = true;
  buildMapSVG();
  setMapMode('price');
}

function buildMapSVG() {
  const svg = document.getElementById('map-svg');
  if (!svg) return;
  svg.innerHTML = '';

  REGIONS.forEach(r => {
    const mapId = r.name.toLowerCase()
      .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
      .replace(/ñ/g, 'n').replace(/ü/g, 'u').replace(/\s+/g, '_').replace(/\./g, '');
    
    const pathData = MAP_SVG_SHAPES[mapId];
    if (!pathData) return;

    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', pathData);
    p.setAttribute('stroke', '#0e0f11');
    p.setAttribute('stroke-width', '1.5');
    p.setAttribute('stroke-linejoin', 'round');
    p.style.cursor = 'pointer';
    p.dataset.id = mapId;
    p.dataset.name = r.name;

    p.addEventListener('mouseenter', e => {
      if (mapId !== mapSelected) p.setAttribute('stroke-width', '2.5');
      showMapTooltip(e, r);
    });
    p.addEventListener('mousemove', e => moveMapTooltip(e));
    p.addEventListener('mouseleave', () => {
      if (mapId !== mapSelected) p.setAttribute('stroke-width', '1.5');
      hideMapTooltip();
    });
    p.addEventListener('click', () => selectMapRegion(r));
    svg.appendChild(p);

    const pos = MAP_LABELS[mapId].split(',');
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', pos[0]);
    t.setAttribute('y', pos[1]);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', '8.5');
    t.setAttribute('font-weight', '500');
    t.setAttribute('pointer-events', 'none');
    t.textContent = r.name.split(' ')[0];
    svg.appendChild(t);
  });
  paintMapSVG();
}

function paintMapSVG() {
  const svg = document.getElementById('map-svg');
  if (!svg) return;

  REGIONS.forEach(r => {
    const mapId = r.name.toLowerCase()
      .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
      .replace(/ñ/g, 'n').replace(/ü/g, 'u').replace(/\s+/g, '_').replace(/\./g, '');
    
    const p = svg.querySelector(`path[data-id="${mapId}"]`);
    if (!p) return;

    const c = getMapColor(r);
    p.setAttribute('fill', c);

    const pos = MAP_LABELS[mapId].split(',');
    const texts = [...svg.querySelectorAll('text')];
    const t = texts.find(tx => tx.getAttribute('x') === pos[0] && tx.getAttribute('y') === pos[1]);
    if (t) t.setAttribute('fill', isLightColor(c) ? '#111' : '#fff');
  });
  buildMapLegend();
}

function buildMapLegend() {
  const stops = MAP_PALETTES[mapMode].stops;
  const fmt = MAP_PALETTES[mapMode].fmt;
  const prev = [0, ...stops.map(s => s.v)];
  const html = stops.map((s, i) => {
    const lbl = i === 0 ? '< ' + fmt(s.v) : fmt(prev[i]) + '–' + fmt(s.v);
    return `<div class="map-legend-item" style="background:${s.c};"><span style="font-size:12px;color:${isLightColor(s.c) ? '#1a1a1a' : '#eee'};">${lbl}</span></div>`;
  }).join('');
  document.getElementById('map-legend-box').innerHTML = html;
}

function selectMapRegion(r) {
  const mapId = r.name.toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
    .replace(/ñ/g, 'n').replace(/ü/g, 'u').replace(/\s+/g, '_').replace(/\./g, '');
  
  const prevSel = mapSelected;
  mapSelected = mapId === mapSelected ? null : mapId;

  const svg = document.getElementById('map-svg');
  if (prevSel && svg) {
    const p = svg.querySelector(`path[data-id="${prevSel}"]`);
    if (p) {
      p.setAttribute('stroke-width', '1.5');
      p.setAttribute('stroke', '#0e0f11');
    }
  }
  if (mapSelected && svg) {
    const p = svg.querySelector(`path[data-id="${mapSelected}"]`);
    if (p) {
      p.setAttribute('stroke-width', '3');
      p.setAttribute('stroke', '#c9a84c');
    }
  }

  if (mapSelected) {
    showMapPanel(r);
  }
}

function showMapPanel(r) {
  const pc = r.prAdj < 16 ? 'var(--green)' : r.prAdj < 20 ? 'var(--accent)' : 'var(--red)';
  const pv = r.prAdj < 16 ? 'выгодно' : r.prAdj < 20 ? 'норма' : 'дорого';
  const calcBtn = '<button style="margin-top:12px;padding:8px 14px;background:var(--accent);color:#000;border:none;border-radius:6px;font-weight:500;cursor:pointer;" onclick="goToCalcWithRegion(\'' + r.name.replace(/'/g, "\\'") + '\')">Рассчитать для этого региона →</button>';
  
  document.getElementById('map-info-panel').innerHTML = `
    <div style="font-size:15px;font-weight:500;margin-bottom:10px;">${r.name}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
      <div><div style="font-size:11px;color:var(--muted);">Цена</div><div style="font-size:14px;font-weight:500;">€${(r.price * 70).toLocaleString('ru')}</div></div>
      <div><div style="font-size:11px;color:var(--muted);">Аренда/мес</div><div style="font-size:14px;font-weight:500;">€${Math.round(r.rent * 70)}</div></div>
      <div><div style="font-size:11px;color:var(--muted);">P/R</div><div style="font-size:14px;font-weight:500;color:${pc};">${r.prAdj.toFixed(1)}</div></div>
      <div><div style="font-size:11px;color:var(--muted);">Доходность</div><div style="font-size:14px;font-weight:500;">${r.yield.toFixed(1)}%</div></div>
    </div>
    ${calcBtn}
  `;
}

function goToCalcWithRegion(regionName) {
  const r = REGIONS.find(x => x.name === regionName);
  if (!r) return;
  
  // Set calculator values based on region
  const price = r.price * 70 * 1000; // assuming 70m² apartment
  const rent = r.rent * 70 * 100;   // monthly rent
  const itp = r.itp * 100;
  
  document.getElementById('c-price').value = Math.round(price / 1000) * 1000;
  document.getElementById('c-rent').value = Math.round(rent / 100);
  document.getElementById('c-itp').value = itp;
  
  showPage('calc', document.querySelectorAll('.nav-btn')[3]);
}

function showMapTooltip(e, r) {
  const t = document.getElementById('map-tooltip');
  const val = MAP_PALETTES[mapMode].fmt(MAP_PALETTES[mapMode].fn(r));
  t.innerHTML = `<div style="font-weight:500;margin-bottom:4px;">${r.name}</div><div style="color:#aaa;">${MAP_PALETTES[mapMode].title}: <strong style="color:#f0ede8;">${val}</strong></div><div style="color:#666;font-size:11px;margin-top:3px;">Нажмите для деталей</div>`;
  t.style.display = 'block';
  moveMapTooltip(e);
}

function moveMapTooltip(e) {
  const wrap = e.currentTarget.closest('svg') || e.currentTarget.parentElement;
  const rect = wrap ? wrap.getBoundingClientRect() : { left: 0, top: 0 };
  const t = document.getElementById('map-tooltip');
  t.style.left = (e.clientX - rect.left + 12) + 'px';
  t.style.top = (e.clientY - rect.top - 10) + 'px';
}

function hideMapTooltip() {
  document.getElementById('map-tooltip').style.display = 'none';
}

function setMapMode(m, btn) {
  mapMode = m;
  if (btn) {
    document.querySelectorAll('.map-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  paintMapSVG();
}

// ---- MARKET TABLE ----
function renderMarket() {
  const tbody = document.getElementById('market-tbody');
  tbody.innerHTML = '';
  REGIONS.forEach(r => {
    const yClass = r.yield > 5 ? 'pill-green' : r.yield > 3.5 ? 'pill-amber' : 'pill-red';
    const gClass = r.growth10 > 80 ? 'pill-amber' : r.growth10 > 50 ? 'pill-blue' : 'pill-green';
    const tr = document.createElement('tr');
    tr.onclick = () => showPRDetailFor(r.name);
    tr.innerHTML = `
      <td style="font-weight:500;">${r.name}</td>
      <td>${r.price.toLocaleString('ru')} €</td>
      <td>${r.rent.toFixed(1)} €</td>
      <td>${(r.itp * 100).toFixed(0)}%</td>
      <td><span class="pill ${yClass}">${r.yield.toFixed(1)}%</span></td>
      <td><span class="pill ${gClass}">+${r.growth10}%</span></td>
      <td><span class="pill ${r.prAdj < 18 ? 'pill-green' : r.prAdj < 22 ? 'pill-amber' : 'pill-red'}">${r.prAdj.toFixed(1)} лет</span></td>
    `;
    tbody.appendChild(tr);
  });
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

// ---- BUY VS RENT CALCULATOR ----
let calcChartInst = null, calcPriceMode = 'nominal';

function toggleCalcInstructions(btn) {
  const inst = document.getElementById('calc-instructions');
  const arrow = btn.querySelector('span');
  inst.style.display = inst.style.display === 'none' ? 'block' : 'none';
  arrow.style.transform = inst.style.display === 'none' ? 'rotate(0deg)' : 'rotate(180deg)';
}

function initCalcRegions() {
  const sel = document.getElementById('calc-region-select');
  sel.innerHTML = '<option value="">Выберите регион...</option>';
  REGIONS.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.name;
    opt.textContent = r.name;
    sel.appendChild(opt);
  });
}

function onCalcRegionChange() {
  const sel = document.getElementById('calc-region-select').value;
  if (!sel) return;
  const r = REGIONS.find(x => x.name === sel);
  if (!r) return;
  document.getElementById('c-price').value = Math.round(r.price * 70000 / 100) * 100;
  document.getElementById('c-rent').value = Math.round(r.rent * 70);
  document.getElementById('c-itp').value = r.itp * 100;
  calcBuyRent();
}

function resetCalcToRegion() {
  onCalcRegionChange();
}

function applyCalcPreset(preset) {
  const r = document.getElementById('c-rent').value;
  const i = document.getElementById('c-inv').value;
  
  if (preset === 'live') {
    document.getElementById('c-rent').value = 0;
    document.getElementById('c-rent').disabled = true;
    document.getElementById('c-inv').value = 0;
    document.getElementById('c-inv').disabled = true;
  } else if (preset === 'rent') {
    document.getElementById('c-rent').disabled = false;
    document.getElementById('c-inv').disabled = false;
    document.getElementById('c-rent').value = 1200;
    document.getElementById('c-inv').value = 7;
  } else if (preset === 'notinvest') {
    document.getElementById('c-rent').disabled = false;
    document.getElementById('c-inv').disabled = true;
    document.getElementById('c-inv').value = 0;
  }
  calcBuyRent();
}

function setPriceMode(mode, btn) {
  calcPriceMode = mode;
  document.querySelectorAll('[onclick*="setPriceMode"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  calcBuyRent();
}

function calcBuyRent() {
  const price       = +document.getElementById('c-price').value;
  const downpct     = +document.getElementById('c-down').value / 100;
  const annRate     = +document.getElementById('c-rate').value / 100;
  const termYears   = +document.getElementById('c-term').value;
  const itpPct      = +document.getElementById('c-itp').value / 100;
  const appreciation = +document.getElementById('c-appr').value / 100;
  const maintenance = +document.getElementById('c-maint').value / 100;
  const rent0       = +document.getElementById('c-rent').value;
  const rentGrowth  = +document.getElementById('c-rentg').value / 100;
  const investRate  = +document.getElementById('c-inv').value / 100;
  const horizon     = +document.getElementById('c-hor').value;
  const inflation   = +document.getElementById('c-inflation').value / 100;

  // Update parameter display
  const upd = (id, val) => { document.getElementById('cv-' + id).textContent = val; };
  upd('price', price.toLocaleString('ru') + ' €');
  upd('down',  (downpct*100).toFixed(0) + '%');
  upd('rate',  (annRate*100).toFixed(1) + '%');
  upd('term',  termYears + ' лет');
  upd('itp',   (itpPct*100).toFixed(1) + '%');
  upd('appr',  (appreciation*100).toFixed(1) + '%');
  upd('maint', (maintenance*100).toFixed(1) + '%');
  upd('rent',  rent0.toLocaleString('ru') + ' €');
  upd('rentg', (rentGrowth*100).toFixed(1) + '%');
  upd('inv',   (investRate*100).toFixed(1) + '%');
  upd('hor',   horizon + ' лет');

  // Update subsidiary amounts
  const downAmt = price * downpct;
  document.getElementById('c-down-amt').textContent = '= ' + Math.round(downAmt).toLocaleString('ru') + ' €';
  
  const down  = price * downpct;
  const loan  = price - down;
  const totalIn = down + price * itpPct;
  const mRate = annRate / 12;
  const nPay  = termYears * 12;
  const monthlyMortgage = loan * (mRate * Math.pow(1+mRate, nPay)) / (Math.pow(1+mRate, nPay) - 1);
  
  // Update mortgage payment display
  document.getElementById('c-rate-pmt').textContent = '≈ ' + Math.round(monthlyMortgage).toLocaleString('ru') + ' €/мес';
  
  // Update ITP amount
  const itpAmt = price * itpPct;
  document.getElementById('c-itp-amt').textContent = '= ' + Math.round(itpAmt).toLocaleString('ru') + ' €';
  
  // Update maintenance amount
  const maintAmt = price * maintenance;
  document.getElementById('c-maint-amt').textContent = '= ' + Math.round(maintAmt).toLocaleString('ru') + ' €/год';

  const labels = [], buyData = [], rentData = [];
  let propVal = price, loanBal = loan, rentPort = totalIn, rent = rent0;
  let totalInterest = 0, totalMaint = 0, totalRentPaid = 0;

  for (let y = 0; y <= horizon; y++) {
    labels.push(y === 0 ? 'Сейчас' : 'Год ' + y);
    buyData.push(Math.round(propVal - loanBal));
    rentData.push(Math.round(rentPort));
    if (y < horizon) {
      for (let m = 0; m < 12; m++) {
        const interest  = loanBal * mRate;
        const principal = y*12+m < nPay ? Math.min(monthlyMortgage - interest, loanBal) : 0;
        const payment   = y*12+m < nPay ? monthlyMortgage : 0;
        loanBal = Math.max(0, loanBal - principal);
        totalInterest += interest;
        const maintCost = propVal * maintenance / 12;
        const ibi       = propVal * 0.005 / 12;
        totalMaint += maintCost;
        const diff = payment + maintCost + ibi - rent;
        rentPort = rentPort * (1 + investRate/12) + Math.max(0, diff);
        totalRentPaid += rent;
      }
      propVal *= (1 + appreciation);
      rent    *= (1 + rentGrowth);
    }
  }

  const fb = buyData[horizon], fr = rentData[horizon], diff = fb - fr;
  const winner = diff > 0 ? 'buy' : 'rent';
  
  // Find parity year (when values cross)
  let parityYear = horizon;
  for (let y = 0; y <= horizon; y++) {
    if (buyData[y] >= rentData[y]) {
      parityYear = y;
      break;
    }
  }
  
  // Calculate leverage effect (ROI on down payment)
  const capitalGain = buyData[horizon] - totalIn;
  const leverageRoi = (capitalGain / downAmt * 100).toFixed(1);
  
  // Update summary cards
  document.getElementById('summary-winner').innerHTML = winner === 'buy' 
    ? `<div style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:0.08em;">🏆 Победитель</div><div style="font-size:28px;font-weight:bold;margin-top:8px;">Покупка</div>`
    : `<div style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:0.08em;">🏆 Победитель</div><div style="font-size:28px;font-weight:bold;margin-top:8px;">Аренда</div>`;
  
  document.getElementById('summary-winner-sub').textContent = `Разница: ${Math.abs(diff).toLocaleString('ru')} €`;
  
  document.getElementById('summary-parity').innerHTML = 
    `<div style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:0.08em;">⚖ Паритет</div><div style="font-size:28px;font-weight:bold;margin-top:8px;">Год ${parityYear}</div>`;
  
  document.getElementById('summary-parity-sub').textContent = `Когда значения выравняются`;
  
  document.getElementById('summary-leverage').innerHTML = 
    `<div style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:0.08em;">📈 Леверидж</div><div style="font-size:28px;font-weight:bold;margin-top:8px;">${leverageRoi}%</div>`;
  
  document.getElementById('summary-leverage-sub').textContent = `Доход на взнос за ${horizon} лет`;
  
  const vEl = document.getElementById('calc-verdict');
  vEl.className = 'verdict ' + (winner === 'buy' ? 'buy' : 'rent');
  vEl.innerHTML = winner === 'buy'
    ? `<div class="verdict-title">Покупка выгоднее через ${horizon} лет</div><div class="verdict-detail">Капитал покупателя: ${fb.toLocaleString('ru')} € · Портфель арендатора: ${fr.toLocaleString('ru')} € · Разница: +${Math.abs(diff).toLocaleString('ru')} €</div>`
    : `<div class="verdict-title">Аренда + инвестиции выгоднее через ${horizon} лет</div><div class="verdict-detail">Портфель арендатора: ${fr.toLocaleString('ru')} € · Капитал покупателя: ${fb.toLocaleString('ru')} € · Разница: +${Math.abs(diff).toLocaleString('ru')} €</div>`;

  if (calcChartInst) { calcChartInst.destroy(); calcChartInst = null; }
  calcChartInst = new Chart(document.getElementById('calcChart'), {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Покупка', data: buyData,  borderColor: '#4a90d9', backgroundColor: 'rgba(74,144,217,0.08)', fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2 },
      { label: 'Аренда',  data: rentData, borderColor: '#5cb88a', backgroundColor: 'rgba(92,184,138,0.08)', fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2 },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString('ru')} €` } } },
      scales: {
        x: { ticks: { color: '#8a8f9e', font: { size: 11 }, maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#8a8f9e', font: { size: 11 }, callback: v => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'k' : v }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });

  document.getElementById('calc-breakdown-content').innerHTML = `
    <div class="card">
      <div style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Покупка — итоговый капитал</div>
      ${brRows([
        ['Стоимость квартиры', propVal.toLocaleString('ru') + ' €'],
        ['Остаток долга', '− ' + Math.round(loanBal).toLocaleString('ru') + ' €'],
        ['Чистый капитал', fb.toLocaleString('ru') + ' €'],
        ['---'],
        ['Взнос + ITP',          '− ' + Math.round(totalIn).toLocaleString('ru') + ' €'],
        ['Выплачено процентов',  '− ' + Math.round(totalInterest).toLocaleString('ru') + ' €'],
        ['Содержание + IBI',     '− ' + Math.round(totalMaint).toLocaleString('ru') + ' €'],
      ])}
    </div>
    <div class="card">
      <div style="font-size:12px;color:var(--blue);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Аренда — итоговый портфель</div>
      ${brRows([
        ['Итоговый портфель', fr.toLocaleString('ru') + ' €'],
        ['---'],
        ['Вложено изначально',   Math.round(totalIn).toLocaleString('ru') + ' €'],
        ['---'],
        ['Всего уплачено аренды', '− ' + Math.round(totalRentPaid).toLocaleString('ru') + ' €'],
      ])}
    </div>
  `;
}

function brRows(data) {
  return data.map(([k, v]) => k === '---'
    ? `<div style="height:1px;background:var(--border);margin:8px 0;"></div>`
    : `<div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid rgba(42,45,53,0.4);"><span style="color:var(--muted);">${k}</span><span>${v}</span></div>`
  ).join('');
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

  const steps = [
    ['Определите бюджет',                 'Включите 10–13% сверху цены на налоги и расходы. Получите предварительное одобрение ипотеки (pre-aprobación).'],
    ['NIE — идентификационный номер',     'Обязателен для любой сделки. Оформляется в полиции или консульстве. Срок: 1–4 недели.'],
    ['Найдите объект',                    'Idealista, Fotocasa, Habitaclia. Проверьте nota simple — выписку из реестра на предмет обременений.'],
    ['Contrato de arras — задаток',       'Обычно 10% от цены. Покупатель отказался — теряет. Продавец отказался — возвращает двойную сумму.'],
    ['Юридическая проверка',             'Долги по коммуналке, ипотека продавца, разрешения на строительство, кадастровое соответствие. Нужен abogado.'],
    ['Счёт в испанском банке',           'Необходим для ипотеки и оплаты. Документы: паспорт, NIE, подтверждение дохода.'],
    ['Подписание ипотеки',               'Банк выдаёт FEIN. Нотариус проводит беседу. 10 дней на раздумье обязательны по закону.'],
    ['Escritura pública — нотариальная сделка', 'Финальное подписание. Оплата через банковский чек или перевод.'],
    ['Регистрация и налоги',             '30 рабочих дней на оплату ITP/IVA и регистрацию в Реестре. Этим занимается gestoria.'],
    ['Получение ключей',                 'Переоформите электричество, газ, воду и домовое сообщество на своё имя.'],
  ];

  document.getElementById('checklist').innerHTML = steps.map(([t,d], i) =>
    `<li><div class="check-num">${i+1}</div><div><div class="check-title">${t}</div><div class="check-desc">${d}</div></div></li>`
  ).join('');

  document.getElementById('itp-table').innerHTML = ITP_TABLE.map(([r, v, n]) =>
    `<tr onclick="showPRDetailFor('${r.replace("'","\\'")}')">
      <td style="font-weight:500;">${r}</td>
      <td><span class="pill ${v==='6%'||v==='6.5%'?'pill-green':v==='10%'||v==='11%'?'pill-red':'pill-amber'}">${v}</span></td>
      <td style="color:var(--muted);font-size:12px;">${n}</td>
    </tr>`
  ).join('');
}
