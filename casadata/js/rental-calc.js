// ============================================================
// rental-calc.js — калькулятор аренды (три стратегии)
// ============================================================

let rentalChartInst = null;
let currentStrategy = 'rent_out'; // live | rent_out | airbnb

function initRentalCalc() {
  const sel = document.getElementById('rc-region-select');
  if (!sel) return;
  REGIONS.forEach(r => {
    const o = document.createElement('option');
    o.value = r.name; o.textContent = r.name;
    sel.appendChild(o);
  });
  sel.value = 'Madrid';
  onRegionChange();
}

function onRegionChange() {
  const name = document.getElementById('rc-region-select').value;
  const r = REGIONS.find(x => x.name === name);
  if (!r) return;
  // auto-fill price and rent from data
  const priceField = document.getElementById('rc-price');
  const rentField  = document.getElementById('rc-long-rent');
  const sqm        = +document.getElementById('rc-sqm').value || 70;
  if (priceField) { priceField.value = Math.round(r.price * sqm); updateVal('rc-price', Math.round(r.price * sqm).toLocaleString('ru') + ' €'); }
  if (rentField)  { rentField.value  = Math.round(r.rent  * sqm); updateVal('rc-long-rent', Math.round(r.rent  * sqm).toLocaleString('ru') + ' €'); }
  calcRental();
}

function setStrategy(s, btn) {
  currentStrategy = s;
  document.querySelectorAll('.strategy-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('rc-live-section').style.display    = s === 'live'     ? 'block' : 'none';
  document.getElementById('rc-rentout-section').style.display = s === 'rent_out' ? 'block' : 'none';
  document.getElementById('rc-airbnb-section').style.display  = s === 'airbnb'   ? 'block' : 'none';
  calcRental();
}

function updateVal(id, val) {
  const el = document.getElementById(id + '-val');
  if (el) el.textContent = val;
}

function fmtE(n) { return Math.round(n).toLocaleString('ru') + ' €'; }
function fmtPct(n) { return n.toFixed(1) + '%'; }

function calcRental() {
  // ---- inputs ----
  const price       = +document.getElementById('rc-price').value           || 300000;
  const sqm         = +document.getElementById('rc-sqm').value             || 70;
  const downPct     = (+document.getElementById('rc-down-pct').value       || 20) / 100;
  const mortgRate   = (+document.getElementById('rc-mort-rate').value      || 3.2) / 100;
  const mortgTerm   = +document.getElementById('rc-mort-term').value       || 25;
  const itpPct      = (+document.getElementById('rc-itp-pct').value        || 8) / 100;
  const maintPct    = (+document.getElementById('rc-maint-pct').value      || 1.2) / 100;
  const communityFee= +document.getElementById('rc-community').value       || 80;
  const insurance   = +document.getElementById('rc-insurance').value       || 40;

  // update display values
  updateVal('rc-price',      fmtE(price));
  updateVal('rc-sqm',        sqm + ' м²');
  updateVal('rc-down-pct',   (downPct*100).toFixed(0) + '%');
  updateVal('rc-mort-rate',  (mortgRate*100).toFixed(1) + '%');
  updateVal('rc-mort-term',  mortgTerm + ' лет');
  updateVal('rc-itp-pct',    (itpPct*100).toFixed(0) + '%');
  updateVal('rc-maint-pct',  (maintPct*100).toFixed(1) + '%');
  updateVal('rc-community',  fmtE(communityFee) + '/мес');
  updateVal('rc-insurance',  fmtE(insurance) + '/мес');

  // ---- mortgage payment ----
  const loan = price * (1 - downPct);
  const mRate = mortgRate / 12;
  const nPay  = mortgTerm * 12;
  const monthlyMortgage = loan * (mRate * Math.pow(1+mRate, nPay)) / (Math.pow(1+mRate, nPay) - 1);

  // ---- fixed monthly costs (same for all strategies) ----
  const ibiMonthly   = price * 0.005 / 12;          // IBI ~0.5%/год
  const maintMonthly = price * maintPct / 12;
  const fixedCosts   = ibiMonthly + maintMonthly + communityFee + insurance;

  let grossIncome = 0, taxRate = 0, vacancyLoss = 0, mgmtCost = 0;
  let netIncome = 0, netCashflow = 0;

  if (currentStrategy === 'live') {
    // живу сам — доходов нет, считаем просто стоимость владения
    netCashflow = -(monthlyMortgage + fixedCosts);
    renderLiveSummary(monthlyMortgage, fixedCosts, price, downPct, itpPct);
    renderCashflowChart(monthlyMortgage, 0, fixedCosts, mortgTerm);
    return;
  }

  if (currentStrategy === 'rent_out') {
    const longRent    = +document.getElementById('rc-long-rent').value    || 1200;
    const vacancyPct  = (+document.getElementById('rc-vacancy').value     || 5) / 100;
    const mgmtPct     = (+document.getElementById('rc-mgmt-pct').value    || 0) / 100;
    const taxStatus   = document.getElementById('rc-tax-status').value    || 'eu';

    updateVal('rc-long-rent', fmtE(longRent) + '/мес');
    updateVal('rc-vacancy',   (vacancyPct*100).toFixed(0) + '%');
    updateVal('rc-mgmt-pct',  (mgmtPct*100).toFixed(0) + '%');

    taxRate   = taxStatus === 'resident' ? 0.19 : taxStatus === 'eu' ? 0.19 : 0.24;
    grossIncome  = longRent * (1 - vacancyPct);
    mgmtCost     = grossIncome * mgmtPct;
    const taxableIncome = grossIncome - mgmtCost - maintMonthly - ibiMonthly - (monthlyMortgage * mortgRate / (mortgRate + 1/nPay)); // approx interest
    const taxAmount  = Math.max(0, taxableIncome * taxRate);
    netIncome    = grossIncome - mgmtCost - taxAmount;
    netCashflow  = netIncome - monthlyMortgage - fixedCosts;

    renderRentOutSummary({
      grossIncome, mgmtCost, taxAmount, taxRate, netIncome,
      monthlyMortgage, fixedCosts, netCashflow,
      price, downPct, itpPct, longRent, vacancyPct, mortgTerm
    });
    renderCashflowChart(monthlyMortgage, netIncome, fixedCosts, mortgTerm);
    return;
  }

  if (currentStrategy === 'airbnb') {
    const nightRate   = +document.getElementById('rc-night-rate').value   || 120;
    const occupancy   = (+document.getElementById('rc-occupancy').value   || 65) / 100;
    const platformPct = (+document.getElementById('rc-platform-pct').value|| 20) / 100;
    const taxStatus   = document.getElementById('rc-tax-status-airbnb').value || 'eu';

    updateVal('rc-night-rate',   fmtE(nightRate) + '/ночь');
    updateVal('rc-occupancy',    (occupancy*100).toFixed(0) + '%');
    updateVal('rc-platform-pct', (platformPct*100).toFixed(0) + '%');

    taxRate      = taxStatus === 'resident' ? 0.21 : taxStatus === 'eu' ? 0.19 : 0.24;
    grossIncome  = nightRate * 30 * occupancy;
    const platformCost = grossIncome * platformPct;
    const taxAmount    = (grossIncome - platformCost - maintMonthly) * taxRate;
    netIncome    = grossIncome - platformCost - taxAmount;
    netCashflow  = netIncome - monthlyMortgage - fixedCosts;

    renderAirbnbSummary({
      grossIncome, platformCost, taxAmount, taxRate, netIncome,
      monthlyMortgage, fixedCosts, netCashflow,
      price, downPct, itpPct, nightRate, occupancy, mortgTerm
    });
    renderCashflowChart(monthlyMortgage, netIncome, fixedCosts, mortgTerm);
  }
}

function renderLiveSummary(mortgage, fixed, price, downPct, itpPct) {
  const totalEntry = price * downPct + price * itpPct + price * 0.015;
  const totalMonthly = mortgage + fixed;
  document.getElementById('rc-summary').innerHTML = `
    <div class="grid-4" style="margin-bottom:16px;">
      <div class="card-sm"><div class="metric-label">Ипотека / мес</div><div class="metric-val">${fmtE(mortgage)}</div></div>
      <div class="card-sm"><div class="metric-label">Прочие расходы / мес</div><div class="metric-val">${fmtE(fixed)}</div></div>
      <div class="card-sm"><div class="metric-label">Итого расходов / мес</div><div class="metric-val red">${fmtE(totalMonthly)}</div></div>
      <div class="card-sm"><div class="metric-label">Расходы при входе</div><div class="metric-val">${fmtE(totalEntry)}</div></div>
    </div>
    <div class="verdict warn">
      <div class="verdict-title">Вы живёте в своей квартире</div>
      <div class="verdict-detail">Ежемесячные расходы: ${fmtE(totalMonthly)} · Расходы при покупке: ${fmtE(totalEntry)} · Актив растёт в цене параллельно</div>
    </div>
  `;
}

function renderRentOutSummary(d) {
  const grossYield = (d.grossIncome * 12) / d.price * 100;
  const netYield   = (d.netIncome  * 12) / d.price * 100;
  const cfClass    = d.netCashflow >= 0 ? 'green' : 'red';
  const cfVerdict  = d.netCashflow >= 0 ? 'buy' : 'rent';
  const coverage   = Math.min(100, (d.netIncome / (d.monthlyMortgage + d.fixedCosts)) * 100);
  const entryTotal = d.price * d.downPct + d.price * d.itpPct + d.price * 0.015;
  const annualCF   = d.netCashflow * 12;
  const cocReturn  = (annualCF / entryTotal) * 100;

  document.getElementById('rc-summary').innerHTML = `
    <div class="grid-4" style="margin-bottom:16px;">
      <div class="card-sm"><div class="metric-label">Доход от аренды / мес</div><div class="metric-val green">${fmtE(d.grossIncome)}</div></div>
      <div class="card-sm"><div class="metric-label">Расходы / мес</div><div class="metric-val">${fmtE(d.monthlyMortgage + d.fixedCosts)}</div></div>
      <div class="card-sm"><div class="metric-label">Чистый CF / мес</div><div class="metric-val ${cfClass}">${d.netCashflow >= 0 ? '+' : ''}${fmtE(d.netCashflow)}</div></div>
      <div class="card-sm"><div class="metric-label">Чистая доходность</div><div class="metric-val gold">${fmtPct(netYield)}</div></div>
    </div>
    <div class="grid-3" style="margin-bottom:16px;">
      <div class="card-sm"><div class="metric-label">Валовая доходность</div><div class="metric-val">${fmtPct(grossYield)}</div></div>
      <div class="card-sm"><div class="metric-label">Cash-on-cash доходность</div><div class="metric-val">${fmtPct(cocReturn)}/год</div></div>
      <div class="card-sm"><div class="metric-label">Покрытие ипотеки арендой</div>
        <div style="font-size:16px;font-weight:500;color:${coverage>=100?'var(--green)':'var(--accent)'};">${Math.round(coverage)}%</div>
        <div class="cf-bar-wrap"><div class="cf-bar-fill" style="width:${Math.min(100,coverage)}%;background:${coverage>=100?'var(--green)':'var(--accent)'};"></div></div>
      </div>
    </div>
    <div class="card" style="font-size:13px;margin-bottom:16px;">
      <div style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Разбивка доходов и расходов / месяц</div>
      ${rows([
        ['Валовый доход от аренды',   '+' + fmtE(d.grossIncome),          'var(--green)'],
        ['— Управляющая компания',    '−' + fmtE(d.mgmtCost),             'var(--muted)'],
        ['— Налог ('+fmtPct(d.taxRate*100)+')',     '−' + fmtE(d.taxAmount),           'var(--muted)'],
        ['= Чистый доход',            fmtE(d.netIncome),                   'var(--text)'],
        ['---'],
        ['— Ипотека',                 '−' + fmtE(d.monthlyMortgage),      'var(--muted)'],
        ['— IBI + содержание',        '−' + fmtE(d.fixedCosts),           'var(--muted)'],
        ['= Чистый денежный поток',   (d.netCashflow>=0?'+':'')+fmtE(d.netCashflow), d.netCashflow>=0?'var(--green)':'var(--red)'],
      ])}
    </div>
    <div class="verdict ${cfVerdict}">
      <div class="verdict-title">${d.netCashflow >= 0 ? 'Положительный денежный поток' : 'Отрицательный денежный поток'}</div>
      <div class="verdict-detail">${d.netCashflow >= 0
        ? 'Аренда полностью покрывает ипотеку и приносит ' + fmtE(d.netCashflow) + '/мес прибыли. Плюс рост стоимости квартиры.'
        : 'Дефицит ' + fmtE(Math.abs(d.netCashflow)) + '/мес — вы доплачиваете из своего кармана. Но квартира растёт в цене.'
      }</div>
    </div>
  `;
}

function renderAirbnbSummary(d) {
  const grossYield = (d.grossIncome * 12) / d.price * 100;
  const netYield   = (d.netIncome  * 12) / d.price * 100;
  const cfClass    = d.netCashflow >= 0 ? 'green' : 'red';
  const cfVerdict  = d.netCashflow >= 0 ? 'buy' : 'rent';
  const annualNights = Math.round(d.occupancy * 365);

  document.getElementById('rc-summary').innerHTML = `
    <div class="grid-4" style="margin-bottom:16px;">
      <div class="card-sm"><div class="metric-label">Доход Airbnb / мес</div><div class="metric-val green">${fmtE(d.grossIncome)}</div></div>
      <div class="card-sm"><div class="metric-label">Ночей в год</div><div class="metric-val">${annualNights}</div></div>
      <div class="card-sm"><div class="metric-label">Чистый CF / мес</div><div class="metric-val ${cfClass}">${d.netCashflow>=0?'+':''}${fmtE(d.netCashflow)}</div></div>
      <div class="card-sm"><div class="metric-label">Чистая доходность</div><div class="metric-val gold">${fmtPct(netYield)}</div></div>
    </div>
    <div class="card" style="font-size:13px;margin-bottom:16px;">
      <div style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Разбивка / месяц</div>
      ${rows([
        ['Gross Airbnb доход',         '+' + fmtE(d.grossIncome),      'var(--green)'],
        ['— Платформа + уборка',       '−' + fmtE(d.platformCost),    'var(--muted)'],
        ['— Налог ('+fmtPct(d.taxRate*100)+')',  '−' + fmtE(d.taxAmount),      'var(--muted)'],
        ['= Чистый доход',             fmtE(d.netIncome),              'var(--text)'],
        ['---'],
        ['— Ипотека',                  '−' + fmtE(d.monthlyMortgage), 'var(--muted)'],
        ['— IBI + содержание',         '−' + fmtE(d.fixedCosts),      'var(--muted)'],
        ['= Чистый денежный поток',    (d.netCashflow>=0?'+':'')+fmtE(d.netCashflow), d.netCashflow>=0?'var(--green)':'var(--red)'],
      ])}
    </div>
    <div class="verdict ${cfVerdict}">
      <div class="verdict-title">${d.netCashflow >= 0 ? 'Airbnb покрывает ипотеку' : 'Отрицательный денежный поток'}</div>
      <div class="verdict-detail">Важно: для краткосрочной аренды нужна туристическая лицензия. В Барселоне и Мадриде новые лицензии практически не выдаются.</div>
    </div>
  `;
}

function rows(data) {
  return data.map(([k, v, c]) =>
    k === '---'
      ? `<div style="height:1px;background:var(--border);margin:8px 0;"></div>`
      : `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(42,45,53,0.4);">
           <span style="color:var(--muted);">${k}</span>
           <span style="font-weight:500;color:${c||'var(--text)'};">${v}</span>
         </div>`
  ).join('');
}

function renderCashflowChart(mortgage, income, fixed, years) {
  const canvas = document.getElementById('rc-cf-chart');
  if (!canvas) return;
  if (rentalChartInst) { rentalChartInst.destroy(); rentalChartInst = null; }

  const labels = [], cfData = [], cumData = [];
  let cumCF = 0;
  for (let y = 1; y <= Math.min(years, 30); y++) {
    labels.push('Год ' + y);
    const inc = income * Math.pow(1.03, y-1);  // +3% рост аренды
    const mort = y <= years ? mortgage : 0;
    const cf = inc - mort - fixed;
    cumCF += cf * 12;
    cfData.push(Math.round(cf));
    cumData.push(Math.round(cumCF));
  }

  rentalChartInst = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'CF / мес',
          data: cfData,
          backgroundColor: cfData.map(v => v >= 0 ? 'rgba(92,184,138,0.7)' : 'rgba(224,92,92,0.7)'),
          borderWidth: 0,
          yAxisID: 'y',
        },
        {
          label: 'Накопленный CF',
          data: cumData,
          type: 'line',
          borderColor: '#c9a84c',
          backgroundColor: 'transparent',
          tension: 0.3,
          pointRadius: 2,
          borderWidth: 2,
          yAxisID: 'y2',
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString('ru')} €` } }
      },
      scales: {
        x:  { ticks: { color: '#8a8f9e', font: { size: 10 }, maxTicksLimit: 10 }, grid: { display: false } },
        y:  { ticks: { color: '#8a8f9e', font: { size: 10 }, callback: v => v >= 0 ? '+' + Math.round(v) : Math.round(v) }, grid: { color: 'rgba(255,255,255,0.04)' }, position: 'left' },
        y2: { ticks: { color: '#c9a84c', font: { size: 10 }, callback: v => (v/1000).toFixed(0) + 'k' }, grid: { display: false }, position: 'right' }
      }
    }
  });
}
