/* ============================================================
   Динамика (новая) — Д2: РЕАЛЬНЫЕ данные.
   Питание: data/history.json (месячные ряды venta/alquiler) +
   REGIONS из data.js (growth1/rentGrowth1, cagr5/10, rentCagr5/10,
   price/rent/yield) + trailing-поля из data-history.js
   (priceGrowth12m/rentGrowth12m). Демо-объекта больше нет.

   Изоляция как в Д1: весь код в IIFE, наружу только window.DYN.
   Chart.js — общий (сайт грузит 4.4.1). Свою историю грузим
   отдельным fetch (файл кэшируется браузером) — так секция
   остаётся самодостаточной для Д3.

   Колонки хитмапа: 9 годовых Dec-к-Dec (2017→2025) из history.json
   + «12 мес» = growth1/rentGrowth1 из data.js (точное совпадение с
   карточкой P/R и рыночной таблицей).
   ============================================================ */
(function () {
  'use strict';

  // ── Локальный i18n (изолирован; язык берём из глобала сайта) ──
  const DYN_I18N = {
    ru: {
      loading: "Загрузка данных…", na: "н/д", col12m: "12 мес",
      rentFaster: "Аренда быстрее", pricesFaster: "Цены быстрее",
      lowGrowthP: "Низкий рост цен", lowGrowthR: "Низкий рост аренды", highGrowth: "Высокий рост",
      howToRead: '<b>Как читать:</b> красные ячейки — цены росли быстрее аренды (рынок перегревается, доходность падает). Зелёные — аренда обгоняла цены (рынок становится привлекательнее). Колонка «12 мес» — свежий год-к-году.',
      cooling: "остывает", accelerating: "ускоряется", inline: "вровень",
      byPrice: "по ценам", byRent: "по аренде",
    },
    en: {
      loading: "Loading data…", na: "n/a", col12m: "12 mo",
      rentFaster: "Rents faster", pricesFaster: "Prices faster",
      lowGrowthP: "Low price growth", lowGrowthR: "Low rent growth", highGrowth: "High growth",
      howToRead: '<b>How to read:</b> red cells — prices grew faster than rents (market overheating, yield falling). Green — rents outpaced prices (market more attractive). The “12 mo” column is the latest year-over-year.',
      cooling: "cooling", accelerating: "accelerating", inline: "in line",
      byPrice: "price", byRent: "rent",
    },
    es: {
      loading: "Cargando datos…", na: "n/d", col12m: "12 m",
      rentFaster: "Alquiler más rápido", pricesFaster: "Precios más rápido",
      lowGrowthP: "Bajo crec. precios", lowGrowthR: "Bajo crec. alquiler", highGrowth: "Alto crecimiento",
      howToRead: '<b>Cómo leer:</b> celdas rojas — los precios crecieron más rápido que los alquileres (mercado sobrecalentado, rentabilidad a la baja). Verdes — los alquileres superaron a los precios (mercado más atractivo). La columna «12 m» es la variación interanual reciente.',
      cooling: "se enfría", accelerating: "se acelera", inline: "a la par",
      byPrice: "de precios", byRent: "de alquiler",
    },
  };
  const lang = () => (window.currentLang && DYN_I18N[window.currentLang]) ? window.currentLang
                    : (DYN_I18N[document.documentElement.lang] ? document.documentElement.lang : 'ru');
  const T = (k) => DYN_I18N[lang()][k];

  // Статические подписи секции (заголовки, табы, шапка таблицы, CTA).
  // Проставляются по [data-dyn-i18n] — innerHTML (в CTA есть <b>).
  const DYN_STATIC = {
    ru: {
      dyn_title: "Динамика и тренды",
      dyn_subtitle: "Хитмап рынка, momentum по регионам и сравнение — на реальных данных (history.json + Idealista).",
      dyn_nav_heatmap: "Хитмап рынка", dyn_nav_momentum: "Куда движется рынок", dyn_nav_comparison: "Сравнение регионов",
      dyn_hm_title: "Хитмап рынка",
      dyn_hm_sub: "Все регионы × все годы. Цвет показывает степень «перегретости» рынка для инвестора.",
      dyn_hm_tab_div: "Разрыв цен/аренды", dyn_hm_tab_price: "Рост цен", dyn_hm_tab_rent: "Рост аренды",
      dyn_hm_note: "% — годовое изменение · € — цена за м²",
      dyn_mo_title: "Куда движется рынок",
      dyn_mo_sub: "Регионы отсортированы по тренду. Долгосрочное изменение + ускорение за последний год.",
      dyn_mo_tab_yield: "Доходность", dyn_mo_tab_price: "Цены", dyn_mo_tab_rent: "Аренда",
      dyn_vel_5: "5 лет", dyn_vel_10: "10 лет",
      dyn_cmp_title: "Сравнение регионов",
      dyn_cmp_sub: "Выберите 2–5 регионов для глубокого сравнения по всем метрикам.",
      dyn_cmp_regions: "Регионы",
      dyn_cmp_tab_yield: "Доходность", dyn_cmp_tab_price: "Цена", dyn_cmp_tab_rent: "Аренда",
      dyn_th_region: "Регион", dyn_th_price: "Цена €/м²", dyn_th_rent: "Аренда €/м²",
      dyn_th_yield: "Доходность", dyn_th_growth5: "Рост 5л", dyn_th_momentum: "Momentum",
      dyn_cta_text: 'Нашли подходящие регионы? <b>Посчитайте конкретную стратегию</b> с учётом вашего бюджета, ипотеки и налогов.',
      dyn_cta_btn: "Посчитать стратегию →",
    },
    en: {
      dyn_title: "Dynamics & trends",
      dyn_subtitle: "Market heatmap, regional momentum and comparison — on real data (history.json + Idealista).",
      dyn_nav_heatmap: "Market heatmap", dyn_nav_momentum: "Where the market is heading", dyn_nav_comparison: "Region comparison",
      dyn_hm_title: "Market heatmap",
      dyn_hm_sub: "All regions × all years. Colour shows how “overheated” the market is for an investor.",
      dyn_hm_tab_div: "Price/rent gap", dyn_hm_tab_price: "Price growth", dyn_hm_tab_rent: "Rent growth",
      dyn_hm_note: "% — annual change · € — price per m²",
      dyn_mo_title: "Where the market is heading",
      dyn_mo_sub: "Regions sorted by trend. Long-term change + last-year acceleration.",
      dyn_mo_tab_yield: "Yield", dyn_mo_tab_price: "Prices", dyn_mo_tab_rent: "Rent",
      dyn_vel_5: "5 yrs", dyn_vel_10: "10 yrs",
      dyn_cmp_title: "Region comparison",
      dyn_cmp_sub: "Pick 2–5 regions for a deep comparison across all metrics.",
      dyn_cmp_regions: "Regions",
      dyn_cmp_tab_yield: "Yield", dyn_cmp_tab_price: "Price", dyn_cmp_tab_rent: "Rent",
      dyn_th_region: "Region", dyn_th_price: "Price €/m²", dyn_th_rent: "Rent €/m²",
      dyn_th_yield: "Yield", dyn_th_growth5: "5y growth", dyn_th_momentum: "Momentum",
      dyn_cta_text: 'Found the right regions? <b>Calculate a concrete strategy</b> factoring in your budget, mortgage and taxes.',
      dyn_cta_btn: "Calculate strategy →",
    },
    es: {
      dyn_title: "Dinámica y tendencias",
      dyn_subtitle: "Mapa de calor del mercado, momentum regional y comparación — con datos reales (history.json + Idealista).",
      dyn_nav_heatmap: "Mapa de calor", dyn_nav_momentum: "Hacia dónde va el mercado", dyn_nav_comparison: "Comparación de regiones",
      dyn_hm_title: "Mapa de calor del mercado",
      dyn_hm_sub: "Todas las regiones × todos los años. El color muestra cuán «sobrecalentado» está el mercado para un inversor.",
      dyn_hm_tab_div: "Brecha precio/alquiler", dyn_hm_tab_price: "Crec. de precios", dyn_hm_tab_rent: "Crec. de alquiler",
      dyn_hm_note: "% — variación anual · € — precio por m²",
      dyn_mo_title: "Hacia dónde va el mercado",
      dyn_mo_sub: "Regiones ordenadas por tendencia. Cambio a largo plazo + aceleración del último año.",
      dyn_mo_tab_yield: "Rentabilidad", dyn_mo_tab_price: "Precios", dyn_mo_tab_rent: "Alquiler",
      dyn_vel_5: "5 años", dyn_vel_10: "10 años",
      dyn_cmp_title: "Comparación de regiones",
      dyn_cmp_sub: "Elige 2–5 regiones para una comparación detallada por todas las métricas.",
      dyn_cmp_regions: "Regiones",
      dyn_cmp_tab_yield: "Rentabilidad", dyn_cmp_tab_price: "Precio", dyn_cmp_tab_rent: "Alquiler",
      dyn_th_region: "Región", dyn_th_price: "Precio €/m²", dyn_th_rent: "Alquiler €/m²",
      dyn_th_yield: "Rentabilidad", dyn_th_growth5: "Crec. 5a", dyn_th_momentum: "Momentum",
      dyn_cta_text: '¿Encontraste las regiones adecuadas? <b>Calcula una estrategia concreta</b> considerando tu presupuesto, hipoteca e impuestos.',
      dyn_cta_btn: "Calcular estrategia →",
    },
  };
  function applyStaticLabels() {
    const dict = DYN_STATIC[lang()];
    document.querySelectorAll('#page-dynamics [data-dyn-i18n]').forEach(el => {
      const k = el.getAttribute('data-dyn-i18n');
      if (dict[k] != null) el.innerHTML = dict[k];
    });
  }

  // Инсайт momentum — генерится по данным, трилингвально.
  function momentumInsight(key, top, bottom, n) {
    const L = lang();
    if (key === "y") {
      const v = (top.velocity > 0 ? "+" : "") + top.velocity.toFixed(1) + "%";
      return {
        ru: `<b>${top.n}</b> — лидер по улучшению доходности за ${n} лет (${v}). <b>${bottom.n}</b> — доходность снизилась. Стрелки справа — momentum за последний год.`,
        en: `<b>${top.n}</b> — biggest yield improvement over ${n} yrs (${v}). <b>${bottom.n}</b> — yield declined. Arrows show last-year momentum.`,
        es: `<b>${top.n}</b> — mayor mejora de rentabilidad en ${n} años (${v}). <b>${bottom.n}</b> — la rentabilidad bajó. Las flechas muestran el momentum del último año.`,
      }[L];
    }
    const by = key === "pc" ? T("byPrice") : T("byRent");
    const v = "+" + top.velocity.toFixed(1) + "%";
    return {
      ru: `<b>${top.n}</b> — самый быстрый среднегодовой рост ${by} за ${n} лет (${v}). <b>${bottom.n}</b> — самый медленный. Стрелки — momentum за последний год; бейдж у названия — остывает/ускоряется относительно сглаженного тренда.`,
      en: `<b>${top.n}</b> — fastest annualized ${by} growth over ${n} yrs (${v}). <b>${bottom.n}</b> — slowest. Arrows show last-year momentum; the badge by the name means cooling/accelerating vs the smoothed trend.`,
      es: `<b>${top.n}</b> — mayor crecimiento anualizado ${by} en ${n} años (${v}). <b>${bottom.n}</b> — el más lento. Las flechas muestran el momentum del último año; la etiqueta junto al nombre significa se enfría/acelera frente a la tendencia suavizada.`,
    }[L];
  }

  // ── State ──────────────────────────────────────────────────
  let heatmapMetric  = "divergence";
  let momentumMetric = "yield";
  let cmpMetric      = "y";
  let velYears       = 5;
  let selectedRegions = new Set(["madrid", "cataluna"]);   // ключи = id из data.js
  let cmpChart = null;

  // Модель (строится после готовности данных). До этого — null.
  let MODEL = null;
  let rawRegions = null;          // сырые ряды history.json
  let fetchDone = false;

  const ANNUAL_YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const DYN_PALETTE = ["#c9a84c", "#5cb88a", "#5b9be0", "#e05c5c", "#bb7fd8"];

  // ── Построение модели из реальных источников ───────────────
  function buildModel() {
    MODEL = REGIONS.map(r => {
      const raw = rawRegions[r.id] || { venta: [], alquiler: [] };
      const ventaMap = new Map(raw.venta.map(x => [x.mes, x.precio_m2]));
      const alqMap   = new Map(raw.alquiler.map(x => [x.mes, x.precio_m2]));
      const decV = y => (ventaMap.has(y + "-12") ? ventaMap.get(y + "-12") : null);
      const decA = y => (alqMap.has(y + "-12") ? alqMap.get(y + "-12") : null);
      const yoy = (v1, v0) => (v1 == null || v0 == null || v0 === 0) ? null : (v1 / v0 - 1) * 100;

      // Годовые Dec-к-Dec + «12 мес» (из data.js YoY — совпадает с карточкой)
      const hmPrice = {}, hmRent = {}, hmDiv = {}, subP = {}, subR = {};
      ANNUAL_YEARS.forEach(y => {
        hmPrice[y] = yoy(decV(y), decV(y - 1));
        hmRent[y]  = yoy(decA(y), decA(y - 1));
        hmDiv[y]   = (hmPrice[y] != null && hmRent[y] != null) ? hmPrice[y] - hmRent[y] : null;
        subP[y]    = decV(y);
        subR[y]    = decA(y);
      });
      hmPrice["12m"] = r.growth1 ?? null;
      hmRent["12m"]  = r.rentGrowth1 ?? null;
      hmDiv["12m"]   = (r.growth1 != null && r.rentGrowth1 != null) ? r.growth1 - r.rentGrowth1 : null;
      subP["12m"]    = r.price;
      subR["12m"]    = r.rent;

      // yield velocity/momentum из yieldHistory (data-history.js)
      const yh = r.yieldHistory || [];
      const yMap = new Map(yh.map(p => [p.mes, p.yield]));
      const lastMes = yh.length ? yh[yh.length - 1].mes : null;
      const backMes = (nYears) => {
        if (!lastMes) return null;
        const [Y, M] = lastMes.split("-");
        return (+Y - nYears) + "-" + M;
      };
      const yNow = lastMes ? yMap.get(lastMes) : null;
      const yieldVel = (nYears) => {
        const m = backMes(nYears);
        return (yNow != null && m && yMap.has(m)) ? yNow - yMap.get(m) : null;
      };
      const m1y = backMes(1);
      const yieldMom = (yNow != null && m1y && yMap.has(m1y)) ? yNow - yMap.get(m1y) : null;

      return {
        id: r.id, n: r.name, color: r.color,
        price: r.price, rent: r.rent, yield: r.yield,
        growth1: r.growth1 ?? null, rentGrowth1: r.rentGrowth1 ?? null,
        cagr5: r.cagr5 ?? null, cagr10: r.cagr10 ?? null,
        rentCagr5: r.rentCagr5 ?? null, rentCagr10: r.rentCagr10 ?? null,
        priceGrowth12m: (typeof r.priceGrowth12m === "number") ? r.priceGrowth12m : null,
        rentGrowth12m:  (typeof r.rentGrowth12m === "number") ? r.rentGrowth12m : null,
        hmPrice, hmRent, hmDiv, subP, subR,
        ventaMap, alqMap, yieldHistory: yh,
        yieldVel5: yieldVel(5), yieldVel10: yieldVel(10), yieldMom,
      };
    });
  }

  const ready = () => fetchDone && window.historyReady && MODEL;

  // ── Цвета ячеек ────────────────────────────────────────────
  function divergenceColor(v) {
    if (v == null) return "var(--bg3)";
    const t = Math.max(-1, Math.min(1, v / 6));
    if (t > 0) return `rgba(224, 92, 92, ${0.3 + Math.abs(t) * 0.7})`;
    if (t < 0) return `rgba(92, 184, 138, ${0.3 + Math.abs(t) * 0.7})`;
    return "rgba(90, 95, 110, 0.4)";
  }
  function sequentialColor(v, max) {
    if (v == null) return "var(--bg3)";
    const t = Math.max(0, Math.min(1, v / max));
    return `rgba(201, 168, 76, ${0.15 + t * 0.85})`;
  }
  const dynVisible = () => {
    const p = document.getElementById("page-dynamics");
    return !!p && p.classList.contains("active");
  };

  // ── Блок 1: Хитмап ─────────────────────────────────────────
  function renderHeatmap() {
    const grid = document.getElementById("dyn-heatmap-grid");
    const labelEl = document.getElementById("dyn-heatmap-legend");
    if (!grid) return;
    if (!ready()) { grid.innerHTML = `<div class="dyn-loading">${T("loading")}</div>`; return; }

    const cols = [...ANNUAL_YEARS, "12m"];
    let html = `<div class="dyn-hm-cell dyn-hm-head"></div>`;
    cols.forEach(c => html += `<div class="dyn-hm-cell dyn-hm-head">${c === "12m" ? T("col12m") : c}</div>`);

    MODEL.forEach(r => {
      html += `<div class="dyn-hm-cell dyn-hm-region">${r.n}</div>`;
      cols.forEach(c => {
        let value, sub;
        if (heatmapMetric === "divergence") { value = r.hmDiv[c];   sub = r.subP[c]; }
        else if (heatmapMetric === "price") { value = r.hmPrice[c]; sub = r.subP[c]; }
        else                                { value = r.hmRent[c];  sub = r.subR[c]; }

        if (value == null) {
          html += `<div class="dyn-hm-cell dyn-na"><span class="dyn-hm-cell-main">${T("na")}</span></div>`;
          return;
        }
        const color = heatmapMetric === "divergence" ? divergenceColor(value)
                    : heatmapMetric === "price"       ? sequentialColor(value, 15)
                    :                                   sequentialColor(value, 12);
        const main = (value > 0 ? "+" : "") + value.toFixed(1) + "%";
        const subText = sub == null ? "" : (heatmapMetric === "rent" ? sub.toFixed(1) + "€" : Math.round(sub) + "€");
        html += `<div class="dyn-hm-cell" style="background:${color}">
          <span class="dyn-hm-cell-main">${main}</span>
          <span class="dyn-hm-cell-sub">${subText}</span>
        </div>`;
      });
    });

    grid.style.gridTemplateColumns = `120px repeat(${cols.length}, minmax(58px, 1fr))`;
    grid.innerHTML = html;

    if (labelEl) {
      if (heatmapMetric === "divergence") {
        labelEl.innerHTML = `<span>${T("rentFaster")}</span><div class="dyn-legend-bar dyn-diverging"></div><span>${T("pricesFaster")}</span>`;
      } else {
        const low = heatmapMetric === "price" ? T("lowGrowthP") : T("lowGrowthR");
        labelEl.innerHTML = `<span>${low}</span><div class="dyn-legend-bar dyn-sequential"></div><span>${T("highGrowth")}</span>`;
      }
    }
    const insightEl = document.getElementById("dyn-heatmap-insight");
    if (insightEl) insightEl.innerHTML = T("howToRead");   // только статическое «как читать»
  }

  // ── Блок 2: Momentum ───────────────────────────────────────
  function renderMomentum() {
    const wrap = document.getElementById("dyn-momentum-bars");
    if (!wrap) return;
    if (!ready()) { wrap.innerHTML = `<div class="dyn-loading">${T("loading")}</div>`; return; }
    const key = momentumMetric === "yield" ? "y" : momentumMetric === "price" ? "pc" : "rc";

    const data = MODEL.map(r => {
      let velocity, momentum, delta;
      if (key === "y") {
        velocity = velYears === 10 ? r.yieldVel10 : r.yieldVel5;
        momentum = r.yieldMom;
        delta = null;                                   // trailing-yield нет → без бейджа
      } else if (key === "pc") {
        velocity = velYears === 10 ? r.cagr10 : r.cagr5;
        momentum = r.growth1;
        delta = (r.growth1 != null && r.priceGrowth12m != null) ? r.growth1 - r.priceGrowth12m : null;
      } else {
        velocity = velYears === 10 ? r.rentCagr10 : r.rentCagr5;
        momentum = r.rentGrowth1;
        delta = (r.rentGrowth1 != null && r.rentGrowth12m != null) ? r.rentGrowth1 - r.rentGrowth12m : null;
      }
      return { n: r.n, velocity, momentum, delta };
    });

    // сортировка по velocity (null — вниз)
    data.sort((a, b) => (b.velocity ?? -Infinity) - (a.velocity ?? -Infinity));
    const withVel = data.filter(d => d.velocity != null);
    const maxAbs = Math.max(1, ...withVel.map(d => Math.abs(d.velocity)));

    wrap.innerHTML = data.map(d => {
      // Δ-бейдж (остывает/ускоряется) — только для цены/аренды
      let deltaHtml = "";
      if (d.delta != null) {
        const cls = d.delta > 1 ? "dyn-up" : d.delta < -1 ? "dyn-down" : "dyn-flat";
        const arrow = d.delta > 1 ? "▲" : d.delta < -1 ? "▼" : "≈";
        const word = d.delta > 1 ? T("accelerating") : d.delta < -1 ? T("cooling") : T("inline");
        const num = (d.delta > 0 ? "+" : "") + d.delta.toFixed(1);
        deltaHtml = `<span class="dyn-mb-delta ${cls}">${arrow} ${word} ${num}</span>`;
      }

      if (d.velocity == null) {
        return `<div class="dyn-mb-row">
          <div class="dyn-mb-name">${d.n}${deltaHtml}</div>
          <div class="dyn-mb-bar-wrap"><div class="dyn-mb-bar-zero"></div></div>
          <div class="dyn-mb-na">${T("na")}</div><div></div>
        </div>`;
      }

      const w = Math.abs(d.velocity) / maxAbs * 50;
      const positive = d.velocity > 0;
      const barColor = key === "y"
        ? (positive ? "var(--green)" : "var(--red)")
        : (positive ? "var(--accent)" : "var(--gray-mid)");
      const velCls = key === "y" ? (positive ? "dyn-up" : "dyn-down") : "";
      const velSign = d.velocity > 0 ? "+" : "";

      let momArrow = "→", momCls = "dyn-flat", momSign = "", momTxt = "";
      if (d.momentum != null) {
        const th = key === "y" ? 0.05 : 0.5;
        if (d.momentum > th) { momArrow = "↑"; momCls = "dyn-up"; }
        else if (d.momentum < -th) { momArrow = "↓"; momCls = "dyn-down"; }
        momSign = d.momentum > 0 ? "+" : "";
        momTxt = `${momSign}${d.momentum.toFixed(1)}%`;
      }

      const barStyle = positive
        ? `left: 50%; width: ${w}%; background: ${barColor};`
        : `right: 50%; width: ${w}%; background: ${barColor};`;

      return `<div class="dyn-mb-row">
        <div class="dyn-mb-name">${d.n}${deltaHtml}</div>
        <div class="dyn-mb-bar-wrap"><div class="dyn-mb-bar-zero"></div><div class="dyn-mb-bar" style="${barStyle}"></div></div>
        <div class="dyn-mb-velocity ${velCls}">${velSign}${d.velocity.toFixed(1)}%</div>
        <div class="dyn-mb-momentum ${momCls}"><span class="dyn-mb-arrow">${momArrow}</span> ${momTxt}</div>
      </div>`;
    }).join("");

    const insightEl = document.getElementById("dyn-momentum-insight");
    if (insightEl && withVel.length) {
      insightEl.innerHTML = momentumInsight(key, withVel[0], withVel[withVel.length - 1], velYears);
    }
  }

  // ── Блок 3: Сравнение ──────────────────────────────────────
  function renderCmpPills() {
    const groupsEl = document.getElementById("dyn-cmp-groups");
    if (!groupsEl || !MODEL) return;
    groupsEl.innerHTML = "";
    const pills = document.createElement("div");
    pills.className = "dyn-cmp-pills";
    MODEL.forEach(r => {
      const btn = document.createElement("button");
      btn.className = "dyn-pill" + (selectedRegions.has(r.id) ? " dyn-on" : "");
      btn.textContent = r.n;
      btn.addEventListener("click", () => toggleCmpPill(btn, r.id));
      pills.appendChild(btn);
    });
    groupsEl.appendChild(pills);
    const cnt = document.getElementById("dyn-cmp-count");
    if (cnt) cnt.textContent = selectedRegions.size;
  }

  function toggleCmpPill(btn, id) {
    if (selectedRegions.has(id)) {
      if (selectedRegions.size <= 2) return;
      selectedRegions.delete(id); btn.classList.remove("dyn-on");
    } else {
      if (selectedRegions.size >= 5) return;
      selectedRegions.add(id); btn.classList.add("dyn-on");
    }
    const cnt = document.getElementById("dyn-cmp-count");
    if (cnt) cnt.textContent = selectedRegions.size;
    renderCmpChart(); renderCmpTable();
  }

  // Помесячные ряды выбранной метрики для выбранных регионов.
  function monthlySeries(r, metric) {
    if (metric === "pc") return r.ventaMap;
    if (metric === "rc") return r.alqMap;
    // yield: пересечение месяцев (есть и цена, и аренда)
    const m = new Map();
    r.yieldHistory.forEach(p => m.set(p.mes, p.yield));
    return m;
  }

  function renderCmpChart() {
    const canvas = document.getElementById("dynCmpCanvas");
    if (!canvas || typeof Chart === "undefined" || !ready()) return;
    if (!dynVisible()) return;                 // канвас без размеров в скрытой секции

    const sel = MODEL.filter(r => selectedRegions.has(r.id));
    const meta = { y:{d:1,s:"%"}, pc:{d:0,s:"€"}, rc:{d:1,s:"€"} }[cmpMetric];

    // Общая ось меток = объединение месяцев выбранных регионов (по возрастанию)
    const monthSet = new Set();
    const maps = sel.map(r => monthlySeries(r, cmpMetric));
    maps.forEach(m => m.forEach((_, k) => monthSet.add(k)));
    const labels = [...monthSet].sort();

    const datasets = sel.map((r, i) => ({
      label: r.n,
      data: labels.map(mo => maps[i].has(mo) ? maps[i].get(mo) : null),
      borderColor: DYN_PALETTE[i], backgroundColor: DYN_PALETTE[i] + "22",
      borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2, fill: false, spanGaps: true,
    }));

    if (cmpChart) cmpChart.destroy();
    cmpChart = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { right: 100 } },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#16181c", borderColor: "#2a2d35", borderWidth: 1,
            callbacks: { label: c => c.parsed.y == null ? null : ` ${c.dataset.label}: ${c.parsed.y.toFixed(meta.d)}${meta.s}` }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,0.04)" },
            ticks: {
              color: "#8a8f9e", font: { size: 11 }, maxRotation: 0, autoSkip: false,
              callback: function (v) { const l = this.getLabelForValue(v); return (l && l.endsWith("-01")) ? l.slice(0, 4) : ""; }
            }
          },
          y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "#8a8f9e", font: { size: 11 }, callback: v => v.toFixed(meta.d) + meta.s } }
        }
      },
      plugins: [{
        id: "dynEndLabel",
        afterDatasetsDraw(chart) {
          const { ctx, chartArea: { right } } = chart;
          chart.data.datasets.forEach((ds, i) => {
            const m = chart.getDatasetMeta(i);
            if (!m.visible) return;
            // последняя не-null точка
            let last = null;
            for (let j = m.data.length - 1; j >= 0; j--) { if (ds.data[j] != null) { last = m.data[j]; break; } }
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
    if (!tbody || !MODEL) return;
    const sel = MODEL.filter(r => selectedRegions.has(r.id));
    tbody.innerHTML = sel.map((r, i) => {
      const g5 = r.cagr5;
      const mom = r.growth1;
      const momArrow = mom == null ? "" : mom > 0.05 ? "↑" : mom < -0.05 ? "↓" : "→";
      const momCls   = mom == null ? "" : mom > 0.05 ? "dyn-up" : mom < -0.05 ? "dyn-down" : "dyn-flat";
      return `<tr>
        <td><div class="dyn-cmp-name-cell"><span class="dyn-cmp-color-dot" style="background:${DYN_PALETTE[i]}"></span>${r.n}</div></td>
        <td>${Math.round(r.price).toLocaleString("en-US")} €</td>
        <td>${r.rent.toFixed(1)} €</td>
        <td>${r.yield != null ? r.yield.toFixed(1) + "%" : T("na")}</td>
        <td>${g5 != null ? "+" + g5.toFixed(1) + "%" : T("na")}</td>
        <td class="${momCls}">${mom != null ? `${momArrow} ${mom > 0 ? "+" : ""}${mom.toFixed(1)}%` : T("na")}</td>
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
    renderCmpChart();                          // теперь канвас виден
  }

  function renderAll() {
    applyStaticLabels();
    renderHeatmap();
    renderMomentum();
    renderCmpPills();
    renderCmpTable();
    renderCmpChart();
  }

  // ── Готовность данных ──────────────────────────────────────
  function tryReady() {
    if (fetchDone && window.historyReady && !MODEL) buildModel();
    renderAll();
  }

  // Свой fetch истории (файл кэшируется браузером; секция автономна)
  fetch("data/history.json")
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(h => { rawRegions = h.regions; fetchDone = true; tryReady(); })
    .catch(err => console.error("Динамика: не удалось загрузить history.json:", err));

  if (window.historyReady) { /* trailing-поля уже готовы */ }
  else document.addEventListener("historyLoaded", tryReady);

  // Перерисовка при смене языка (setLang меняет <html lang>)
  const langObs = new MutationObserver(() => { applyStaticLabels(); if (MODEL) renderAll(); });
  langObs.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  // Секция открывается штатно через showPage('dynamics') — тот лишь ставит
  // .active. Канвас графика без размеров в скрытой секции, поэтому рисуем его,
  // когда секция становится видимой.
  const pageEl = document.getElementById("page-dynamics");
  if (pageEl) {
    const pageObs = new MutationObserver(() => { if (dynVisible()) renderCmpChart(); });
    pageObs.observe(pageEl, { attributes: true, attributeFilter: ["class"] });
  }

  // Первичный рендер (покажет «загрузка…», пока данные не готовы)
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderAll);
  else renderAll();

  window.DYN = { setHeatmapMetric, setMomentumMetric, setCmpMetric, setVelYears, show };
})();
