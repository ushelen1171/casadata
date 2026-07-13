/* ============================================================
   Динамика (новая) — Д1 каркас. ПОЛНАЯ ИЗОЛЯЦИЯ.
   Всё в IIFE — ни одного глобального const (никаких REGIONS/YEARS
   в глобале). Наружу торчит только объект window.DYN с
   обработчиками (нужен инлайн-onclick в разметке) и опенером show().
   Данные — ДЕМО из макета (числа фейковые). Реальные данные — Д2:
   Д2 подставит настоящие ряды в DYN_REGIONS и cagr5/cagr10 в toggle.
   Chart.js берём общий (сайт грузит 4.4.1) — свою копию НЕ грузим.
   ============================================================ */
(function () {
  'use strict';

  // 17 регионов × 10 лет (ДЕМО). pc — цена €/м², rc — аренда €/м², y — доходность %
  const DYN_REGIONS = {
    metro: [
      {n:"Madrid",        pc:[2800,2960,3140,3320,3510,3480,3600,3800,4000,4234], rc:[14.5,15.2,16.0,16.8,17.6,17.0,17.8,18.9,19.8,20.3], y:[6.2,6.2,6.1,6.1,6.0,5.9,5.9,6.0,5.9,5.8]},
      {n:"Cataluña",      pc:[1800,1880,1970,2050,2130,2100,2180,2300,2420,2560], rc:[13.5,14.2,15.0,15.8,16.5,16.0,16.8,17.9,19.0,20.0], y:[9.0,9.1,9.1,9.2,9.3,9.1,9.2,9.3,9.4,9.4]},
      {n:"Valencia",      pc:[1420,1480,1540,1600,1660,1640,1720,1860,2010,2207], rc:[9.2,9.8,10.3,10.8,11.2,11.0,11.8,12.9,13.9,14.9], y:[7.8,7.9,8.0,8.1,8.1,8.0,8.2,8.3,8.3,8.1]},
      {n:"Andalucía",     pc:[1500,1560,1620,1690,1760,1740,1800,1960,2170,2468], rc:[9.8,10.0,10.2,10.4,10.6,10.3,10.7,11.2,12.0,12.6], y:[7.8,7.7,7.6,7.4,7.2,7.1,7.1,6.9,6.6,6.1]},
    ],
    north: [
      {n:"País Vasco",    pc:[2400,2490,2580,2670,2760,2740,2810,2900,2970,3035], rc:[12.8,13.2,13.6,14.0,14.4,14.2,14.5,14.6,14.7,14.9], y:[6.4,6.4,6.3,6.3,6.3,6.2,6.2,6.0,5.9,5.9]},
      {n:"Galicia",       pc:[1180,1230,1280,1330,1380,1370,1430,1520,1580,1650], rc:[6.3,6.5,6.7,6.9,7.1,6.9,7.2,7.6,7.9,8.2],   y:[6.4,6.3,6.3,6.2,6.2,6.0,6.0,6.0,6.0,6.0]},
      {n:"Asturias",      pc:[1050,1090,1130,1170,1210,1200,1260,1330,1400,1480], rc:[5.6,5.8,6.0,6.2,6.4,6.3,6.6,6.9,7.4,7.8],   y:[6.4,6.4,6.4,6.4,6.3,6.3,6.3,6.2,6.3,6.3]},
      {n:"Cantabria",     pc:[1260,1300,1340,1390,1440,1420,1470,1560,1640,1750], rc:[6.6,6.8,7.0,7.2,7.4,7.2,7.6,8.2,8.7,9.5],   y:[6.3,6.3,6.3,6.2,6.2,6.1,6.2,6.3,6.4,6.5]},
      {n:"Navarra",       pc:[1340,1380,1420,1470,1530,1510,1560,1650,1720,1800], rc:[7.1,7.3,7.6,7.9,8.2,8.0,8.4,8.9,9.3,9.8],   y:[6.4,6.3,6.4,6.4,6.4,6.4,6.5,6.5,6.5,6.5]},
      {n:"La Rioja",      pc:[1040,1070,1100,1140,1180,1160,1210,1280,1340,1400], rc:[5.3,5.4,5.6,5.8,6.0,5.8,6.1,6.5,6.8,7.2],   y:[6.1,6.1,6.1,6.1,6.1,6.0,6.1,6.1,6.1,6.2]},
      {n:"Aragón",        pc:[1180,1220,1270,1320,1380,1360,1420,1500,1560,1600], rc:[5.9,6.0,6.2,6.4,6.6,6.4,6.8,7.2,7.6,8.0],   y:[6.0,5.9,5.9,5.8,5.7,5.6,5.7,5.8,5.8,6.0]},
    ],
    center: [
      {n:"Castilla y León",pc:[960,990,1020,1060,1100,1080,1130,1200,1250,1300],   rc:[4.8,5.0,5.2,5.4,5.6,5.4,5.7,6.1,6.4,6.8],   y:[6.0,6.1,6.1,6.1,6.1,6.0,6.1,6.1,6.1,6.3]},
      {n:"C.-La Mancha",  pc:[640,650,665,680,700,690,720,770,810,850],            rc:[3.8,4.0,4.1,4.3,4.5,4.5,4.8,5.2,5.5,5.8],   y:[7.1,7.3,7.5,7.6,7.8,7.9,8.0,8.1,8.2,8.2]},
      {n:"Extremadura",   pc:[680,695,710,725,740,735,755,810,860,900],            rc:[3.9,4.1,4.3,4.6,4.8,4.9,4.9,5.4,5.7,6.0],   y:[6.9,7.1,7.4,7.6,7.8,7.9,7.9,8.0,8.0,8.0]},
      {n:"Murcia",        pc:[890,920,955,990,1025,1000,1060,1140,1200,1250],      rc:[5.9,6.0,6.1,6.2,6.3,6.0,6.3,6.8,7.2,7.5],   y:[7.9,7.8,7.6,7.5,7.4,7.2,7.1,7.2,7.2,7.2]},
    ],
    islands: [
      {n:"Baleares",      pc:[3200,3470,3680,3850,4020,3990,4120,4380,4650,4905],  rc:[17.5,17.6,17.5,17.2,17.4,17.2,17.1,17.4,17.9,18.7],y:[6.6,6.1,5.7,5.4,5.2,5.2,5.0,4.8,4.6,4.6]},
      {n:"Canarias",      pc:[1950,2040,2130,2220,2320,2310,2400,2520,2650,2789],  rc:[10.8,11.0,11.2,11.4,11.6,11.4,11.8,12.3,12.6,12.9],y:[6.6,6.5,6.3,6.2,6.0,5.9,5.9,5.9,5.7,5.6]},
    ],
  };

  const DYN_GROUP_LABELS = { metro:"Крупные рынки", north:"Север", center:"Центр и юг", islands:"Острова" };
  const DYN_ALL   = [...DYN_REGIONS.metro, ...DYN_REGIONS.north, ...DYN_REGIONS.center, ...DYN_REGIONS.islands];
  const DYN_YEARS = [2016,2017,2018,2019,2020,2021,2022,2023,2024,2025];
  const DYN_PALETTE = ["#c9a84c", "#5cb88a", "#5b9be0", "#e05c5c", "#bb7fd8"];

  // State
  let heatmapMetric  = "divergence";
  let momentumMetric = "yield";
  let cmpMetric      = "y";
  let velYears       = 5;                       // toggle 5/10 лет (Д2 → cagr5/cagr10)
  let selectedRegions = new Set(["Madrid","Valencia","Cataluña"]);
  let cmpChart = null;

  // ── Helpers ────────────────────────────────────────────────
  const pctChange = (arr, i) => i === 0 ? 0 : ((arr[i] / arr[i-1]) - 1) * 100;
  const calcYoY   = (arr) => arr.map((_, i) => i === 0 ? null : pctChange(arr, i));

  function divergenceColor(v) {
    if (v === null) return "var(--bg3)";
    const t = Math.max(-1, Math.min(1, v / 3));
    if (t > 0) return `rgba(224, 92, 92, ${0.3 + Math.abs(t) * 0.7})`;   // цены обгоняют — красный
    if (t < 0) return `rgba(92, 184, 138, ${0.3 + Math.abs(t) * 0.7})`;  // аренда обгоняет — зелёный
    return "rgba(90, 95, 110, 0.4)";
  }
  function sequentialColor(v, max) {
    if (v === null) return "var(--bg3)";
    const t = Math.max(0, Math.min(1, v / max));
    return `rgba(201, 168, 76, ${0.15 + t * 0.85})`;
  }

  function dynVisible() {
    const p = document.getElementById("page-dynamics");
    return !!p && p.classList.contains("active");
  }

  // ── Блок 1: Хитмап ─────────────────────────────────────────
  function renderHeatmap() {
    const grid = document.getElementById("dyn-heatmap-grid");
    const labelEl = document.getElementById("dyn-heatmap-legend");
    if (!grid) return;

    let html = `<div class="dyn-hm-cell dyn-hm-head"></div>`;
    DYN_YEARS.slice(1).forEach(y => html += `<div class="dyn-hm-cell dyn-hm-head">${y}</div>`);

    DYN_ALL.forEach(r => {
      html += `<div class="dyn-hm-cell dyn-hm-region">${r.n}</div>`;
      const priceYoY = calcYoY(r.pc);
      const rentYoY  = calcYoY(r.rc);

      for (let i = 1; i < DYN_YEARS.length; i++) {
        let value, color, mainText, subText;
        const price = r.pc[i];
        if (heatmapMetric === "divergence") {
          value = priceYoY[i] - rentYoY[i];
          color = divergenceColor(value);
          mainText = (value > 0 ? "+" : "") + value.toFixed(1) + "%";
          subText = price + "€";
        } else if (heatmapMetric === "price") {
          value = priceYoY[i];
          color = sequentialColor(value, 12);
          mainText = (value > 0 ? "+" : "") + value.toFixed(1) + "%";
          subText = price + "€";
        } else {
          value = rentYoY[i];
          color = sequentialColor(value, 10);
          mainText = (value > 0 ? "+" : "") + value.toFixed(1) + "%";
          subText = r.rc[i].toFixed(1) + "€";
        }
        html += `<div class="dyn-hm-cell" style="background:${color}">
          <span class="dyn-hm-cell-main">${mainText}</span>
          <span class="dyn-hm-cell-sub">${subText}</span>
        </div>`;
      }
    });

    grid.style.gridTemplateColumns = `120px repeat(${DYN_YEARS.length - 1}, minmax(58px, 1fr))`;
    grid.innerHTML = html;

    if (labelEl) {
      if (heatmapMetric === "divergence") {
        labelEl.innerHTML = `<span>Аренда быстрее</span><div class="dyn-legend-bar dyn-diverging"></div><span>Цены быстрее</span>`;
      } else {
        const label = heatmapMetric === "price" ? "цен" : "аренды";
        labelEl.innerHTML = `<span>Низкий рост ${label}</span><div class="dyn-legend-bar dyn-sequential"></div><span>Высокий рост</span>`;
      }
    }

    const insightEl = document.getElementById("dyn-heatmap-insight");
    if (insightEl) {
      if (heatmapMetric === "divergence") {
        insightEl.innerHTML = `<b>Как читать:</b> красные ячейки — цены росли быстрее аренды (рынок перегревается, доходность падает). Зелёные — аренда обгоняла цены (рынок становится привлекательнее). 2020 (ковид) и 2024–2025 — преимущественно красные: фундаментально перегретые годы.`;
      } else if (heatmapMetric === "price") {
        insightEl.innerHTML = `<b>Что видно:</b> 2020 — провал почти везде (ковид). 2023–2025 — резкое ускорение в крупных рынках и южных регионах. Самый быстрый рост в Andalucía и Murcia.`;
      } else {
        insightEl.innerHTML = `<b>Что видно:</b> аренда росла стабильнее цен. Самый сильный рост — в Madrid, Valencia, Murcia. На Балеарах — почти стагнация: туристический потолок.`;
      }
    }
  }

  // ── Блок 2: Momentum-бары ──────────────────────────────────
  function renderMomentum() {
    const wrap = document.getElementById("dyn-momentum-bars");
    if (!wrap) return;
    const key = momentumMetric === "yield" ? "y" : momentumMetric === "price" ? "pc" : "rc";

    const data = DYN_ALL.map(r => {
      const arr = r[key];
      const cur = arr[arr.length - 1];
      const prev = arr[arr.length - 2];
      // velocity — за выбранный период (5 или 10 лет); на демо это lookback по индексу.
      // Д2 заменит на реальные cagr5/cagr10.
      const lookIdx = velYears === 10 ? 0 : Math.max(0, arr.length - 6);
      const base = arr[lookIdx];

      let velocity, momentum;
      if (key === "y") { velocity = cur - base; momentum = cur - prev; }
      else { velocity = ((cur / base) - 1) * 100; momentum = ((cur / prev) - 1) * 100; }
      return { n: r.n, velocity, momentum };
    });

    data.sort((a, b) => b.velocity - a.velocity);
    const maxAbs = Math.max(...data.map(d => Math.abs(d.velocity))) || 1;

    wrap.innerHTML = data.map(d => {
      const w = Math.abs(d.velocity) / maxAbs * 50;
      const positive = d.velocity > 0;
      const barColor = key === "y"
        ? (positive ? "var(--green)" : "var(--red)")
        : (positive ? "var(--accent)" : "var(--gray-mid)");
      const velCls = key === "y" ? (positive ? "dyn-up" : "dyn-down") : "";
      const velSign = d.velocity > 0 ? "+" : "";

      const momThresh = key === "y" ? 0.05 : 0.5;
      let momArrow, momCls;
      if (d.momentum > momThresh) { momArrow = "↑"; momCls = "dyn-up"; }
      else if (d.momentum < -momThresh) { momArrow = "↓"; momCls = "dyn-down"; }
      else { momArrow = "→"; momCls = "dyn-flat"; }
      const momSign = d.momentum > 0 ? "+" : "";

      const barStyle = positive
        ? `left: 50%; width: ${w}%; background: ${barColor};`
        : `right: 50%; width: ${w}%; background: ${barColor};`;

      return `<div class="dyn-mb-row">
        <div class="dyn-mb-name">${d.n}</div>
        <div class="dyn-mb-bar-wrap"><div class="dyn-mb-bar-zero"></div><div class="dyn-mb-bar" style="${barStyle}"></div></div>
        <div class="dyn-mb-velocity ${velCls}">${velSign}${d.velocity.toFixed(1)}%</div>
        <div class="dyn-mb-momentum ${momCls}"><span class="dyn-mb-arrow">${momArrow}</span> ${momSign}${d.momentum.toFixed(1)}%</div>
      </div>`;
    }).join("");

    const insightEl = document.getElementById("dyn-momentum-insight");
    if (insightEl) {
      const top = data[0], bottom = data[data.length - 1];
      if (key === "y") {
        insightEl.innerHTML = `<b>${top.n}</b> — лидер по улучшению доходности (${top.velocity > 0 ? "+" : ""}${top.velocity.toFixed(1)}% за ${velYears} лет). <b>${bottom.n}</b> — наоборот, доходность снизилась на ${Math.abs(bottom.velocity).toFixed(1)}%. Стрелки справа — momentum за последний год.`;
      } else {
        const label = key === "pc" ? "ценам" : "аренде";
        insightEl.innerHTML = `<b>${top.n}</b> — самый быстрый рост по ${label} за ${velYears} лет (+${top.velocity.toFixed(0)}%). Стрелки справа показывают momentum за последний год.`;
      }
    }
  }

  // ── Блок 3: Сравнение регионов ─────────────────────────────
  function renderCmpPills() {
    const groupsEl = document.getElementById("dyn-cmp-groups");
    if (!groupsEl) return;
    groupsEl.innerHTML = "";

    Object.keys(DYN_REGIONS).forEach(g => {
      const lbl = document.createElement("div");
      lbl.className = "dyn-cmp-group-label";
      lbl.textContent = DYN_GROUP_LABELS[g];
      groupsEl.appendChild(lbl);

      const pills = document.createElement("div");
      pills.className = "dyn-cmp-pills";
      DYN_REGIONS[g].forEach(r => {
        const btn = document.createElement("button");
        btn.className = "dyn-pill" + (selectedRegions.has(r.n) ? " dyn-on" : "");
        btn.textContent = r.n;
        btn.addEventListener("click", () => toggleCmpPill(btn, r.n));
        pills.appendChild(btn);
      });
      groupsEl.appendChild(pills);
    });

    const cnt = document.getElementById("dyn-cmp-count");
    if (cnt) cnt.textContent = selectedRegions.size;
  }

  function toggleCmpPill(btn, name) {
    if (selectedRegions.has(name)) {
      if (selectedRegions.size <= 2) return;
      selectedRegions.delete(name);
      btn.classList.remove("dyn-on");
    } else {
      if (selectedRegions.size >= 5) return;
      selectedRegions.add(name);
      btn.classList.add("dyn-on");
    }
    const cnt = document.getElementById("dyn-cmp-count");
    if (cnt) cnt.textContent = selectedRegions.size;
    renderCmpChart();
    renderCmpTable();
  }

  function renderCmpChart() {
    const canvas = document.getElementById("dynCmpCanvas");
    if (!canvas || typeof Chart === "undefined") return;
    if (!dynVisible()) return;                 // канвас без размеров в скрытой секции — ждём show()

    const meta = { y:{decimals:1,suffix:"%"}, pc:{decimals:0,suffix:"€"}, rc:{decimals:1,suffix:"€"} }[cmpMetric];
    const datasets = DYN_ALL.filter(r => selectedRegions.has(r.n)).map((r, i) => ({
      label: r.n, data: r[cmpMetric],
      borderColor: DYN_PALETTE[i], backgroundColor: DYN_PALETTE[i] + "22",
      borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, fill: false,
    }));

    if (cmpChart) cmpChart.destroy();
    cmpChart = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: { labels: DYN_YEARS, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { right: 100 } },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#16181c", borderColor: "#2a2d35", borderWidth: 1,
            callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y.toFixed(meta.decimals)}${meta.suffix}` }
          }
        },
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#8a8f9e", font:{size:11} } },
          y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#8a8f9e", font:{size:11}, callback: v => v.toFixed(meta.decimals) + meta.suffix } }
        }
      },
      plugins: [{
        id: "dynEndLabel",
        afterDatasetsDraw(chart) {
          const { ctx, chartArea: { right } } = chart;
          chart.data.datasets.forEach((ds, i) => {
            const m = chart.getDatasetMeta(i);
            if (!m.visible) return;
            const last = m.data[m.data.length - 1];
            if (!last) return;
            ctx.save();
            ctx.fillStyle = ds.borderColor;
            ctx.font = "500 11px -apple-system, sans-serif";
            ctx.textAlign = "left"; ctx.textBaseline = "middle";
            ctx.fillText(ds.label, right + 6, last.y);
            ctx.restore();
          });
        }
      }]
    });
  }

  function renderCmpTable() {
    const tbody = document.querySelector("#dyn-cmp-table tbody");
    if (!tbody) return;
    const selected = DYN_ALL.filter(r => selectedRegions.has(r.n));
    tbody.innerHTML = selected.map((r, i) => {
      const color = DYN_PALETTE[i];
      const price = r.pc[r.pc.length - 1];
      const rent  = r.rc[r.rc.length - 1];
      const yield_ = r.y[r.y.length - 1];
      const growth5 = ((price / r.pc[r.pc.length - 6]) - 1) * 100;
      const momentum = yield_ - r.y[r.y.length - 2];
      const momArrow = momentum > 0.05 ? "↑" : momentum < -0.05 ? "↓" : "→";
      const momCls   = momentum > 0.05 ? "dyn-up" : momentum < -0.05 ? "dyn-down" : "dyn-flat";
      return `<tr>
        <td><div class="dyn-cmp-name-cell"><span class="dyn-cmp-color-dot" style="background:${color}"></span>${r.n}</div></td>
        <td>${price.toLocaleString("en-US")} €</td>
        <td>${rent.toFixed(1)} €</td>
        <td>${yield_.toFixed(1)}%</td>
        <td>+${growth5.toFixed(0)}%</td>
        <td class="${momCls}">${momArrow} ${momentum > 0 ? "+" : ""}${momentum.toFixed(1)}%</td>
      </tr>`;
    }).join("");
  }

  // ── Metric-переключатели ───────────────────────────────────
  function setActive(sectionId, values, m) {
    document.querySelectorAll(`#${sectionId} .dyn-metric-tab`).forEach((t, i) =>
      t.classList.toggle("dyn-active", values[i] === m));
  }
  function setHeatmapMetric(m)  { heatmapMetric = m;  setActive("dyn-hm-tabs",  ["divergence","price","rent"], m); renderHeatmap(); }
  function setMomentumMetric(m) { momentumMetric = m; setActive("dyn-mo-tabs",  ["yield","price","rent"], m);      renderMomentum(); }
  function setCmpMetric(m)      { cmpMetric = m;      setActive("dyn-cmp-tabs", ["y","pc","rc"], m);               renderCmpChart(); }
  function setVelYears(n, btn)  {
    velYears = n;
    document.querySelectorAll("#dyn-momentum .dyn-vel-toggle .dyn-metric-tab").forEach(t => t.classList.remove("dyn-active"));
    if (btn) btn.classList.add("dyn-active");
    renderMomentum();
  }

  // ── Опенер (нет кнопки в меню; открывать из консоли DYN.show()) ─
  function show() {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    const hero = document.getElementById("hero-block");
    if (hero) hero.style.display = "none";
    const page = document.getElementById("page-dynamics");
    if (page) page.classList.add("active");
    // канвас теперь имеет размеры — можно рисовать график
    renderCmpChart();
  }

  // ── Init: рендерим статичные блоки сразу (chart — лениво в show) ─
  function init() {
    renderHeatmap();
    renderMomentum();
    renderCmpPills();
    renderCmpTable();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Наружу — только namespaced-объект (без глобальных данных).
  window.DYN = { setHeatmapMetric, setMomentumMetric, setCmpMetric, setVelYears, show };
})();
