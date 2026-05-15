// ITP rates — segunda mano, Spain 2025-2026
// Source of truth: docs/spain_itp_data.md
// When rates change: update docs/spain_itp_data.md AND this file.
//
// Fields per region:
//   itp    — general rate for all buyers (first tramo for progressive regions)
//   itpHab — vivienda habitual, base rate WITHOUT льготы/bonifications
//            (= itp for most regions; differs only where habitual = auto-lower tramo)
//   itpInv — investor / second property rate
//
// Special case: pais_vasco itpHab 2.5% — standard rate for vivienda habitual
//   (requires: area ≤96 m² Gipuzkoa / ≤120 m² Bizkaia, no other property in municipality)

const ITP_RATES = {
  baleares:      { itp: 0.08,  itpHab: 0.08,  itpInv: 0.10  }, // progressive 8-13%; hab льготная 4% (≤270k, no other prop) — not included here
  madrid:        { itp: 0.06,  itpHab: 0.06,  itpInv: 0.06  }, // no hab reduction for general buyer
  pais_vasco:    { itp: 0.04,  itpHab: 0.025, itpInv: 0.07  }, // 2.5% standard hab rate; 4% general residential; 7% non-residential
  canarias:      { itp: 0.065, itpHab: 0.065, itpInv: 0.065 }, // hab льготная 5% (≤200k) — not included
  cataluna:      { itp: 0.10,  itpHab: 0.10,  itpInv: 0.11  }, // progressive 10-13%
  andalucia:     { itp: 0.07,  itpHab: 0.07,  itpInv: 0.08  }, // hab льготная 6% (≤150k) — not included
  valencia:      { itp: 0.10,  itpHab: 0.10,  itpInv: 0.10  }, // drops to 9% from 01.06.2026
  cantabria:     { itp: 0.09,  itpHab: 0.09,  itpInv: 0.10  }, // progressive 9-10%; hab льготная 7% (≤200k) — not included
  navarra:       { itp: 0.06,  itpHab: 0.06,  itpInv: 0.06  },
  asturias:      { itp: 0.08,  itpHab: 0.08,  itpInv: 0.08  }, // progressive 8-10%
  murcia:        { itp: 0.08,  itpHab: 0.08,  itpInv: 0.08  },
  aragon:        { itp: 0.08,  itpHab: 0.08,  itpInv: 0.08  }, // progressive 8-10%
  galicia:       { itp: 0.10,  itpHab: 0.08,  itpInv: 0.10  }, // progressive 8-10%; hab базовая starts at 8%
  la_rioja:      { itp: 0.07,  itpHab: 0.07,  itpInv: 0.07  },
  castilla_leon: { itp: 0.08,  itpHab: 0.08,  itpInv: 0.08  }, // progressive 8-10%
  clm:           { itp: 0.09,  itpHab: 0.09,  itpInv: 0.09  }, // hab льготная 6% (≤180k + mortgage) — not included
  extremadura:   { itp: 0.08,  itpHab: 0.08,  itpInv: 0.08  }, // progressive 8-11%
};
