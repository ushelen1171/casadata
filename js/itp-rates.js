// ITP rates (segunda mano) + new-build tax basis (obra nueva), Spain 2025-2026
// Source of truth (ITP): docs/spain_itp_data.md
// When rates change: update docs/spain_itp_data.md AND this file.
//
// Fields per region:
//   itp    — general ITP rate for all buyers (first tramo for progressive regions)
//   itpHab — vivienda habitual, base rate WITHOUT льготы/bonifications
//            (= itp for most regions; differs only where habitual = auto-lower tramo)
//   itpInv — investor / second property rate
//   ajd    — Actos Jurídicos Documentados, tipo general 2026 (obra nueva only)
//   newBase— базовый налог новостройки: IVA 0.10 общий; IGIC 0.065 для Канар
//
// Новостройка (obra nueva): налог = (newBase + ajd) × 100 + нотариус 1.5%.
// К новостройке применяется IVA/IGIC + AJD, а НЕ ITP (поля itp* не участвуют).
//
// Special case: pais_vasco itpHab 2.5% — standard rate for vivienda habitual
//   (requires: area ≤96 m² Gipuzkoa / ≤120 m² Bizkaia, no other property in municipality)
//
// AJD — вторичные агрегаты (Rankia, BancSabadell, guiafiscal 2026), требуют
// периодической сверки с официальными Hacienda. Валенсия AJD 1.4% с 01.06.2026.
// ⚠ Navarra: docs/spain_property_taxes.json помечает AJD исключённым (foral),
//   здесь 0.5% по данным задачи — требует проверки.

const ITP_RATES = {
  baleares:      { itp: 0.08,  itpHab: 0.08,  itpInv: 0.10,  ajd: 0.015,  newBase: 0.10  }, // progressive 8-13%; hab льготная 4% (≤270k) — not included
  madrid:        { itp: 0.06,  itpHab: 0.06,  itpInv: 0.06,  ajd: 0.0075, newBase: 0.10  }, // no hab reduction for general buyer
  pais_vasco:    { itp: 0.04,  itpHab: 0.025, itpInv: 0.07,  ajd: 0,      newBase: 0.10  }, // foral: AJD excluded (0)
  canarias:      { itp: 0.065, itpHab: 0.065, itpInv: 0.065, ajd: 0.01,   newBase: 0.065 }, // IGIC 6.5% вместо IVA; hab льготная 5% — not included
  cataluna:      { itp: 0.10,  itpHab: 0.10,  itpInv: 0.11,  ajd: 0.015,  newBase: 0.10  }, // progressive 10-13%
  andalucia:     { itp: 0.07,  itpHab: 0.07,  itpInv: 0.08,  ajd: 0.012,  newBase: 0.10  }, // hab льготная 6% (≤150k) — not included
  valencia:      { itp: 0.10,  itpHab: 0.10,  itpInv: 0.10,  ajd: 0.014,  newBase: 0.10  }, // AJD 1.4% с 01.06.2026
  cantabria:     { itp: 0.09,  itpHab: 0.09,  itpInv: 0.10,  ajd: 0.015,  newBase: 0.10  }, // progressive 9-10%; hab льготная 7% — not included
  navarra:       { itp: 0.06,  itpHab: 0.06,  itpInv: 0.06,  ajd: 0.005,  newBase: 0.10  }, // ⚠ foral — AJD 0.5% по данным задачи, проверить
  asturias:      { itp: 0.08,  itpHab: 0.08,  itpInv: 0.08,  ajd: 0.012,  newBase: 0.10  }, // progressive 8-10%
  murcia:        { itp: 0.08,  itpHab: 0.08,  itpInv: 0.08,  ajd: 0.02,   newBase: 0.10  },
  aragon:        { itp: 0.08,  itpHab: 0.08,  itpInv: 0.08,  ajd: 0.015,  newBase: 0.10  }, // progressive 8-10%
  galicia:       { itp: 0.10,  itpHab: 0.08,  itpInv: 0.10,  ajd: 0.015,  newBase: 0.10  }, // progressive 8-10%; hab базовая starts at 8%
  la_rioja:      { itp: 0.07,  itpHab: 0.07,  itpInv: 0.07,  ajd: 0.01,   newBase: 0.10  },
  castilla_leon: { itp: 0.08,  itpHab: 0.08,  itpInv: 0.08,  ajd: 0.015,  newBase: 0.10  }, // progressive 8-10%
  clm:           { itp: 0.09,  itpHab: 0.09,  itpInv: 0.09,  ajd: 0.0125, newBase: 0.10  }, // hab льготная 6% (≤180k + mortgage) — not included
  extremadura:   { itp: 0.08,  itpHab: 0.08,  itpInv: 0.08,  ajd: 0.015,  newBase: 0.10  }, // progressive 8-11%
};

// Налог новостройки (obra nueva), в процентах — единая формула для Калк 1 и Калк 2:
//   база IVA/IGIC (newBase) + AJD региона + нотариус/регистр (notaryPct, %).
// ITP к новостройке НЕ применяется. Fallback на плоскую ставку, если у региона
// нет полей (не должно случаться — все регионы заданы выше).
function getNewBuildTaxPct(r, notaryPct) {
  if (!r || r.newBase == null) return DEFAULTS.newPropertyTaxPct;
  return (r.newBase + r.ajd) * 100 + notaryPct;
}
