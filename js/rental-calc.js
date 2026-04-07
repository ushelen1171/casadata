// ============================================================
// rental-calc.js — Калькулятор 2: Доход от недвижимости (v3)
// 4 стратегии: живу сам | сдаю | airbnb | индексный фонд
// ============================================================

let c2Chart  = null;
let c2Horizon = 20;
let c2PropertyType = 'secondary';

// ---- Tax helpers ----
function getRentalTaxRate(status) {
  return status === 'noneu' ? 0.24 : 0.19;
}

// Испанский резидент: месячная сумма вычетов из арендного дохода
// Правила (IRPF): вычитается ТОЛЬКО процентная часть ипотеки (не тело долга),
// амортизация — 3% от стоимости СТРОИТЕЛЬСТВА (≈50% от цены, без земли),
// плюс IBI, страховка, содержание.
function calcMonthlyResidentDeductions(propVal, interestThisMonth, maintMo) {
  const monthlyIBI          = propVal * 0.005 / 12;          // IBI ~0.5% в год
  const monthlyInsurance    = propVal * 0.001 / 12;          // страховка ~0.1% в год
  // Амортизация: 3% от стоимости строительства (исключая землю ≈ 50% от цены)
  const monthlyDepreciation = propVal * 0.50 * 0.03 / 12;
  // Проценты: ТОЛЬКО процентная часть платежа этого месяца (тело долга — не вычитается)
  const deductibleInterest  = interestThisMonth;
  return monthlyIBI + monthlyInsurance + monthlyDepreciation + deductibleInterest + maintMo;
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
  // night rate: approx 2.5× monthly/30
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
  // Read inputs
  const price    = +document.getElementById('c2-price').value;
  const downPct  = +document.getElementById('c2-down').value / 100;
  const annRate  = +document.getElementById('c2-rate').value / 100;
  const termYrs  = +document.getElementById('c2-term').value;
  const taxPct   = +document.getElementById('c2-tax').value / 100;
  const maint    = +document.getElementById('c2-maint').value / 100;
  const appr     = +document.getElementById('c2-appr').value / 100;
  const longRent = +document.getElementById('c2-long-rent').value;
  const rentg    = +document.getElementById('c2-rentg').value / 100;
  const vacancy  = +document.getElementById('c2-vacancy').value / 100;
  const mgmt     = +document.getElementById('c2-mgmt').value / 100;
  const nightRate= +document.getElementById('c2-night').value;
  const occRate  = +document.getElementById('c2-occ').value / 100;
  const platform = +document.getElementById('c2-platform').value / 100;
  const taxStatus= document.getElementById('c2-tax-status').value;
  const horizon  = c2Horizon;

  // Display labels
  const fmt = v => Math.round(v).toLocaleString('ru');
  document.getElementById('c2v-price').textContent  = fmt(price) + ' €';
  document.getElementById('c2v-down').textContent   = (downPct*100).toFixed(0) + '%';
  document.getElementById('c2v-rate').textContent   = (annRate*100).toFixed(1) + '%';
  document.getElementById('c2v-term').textContent   = termYrs + ' лет';
  document.getElementById('c2v-tax').textContent    = (taxPct*100).toFixed(1) + '%';
  document.getElementById('c2v-maint').textContent  = (maint*100).toFixed(1) + '%';
  document.getElementById('c2v-appr').textContent   = (appr*100).toFixed(1) + '%';
  document.getElementById('c2v-long-rent').textContent = fmt(longRent) + ' €';
  document.getElementById('c2v-rentg').textContent  = (rentg*100).toFixed(1) + '%';
  document.getElementById('c2v-vacancy').textContent= (vacancy*100).toFixed(0) + '%';
  document.getElementById('c2v-mgmt').textContent   = (mgmt*100).toFixed(0) + '%';
  document.getElementById('c2v-night').textContent  = fmt(nightRate) + ' €';
  document.getElementById('c2v-occ').textContent    = (occRate*100).toFixed(0) + '%';
  document.getElementById('c2v-platform').textContent = (platform*100).toFixed(0) + '%';

  // Down payment amount
  const downAmt = price * downPct;
  const taxAmt  = price * taxPct;
  document.getElementById('c2v-down-amt').textContent = '= ' + fmt(downAmt) + ' €';

  // Mortgage
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

  const initialCash = downAmt + taxAmt;  // total day-1 outlay

  // Airbnb monthly gross
  const airbnbGross = nightRate * occRate * 365 / 12;

  // Tax rate
  const tRate = getRentalTaxRate(taxStatus);

  // ----------------------------------------------------------------
  // Simulate 4 strategies over `horizon` years (monthly)
  // All strategies start with the same property and initialCash outlay
  // ----------------------------------------------------------------
  const labels = [];

  // Strategy data arrays (equity = propVal - loanBal + cumulative cashflow reinvested)
  // We track "net wealth" = property equity + accumulated cashflow (invested at 0%)
  // For index: portfolio grows at invRate (7%), starting with initialCash
  const INV_RATE = 0.07; // 7% p.a. for index benchmark

  // Per-strategy state
  const strategies = {
    live:   { equity: [], cashflows: [], loanBal: loan, propVal: price, cumCF: 0 },
    rent:   { equity: [], cashflows: [], loanBal: loan, propVal: price, cumCF: 0 },
    airbnb: { equity: [], cashflows: [], loanBal: loan, propVal: price, cumCF: 0 },
    index:  { equity: [], cashflows: [], portfolio: initialCash },
  };

  let rent = longRent;
  let airbnb = airbnbGross;

  // snapshot at year 0
  Object.keys(strategies).forEach(k => {
    if (k === 'index') strategies[k].equity.push(Math.round(strategies[k].portfolio));
    else strategies[k].equity.push(Math.round(strategies[k].propVal - strategies[k].loanBal));
  });
  labels.push(t('c1_now') || 'Сейчас');

  let firstYearRentCF = null;
  let firstYearAirbnbCF = null;
  let residentDeductionsExceededCount = 0; // сколько месяцев вычеты > дохода

  for (let y = 0; y < horizon; y++) {
    // monthly
    for (let m = 0; m < 12; m++) {
      const mo = y * 12 + m;

      // ── Ипотека: сначала считаем ПРОЦЕНТНУЮ часть (до уменьшения остатка) ──
      let payment         = 0;
      let interestThisMo  = 0;  // только проценты — идут в вычет для резидента
      if (mo < nPay && strategies.live.loanBal > 0) {
        interestThisMo        = strategies.live.loanBal * mRate;           // % часть
        const principal       = Math.min(monthlyMortgage - interestThisMo, strategies.live.loanBal); // тело долга (не вычитается)
        strategies.live.loanBal   = Math.max(0, strategies.live.loanBal - principal);
        strategies.rent.loanBal   = strategies.live.loanBal;
        strategies.airbnb.loanBal = strategies.live.loanBal;
        payment = monthlyMortgage;
      }

      // Содержание (% от текущей стоимости объекта)
      const maintMo = strategies.live.propVal * maint / 12;

      // ── «Живу сам»: только расходы ──
      strategies.live.cumCF -= (payment + maintMo);

      // ── «Покупаю и сдаю»: доход от аренды минус расходы и налог ──
      const rentGross    = rent * (1 - vacancy);
      const rentMgmtCost = rentGross * mgmt;
      let rentTax = 0;
      if (taxStatus === 'resident') {
        // IRPF: вычеты = IBI + страховка + амортизация стр.части + ТОЛЬКО проценты + содержание
        const deductions = calcMonthlyResidentDeductions(strategies.rent.propVal, interestThisMo, maintMo);
        const taxBase    = rentGross - deductions;
        if (taxBase > 0) {
          rentTax = taxBase * tRate;
        } else {
          // Вычеты превышают доход — налог 0, фиксируем для сообщения
          residentDeductionsExceededCount++;
        }
      } else {
        // ЕС / нерезидент: вычетов нет, налог на весь доход
        rentTax = rentGross * tRate;
      }
      const rentCF = rentGross - rentMgmtCost - rentTax - payment - maintMo;
      strategies.rent.cumCF += rentCF;

      // ── «Покупаю и сдаю посуточно (Airbnb)» ──
      const airbnbNet = airbnb * (1 - platform);
      let airbnbTax = 0;
      if (taxStatus === 'resident') {
        const deductionsA = calcMonthlyResidentDeductions(strategies.airbnb.propVal, interestThisMo, maintMo);
        const taxBaseA    = airbnbNet - deductionsA;
        airbnbTax = taxBaseA > 0 ? taxBaseA * tRate : 0;
      } else {
        airbnbTax = airbnbNet * tRate;
      }
      const airbnbCF = airbnbNet - airbnbTax - payment - maintMo;
      strategies.airbnb.cumCF += airbnbCF;

      // ── Индекс: ежемесячное компаундирование ──
      strategies.index.portfolio *= (1 + INV_RATE / 12);

      // Фиксируем CF за первый год для карточек
      if (y === 0) {
        if (firstYearRentCF   === null) firstYearRentCF   = 0;
        if (firstYearAirbnbCF === null) firstYearAirbnbCF = 0;
        firstYearRentCF   += rentCF;
        firstYearAirbnbCF += airbnbCF;
      }
    }

    // Annual: appreciate property and rent
    strategies.live.propVal   *= (1 + appr);
    strategies.rent.propVal   = strategies.live.propVal;
    strategies.airbnb.propVal = strategies.live.propVal;
    rent    *= (1 + rentg);
    airbnb  *= (1 + rentg);

    // Snapshot equity (propVal - loanBal + cumulative cashflow for buy strategies)
    strategies.live.equity.push(Math.round(strategies.live.propVal - strategies.live.loanBal + strategies.live.cumCF));
    strategies.rent.equity.push(Math.round(strategies.rent.propVal - strategies.rent.loanBal + strategies.rent.cumCF));
    strategies.airbnb.equity.push(Math.round(strategies.airbnb.propVal - strategies.airbnb.loanBal + strategies.airbnb.cumCF));
    strategies.index.equity.push(Math.round(strategies.index.portfolio));
    labels.push(`${t('c1_year')||'Год'} ${y + 1}`);
  }

  // ---- Summary cards ----
  const finalEquity = {
    live:   strategies.live.equity[horizon],
    rent:   strategies.rent.equity[horizon],
    airbnb: strategies.airbnb.equity[horizon],
    index:  strategies.index.equity[horizon],
  };

  const names = {
    live:   t('c2_s_live')   || 'Живу сам',
    rent:   t('c2_s_rent')   || 'Сдаю',
    airbnb: t('c2_s_airbnb') || 'Airbnb',
    index:  t('c2_s_index')  || 'Индекс',
  };

  const bestKey = Object.keys(finalEquity).reduce((a,b) => finalEquity[a] > finalEquity[b] ? a : b);
  const bestVal = finalEquity[bestKey];
  const roiAnn  = (Math.pow(bestVal / initialCash, 1 / horizon) - 1) * 100;

  // Year that buy-and-rent beats index
  let beatsIndexYear = null;
  for (let y = 1; y <= horizon; y++) {
    if (strategies.rent.equity[y] > strategies.index.equity[y]) {
      beatsIndexYear = y;
      break;
    }
  }

  const avgRentMoCF   = firstYearRentCF !== null ? firstYearRentCF / 12 : 0;
  const avgAirbnbMoCF = firstYearAirbnbCF !== null ? firstYearAirbnbCF / 12 : 0;
  const bestMoCF = bestKey === 'airbnb' ? avgAirbnbMoCF : avgRentMoCF;

  document.getElementById('c2-best').textContent     = names[bestKey];
  document.getElementById('c2-best-sub').textContent = fmt(bestVal) + ' € / ' + horizon + ' ' + (t('c1_years')||'лет');
  document.getElementById('c2-cashflow').textContent = (avgRentMoCF >= 0 ? '+' : '') + fmt(avgRentMoCF) + ' €';
  document.getElementById('c2-beats').textContent    = beatsIndexYear ? beatsIndexYear + ' ' + (t('c1_years')||'лет') : '>' + horizon;
  document.getElementById('c2-roi').textContent      = roiAnn.toFixed(1) + '%';

  // ---- Comparison table ----
  const tbody = document.getElementById('c2-table-body');
  if (tbody) {
    const rowData = [
      { key: 'live',   color: '#4a90d9' },
      { key: 'rent',   color: '#c9a84c' },
      { key: 'airbnb', color: '#e8955a' },
      { key: 'index',  color: '#5cb88a' },
    ];
    tbody.innerHTML = rowData.map(({ key, color }) => {
      const eq5  = strategies[key].equity[Math.min(5,  horizon)];
      const eq10 = strategies[key].equity[Math.min(10, horizon)];
      const eq20 = strategies[key].equity[Math.min(20, horizon)];
      const roi  = (Math.pow(finalEquity[key] / initialCash, 1 / horizon) - 1) * 100;
      const isWinner = key === bestKey;
      return `<tr style="${isWinner ? 'background:rgba(201,168,76,0.08);' : ''}">
        <td style="color:${color};font-weight:500;">${names[key]}${isWinner ? ' 🏆' : ''}</td>
        <td>${eq5  !== undefined ? fmt(eq5)  : '—'} €</td>
        <td>${eq10 !== undefined ? fmt(eq10) : '—'} €</td>
        <td>${eq20 !== undefined ? fmt(eq20) : '—'} €</td>
        <td>${roi.toFixed(1)}%</td>
      </tr>`;
    }).join('');
  }

  // ---- Chart ----
  drawCalc2Chart(labels, strategies, horizon);

  // ---- Auto-summary ----
  buildCalc2Summary(names, bestKey, finalEquity, beatsIndexYear, avgRentMoCF, avgAirbnbMoCF, horizon, initialCash, roiAnn, taxStatus, residentDeductionsExceededCount);
}

function drawCalc2Chart(labels, strategies, horizon) {
  const canvas = document.getElementById('rc-cf-chart');
  if (!canvas) return;
  if (c2Chart) { c2Chart.destroy(); c2Chart = null; }

  c2Chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: t('c2_s_live') || 'Живу сам',
          data: strategies.live.equity,
          borderColor: '#4a90d9',
          backgroundColor: 'transparent',
          tension: 0.35, pointRadius: 2, borderWidth: 2,
        },
        {
          label: t('c2_s_rent') || 'Сдаю',
          data: strategies.rent.equity,
          borderColor: '#c9a84c',
          backgroundColor: 'transparent',
          tension: 0.35, pointRadius: 2, borderWidth: 2,
        },
        {
          label: t('c2_s_airbnb') || 'Airbnb',
          data: strategies.airbnb.equity,
          borderColor: '#e8955a',
          backgroundColor: 'transparent',
          tension: 0.35, pointRadius: 2, borderWidth: 2,
        },
        {
          label: t('c2_s_index') || 'Индекс (7%)',
          data: strategies.index.equity,
          borderColor: '#5cb88a',
          backgroundColor: 'transparent',
          borderDash: [6, 3],
          tension: 0.35, pointRadius: 2, borderWidth: 2,
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
          labels: { color: '#8a8f9e', boxWidth: 14, font: { size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString('ru')} €`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8a8f9e', font: { size: 11 }, maxTicksLimit: 8 },
          grid: { color: 'rgba(255,255,255,0.04)' }
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

function buildCalc2Summary(names, bestKey, finalEquity, beatsIndexYear, avgRentCF, avgAirbnbCF, horizon, initialCash, roiAnn, taxStatus, deductionsExceededCount) {
  const el = document.getElementById('c2-summary-text');
  if (!el) return;
  const fmt = v => Math.round(v).toLocaleString('ru');
  const beatsStr = beatsIndexYear
    ? `${t('c2_sum_beats')||'Стратегия «Сдаю» обгоняет индексный фонд на год'} ${beatsIndexYear}.`
    : `${t('c2_sum_no_beats')||'Стратегия «Сдаю» не обгоняет индекс за указанный период.'}`;

  // Пояснение о вычетах для резидентов
  let deductionNote = '';
  if (taxStatus === 'resident' && deductionsExceededCount > 0) {
    const totalMonths = horizon * 12;
    const pct = Math.round(deductionsExceededCount / totalMonths * 100);
    deductionNote = `<br><span style="color:var(--muted);font-size:12px;">
      ℹ ${t('c2_deductions_exceed')||'Вычеты превышают арендный доход'} в ${deductionsExceededCount} ${t('c2_months_of')||'мес. из'} ${totalMonths}
      (${pct}%) — ${t('c2_tax_zero_note')||'налог IRPF в эти месяцы = 0 €. Базовый сценарий: крупная ипотека + амортизация перекрывают доход.'}
    </span>`;
  }

  el.innerHTML = `<strong>${t('c1_sum_intro')||'Вывод:'}</strong>
    ${t('c2_sum_best')||'Лучшая стратегия за'} <strong>${horizon} ${t('c1_years')||'лет'}</strong> —
    <strong>${names[bestKey]}</strong> (${fmt(finalEquity[bestKey])} €, ROI ${roiAnn.toFixed(1)}% ${t('c1_per_year')||'годовых'}).
    ${t('c2_sum_rent_cf')||'Cashflow от долгосрочной аренды (год 1):'} <strong>${(avgRentCF>=0?'+':'') + fmt(avgRentCF)} €/мес</strong>.
    ${t('c2_sum_airbnb_cf')||'Cashflow Airbnb (год 1):'} <strong>${(avgAirbnbCF>=0?'+':'') + fmt(avgAirbnbCF)} €/мес</strong>.
    ${beatsStr}${deductionNote}`;
}
