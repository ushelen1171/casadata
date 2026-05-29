# Calc1 Golden Numbers — снято перед рефакторингом c1RunSimulation

Дата снятия: 2026-05-29
Коммит: f826a01 (cycle position popup)

Цель: точка отката для рефакторинга `calc1Update` + `c1SimulateFinalDiff` в
общий helper `c1RunSimulation(params)`. После рефакторинга прогон тех же 15
комбинаций должен дать **полностью идентичные** числа (до евро / десятой
процента / целого года паритета).

Сбор: через runtime `evaluate` в браузере на свежей сессии (?t=23). Каждая
строка снимается после `resetCalc1()` → выбор региона → применение сценария.

## Сценарий A: Nominal, Realistic, 25 лет, sellAtEnd=OFF

| Регион   | Разница (€) | Паритет | ROI (%) | cycleImpact (€) |
|----------|------------:|--------:|--------:|----------------:|
| Madrid   | +174 274    | 3 года  | 8.5     | +35 679         |
| Baleares |  +62 979    | 5 лет   | 8.2     | +80 309         |
| Cataluña |  +62 303    | 4 года  | 7.9     | −38 185         |
| Murcia   |  +51 122    | 4 года  | 8.2     |  −2 689         |
| CLM      |  +27 657    | 4 года  | 8.1     | −82 706         |

## Сценарий B: Real, Symmetric, 20 лет, sellAtEnd=ON

| Регион   | Разница (€) | Паритет | ROI (%) | cycleImpact (€) |
|----------|------------:|--------:|--------:|----------------:|
| Madrid   | +158 791    | 3 года  | 7.8     | +15 309         |
| Baleares |  +31 729    | 5 лет   | 6.3     | +34 485         |
| Cataluña | +204 760    | 3 года  | 9.3     | −16 363         |
| Murcia   |  +98 033    | 3 года  | 8.9     |  −1 153         |
| CLM      | +145 992    | 2 года  | 11.7    | −35 348         |

## Сценарий C: Nominal, Realistic, 10 лет, sellAtEnd=OFF

| Регион   | Разница (€) | Паритет | ROI (%) | cycleImpact (€) |
|----------|------------:|--------:|--------:|----------------:|
| Madrid   |  +80 913    | 3 года  | 11.3    |  +7 264         |
| Baleares |  +44 241    | 5 лет   | 10.5    | +16 402         |
| Cataluña |  +33 833    | 4 года  | 9.8     |  −7 731         |
| Murcia   |  +25 123    | 4 года  | 10.5    |    −546         |
| CLM      |  +14 195    | 4 года  | 10.2    | −16 564         |

---

## Раскрытие способа сбора

```js
const scenarios = [
  { name: 'A', priceMode: 'nominal', model: 'realistic', horizon: 25, sell: false },
  { name: 'B', priceMode: 'real',    model: 'symmetric', horizon: 20, sell: true  },
  { name: 'C', priceMode: 'nominal', model: 'realistic', horizon: 10, sell: false },
];
// Для каждой комбинации (regions × scenarios):
//   resetCalc1()
//   region.value = id; onCalc1RegionChange()
//   setPriceMode1 / setComparisonModel / setHorizon1 / sell.checked
//   calc1Update()
//   снять: c1-winner-sub (diff), c1-parity, c1-roi, c1CycleImpact
```

## Условия

- Дефолты `DEFAULTS` на момент снятия: appr=3, rentGrowth=3, inv=7,
  inflation=2, downPaymentPct=20, mortgageRate=2.9, mortgageTerm=25,
  maintenancePct=1.2, comparisonModelDefault='realistic'.
- ITP, цена, аренда — из `REGIONS` после `onCalc1RegionChange`.
- `c1CycleImpact` всегда вычисляется в **symmetric** (как решено в Шаге 2,
  чтобы не давать 0 для регионов с rent > buyerTotal).

После рефакторинга все 15 строк должны совпасть точно. Любое расхождение
указывает на ошибку переноса логики.
