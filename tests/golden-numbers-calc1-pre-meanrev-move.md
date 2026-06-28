# Calc1 Golden Numbers — снято перед переносом mean reversion в Advanced

Дата снятия: 2026-06-28
Коммит: bd78458 (redesign Cycle Position card + unify popup phase block)

Цель: точка отката для **переноса денежной оценки mean reversion** из popup
Cycle Position под чекбокс `c1-mean-reversion` в Advanced settings, удаления
mean-reversion разметки/функций/i18n-ключей из popup, замены `?`-подсказки на
короткую.

**Расчёт не меняется** — только отображение. После всех правок прогон 15
комбинаций должен дать **полностью идентичные** числа (до евро / десятой
процента / целого года паритета / целого евро `cycleImpact`). Любое
расхождение указывает на случайное затрагивание формулы.

## Сценарий A: Nominal, Realistic, 25 лет, sellAtEnd=OFF, mean reversion OFF

| Регион   | Разница (€) | Паритет | ROI (%) | cycleImpact (€) |
|----------|------------:|--------:|--------:|----------------:|
| Madrid   | +174 274    | 3       | 8.5     | +35 679         |
| Baleares |  +62 979    | 5       | 8.2     | +80 309         |
| Cataluña |  +62 303    | 4       | 7.9     | −38 185         |
| Murcia   |  +51 122    | 4       | 8.2     |  −2 689         |
| CLM      |  +27 657    | 4       | 8.1     | −82 706         |

## Сценарий B: Real, Symmetric, 20 лет, sellAtEnd=ON, mean reversion OFF

| Регион   | Разница (€) | Паритет | ROI (%) | cycleImpact (€) |
|----------|------------:|--------:|--------:|----------------:|
| Madrid   | +158 791    | 3       | 7.8     | +15 309         |
| Baleares |  +31 729    | 5       | 6.3     | +34 485         |
| Cataluña | +204 760    | 3       | 9.3     | −16 363         |
| Murcia   |  +98 033    | 3       | 8.9     |  −1 153         |
| CLM      | +145 992    | 2       | 11.7    | −35 348         |

## Сценарий C: Nominal, Realistic, 10 лет, sellAtEnd=OFF, mean reversion OFF

| Регион   | Разница (€) | Паритет | ROI (%) | cycleImpact (€) |
|----------|------------:|--------:|--------:|----------------:|
| Madrid   |  +80 913    | 3       | 11.3    |  +7 264         |
| Baleares |  +44 241    | 5       | 10.5    | +16 402         |
| Cataluña |  +33 833    | 4       | 9.8     |  −7 731         |
| Murcia   |  +25 123    | 4       | 10.5    |    −546         |
| CLM      |  +14 195    | 4       | 10.2    | −16 564         |

---

## Способ сбора

Снято через playwright-evaluate в браузере на свежей сессии. Для каждой
комбинации (regions × scenarios) — `resetCalc1()` → set region → set
priceMode/model/horizon/sell → `calc1Update()` → читались
`#c1-winner-sub`, `#c1-parity`, `#c1-roi`, переменная `c1CycleImpact`.

## Условия

- Дефолты на момент снятия: appr=3, rentGrowth=3, inv=7, inflation=2,
  downPaymentPct=20, mortgageRate=2.9, mortgageTerm=25, maintenancePct=1.2,
  comparisonModelDefault='realistic'.
- ITP, цена, аренда — из `REGIONS` после `onCalc1RegionChange`.
- `c1CycleImpact` всегда вычисляется в **symmetric** при OFF (см.
  `c1ComputeCycleImpact`).

После переноса все 15 строк × 4 метрики должны совпасть точно.
