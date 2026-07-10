// ============================================================
// rental-calc.js — Калькулятор 2: Доход от недвижимости (v4)
// 3 стратегии + индексный фонд: живу сам | сдаю | посуточно
// ============================================================

let c2Chart         = null;
let c2CashflowChart = null;
let c2Horizon       = DEFAULTS.horizonYears;
let c2PropertyType  = 'secondary';
let c2ActiveStrategy = 'rent';
let c2ComputedData  = null;
let c2FinalEquity   = null;
let c2PriceMode     = 'nominal';
let c2IsCash        = false;
let c2SavedDown     = DEFAULTS.downPaymentPct;
let c2SavedRate     = DEFAULTS.mortgageRate;
let c2SavedTerm     = DEFAULTS.mortgageTerm;
let c2Reinvest      = false;

const fmt = v => Math.round(v).toLocaleString('ru');

const IRPF_MARGINAL_RATE_DEFAULT = DEFAULTS.irpfMarginalRate;

// ---- Tax helper: ITP rate by residency ----
function getItpRateByStatus(r, taxStatus) {
  const isNonResident = taxStatus === 'eu' || taxStatus === 'noneu';
  return isNonResident ? (r.itpInv ?? r.itp) : r.itp;
}

// ---- On tax status change: recalculate ITP ----
function onCalc2TaxStatusChange() {
  const id = document.getElementById('c2-region')?.value;
  if (id) {
    const r = REGIONS.find(x => x.id === id);
    if (r) {
      const taxStatus = document.getElementById('c2-tax-status').value;
      const itpRate = getItpRateByStatus(r, taxStatus);
      const tax = c2PropertyType === 'new' ? getNewBuildTaxPct(r, DEFAULTS.notaryPct) : (itpRate + (DEFAULTS.notaryPct / 100)) * 100;
      document.getElementById('c2-tax').value = tax.toFixed(2);
    }
  }
  calcRental();
}

// Вычеты для резидента/ЕС-нерезидента (IRPF / IRNR):
// IBI и страховка НЕ добавляются — они уже в maintMo (слайдер «Содержание + IBI»)
// Амортизация считается от valorCatastral × buildingShareOfCadastral × annualDepreciationRate
function calcMonthlyResidentDeductions(valorCatastral, interestThisMonth, maintMo) {
  const monthlyDepreciation = valorCatastral * DEFAULTS.buildingShareOfCadastral * DEFAULTS.annualDepreciationRate / 12;
  return monthlyDepreciation + interestThisMonth + maintMo;
}

// ---- Strategy tab ----
function setStrategy2(strategy, btn) {
  c2ActiveStrategy = strategy;
  document.querySelectorAll('#c2-strategy-btns .calc-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  updateAirbnbWarning();
  updateC2Display();
}

function updateAirbnbWarning() {
  const el = document.getElementById('c2-airbnb-warning');
  if (!el) return;
  if (c2ActiveStrategy !== 'airbnb') { el.style.display = 'none'; return; }

  const regionId = document.getElementById('c2-region') ? document.getElementById('c2-region').value : '';
  const region   = REGIONS.find(r => r.id === regionId);

  if (region && region.airbnbRestricted) {
    const note   = t(region.airbnbNoteKey) || region.airbnbNoteKey;
    const suffix = t('c2_airbnb_license') || 'Краткосрочная аренда требует туристической лицензии — уточните актуальные правила в местном муниципалитете.';
    el.textContent = '⚠ ' + note + '. ' + suffix;
  } else {
    el.textContent = t('c2_airbnb_license_basic') || 'Краткосрочная аренда требует туристической лицензии.';
  }
  el.style.display = 'block';
}

function updateC2Display() {
  const cfSection = document.getElementById('c2-cf-section');
  if (!cfSection || !c2ComputedData) return;
  const showCF = c2ActiveStrategy === 'rent' || c2ActiveStrategy === 'airbnb' || c2ActiveStrategy === 'live';
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
  const firstInit = sel.options.length <= 1;
  if (firstInit) {
    REGIONS.forEach(r => {
      const o = document.createElement('option');
      o.value = r.id; o.textContent = r.name;
      sel.appendChild(o);
    });
    // Apply slider defaults from DEFAULTS (overrides HTML fallback values)
    document.getElementById('c2-down').value     = DEFAULTS.downPaymentPct;
    document.getElementById('c2-rate').value     = DEFAULTS.mortgageRate;
    document.getElementById('c2-term').value     = DEFAULTS.mortgageTerm;
    document.getElementById('c2-maint').value    = DEFAULTS.maintenancePct;
    document.getElementById('c2-appr').value     = DEFAULTS.apprDefault;
    document.getElementById('c2-rentg').value    = DEFAULTS.rentGrowthDefault;
    document.getElementById('c2-vacancy').value  = DEFAULTS.vacancyPct;
    document.getElementById('c2-occ').value      = DEFAULTS.occupancyPct;
    document.getElementById('c2-mgmt').value     = DEFAULTS.managementFeePct;
    document.getElementById('c2-platform').value = DEFAULTS.platformFeePct;
    document.getElementById('c2-tax').value      = DEFAULTS.defaultTaxFallbackSecondary;
  }
  if (!sel.value) {
    sel.value = 'madrid';
    onCalc2RegionChange();
  } else {
    calcRental();
  }
}

function onCalc2RegionChange() {
  const id = document.getElementById('c2-region').value;
  if (!id) return;
  updateAirbnbWarning();
  const r = REGIONS.find(x => x.id === id);
  if (!r) return;
  const sqm = DEFAULTS.defaultSqm;
  document.getElementById('c2-price').value     = Math.round(r.price * sqm / 5000) * 5000;
  document.getElementById('c2-long-rent').value = Math.round(r.rent * sqm / 50) * 50;
  document.getElementById('c2-night').value = Math.round(r.rent * sqm / 30 * DEFAULTS.airbnbNightMultiplier / 5) * 5;
  // Темп роста цены и аренды НЕ подставляется по региону — остаётся то, что
  // задал пользователь (или дефолт 3% из initRentalCalc).
  const taxStatus = document.getElementById('c2-tax-status')?.value || 'eu';
  const itpRate   = getItpRateByStatus(r, taxStatus);
  const tax = c2PropertyType === 'new' ? getNewBuildTaxPct(r, DEFAULTS.notaryPct) : (itpRate + (DEFAULTS.notaryPct / 100)) * 100;
  document.getElementById('c2-tax').value = tax.toFixed(2);
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
      const taxStatus = document.getElementById('c2-tax-status')?.value || 'eu';
      const itpRate = getItpRateByStatus(r, taxStatus);
      const tax = type === 'new' ? getNewBuildTaxPct(r, DEFAULTS.notaryPct) : (itpRate + (DEFAULTS.notaryPct / 100)) * 100;
      document.getElementById('c2-tax').value = tax.toFixed(2);
    }
  } else {
    document.getElementById('c2-tax').value = type === 'new'
      ? String(DEFAULTS.newPropertyTaxPct)
      : String(DEFAULTS.defaultTaxFallbackSecondary);
  }
  calcRental();
}

function setHorizon2(years, btn) {
  c2Horizon = years;
  document.querySelectorAll('#c2-horizon-btns .calc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  calcRental();
}

function setPriceMode2(mode, btn) {
  c2PriceMode = mode;
  document.querySelectorAll('#c2-mode-btns .calc-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  calcRental();
}

function applyCalc2Preset(preset, btn) {
  document.querySelectorAll('#c2-preset-btns .calc-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const downRow = document.getElementById('c2-down-row');
  const rateRow = document.getElementById('c2-rate-row');
  const termRow = document.getElementById('c2-term-row');
  if (preset === 'cash') {
    c2SavedDown = +document.getElementById('c2-down').value;
    c2SavedRate = +document.getElementById('c2-rate').value;
    c2SavedTerm = +document.getElementById('c2-term').value;
    c2IsCash = true;
    if (downRow) downRow.style.display = 'none';
    if (rateRow) rateRow.style.display = 'none';
    if (termRow) termRow.style.display = 'none';
    document.getElementById('c2-down').value = 100;
  } else {
    c2IsCash = false;
    if (downRow) downRow.style.display = '';
    if (rateRow) rateRow.style.display = '';
    if (termRow) termRow.style.display = '';
    document.getElementById('c2-down').value = c2SavedDown;
    document.getElementById('c2-rate').value = c2SavedRate;
    document.getElementById('c2-term').value = c2SavedTerm;
  }
  calcRental();
}

function setReinvest2(value, btn) {
  c2Reinvest = value;
  document.querySelectorAll('#c2-reinvest-btns .calc-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  calcRental();
}

let c2ReinvestPopupCloseTimer = null;
let c2ReinvestPopupOutsideHandler = null;
function openC2ReinvestPopup(e) {
  if (e) e.stopPropagation();
  if (c2ReinvestPopupCloseTimer) { clearTimeout(c2ReinvestPopupCloseTimer); c2ReinvestPopupCloseTimer = null; }
  const popup = document.getElementById('c2-reinvest-popup');
  if (!popup) return;
  popup.classList.add('visible');
  setTimeout(() => {
    c2ReinvestPopupOutsideHandler = ev => { if (!popup.contains(ev.target)) closeC2ReinvestPopup(); };
    document.addEventListener('click', c2ReinvestPopupOutsideHandler);
  }, 0);
}
function closeC2ReinvestPopup() {
  const popup = document.getElementById('c2-reinvest-popup');
  if (popup) popup.classList.remove('visible');
  if (c2ReinvestPopupOutsideHandler) {
    document.removeEventListener('click', c2ReinvestPopupOutsideHandler);
    c2ReinvestPopupOutsideHandler = null;
  }
}
function closeC2ReinvestPopupDelayed() {
  c2ReinvestPopupCloseTimer = setTimeout(closeC2ReinvestPopup, 150);
}
function cancelCloseC2ReinvestPopup() {
  if (c2ReinvestPopupCloseTimer) { clearTimeout(c2ReinvestPopupCloseTimer); c2ReinvestPopupCloseTimer = null; }
}

function updateC2ChartSub() {
  const el = document.getElementById('c2-chart1-sub');
  if (!el) return;
  const appr = parseFloat(document.getElementById('c2-appr')?.value || DEFAULTS.apprDefault).toFixed(1);
  if (c2IsCash) {
    const tpl = t('c2_chart_sub_cash_tpl') || 'Расчёт при покупке за наличные · рост цен {appr}%/год';
    el.textContent = tpl.replace('{appr}', appr);
  } else {
    const rate = parseFloat(document.getElementById('c2-rate')?.value || DEFAULTS.mortgageRate).toFixed(1);
    const tpl = t('c2_chart_sub_tpl') || 'Расчёт при росте цен {appr}%/год · ставка ипотеки {rate}%';
    el.textContent = tpl.replace('{appr}', appr).replace('{rate}', rate);
  }
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

  // Посуточно — расходы разведены на честные статьи (шаг 2):
  //   база = price × maint / 12 (0.5%, как Держу);
  //   износ мебели = фикс, occupancy НЕ применяется (амортизация не зависит от загрузки);
  //   уборка = стоимость_заезда × заездов_в_месяц × occupancy (переменная).
  const airbnbFurnitureMo = price * DEFAULTS.furnitureDepreciationPct / 100 / 12;
  const airbnbCleaningMo  = DEFAULTS.cleaningPerStay * (30 / DEFAULTS.avgStayNights) * occRate;

  document.getElementById('c2v-price').textContent     = fmt(price) + ' €';
  document.getElementById('c2v-down').textContent      = (downPct*100).toFixed(0) + '%';
  document.getElementById('c2v-rate').textContent      = (annRate*100).toFixed(1) + '%';
  document.getElementById('c2v-term').textContent      = termYrs + ' лет';
  document.getElementById('c2v-tax').textContent       = (taxPct*100).toFixed(2) + '%';
  document.getElementById('c2v-maint').textContent     = (maint*100).toFixed(1) + '%';
  const maintEl = document.getElementById('c2-maint-breakdown');
  if (maintEl) {
    const fmtM = v => Math.round(v);
    const mLive   = fmtM(price * maint / 12);
    const mRent   = fmtM(price * maint * DEFAULTS.longTermMaintMultiplier / 12);
    const mAirbnb = fmtM(price * maint / 12 + airbnbFurnitureMo + airbnbCleaningMo);
    const lbl = t('c2_maint_breakdown') || 'Содержание:';
    const sLive   = t('c2_s_live')   || 'Держу';
    const sRent   = t('c2_s_rent')   || 'Сдаю';
    const sAirbnb = t('c2_s_airbnb') || 'Посуточно';
    const airbnbItems = (t('c2_airbnb_cost_items') || 'содержание {M} + износ мебели {W} + уборка {C}')
      .replace('{M}', fmtM(price * maint / 12)).replace('{W}', fmtM(airbnbFurnitureMo)).replace('{C}', fmtM(airbnbCleaningMo));
    const eurMo = t('unit_eur_mo') || '€/мес';
    maintEl.textContent = `${lbl} ${sLive} ${mLive} ${eurMo} · ${sRent} ${mRent} ${eurMo} · ${sAirbnb} ${mAirbnb} ${eurMo} (${airbnbItems})`;
  }
  document.getElementById('c2v-appr').textContent      = (appr*100).toFixed(1) + '%';
  document.getElementById('c2v-long-rent').textContent = fmt(longRent) + ' €';
  document.getElementById('c2v-rentg').textContent     = (rentg*100).toFixed(1) + '%';
  document.getElementById('c2v-vacancy').textContent   = (vacancy*100).toFixed(0) + '%';
  document.getElementById('c2v-mgmt').textContent      = (mgmt*100).toFixed(0) + '%';
  document.getElementById('c2v-night').textContent     = fmt(nightRate) + ' €';
  document.getElementById('c2v-occ').textContent       = (occRate*100).toFixed(0) + '%';
  document.getElementById('c2v-platform').textContent  = (platform*100).toFixed(1) + '%';

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
  document.getElementById('c2v-rate-pmt').textContent = '≈ ' + fmt(monthlyMortgage) + ' ' + (t('unit_eur_mo') || '€/мес');

  // Год 0: покупатель стартует с equity, индекс стартует ВЫШЕ (с полной суммой входа)
  const initialCash = downAmt + taxAmt;
  const INV_RATE    = (DEFAULTS.investmentReturn / 100);
  const airbnbGross0 = nightRate * occRate * 365 / 12;

  const purchasePrice = price; // фиксируется до цикла, для амортизации

  // Кадастральная стоимость фиксируется на дату покупки (revaluation раз в 10+ лет, игнорируем)
  const regionId      = document.getElementById('c2-region')?.value || '';
  const cadastralRatio = DEFAULTS.cadastralByRegion[regionId] ?? DEFAULTS.cadastralFallback;
  const valorCatastral = price * cadastralRatio;

  // Налог на вменённый доход: без вычетов, только ставка по статусу
  const imputedTaxRate = taxStatus === 'resident' ? IRPF_MARGINAL_RATE_DEFAULT : taxStatus === 'noneu' ? DEFAULTS.irnrRateNonEU : DEFAULTS.irnrRateEU;
  const imputedTaxMo   = valorCatastral * DEFAULTS.imputedIncomeRate * imputedTaxRate / 12;

  // Состояние стратегий
  const s = {
    live:        { loanBal: loan, propVal: price, cumCF: 0 },
    rent:        { loanBal: loan, propVal: price, cumCF: 0, reinvest: 0 },
    airbnb:      { loanBal: loan, propVal: price, cumCF: 0, reinvest: 0 },
    index:       { portfolio: initialCash }, // взнос + налог + нотариус — те же деньги что потратил покупатель
    indexLive:   { portfolio: initialCash }, // fair vs «Живу сам»: +(ипотека+расходы−аренда) при >0
    indexAirbnb: { portfolio: initialCash }, // fair vs «Посуточно»: +|airbnbCF| при CF<0
  };

  // Год 0 — снэпшоты (equity = цена × взнос%, индекс = initialCash)
  const equityLive        = [Math.round(price - loan)];
  const equityRent        = [Math.round(price - loan)];
  const equityAirbnb      = [Math.round(price - loan)];
  const equityIndex       = [Math.round(initialCash)]; // fair vs «Сдаю»
  const equityIndexLive   = [Math.round(initialCash)]; // fair vs «Живу сам»
  const equityIndexAirbnb = [Math.round(initialCash)]; // fair vs «Посуточно»
  const rentCumCFYearly   = [0]; // годовые снимки накопленного CF «Сдаю» для зон графика
  const labels            = [t('c1_now') || 'Сейчас'];

  // Массивы помесячного CF для графика 2
  const rentMonthlyCF   = [];
  const airbnbMonthlyCF = [];
  const liveMonthlyCF   = [];

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

      // Содержание: три ставки для каждой стратегии
      // Используем price (цена покупки), а не propVal — реальные расходы растут с инфляцией, а не с рынком
      const maintMo_live   = price * maint / 12;
      const maintMo_rent   = price * maint * DEFAULTS.longTermMaintMultiplier / 12;
      const maintMo_airbnb = price * maint / 12 + airbnbFurnitureMo + airbnbCleaningMo;

      // ── «Держу»: платит ипотеку + содержание, дохода нет ──

      // ── «Сдаю» ──
      const rentGross    = rent * (1 - vacancy);
      const rentMgmtCost = rentGross * mgmt;
      let rentTax = 0;
      if (taxStatus === 'resident') {
        // IRPF: вычеты + 50% льгота для долгосрочной аренды (новые договоры с 26.05.2023)
        const deductions = calcMonthlyResidentDeductions(valorCatastral, interestThisMo, maintMo_rent) + rentMgmtCost;
        const taxBase    = Math.max(0, rentGross - deductions);
        if (taxBase === 0) residentDeductionsExceededCount++;
        rentTax = taxBase * DEFAULTS.longTermRentalIrpfReduction * IRPF_MARGINAL_RATE_DEFAULT;
      } else if (taxStatus === 'eu') {
        // IRNR: резидент ЕС — вычеты применяются, льготы нет
        const deductions = calcMonthlyResidentDeductions(valorCatastral, interestThisMo, maintMo_rent) + rentMgmtCost;
        const taxBase    = Math.max(0, rentGross - deductions);
        rentTax = taxBase * DEFAULTS.irnrRateEU;
      } else {
        // IRNR: нерезидент не из ЕС — с валового дохода, без вычетов
        rentTax = rentGross * DEFAULTS.irnrRateNonEU;
      }
      const rentNetIncome = rentGross - rentMgmtCost - rentTax;
      const rentCF = rentNetIncome - payment - maintMo_rent;
      if (c2Reinvest) {
        s.rent.reinvest *= (1 + INV_RATE / 12);
        if (rentCF > 0) s.rent.reinvest += rentCF;
        else s.rent.cumCF += rentCF;
      } else {
        s.rent.cumCF += rentCF;
      }
      rentMonthlyCF.push(rentCF);
      if (y === 0) firstYearNetIncomeRent += rentNetIncome;

      // ── «Посуточно» ──
      const airbnbNet = airbnb * (1 - platform);
      let airbnbTax = 0;
      if (taxStatus === 'resident' || taxStatus === 'eu') {
        // IRPF/IRNR EU: вычеты применяются; для краткосрочной аренды льготы 50% нет
        const deductionsA = calcMonthlyResidentDeductions(valorCatastral, interestThisMo, maintMo_airbnb);
        const taxBaseA    = Math.max(0, airbnbNet - deductionsA);
        airbnbTax = taxBaseA * DEFAULTS.irnrRateEU;
      } else {
        // IRNR: нерезидент не из ЕС — с валового дохода
        airbnbTax = airbnbNet * DEFAULTS.irnrRateNonEU;
      }
      const airbnbNetIncome = airbnbNet - airbnbTax;
      const airbnbCF = airbnbNetIncome - payment - maintMo_airbnb;
      if (c2Reinvest) {
        s.airbnb.reinvest *= (1 + INV_RATE / 12);
        if (airbnbCF > 0) s.airbnb.reinvest += airbnbCF;
        else s.airbnb.cumCF += airbnbCF;
      } else {
        s.airbnb.cumCF += airbnbCF;
      }
      airbnbMonthlyCF.push(airbnbCF);
      if (y === 0) firstYearNetIncomeAirbnb += airbnbNetIncome;

      // ── Индексный фонд: независимое сравнение ──
      // Те же деньги на входе + ежемесячно вносит сумму ипотечного платежа
      s.index.portfolio *= (1 + INV_RATE / 12);
      s.index.portfolio += monthlyMortgage;

      // vs «Держу»: владелец платит ипотеку + содержание + налог на вменённый доход
      const liveCF = -(payment + maintMo_live + imputedTaxMo);
      s.live.cumCF += liveCF;
      liveMonthlyCF.push(liveCF);
      if (liveCF < 0) {
        s.indexLive.portfolio += Math.abs(liveCF);
      }
      s.indexLive.portfolio *= (1 + INV_RATE / 12);

      // vs «Посуточно»: когда CF<0 владелец доплачивает — те же деньги в индекс
      s.indexAirbnb.portfolio *= (1 + INV_RATE / 12);
      if (airbnbCF < 0) s.indexAirbnb.portfolio += Math.abs(airbnbCF);

      // Помесячный рост аренды
      rent   *= (1 + rentg / 12);
      airbnb *= (1 + rentg / 12);
    }

    // Годовые снэпшоты капитала
    const C2_INFL = (DEFAULTS.inflation / 100);
    const inflFactor = c2PriceMode === 'real' ? Math.pow(1 + C2_INFL, y + 1) : 1;
    // «Держу»: equity = propVal − loanBal + cumCF (cumCF ≤ 0 — расходы без дохода)
    equityLive.push(Math.round((s.live.propVal - s.live.loanBal + s.live.cumCF) / inflFactor));
    // «Сдаю»: equity + накопленный CF + реинвест
    equityRent.push(Math.round((s.rent.propVal - s.rent.loanBal + s.rent.cumCF + s.rent.reinvest) / inflFactor));
    rentCumCFYearly.push(Math.round(s.rent.cumCF));
    // «Посуточно»: equity + накопленный CF
    equityAirbnb.push(Math.round((s.airbnb.propVal - s.airbnb.loanBal + s.airbnb.cumCF + s.airbnb.reinvest) / inflFactor));
    equityIndex.push(Math.round(s.index.portfolio / inflFactor));
    equityIndexLive.push(Math.round(s.indexLive.portfolio / inflFactor));
    equityIndexAirbnb.push(Math.round(s.indexAirbnb.portfolio / inflFactor));
    labels.push(`${t('c1_year')||'Год'} ${y + 1}`);
  }

  // ---- Итоговые значения ----
  const finalEquity = {
    live:   equityLive[horizon],
    rent:   equityRent[horizon],
    airbnb: equityAirbnb[horizon],
    index:  equityIndex[horizon],
  };

  const reKeys  = ['live', 'rent', 'airbnb'];
  const bestKey = reKeys.reduce((a,b) => finalEquity[a] > finalEquity[b] ? a : b);
  const roiAnn  = (Math.pow(finalEquity[bestKey] / initialCash, 1 / horizon) - 1) * 100;
  c2FinalEquity = finalEquity;

  // Когда «Сдаю» обгоняет индекс
  let beatsIndexYear = null;
  for (let y = 1; y <= horizon; y++) {
    if (equityRent[y] > equityIndex[y]) { beatsIndexYear = y; break; }
  }

  // Год когда ежемесячный CF «Сдаю» впервые ≥ 0 (аренда покрывает расходы)
  const firstPosCFMonth = rentMonthlyCF.findIndex(cf => cf >= 0);
  const firstPosCFYear  = firstPosCFMonth >= 0 ? Math.floor(firstPosCFMonth / 12) + 1 : -1;

  // Год когда equity «Держу» впервые превышает начальные вложения (взнос + налог)
  const holdBreakevenYear = equityLive.findIndex((v, i) => i > 0 && v > initialCash);

  const avgRentMoCF   = rentMonthlyCF.slice(0, 12).reduce((a,b) => a+b, 0) / 12;
  const avgAirbnbMoCF = airbnbMonthlyCF.slice(0, 12).reduce((a,b) => a+b, 0) / 12;

  // ---- Карточки сверху ----
  const names = {
    live:   t('c2_s_live')   || 'Держу',
    rent:   t('c2_s_rent')   || 'Сдаю',
    airbnb: t('c2_s_airbnb') || 'Посуточно',
    index:  t('c2_s_index')  || 'Индекс',
  };
  updateWinnerCard(names, finalEquity, bestKey, horizon);
  updateC2IndexFootnote(names, finalEquity, horizon, initialCash);
  const winnerCF = bestKey === 'rent' ? avgRentMoCF : bestKey === 'airbnb' ? avgAirbnbMoCF : null;
  const cfSubEl = document.getElementById('c2-cashflow-sub');
  if (winnerCF !== null) {
    document.getElementById('c2-cashflow').textContent = (winnerCF >= 0 ? '+' : '') + fmt(winnerCF) + ' €';
    if (cfSubEl) cfSubEl.textContent = names[bestKey] + ', ' + (t('c2_year1') || 'год 1');
  } else {
    document.getElementById('c2-cashflow').textContent = '—';
    if (cfSubEl) cfSubEl.textContent = names[bestKey];
  }
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
    liveMonthlyCF,
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
    equityIndexLive,
    equityIndexAirbnb,
  };

  // ---- Графики ----
  drawCalc2Chart(labels, equityLive, equityRent, equityAirbnb, equityIndex, rentCumCFYearly, firstPosCFYear, holdBreakevenYear);
  updateC2Display();
  updateC2ChartSub();
  updateAirbnbWarning();

  // ---- Текстовое резюме ----
  buildCalc2Summary(names, bestKey, finalEquity, beatsIndexYear, avgRentMoCF, avgAirbnbMoCF, horizon, initialCash, roiAnn, taxStatus, residentDeductionsExceededCount);
}

// ---- Легенда: включить/выключить стратегию ----
function toggleStrategy2(strategy, checkbox) {
  if (!c2Chart) return;
  const dsIdx = { live:0, rent:1, airbnb:2, index:3 }[strategy];
  c2Chart.data.datasets[dsIdx].hidden = !checkbox.checked;
  c2Chart.update();

  const label = checkbox.closest('.c2-legend-item');
  if (label) label.classList.toggle('disabled', !checkbox.checked);

  if (!c2FinalEquity) return;
  const reKeys = ['live','rent','airbnb'];
  if (!reKeys.includes(strategy)) return;

  const names = {
    live:   t('c2_s_live')   || 'Держу',
    rent:   t('c2_s_rent')   || 'Сдаю',
    airbnb: t('c2_s_airbnb') || 'Посуточно',
  };
  const reDsIdx = { live:0, rent:1, airbnb:2 };
  const visible = reKeys.filter(k => !c2Chart.data.datasets[reDsIdx[k]].hidden);
  const bestEl = document.getElementById('c2-best');
  const subEl  = document.getElementById('c2-best-sub');
  if (!bestEl) return;
  if (visible.length === 0) {
    bestEl.textContent = '—';
    if (subEl) subEl.textContent = '';
    return;
  }
  const bestKey = visible.reduce((a,b) => c2FinalEquity[a] > c2FinalEquity[b] ? a : b);
  bestEl.textContent = '🏆 ' + names[bestKey] + ' · ' + fmt(c2FinalEquity[bestKey]) + ' €';
  if (subEl) subEl.textContent = (t('c2_card_best_sub') || 'Чистые активы через {N} лет').replace('{N}', c2Horizon);
}

// ---- Карточка победителя (недвижимость) ----
function updateWinnerCard(names, finalEquity, bestKey, horizon) {
  const el    = document.getElementById('c2-best');
  const subEl = document.getElementById('c2-best-sub');
  if (!el) return;
  el.textContent = '🏆 ' + names[bestKey] + ' · ' + fmt(finalEquity[bestKey]) + ' €';
  if (subEl) subEl.textContent = (t('c2_card_best_sub') || 'Чистые активы через {N} лет').replace('{N}', horizon);
}

// ---- Сноска про индексный фонд под карточками ----
function updateC2IndexFootnote(names, finalEquity, horizon, initialCash) {
  const el = document.getElementById('c2-index-footnote');
  if (!el) return;
  const indexVal = finalEquity.index;
  const roi = ((Math.pow(indexVal / initialCash, 1 / horizon) - 1) * 100).toFixed(1);
  const label = t('c2_index_footnote_tpl') || 'Для сравнения — Индексный фонд 7%/год: {VAL} € за {N} лет · доходность {ROI}%/год';
  el.textContent = label.replace('{VAL}', fmt(indexVal)).replace('{N}', horizon).replace('{ROI}', roi);
}

// ---- График 1: накопление капитала ----
function drawCalc2Chart(labels, equityLive, equityRent, equityAirbnb, equityIndex, rentCumCFYearly, firstPosCFYear, holdBreakevenYear) {
  const canvas = document.getElementById('rc-cf-chart');
  if (!canvas) return;
  if (c2Chart) { c2Chart.destroy(); c2Chart = null; }

  // Позиционер возвращает точку курсора; yAlign:'bottom' размещает тултип выше
  Chart.Tooltip.positioners.aboveCursor = (_, pos) => ({ x: pos.x, y: pos.y });

  const n = labels.length - 1;
  const rentZonesPlugin = {
    id: 'rentZones',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x || !scales.y) return;

      const lbl = holdBreakevenYear > 0
        ? (t('c2_zone_hold') || '⚠ «Держу»: ипотека + содержание без дохода до года {N}').replace('{N}', holdBreakevenYear)
        : (t('c2_zone_hold_never') || '⚠ «Держу»: ипотека + содержание без дохода');

      // x: ~год 5; y: по кривой «Держу» в этой точке
      const xYear = Math.min(5, n);
      const xPx   = scales.x.getPixelForValue(xYear);
      const yPx   = scales.y.getPixelForValue(equityLive[xYear]);

      ctx.save();
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(138,143,158,0.85)';
      ctx.textAlign = 'left';
      ctx.fillText(lbl, xPx + 6, yPx - 8);
      ctx.restore();
    }
  };

  c2Chart = new Chart(canvas, {
    type: 'line',
    plugins: [rentZonesPlugin],
    data: {
      labels,
      datasets: [
        { label: t('c2_s_live')   || 'Держу',        data: equityLive,   borderColor: '#4a90d9', backgroundColor: 'transparent', tension: 0.35, pointRadius: 3, pointHoverRadius: 14, borderWidth: 2 },
        { label: t('c2_s_rent')   || 'Сдаю',         data: equityRent,   borderColor: '#c9a84c', backgroundColor: 'transparent', tension: 0.35, pointRadius: 3, pointHoverRadius: 14, borderWidth: 2 },
        { label: t('c2_s_airbnb') || 'Посуточно',    data: equityAirbnb, borderColor: '#e8955a', backgroundColor: 'transparent', tension: 0.35, pointRadius: 3, pointHoverRadius: 14, borderWidth: 2 },
        { label: t('c2_s_index')  || 'Индекс (7%)',  data: equityIndex,  borderColor: '#5cb88a', backgroundColor: 'transparent', borderDash: [6,3], tension: 0.35, pointRadius: 3, pointHoverRadius: 14, borderWidth: 2 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      plugins: {
        legend: { display: false },
        tooltip: {
          xAlign: 'center',
          yAlign: 'bottom',
          caretPadding: 10,
          backgroundColor: 'rgba(22,24,28,0.75)',
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString('ru')} €`,
            labelColor: ctx => ({ borderColor: ctx.dataset.borderColor, backgroundColor: 'rgba(22,24,28,0.75)', borderWidth: 2 }),
          }
        }
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

  // Снять старые слушатели перед повторным созданием графика
  if (canvas._c2ClickHandler)  canvas.removeEventListener('click',      canvas._c2ClickHandler);
  if (canvas._c2LeaveHandler)  canvas.removeEventListener('mouseleave', canvas._c2LeaveHandler);

  // Клик/тап на пустую область — убрать тултип
  canvas._c2ClickHandler = (e) => {
    if (!c2Chart) return;
    const pts = c2Chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
    if (!pts.length) {
      c2Chart.tooltip.setActiveElements([], {});
      c2Chart.update('none');
    }
  };
  canvas.addEventListener('click', canvas._c2ClickHandler);

  // Уход курсора с графика — убрать тултип
  canvas._c2LeaveHandler = () => {
    if (!c2Chart) return;
    c2Chart.tooltip.setActiveElements([], {});
    c2Chart.update('none');
  };
  canvas.addEventListener('mouseleave', canvas._c2LeaveHandler);
}

// ---- График 2: денежный поток / месяц ----
function drawC2CashflowChart(strategy) {
  const data = c2ComputedData;
  if (!data) return;
  const canvas = document.getElementById('rc-cashflow-chart');
  if (!canvas) return;
  if (c2CashflowChart) { c2CashflowChart.destroy(); c2CashflowChart = null; }

  const monthlyCF = strategy === 'rent' ? data.rentMonthlyCF
    : strategy === 'live' ? data.liveMonthlyCF
    : data.airbnbMonthlyCF;

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
  if (cfPositiveMonth >= 0 && strategy !== 'live') {
    const yr = Math.floor(cfPositiveMonth / 12) + 1;
    annotations.cfPositive = {
      type: 'line', xMin: cfPositiveMonth, xMax: cfPositiveMonth,
      borderColor: 'rgba(92,184,138,0.8)', borderWidth: 1.5, borderDash: [4,4],
      label: {
        display: true,
        content: `${t('c1_year')||'Год'} ${yr}: ${t('c2_ann_cf_covers')||'аренда покрывает ипотеку'}`,
        color: '#5cb88a', font: { size: 10 }, position: 'end', yAdjust: -6,
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

  const cfLegendPatchPlugin = {
    id: 'cfLegendPatch',
    afterDraw(chart) {
      const boxes = chart.legend && chart.legend.legendHitBoxes;
      if (!boxes || !boxes[0]) return;
      const { left, top, height } = boxes[0];
      const boxW = 12, boxH = 8;
      const bx = left;
      const by = top + (height - boxH) / 2;
      const { ctx } = chart;
      ctx.save();
      ctx.fillStyle = 'rgba(224,92,92,0.85)';
      ctx.fillRect(bx, by, boxW / 2, boxH);
      ctx.fillStyle = 'rgba(92,184,138,0.85)';
      ctx.fillRect(bx + boxW / 2, by, boxW / 2, boxH);
      ctx.restore();
    }
  };

  const monthlyCFRounded = monthlyCF.map(v => Math.round(v));
  c2CashflowChart = new Chart(canvas, {
    type: 'bar',
    plugins: [cfLegendPatchPlugin],
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: t('c2_monthly_cf_label') || 'Денежный поток / мес',
          data: monthlyCFRounded,
          backgroundColor: monthlyCFRounded.map(v => v >= 0 ? 'rgba(92,184,138,0.7)' : 'rgba(224,92,92,0.7)'),
          borderColor: monthlyCFRounded.map(v => v >= 0 ? 'rgba(92,184,138,0.9)' : 'rgba(224,92,92,0.9)'),
          borderWidth: 0,
          borderRadius: 2,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: t('c2_cum_cf_label') || 'Накопленный денежный поток',
          data: cumCF,
          borderColor: '#c9a84c',
          backgroundColor: 'transparent',
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 16,
          borderWidth: 2,
          yAxisID: 'y2',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      plugins: {
        legend: { display: true, position: 'top', align: 'center', labels: { color: '#8a8f9e', boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          xAlign: 'center',
          yAlign: 'bottom',
          caretPadding: 10,
          backgroundColor: 'rgba(22,24,28,0.75)',
          callbacks: {
            title: items => `${t('c1_year') || 'Год'} ${Math.floor(items[0].dataIndex / 12) + 1}`,
            label: ctx => ` ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString('ru')} €`,
            labelColor: ctx => {
              const color = ctx.datasetIndex === 0
                ? (ctx.raw >= 0 ? 'rgba(92,184,138,0.9)' : 'rgba(224,92,92,0.9)')
                : (ctx.dataset.borderColor || '#c9a84c');
              return { borderColor: color, backgroundColor: 'rgba(22,24,28,0.75)', borderWidth: 2 };
            },
          }
        },
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
  const monthlyCF = strategy === 'rent' ? data.rentMonthlyCF
    : strategy === 'live' ? data.liveMonthlyCF
    : data.airbnbMonthlyCF;

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
  if (beEl)   beEl.textContent   = strategy === 'live' ? '—'
    : cfPositiveYear ? `${t('c1_year')||'Год'} ${cfPositiveYear}`
    : '>' + data.horizon;
  if (totEl)  totEl.textContent  = (totalCumCF >= 0 ? '+' : '') + fmt(totalCumCF) + ' €';
}

// ---- Три карточки результатов ----
function updateC2ResultCards(strategy) {
  const data = c2ComputedData;
  if (!data) return;

  const cfEl    = document.getElementById('c2-rc-cf');
  const yldEl   = document.getElementById('c2-rc-yield');
  const cocEl   = document.getElementById('c2-rc-coc');

  if (strategy === 'live') {
    const avgLiveMoCF = data.liveMonthlyCF.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
    if (cfEl)  cfEl.textContent  = fmt(avgLiveMoCF) + ' €';
    if (yldEl) yldEl.textContent = '—';
    if (cocEl) cocEl.textContent = '—';
    return;
  }

  const avgMoCF = strategy === 'rent' ? data.avgRentMoCF : data.avgAirbnbMoCF;
  const firstYearNetIncome = strategy === 'rent'
    ? data.firstYearNetIncomeRent
    : data.firstYearNetIncomeAirbnb;

  // Чистая доходность = (чистый доход за год) / цена × 100
  const netYield = data.price > 0 ? (firstYearNetIncome / data.price * 100) : 0;

  // Доходность на вложенные = (CF/мес × 12) / initialCash × 100
  const coc = data.initialCash > 0 ? (avgMoCF * 12 / data.initialCash * 100) : 0;

  if (cfEl)  cfEl.textContent  = (avgMoCF >= 0 ? '+' : '') + fmt(avgMoCF) + ' €';
  if (yldEl) yldEl.textContent = netYield.toFixed(1) + '%';
  if (cocEl) cocEl.textContent = coc.toFixed(1) + '%';
}

// ---- Текстовое резюме ----
function buildCalc2Summary(names, bestKey, finalEquity, beatsIndexYear, avgRentCF, avgAirbnbCF, horizon, initialCash, roiAnn, taxStatus, deductionsExceededCount) {
  const el = document.getElementById('c2-summary-text');
  if (!el) return;
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
    ${t('c2_sum_rent_cf')||'Денежный поток от долгосрочной аренды (год 1):'} <strong>${(avgRentCF>=0?'+':'') + fmt(avgRentCF)} ${t('unit_eur_mo')||'€/мес'}</strong>.
    ${t('c2_sum_airbnb_cf')||'Денежный поток Airbnb (год 1):'} <strong>${(avgAirbnbCF>=0?'+':'') + fmt(avgAirbnbCF)} ${t('unit_eur_mo')||'€/мес'}</strong>.
    ${beatsStr}${deductionNote}`;
}
