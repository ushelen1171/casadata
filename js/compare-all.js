// ============================================================
// compare-all.js — сравнение 5 инвестиционных стратегий
// Данные: средние цены и аренда по регионам Испании (Q4 2025)
// Цена квартиры = цена/м² × 70 м² (средняя площадь)
// Аренда = аренда/м²/мес × 70 м²
// ============================================================

let cmpChartInst = null;

const COMPARE_STRATEGIES = {
  'buy_live': { color: '#4a90d9', calc: calcBuyLiveStrategy, i18n: 'buy_live_str' },
  'rent_invest': { color: '#5cb88a', calc: calcRentInvestStrategy, i18n: 'rent_invest_str' },
  'rent_longterm': { color: '#f5a623', calc: calcRentLongtermStrategy, i18n: 'rent_long_str' },
  'buy_renovate': { color: '#8e7cc3', calc: calcRenovateStrategy, i18n: 'buy_renovate_str' },
  'rent_airbnb': { color: '#e94b3c', calc: calcRentAirbnbStrategy, i18n: 'airbnb_str' }
};

function getStrategyLabel(key) {
  const strategy = COMPARE_STRATEGIES[key];
  if (!strategy) return key;
  const raw = t(strategy.i18n || key) || key;
  if (key === 'rent_invest') {
    const mention = currentLang === 'es' ? 'diferencia' : currentLang === 'en' ? 'difference' : 'разницу';
    const wrapped = `<span class="tooltip-trigger" onclick="showTooltip(this)" onmouseover="showTooltip(this)" onmouseout="hideTooltip()" ontouchstart="showTooltip(this)">${mention}</span>`;
    return raw.replace(mention, wrapped);
  }
  return raw;
}

function getStrategyPlainLabel(key) {
  const div = document.createElement('div');
  div.innerHTML = getStrategyLabel(key);
  return div.textContent || div.innerText || '';
}

function initCompare() {
  // Populate region selector
  const sel = document.getElementById('cmp-region-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">Выберите регион...</option>';
  REGIONS.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.name;
    opt.textContent = r.name;
    sel.appendChild(opt);
  });
  sel.value = 'Madrid';
  renderComparison();
}

function showTooltip(element) {
  hideTooltip();
  const popup = document.createElement('div');
  popup.id = 'custom-tooltip';
  popup.className = 'custom-tooltip';
  popup.innerText = t('tooltip_difference');
  document.body.appendChild(popup);

  const rect = element.getBoundingClientRect();
  popup.style.left = Math.min(window.innerWidth - popup.offsetWidth - 10, Math.max(10, rect.left + rect.width / 2 - popup.offsetWidth / 2)) + 'px';
  popup.style.top = (rect.bottom + 8) + 'px';

  requestAnimationFrame(() => popup.classList.add('show'));
}

function hideTooltip() {
  const popup = document.getElementById('custom-tooltip');
  if (!popup) return;
  popup.classList.remove('show');
  setTimeout(() => popup.remove(), 180);
}

function renderComparison() {
  const regionName = document.getElementById('cmp-region-select').value;
  const horizon = +document.getElementById('cmp-horizon').value;
  
  if (!regionName) return;
  
  const region = REGIONS.find(r => r.name === regionName);
  if (!region) return;
  
  // Calculate all 4 strategies
  const results = {};
  Object.entries(COMPARE_STRATEGIES).forEach(([key, strat]) => {
    results[key] = strat.calc(region, horizon);
  });
  
  // Render table
  renderComparisonTable(results, horizon);
  
  // Render chart
  renderComparisonChart(results, horizon, region);
  
  // Render insights
  renderComparisonInsights(results, region, horizon);
}

function calcBuyLiveStrategy(region, horizon) {
  // Вы покупаете квартиру и живите в ней
  const price = region.price * 70; // цена квартиры = цена/м² × 70 м²
  const downPct = 0.20;
  const mortgRate = 0.032;
  const termYears = 25;
  const itpPct = region.itp / 100;
  const maintPct = 0.012;
  const appreciation = 0.03;
  
  const down = price * downPct;
  const loan = price - down;
  const totalEntry = down + price * itpPct + price * 0.015;
  const mRate = mortgRate / 12;
  const nPay = termYears * 12;
  const monthlyMortgage = loan * (mRate * Math.pow(1+mRate, nPay)) / (Math.pow(1+mRate, nPay) - 1);
  const monthlyMaint = price * maintPct / 12;
  
  const data = [];
  let propVal = price, loanBal = loan;
  
  for (let y = 0; y <= horizon; y++) {
    const equity = propVal - loanBal;
    data.push(Math.round(equity));
    
    if (y < horizon) {
      for (let m = 0; m < 12; m++) {
        const interest = loanBal * mRate;
        const principal = y*12+m < nPay ? Math.min(monthlyMortgage - interest, loanBal) : 0;
        loanBal = Math.max(0, loanBal - principal);
      }
      propVal *= (1 + appreciation);
    }
  }
  
  return { data, initialInvest: totalEntry, monthlyOutflow: monthlyMortgage + monthlyMaint };
}

function calcRentInvestStrategy(region, horizon) {
  // Вы снимаете квартиру и инвестируете разницу
  const price = region.price * 70; // цена квартиры = цена/м² × 70 м²
  const downPct = 0.20;
  const mortgRate = 0.032;
  const termYears = 25;
  const itpPct = region.itp / 100;
  
  const rent = region.rent * 70; // аренда = аренда/м²/мес × 70 м²
  const rentGrowth = 0.03;
  const investReturn = 0.07; // доходность инвестиций 7%/год
  
  const down = price * downPct;
  const totalEntry = down + price * itpPct + price * 0.015;
  const loan = price - down;
  const mRate = mortgRate / 12;
  const nPay = termYears * 12;
  const monthlyMortgage = loan * (mRate * Math.pow(1+mRate, nPay)) / (Math.pow(1+mRate, nPay) - 1);
  
  const data = [];
  let portfolio = totalEntry;
  let rentPrice = rent;
  
  for (let y = 0; y <= horizon; y++) {
    data.push(Math.round(portfolio));
    
    if (y < horizon) {
      for (let m = 0; m < 12; m++) {
        const diff = monthlyMortgage - rentPrice;
        portfolio = portfolio * (1 + investReturn/12) - diff;
      }
      rentPrice *= (1 + rentGrowth);
    }
  }
  
  return { data, initialInvest: totalEntry, monthlyOutflow: 0 };
}

function calcRentLongtermStrategy(region, horizon) {
  // Вы сдаёте квартиру долгосрочно
  const price = region.price * 70; // цена квартиры = цена/м² × 70 м²
  const downPct = 0.20;
  const mortgRate = 0.032;
  const termYears = 25;
  const itpPct = region.itp / 100;
  const maintPct = 0.012;
  
  const rent = region.rent * 70; // аренда = аренда/м²/мес × 70 м²
  const rentGrowth = 0.03;
  const vacancyPct = 0.05;
  const taxRate = 0.19;
  const investReturn = 0.07; // доходность инвестиций 7%/год
  
  const down = price * downPct;
  const totalEntry = down + price * itpPct + price * 0.015;
  const loan = price - down;
  const mRate = mortgRate / 12;
  const nPay = termYears * 12;
  const monthlyMortgage = loan * (mRate * Math.pow(1+mRate, nPay)) / (Math.pow(1+mRate, nPay) - 1);
  const monthlyMaint = price * maintPct / 12;
  
  const data = [];
  let propVal = price, loanBal = loan;
  let portfolio = totalEntry;
  let rentPrice = rent;
  
  for (let y = 0; y <= horizon; y++) {
    const equity = propVal - loanBal;
    const totalAssets = equity + portfolio;
    data.push(Math.round(totalAssets));
    
    if (y < horizon) {
      for (let m = 0; m < 12; m++) {
        const interest = loanBal * mRate;
        const principal = y*12+m < nPay ? Math.min(monthlyMortgage - interest, loanBal) : 0;
        loanBal = Math.max(0, loanBal - principal);
        
        const grossIncome = rentPrice * (1 - vacancyPct);
        const taxAmount = Math.max(0, (grossIncome - monthlyMaint - monthlyMortgage * 0.33) * taxRate);
        const netCashflow = grossIncome - monthlyMortgage - monthlyMaint - taxAmount;
        portfolio = portfolio * (1 + investReturn/12) + Math.max(0, netCashflow);
      }
      propVal *= (1 + 0.03);
      rentPrice *= (1 + rentGrowth);
    }
  }
  
  return { data, initialInvest: totalEntry, monthlyOutflow: monthlyMortgage };
}

function calcRentAirbnbStrategy(region, horizon) {
  // Краткосрочная аренда через Airbnb
  const price = region.price * 70; // цена квартиры = цена/м² × 70 м²
  const downPct = 0.20;
  const mortgRate = 0.032;
  const termYears = 25;
  const itpPct = region.itp / 100;
  const maintPct = 0.012;
  
  const nightRate = (region.rent * 70 * 3.5) / 30; // дневная ставка Airbnb ~3.5x месячной аренды
  const occupancy = 0.75; // повышенная occupancy для Airbnb
  const platformPct = 0.25; // повышенные расходы платформы
  const taxRate = 0.21; // повышенный налог для Airbnb
  const investReturn = 0.08; // рискованная инвестиция, но потенциально выше доходность
  
  const down = price * downPct;
  const totalEntry = down + price * itpPct + price * 0.015;
  const loan = price - down;
  const mRate = mortgRate / 12;
  const nPay = termYears * 12;
  const monthlyMortgage = loan * (mRate * Math.pow(1+mRate, nPay)) / (Math.pow(1+mRate, nPay) - 1);
  const monthlyMaint = price * maintPct / 12;
  
  const data = [];
  let propVal = price, loanBal = loan;
  let portfolio = totalEntry;
  let rate = nightRate;
  
  for (let y = 0; y <= horizon; y++) {
    const equity = propVal - loanBal;
    const totalAssets = equity + portfolio;
    data.push(Math.round(totalAssets));
    
    if (y < horizon) {
      for (let m = 0; m < 12; m++) {
        const interest = loanBal * mRate;
        const principal = y*12+m < nPay ? Math.min(monthlyMortgage - interest, loanBal) : 0;
        loanBal = Math.max(0, loanBal - principal);
        
        const grossIncome = rate * 30 * occupancy;
        const platformCost = grossIncome * platformPct;
        const taxAmount = (grossIncome - platformCost - monthlyMaint) * taxRate;
        const netCashflow = grossIncome - platformCost - monthlyMortgage - monthlyMaint - taxAmount;
        portfolio = portfolio * (1 + investReturn/12) + Math.max(0, netCashflow);
      }
      propVal *= (1 + 0.03);
      rate *= (1 + 0.02); // медленнее растёт
    }
  }
  
  return { data, initialInvest: totalEntry, monthlyOutflow: monthlyMortgage };
}

function renderComparisonTable(results, horizon) {
  const tbody = document.getElementById('cmp-table-body');
  tbody.innerHTML = '';
  
  const years = [5, 10, 15, 20];
  const indices = years.map(y => Math.min(y, horizon));
  
  Object.entries(COMPARE_STRATEGIES).forEach(([key, strat]) => {
    const data = results[key].data;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:500;color:${strat.color};">${getStrategyLabel(key)}</td>
      ${indices.map(i => `<td style="text-align:right;">${data[i].toLocaleString('ru')} €</td>`).join('')}
      <td style="text-align:right;font-weight:bold;color:${strat.color};">${data[data.length-1].toLocaleString('ru')} €</td>
    `;
    tbody.appendChild(row);
  });
}

function renderComparisonChart(results, horizon, region) {
  const canvas = document.getElementById('cmpChart');
  if (!canvas) return;
  if (cmpChartInst) { cmpChartInst.destroy(); cmpChartInst = null; }
  
  const labels = [];
  for (let y = 0; y <= horizon; y++) {
    labels.push(y === 0 ? 'Сейчас' : 'Год ' + y);
  }
  
  const datasets = Object.entries(COMPARE_STRATEGIES).map(([key, strat]) => {
    // Конвертируем hex цвет в rgba с прозрачностью 0.8
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };
    const rgb = hexToRgb(strat.color);
    const backgroundColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1.0)` : strat.color;
    
    return {
      label: getStrategyPlainLabel(key),
      data: results[key].data,
      borderColor: strat.color,
      backgroundColor: backgroundColor,
      fill: 'origin', // Заливка до оси X (нуля)
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 2,
      hoverBorderWidth: 4
    };
  });
  
  cmpChartInst = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      hover: { mode: 'index', intersect: false }, // Подсвечивает все линии при наведении
      plugins: {
        legend: { 
          display: true, 
          position: 'top',
          onClick: function(e, legendItem, legend) {
            const index = legendItem.datasetIndex;
            const ci = legend.chart;
            const meta = ci.getDatasetMeta(index);
            meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
            ci.update();
          }
        },
        tooltip: { 
          mode: 'index', // Показывает все 5 значений сразу
          intersect: false,
          callbacks: { 
            label: ctx => ` ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString('ru')} €` 
          } 
        }
      },
      scales: {
        x: { ticks: { color: '#8a8f9e', font: { size: 11 }, maxTicksLimit: 12 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#8a8f9e', font: { size: 11 }, callback: v => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'k' : v }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function renderComparisonInsights(results, region, horizon) {
  const data = results;
  const final = {};
  Object.entries(COMPARE_STRATEGIES).forEach(([key]) => {
    final[key] = data[key].data[horizon];
  });
  
  const sorted = Object.entries(final).sort(([,a], [,b]) => b - a);
  const winnerKey = sorted[0][0];
  const runnerUpKey = sorted[1][0];
  const diff = (sorted[0][1] - sorted[1][1]).toLocaleString('ru');
  
  let insights = `
    <div style="margin-bottom: 12px;">
      <strong style="color: var(--green);">🏆 Победитель:</strong> ${getStrategyPlainLabel(winnerKey)} — <strong>${sorted[0][1].toLocaleString('ru')} €</strong>
    </div>
    <div style="margin-bottom: 12px;">
      Вторая стратегия: ${getStrategyPlainLabel(runnerUpKey)} — ${sorted[1][1].toLocaleString('ru')} €
    </div>
    <div style="margin-bottom: 12px;">
      Разница: <strong>+${diff} €</strong> в пользу победителя
    </div>
    <div style="font-size: 12px; color: var(--muted); line-height: 1.6;">
      <p>За ${horizon} лет накопления первоначального взноса и ITP (~${(data.buy_live.initialInvest).toLocaleString('ru')} €) 
      показывают разные результаты в зависимости от региона, времени рынка и личной навыков управления.</p>
    </div>
  `;
  
  document.getElementById('cmp-insights').innerHTML = insights;
  
  // Assets reference
  const assetsRef = `
    <div style="margin-bottom: 8px;"><strong>Прогнозная доходность активов:</strong></div>
    <div style="line-height: 2;">
      <div>📈 MSCI World IndexFund: <strong>7%</strong>/год</div>
      <div>📈 S&P 500: <strong>9%</strong>/год</div>
      <div>📊 Облигации: <strong>3-5%</strong>/год</div>
      <div>🏦 Банк (депозит): <strong>2-3%</strong>/год</div>
      <div>🏠 Недвижимость: <strong>3%</strong>/год рост + доход</div>
    </div>
  `;
  
  document.getElementById('cmp-assets-ref').innerHTML = assetsRef;
}

function calcRenovateStrategy(region, horizon) {
  // BLOCK 7: Покупка квартиры со скидкой + её ремонт и сдача в аренду
  const basePrice = region.price * 70 * 0.85; // Скидка 15% за нужность ремонта, цена = цена/м² × 70 м²
  const renovationCost = 1000 * 70; // Стандартный ремонт: €1000/м²
  const renovationMonths = 4; // Длительность ремонта
  const finalPrice = basePrice * 1.12; // После ремонта стоимость растёт на 12%
  
  const downPct = 0.20;
  const mortgRate = 0.032;
  const termYears = 25;
  const itpPct = region.itp / 100;
  const maintPct = 0.012;
  
  const rent = region.rent * 70 * 1.15; // Ремонт позволяет повысить аренду на 15%, аренда = аренда/м²/мес × 70 м²
  const rentGrowth = 0.03;
  const vacancyPct = 0.05;
  const taxRate = 0.19;
  const investReturn = 0.07; // доходность инвестиций 7%/год
  
  const down = basePrice * downPct;
  const loan = basePrice - down;
  const totalEntry = down + basePrice * itpPct + basePrice * 0.015 + renovationCost;
  const mRate = mortgRate / 12;
  const nPay = termYears * 12;
  const monthlyMortgage = loan * (mRate * Math.pow(1+mRate, nPay)) / (Math.pow(1+mRate, nPay) - 1);
  const monthlyMaint = finalPrice * maintPct / 12;
  
  const data = [];
  let propVal = basePrice, loanBal = loan;
  let portfolio = totalEntry - renovationCost; // Вычитаем ремонт из портфеля
  let rentPrice = 0; // Первые 4 месяца нет дохода из-за ремонта
  let monthCount = 0;
  
  for (let y = 0; y <= horizon; y++) {
    const equity = propVal - loanBal;
    const totalAssets = equity + portfolio;
    data.push(Math.round(totalAssets));
    
    if (y < horizon) {
      for (let m = 0; m < 12; m++) {
        const interest = loanBal * mRate;
        const principal = y*12+m < nPay ? Math.min(monthlyMortgage - interest, loanBal) : 0;
        loanBal = Math.max(0, loanBal - principal);
        
        monthCount++;
        // После 4 месяцев ремонта квартира начинает приносить доход
        if (monthCount > renovationMonths) {
          const grossIncome = rentPrice * (1 - vacancyPct);
          const taxAmount = Math.max(0, (grossIncome - monthlyMaint - monthlyMortgage * 0.33) * taxRate);
          const netCashflow = grossIncome - monthlyMortgage - monthlyMaint - taxAmount;
          portfolio = portfolio * (1 + investReturn/12) + Math.max(0, netCashflow);
        } else {
          // Во время ремонта платим только ипотеку и практически нет квартиры
          portfolio = portfolio * (1 + investReturn/12) - monthlyMortgage * 0.5;
        }
      }
      propVal = finalPrice * Math.pow(1.03, y); // После ремонта стоимость растёт быстрее
      rentPrice = rent * Math.pow(1 + rentGrowth, y);
    }
  }
  
  return { data, initialInvest: totalEntry, monthlyOutflow: monthlyMortgage };
}
