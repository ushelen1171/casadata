// ============================================================
// rental-calc.js — Калькулятор 2: Доход от недвижимости (v4)
// 3 стратегии + индексный фонд: живу сам | сдаю | посуточно
// ============================================================

let c2Chart         = null;
let c2CashflowChart = null;
let c2Horizon       = 20;
let c2PropertyType  = 'secondary';
let c2ActiveStrategy = 'rent';
let c2ComputedData  = null;

// ---- Tax helpers ----
function getRentalTaxRate(status) {
  return status === 'noneu' ? 0.24 : 0.19;
}

// Вычеты для испанского резидента (IRPF):
// амортизация 3% от строительной части (65% цены, без земли)
function calcMonthlyResidentDeductions(propVal, interestThisMonth, maintMo) {
  const monthlyIBI          = propVal * 0.005 / 12;       // IBI ~0.5%/год
  const monthlyInsurance    = propVal * 0.001 / 12;       // страховка ~0.1%/год
  const monthlyDepreciation = propVal * 0.65 * 0.03 / 12; // амортизация 3% × 65%
  return monthlyIBI + monthlyInsurance + monthlyDepreciation + interestThisMonth + maintMo;
}

// ---- Strategy tab ----
function setStrategy2(strategy, btn) {
  c2ActiveStrategy = strategy;
  document.querySelectorAll('#c2-strategy-btns .calc-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  updateC2Display();
}

function updateC2Display() {
  const cfSection = document.getElementById('c2-cf-section');
  if (!cfSection || !c2ComputedData) return;
  const showCF = c2ActiveStrategy === 'rent' || c2ActiveStrategy === 'airbnb';
  cfSection.style.display = showCF ? '' : 'none';
  if (showCF) {
    drawC2CashflowChart(c2ActiveStrategy);
    updateC2MiniCards(c2ActiveStrategy);
    updateC2ResultCards(c2ActiveStrategy);
  }
}

// ---- Init / Region ----
function initRentalCalc() {
  const sel = document.getElementById('c2-region');
  if (!sel) return;
  if (sel.options.length <= 1) {
    REGIONS.forEach(r => {
      const o = document.createElement('option');
      o.value = r.id; o.textContent = r.name;
      sel.appendChild(o);
    });
  }
  calcRental();
}

function onCalc2RegionChange() {
  const id = document.getElementById('c2-region').value;
  if (!id) return;
  const r = REGIONS.find(x => x.id === id);
  if (!r) return;
  const sqm = 70;
  document.getElementById('c2-price').value     = Math.round(r.price * sqm / 5000) * 5000;
  document.getElementById('c2-long-rent').value = Math.round(r.rent * sqm / 50) * 50;
  document.getElementById('c2-night').value = Math.round(r.rent * sqm / 30 * 2.5 / 5) * 5;
  const tax = c2PropertyType === 'new' ? 12.5 : (r.itp + 0.015) * 100;
  document.getElementById('c2-tax').value = tax.toFixed(1);
  calcRental();
}

function setPropertyType2(type, btn) {
  c2PropertyType = type;
  document.querySelectorAll('#c2-proptype-btns .calc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const id = document.getElementById('c2-region').value;
  if (id) {
    const r = REGIONS.find(x => x.id === id);
    if (r) {
      const tax = type === 'new' ? 12.5 : (r.itp + 0.015) * 100;
      document.getElementById('c2-tax').value = tax.toFixed(1);
    }
  } else {
    document.getElementById('c2-tax').value = type === 'new' ? '12.5' : '7.5';
  }
  calcRental();
}

function setHorizon2(years, btn) {
  c2Horizon = years;
  document.querySelectorAll('#c2-horizon-btns .calc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  calcRental();
}

// ---- Main calculation ----
function calcRental() {
  const price     = +document.getElementById('c2-price').value;
  const downPct   = +document.getElementById('c2-down').value / 100;
  const annRate   = +document.getElementById('c2-rate').value / 100;
  const termYrs   = +document.getElementById('c2-term').value;
  const taxPct    = +document.getElementById('c2-tax').value / 100;
  const maint     = +document.getElementById('c2-maint').value / 100;
  const appr      = +document.getElementById('c2-appr').value / 100;
  const longRent  = +document.getElementById('c2-long-rent').value;
  const rentg     = +document.getElementById('c2-rentg').value / 100;
  const vacancy   = +document.getElementById('c2-vacancy').value / 100;
  const mgmt      = +document.getElementById('c2-mgmt').value / 100;
  const nightRate = +document.getElementById('c2-night').value;
  const occRate   = +document.getElementById('c2-occ').value / 100;
  const platform  = +document.getElementById('c2-platform').value / 100;
  const taxStatus = document.getElementById('c2-tax-status').value;
  const horizon   = c2Horizon;

  const fmt = v => Math.round(v).toLocaleString('ru');
  document.getElementById('c2v-price').textContent     = fmt(price) + ' €';
  document.getElementById('c2v-down').textContent      = (downPct*100).toFixed(0) + '%';
  document.getElementById('c2v-rate').textContent      = (annRate*100).toFixed(1) + '%';
  document.getElementById('c2v-term').textContent      = termYrs + ' лет';
  document.getElementById('c2v-tax').textContent       = (taxPct*100).toFixed(1) + '%';
  document.getElementById('c2v-maint').textContent     = (maint*100).toFixed(1) + '%';
  document.getElementById('c2v-appr').textContent      = (appr*100).toFixed(1) + '%';
  document.getElementById('c2v-long-rent').textContent = fmt(longRent) + ' €';
  document.getElementById('c2v-rentg').textContent     = (rentg*100).toFixed(1) + '%';
  document.getElementById('c2v-vacancy').textContent   = (vacancy*100).toFixed(0) + '%';
  document.getElementById('c2v-mgmt').textContent      = (mgmt*100).toFixed(0) + '%';
  document.getElementById('c2v-night').textContent     = fmt(nightRate) + ' €';
  document.getElementById('c2v-occ').textContent       = (occRate*100).toFixed(0) + '%';
  document.getElementById('c2v-platform').textContent  = (platform*100).toFixed(0) + '%';

  const downAmt = price * downPct;
  const taxAmt  = price * taxPct;
  document.getElementById('c2v-down-amt').textContent = '= ' + fmt(downAmt) + ' €';

  const loan  = price * (1 - downPct);
  const mRate = annRate / 12;
  const nPay  = termYrs * 12;
  let monthlyMortgage = 0;
  if (annRate > 0 && loan > 0) {
    monthlyMortgage = loan * (mRate * Math.pow(1+mRate,nPay)) / (Math.pow(1+mRate,nPay) - 1);
  } else if (loan > 0) {
    monthlyMortgage = loan / nPay;
  }
  document.getElementById('c2v-rate-pmt').textContent = '≈ ' + fmt(monthlyMortgage) + ' €/мес';

  // Год 0: покупатель стартует с equity, индекс стартует ВЫШЕ (с полной суммой входа)
  const initialCash = downAmt + taxAmt;
  const INV_RATE    = 0.07;
  const tRate       = getRentalTaxRate(taxStatus);
  const airbnbGross0 = nightRate * occRate * 365 / 12;

  // Состояние стратегий
  const s = {
    live:   { loanBal: loan, propVal: price },
    rent:   { loanBal: loan, propVal: price, cumCF: 0, reinvest: 0 },
    airbnb: { loanBal: loan, propVal: price, cumCF: 0 },
    index:  { portfolio: initialCash }, // простой 7% для графика
  };

  // Год 0 — снэпшоты (equity = цена × взнос%, индекс = initialCash)
  const equityLive   = [Math.round(price - loan)];
  const equityRent   = [Math.round(price - loan)];
  const equityAirbnb = [Math.round(price - loan)];
  const equityIndex  = [Math.round(initialCash)];
  const labels       = [t('c1_now') || 'Сейчас'];

  // Массивы помесячного CF для графика 2
  const rentMonthlyCF   = [];
  const airbnbMonthlyCF = [];

  let rent   = longRent;
  let airbnb = airbnbGross0;

  let firstYearNetIncomeRent   = 0;
  let firstYearNetIncomeAirbnb = 0;
  let residentDeductionsExceededCount = 0;

  for (let y = 0; y < horizon; y++) {
    for (let m = 0; m < 12; m++) {
      const mo = y * 12 + m;

      // Помесячный рост цены (все стратегии — одна квартира)
      s.live.propVal *= (1 + appr / 12);
      s.rent.propVal   = s.live.propVal;
      s.airbnb.propVal = s.live.propVal;

      // Амортизация ипотеки
      let payment = 0;
      let interestThisMo = 0;
      if (mo < nPay && s.live.loanBal > 0) {
        interestThisMo = s.live.loanBal * mRate;
        const principal = Math.min(monthlyMortgage - interestThisMo, s.live.loanBal);
        s.live.loanBal   = Math.max(0, s.live.loanBal - principal);
        s.rent.loanBal   = s.live.loanBal;
        s.airbnb.loanBal = s.live.loanBal;
        payment = monthlyMortgage;
      }

      const maintMo = s.live.propVal * maint / 12;

      // ── «Живу сам»: капитал = equity = propVal − loanBal (нет cashflow) ──

      // ── «Покупаю и сдаю» ──
      const rentGross    = rent * (1 - vacancy);
      const rentMgmtCost = rentGross * mgmt;
      let rentTax = 0;
      if (taxStatus === 'resident') {
        const deductions = calcMonthlyResidentDeductions(s.rent.propVal, interestThisMo, maintMo);
        const taxBase    = Math.max(0, rentGross - deductions);
        if (taxBase === 0) residentDeductionsExceededCount++;
        rentTax = taxBase * tRate;
      } else {
        rentTax = rentGross * tRate;
      }
      const rentNetIncome = rentGross - rentMgmtCost - rentTax;
      const rentCF = rentNetIncome - payment - maintMo;
      s.rent.cumCF += rentCF;
      // Реинвестирование положительного CF под 7%
      s.rent.reinvest *= (1 + INV_RATE / 12);
      if (rentCF > 0) s.rent.reinvest += rentCF;
      rentMonthlyCF.push(rentCF);
      if (y === 0) firstYearNetIncomeRent += rentNetIncome;

      // ── «Посуточно» ──
      const airbnbNet = airbnb * (1 - platform);
      let airbnbTax = 0;
      if (taxStatus === 'resident') {
        const deductionsA = calcMonthlyResidentDeductions(s.airbnb.propVal, interestThisMo, maintMo);
        const taxBaseA    = Math.max(0, airbnbNet - deductionsA);
        airbnbTax = taxBaseA * tRate;
      } else {
        airbnbTax = airbnbNet * tRate;
      }
      const airbnbNetIncome = airbnbNet - airbnbTax;
      const airbnbCF = airbnbNetIncome - payment - maintMo;
      s.airbnb.cumCF += airbnbCF;
      airbnbMonthlyCF.push(airbnbCF);
      if (y === 0) firstYearNetIncomeAirbnb += airbnbNetIncome;

      // ── Индекс: простой 7% ──
      s.index.portfolio *= (1 + INV_RATE / 12);

      // Помесячный рост аренды
      rent   *= (1 + rentg / 12);
      airbnb *= (1 + rentg / 12);
    }

    // Годовые снэпшоты капитала
    // «Живу сам»: equity = propVal − loanBal (без cumCF)
    equityLive.push(Math.round(s.live.propVal - s.live.loanBal));
    // «Сдаю»: equity + накопленный CF + реинвест
    equityRent.push(Math.round(s.rent.propVal - s.rent.loanBal + s.rent.cumCF + s.rent.reinvest));
    // «Посуточно»: equity + накопленный CF
    equityAirbnb.push(Math.round(s.airbnb.propVal - s.airbnb.loanBal + s.airbnb.cumCF));
    equityIndex.push(Math.round(s.index.portfolio));
    labels.push(`${t('c1_year')||'Год'} ${y + 1}`);
  }

  // ---- Итоговые значения ----
  const finalEquity = {
    live:   equityLive[horizon],
    rent:   equityRent[horizon],
    airbnb: equityAirbnb[horizon],
    index:  equityIndex[horizon],
  };

  const bestKey = Object.keys(finalEquity).reduce((a,b) => finalEquity[a] > finalEquity[b] ? a : b);
  const roiAnn  = (Math.pow(finalEquity[bestKey] / initialCash, 1 / horizon) - 1) * 100;

  // Когда «Сдаю» обгоняет индекс
  let beatsIndexYear = null;
  for (let y = 1; y <= horizon; y++) {
    if (equityRent[y] > equityIndex[y]) { beatsIndexYear = y; break; }
  }

  const avgRentMoCF   = rentMonthlyCF.slice(0, 12).reduce((a,b) => a+b, 0) / 12;
  const avgAirbnbMoCF = airbnbMonthlyCF.slice(0, 12).reduce((a,b) => a+b, 0) / 12;

  // ---- Карточки сверху ----
  const names = {
    live:   t('c2_s_live')   || 'Живу сам',
    rent:   t('c2_s_rent')   || 'Сдаю',
    airbnb: t('c2_s_airbnb') || 'Посуточно',
    index:  t('c2_s_index')  || 'Индекс',
  };
  document.getElementById('c2-best').textContent     = names[bestKey];
  document.getElementById('c2-best-sub').textContent = fmt(finalEquity[bestKey]) + ' € / ' + horizon + ' ' + (t('c1_years')||'лет');
  document.getElementById('c2-cashflow').textContent = (avgRentMoCF >= 0 ? '+' : '') + fmt(avgRentMoCF) + ' €';
  document.getElementById('c2-beats').textContent    = beatsIndexYear ? beatsIndexYear + ' ' + (t('c1_years')||'лет') : '>' + horizon;
  document.getElementById('c2-roi').textContent      = roiAnn.toFixed(1) + '%';

  // ---- Таблица сравнения ----
  const tbody = document.getElementById('c2-table-body');
  if (tbody) {
    const rowData = [
      { key: 'live',   color: '#4a90d9', eq: equityLive   },
      { key: 'rent',   color: '#c9a84c', eq: equityRent   },
      { key: 'airbnb', color: '#e8955a', eq: equityAirbnb },
      { key: 'index',  color: '#5cb88a', eq: equityIndex  },
    ];
    tbody.innerHTML = rowData.map(({ key, color, eq }) => {
      const roi = (Math.pow(finalEquity[key] / initialCash, 1 / horizon) - 1) * 100;
      const isWinner = key === bestKey;
      return `<tr style="${isWinner ? 'background:rgba(201,168,76,0.08);' : ''}">
        <td style="color:${color};font-weight:500;">${names[key]}${isWinner ? ' 🏆' : ''}</td>
        <td>${eq[Math.min(5,  horizon)] !== undefined ? fmt(eq[Math.min(5,  horizon)]) : '—'} €</td>
        <td>${eq[Math.min(10, horizon)] !== undefined ? fmt(eq[Math.min(10, horizon)]) : '—'} €</td>
        <td>${eq[Math.min(20, horizon)] !== undefined ? fmt(eq[Math.min(20, horizon)]) : '—'} €</td>
        <td>${roi.toFixed(1)}%</td>
      </tr>`;
    }).join('');
  }

  // ---- Сохраняем данные для графика 2 ----
  c2ComputedData = {
    rentMonthlyCF,
    airbnbMonthlyCF,
    initialCash,
    horizon,
    price,
    firstYearNetIncomeRent,
    firstYearNetIncomeAirbnb,
    avgRentMoCF,
    avgAirbnbMoCF,
    equityLive,
    equityRent,
    equityAirbnb,
    equityIndex,
  };

  // ---- Графики ----
  drawCalc2Chart(labels, equityLive, equityRent, equityAirbnb, equityIndex);
  updateC2Display();

  // ---- Текстовое резюме ----
  buildCalc2Summary(names, bestKey, finalEquity, beatsIndexYear, avgRentMoCF, avgAirbnbMoCF, horizon, initialCash, roiAnn, taxStatus, residentDeductionsExceededCount);
}

// ---- График 1: накопление капитала ----
function drawCalc2Chart(labels, equityLive, equityRent, equityAirbnb, equityIndex) {
  const canvas = document.getElementById('rc-cf-chart');
  if (!canvas) return;
  if (c2Chart) { c2Chart.destroy(); c2Chart = null; }

  c2Chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: t('c2_s_live')   || 'Живу сам',    data: equityLive,   borderColor: '#4a90d9', backgroundColor: 'transparent', tension: 0.35, pointRadius: 2, borderWidth: 2 },
        { label: t('c2_s_rent')   || 'Сдаю',        data: equityRent,   borderColor: '#c9a84c', backgroundColor: 'transparent', tension: 0.35, pointRadius: 2, borderWidth: 2 },
        { label: t('c2_s_airbnb') || 'Посуточно',   data: equityAirbnb, borderColor: '#e8955a', backgroundColor: 'transparent', tension: 0.35, pointRadius: 2, borderWidth: 2 },
        { label: t('c2_s_index')  || 'Индекс (7%)', data: equityIndex,  borderColor: '#5cb88a', backgroundColor: 'transparent', borderDash: [6,3], tension: 0.35, pointRadius: 2, borderWidth: 2 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, labels: { color: '#8a8f9e', boxWidth: 14, font: { size: 12 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString('ru')} €` } }
      },
      scales: {
        x: { ticks: { color: '#8a8f9e', font: { size: 11 }, maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: {
          ticks: { color: '#8a8f9e', font: { size: 11 }, callback: v => v >= 1000000 ? (v/1000000).toFixed(1)+'M €' : v >= 1000 ? (v/1000).toFixed(0)+'k €' : v+'€' },
          grid: { color: 'rgba(255,255,255,0.04)' }
        }
      }
    }
  });
}

// ---- График 2: денежный поток / месяц ----
function drawC2CashflowChart(strategy) {
  const data = c2ComputedData;
  if (!data) return;
  const canvas = document.getElementById('rc-cashflow-chart');
  if (!canvas) return;
  if (c2CashflowChart) { c2CashflowChart.destroy(); c2CashflowChart = null; }

  const monthlyCF = strategy === 'rent' ? data.rentMonthlyCF : data.airbnbMonthlyCF;

  // Накопленный CF
  const cumCF = [];
  let running = 0;
  monthlyCF.forEach(cf => { running += cf; cumCF.push(Math.round(running)); });

  // Метки: показываем год каждые 12 месяцев
  const labels = monthlyCF.map((_, i) =>
    i % 12 === 0 ? `${t('c1_year')||'Год'} ${Math.floor(i/12) + 1}` : ''
  );

  // Точки аннотаций
  const cfPositiveMonth = monthlyCF.findIndex(cf => cf >= 0);
  const recoupedMonth   = cumCF.findIndex(c => c >= data.initialCash);

  const annotations = {};
  if (cfPositiveMonth >= 0) {
    const yr = Math.floor(cfPositiveMonth / 12) + 1;
    annotations.cfPositive = {
      type: 'line', xMin: cfPositiveMonth, xMax: cfPositiveMonth,
      borderColor: 'rgba(92,184,138,0.8)', borderWidth: 1.5, borderDash: [4,4],
      label: {
        display: true,
        content: `${t('c1_year')||'Год'} ${yr}: ${t('c2_ann_cf_covers')||'аренда покрывает ипотеку'}`,
        color: '#5cb88a', font: { size: 10 }, position: 'start',
      }
    };
  }
  if (recoupedMonth >= 0) {
    const yr = Math.floor(recoupedMonth / 12) + 1;
    annotations.recouped = {
      type: 'line', xMin: recoupedMonth, xMax: recoupedMonth,
      borderColor: 'rgba(201,168,76,0.8)', borderWidth: 1.5, borderDash: [4,4],
      label: {
        display: true,
        content: `${t('c1_year')||'Год'} ${yr}: ${t('c2_ann_recouped')||'отбили все вложения'}`,
        color: '#c9a84c', font: { size: 10 }, position: 'end',
      }
    };
  }

  c2CashflowChart = new Chart(canvas, {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: t('c2_monthly_cf_label') || 'Денежный поток / мес',
          data: monthlyCF.map(v => Math.round(v)),
          backgroundColor: monthlyCF.map(v => v >= 0 ? 'rgba(92,184,138,0.65)' : 'rgba(224,92,92,0.65)'),
          borderWidth: 0,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: t('c2_cum_cf_label') || 'Накопленный CF',
          data: cumCF,
          borderColor: '#c9a84c',
          backgroundColor: 'transparent',
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2,
          yAxisID: 'y2',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, labels: { color: '#8a8f9e', boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString('ru')} €` } },
        annotation: Object.keys(annotations).length ? { annotations } : {},
      },
      scales: {
        x: {
          ticks: { color: '#8a8f9e', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          position: 'left',
          ticks: { color: '#8a8f9e', font: { size: 11 }, callback: v => v >= 1000 ? (v/1000).toFixed(0)+'k €' : v+'€' },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y2: {
          position: 'right',
          ticks: { color: '#c9a84c', font: { size: 11 }, callback: v => v >= 1000 ? (v/1000).toFixed(0)+'k €' : v+'€' },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });

  // Если нет выхода в плюс — показываем текст под графиком
  const noBreakevenEl = document.getElementById('c2-no-breakeven');
  if (noBreakevenEl) {
    const hasCfPositive = cfPositiveMonth >= 0;
    noBreakevenEl.style.display = hasCfPositive ? 'none' : '';
  }
}

// ---- Три мини-карточки над графиком 2 ----
function updateC2MiniCards(strategy) {
  const data = c2ComputedData;
  if (!data) return;
  const fmt = v => Math.round(v).toLocaleString('ru');
  const monthlyCF = strategy === 'rent' ? data.rentMonthlyCF : data.airbnbMonthlyCF;

  // Всего доплачено (сумма отрицательных CF)
  const totalPaidIn = monthlyCF.filter(cf => cf < 0).reduce((a, cf) => a + Math.abs(cf), 0);

  // Выходит в плюс: первый месяц CF ≥ 0
  const cfPositiveIdx = monthlyCF.findIndex(cf => cf >= 0);
  const cfPositiveYear = cfPositiveIdx >= 0 ? Math.floor(cfPositiveIdx / 12) + 1 : null;

  // Итого: накопленный CF за весь горизонт
  const totalCumCF = monthlyCF.reduce((a, cf) => a + cf, 0);

  const paidEl = document.getElementById('c2-mini-paid');
  const beEl   = document.getElementById('c2-mini-breakeven');
  const totEl  = document.getElementById('c2-mini-total');
  if (paidEl) paidEl.textContent = fmt(totalPaidIn) + ' €';
  if (beEl)   beEl.textContent   = cfPositiveYear
    ? `${t('c1_year')||'Год'} ${cfPositiveYear}`
    : '>' + data.horizon;
  if (totEl)  totEl.textContent  = (totalCumCF >= 0 ? '+' : '') + fmt(totalCumCF) + ' €';
}

// ---- Три карточки результатов ----
function updateC2ResultCards(strategy) {
  const data = c2ComputedData;
  if (!data) return;
  const fmt = v => Math.round(v).toLocaleString('ru');

  const avgMoCF = strategy === 'rent' ? data.avgRentMoCF : data.avgAirbnbMoCF;
  const firstYearNetIncome = strategy === 'rent'
    ? data.firstYearNetIncomeRent
    : data.firstYearNetIncomeAirbnb;

  // Чистая доходность = (чистый доход за год) / цена × 100
  const netYield = data.price > 0 ? (firstYearNetIncome / data.price * 100) : 0;

  // Доходность на вложенные = (CF/мес × 12) / initialCash × 100
  const coc = data.initialCash > 0 ? (avgMoCF * 12 / data.initialCash * 100) : 0;

  const cfEl    = document.getElementById('c2-rc-cf');
  const yldEl   = document.getElementById('c2-rc-yield');
  const cocEl   = document.getElementById('c2-rc-coc');
  if (cfEl)  cfEl.textContent  = (avgMoCF >= 0 ? '+' : '') + fmt(avgMoCF) + ' €';
  if (yldEl) yldEl.textContent = netYield.toFixed(1) + '%';
  if (cocEl) cocEl.textContent = coc.toFixed(1) + '%';
}

// ---- Текстовое резюме ----
function buildCalc2Summary(names, bestKey, finalEquity, beatsIndexYear, avgRentCF, avgAirbnbCF, horizon, initialCash, roiAnn, taxStatus, deductionsExceededCount) {
  const el = document.getElementById('c2-summary-text');
  if (!el) return;
  const fmt = v => Math.round(v).toLocaleString('ru');
  const beatsStr = beatsIndexYear
    ? `${t('c2_sum_beats')||'Стратегия «Сдаю» обгоняет индексный фонд на год'} ${beatsIndexYear}.`
    : `${t('c2_sum_no_beats')||'Стратегия «Сдаю» не обгоняет индекс за указанный период.'}`;

  let deductionNote = '';
  if (taxStatus === 'resident' && deductionsExceededCount > 0) {
    const totalMonths = horizon * 12;
    const pct = Math.round(deductionsExceededCount / totalMonths * 100);
    deductionNote = `<br><span style="color:var(--muted);font-size:12px;">
      ℹ ${t('c2_deductions_exceed')||'Вычеты превышают арендный доход'} в ${deductionsExceededCount} ${t('c2_months_of')||'мес. из'} ${totalMonths}
      (${pct}%) — ${t('c2_tax_zero_note')||'налог IRPF в эти месяцы = 0 €.'}
    </span>`;
  }

  el.innerHTML = `<strong>${t('c1_sum_intro')||'Вывод:'}</strong>
    ${t('c2_sum_best')||'Лучшая стратегия за'} <strong>${horizon} ${t('c1_years')||'лет'}</strong> —
    <strong>${names[bestKey]}</strong> (${fmt(finalEquity[bestKey])} €, ${t('c2_card_roi')||'Доходность'} ${roiAnn.toFixed(1)}% ${t('c1_per_year')||'годовых'}).
    ${t('c2_sum_rent_cf')||'Денежный поток от долгосрочной аренды (год 1):'} <strong>${(avgRentCF>=0?'+':'') + fmt(avgRentCF)} €/мес</strong>.
    ${t('c2_sum_airbnb_cf')||'Денежный поток Airbnb (год 1):'} <strong>${(avgAirbnbCF>=0?'+':'') + fmt(avgAirbnbCF)} €/мес</strong>.
    ${beatsStr}${deductionNote}`;
}
