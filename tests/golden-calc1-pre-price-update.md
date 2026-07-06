# Calc1 Golden — ДО обновления price/rent (D1)

Дата снятия: 2026-07-06
Ветка: main (перед правкой scripts/enrich_regions.js)

Цель: точка отката перед тем, как enrich начнёт ставить `r.price`/`r.rent` из
текущего (июньского) среза `idealista_raw.json`. Сейчас `r.price`/`r.rent` —
апрельские (Madrid 4707 €/м² / 21.20 €/м²). После правки все build-time поля
будут от одного среза (июнь). Ожидаемый сдвиг входной цены Madrid: 330000 → 335000
(+1.5%), аренда 1500 → 1500 (округление до 50 съедает сдвиг). Выходы должны
сдвинуться пропорционально цене, без смены знаков/победителей.

## Способ сбора

`showPage('calc')` → для каждого региона `c1-region.value=id; onCalc1RegionChange()`
→ для каждого сценария `setPriceMode1/setComparisonModel/setHorizon1` + `c1-sell-at-end.checked`
→ `calc1Update()` → `sim = c1RunSimulation(collectC1Params())`, `cyc = c1ComputeCycleImpact()`.
Снято: `finalDiff` (округл. до €), `parityYear`, `roi` (1 знак), `cycleImpact` (округл. до €).

Сценарии:
- **A**: nominal, realistic, горизонт 25, sellAtEnd=OFF
- **B**: real, symmetric, горизонт 20, sellAtEnd=ON
- **C**: nominal, realistic, горизонт 10, sellAtEnd=OFF

Дефолты слайдеров: appr=3, rentGrowth=3, inv=7, inflation=2, down=20,
rate=2.9, term=25, maint=1.2. Mean-reversion переключатель OFF (cycleImpact
считается в symmetric).

## Таблица (price/rent — вход; finalDiff/parity/roi/cycleImpact — выход)

| Регион   | Сцен | Price € | Rent € | finalDiff € | Паритет | ROI % | cycleImpact € |
|----------|:----:|--------:|-------:|------------:|:-------:|------:|--------------:|
| Madrid   | A | 330000 | 1500 | 174274 | 3 | 8.5 |  35400 |
| Madrid   | B | 330000 | 1500 | 158791 | 3 | 7.8 |  15189 |
| Madrid   | C | 330000 | 1500 |  80913 | 3 | 11.3 |  7207 |
| Baleares | A | 370000 | 1400 |  62979 | 5 | 8.2 |  79667 |
| Baleares | B | 370000 | 1400 |  31729 | 5 | 6.3 |  34209 |
| Baleares | C | 370000 | 1400 |  44241 | 5 | 10.5 | 16271 |
| Cataluña | A | 200000 | 1200 |  62303 | 4 | 7.9 | -37865 |
| Cataluña | B | 200000 | 1200 | 204760 | 3 | 9.3 | -16226 |
| Cataluña | C | 200000 | 1200 |  33833 | 4 | 9.8 |  -7666 |
| Murcia   | A | 120000 |  650 |  51122 | 4 | 8.2 |  -2709 |
| Murcia   | B | 120000 |  650 |  98033 | 3 | 8.9 |  -1161 |
| Murcia   | C | 120000 |  650 |  25123 | 4 | 10.5 |  -550 |
| CLM      | A |  75000 |  600 |  27657 | 4 | 8.1 | -81950 |
| CLM      | B |  75000 |  600 | 145992 | 2 | 11.7 | -35026 |
| CLM      | C |  75000 |  600 |  14195 | 4 | 10.2 | -16415 |

## Сырой JSON (для точного диффа ПОСЛЕ)

```json
[
 {"region":"madrid","scen":"A","price":330000,"rent":1500,"finalDiff":174274,"parityYear":3,"roi":8.5,"cycleImpact":35400},
 {"region":"madrid","scen":"B","price":330000,"rent":1500,"finalDiff":158791,"parityYear":3,"roi":7.8,"cycleImpact":15189},
 {"region":"madrid","scen":"C","price":330000,"rent":1500,"finalDiff":80913,"parityYear":3,"roi":11.3,"cycleImpact":7207},
 {"region":"baleares","scen":"A","price":370000,"rent":1400,"finalDiff":62979,"parityYear":5,"roi":8.2,"cycleImpact":79667},
 {"region":"baleares","scen":"B","price":370000,"rent":1400,"finalDiff":31729,"parityYear":5,"roi":6.3,"cycleImpact":34209},
 {"region":"baleares","scen":"C","price":370000,"rent":1400,"finalDiff":44241,"parityYear":5,"roi":10.5,"cycleImpact":16271},
 {"region":"cataluna","scen":"A","price":200000,"rent":1200,"finalDiff":62303,"parityYear":4,"roi":7.9,"cycleImpact":-37865},
 {"region":"cataluna","scen":"B","price":200000,"rent":1200,"finalDiff":204760,"parityYear":3,"roi":9.3,"cycleImpact":-16226},
 {"region":"cataluna","scen":"C","price":200000,"rent":1200,"finalDiff":33833,"parityYear":4,"roi":9.8,"cycleImpact":-7666},
 {"region":"murcia","scen":"A","price":120000,"rent":650,"finalDiff":51122,"parityYear":4,"roi":8.2,"cycleImpact":-2709},
 {"region":"murcia","scen":"B","price":120000,"rent":650,"finalDiff":98033,"parityYear":3,"roi":8.9,"cycleImpact":-1161},
 {"region":"murcia","scen":"C","price":120000,"rent":650,"finalDiff":25123,"parityYear":4,"roi":10.5,"cycleImpact":-550},
 {"region":"clm","scen":"A","price":75000,"rent":600,"finalDiff":27657,"parityYear":4,"roi":8.1,"cycleImpact":-81950},
 {"region":"clm","scen":"B","price":75000,"rent":600,"finalDiff":145992,"parityYear":2,"roi":11.7,"cycleImpact":-35026},
 {"region":"clm","scen":"C","price":75000,"rent":600,"finalDiff":14195,"parityYear":4,"roi":10.2,"cycleImpact":-16415}
]
```
