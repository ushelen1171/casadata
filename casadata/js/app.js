// ============================================================
// app.js — основная логика приложения
// ============================================================

// ---- NAVIGATION ----
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  btn.classList.add('active');
  document.getElementById('hero-block').style.display = id === 'market' ? 'block' : 'none';
  if (id === 'heatmap') renderHeatmaps();
  if (id === 'pr')      renderPRPage();
  if (id === 'calc')    calcBuyRent();
  if (id === 'rental')  initRentalCalc();
  if (id === 'guide')   renderGuide();
}

function switchTab(group, id, btn) {
  const scope = btn.closest('.page') || btn.closest('.card') || document;
  scope.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  scope.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(group + '-' + id).classList.add('active');
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

let trendChartInst = null, activeTrendLines = ['Madrid'];

function renderTrendChart() {
  const sel = document.getElementById('trend-select').value;
  if (!activeTrendLines.includes(sel)) activeTrendLines = [sel];
  drawTrendChart();
}
function addTrendLine() {
  const sel = document.getElementById('trend-select').value;
  if (!activeTrendLines.includes(sel)) activeTrendLines.push(sel);
  drawTrendChart();
}
function clearTrendLines() { activeTrendLines = [document.getElementById('trend-select').value]; drawTrendChart(); }

function drawTrendChart() {
  if (trendChartInst) { trendChartInst.destroy(); trendChartInst = null; }
  const legend = document.getElementById('trend-legend');
  legend.innerHTML = activeTrendLines.map(n => {
    const r = REGIONS.find(x => x.name === n);
    return `<div class="legend-item"><div class="legend-dot" style="background:${r.color};border-radius:50%;"></div>${n}</div>`;
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
let calcChartInst = null;

function calcBuyRent() {
  const price       = +document.getElementById('c-price').value;
  const downpct     = +document.getElementById('c-down').value / 100;
  const annRate     = +document.getElementById('c-rate').value / 100;
  const termYears   = +document.getElementById('c-term').value;
  const itpPct      = +document.getElementById('c-itp').value / 100;
  const appreciation= +document.getElementById('c-appr').value / 100;
  const maintenance = +document.getElementById('c-maint').value / 100;
  const rent0       = +document.getElementById('c-rent').value;
  const rentGrowth  = +document.getElementById('c-rentg').value / 100;
  const investRate  = +document.getElementById('c-inv').value / 100;
  const horizon     = +document.getElementById('c-hor').value;

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

  const down  = price * downpct;
  const loan  = price - down;
  const totalIn = down + price * itpPct;
  const mRate = annRate / 12;
  const nPay  = termYears * 12;
  const monthlyMortgage = loan * (mRate * Math.pow(1+mRate, nPay)) / (Math.pow(1+mRate, nPay) - 1);

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

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  renderMarket();
});
