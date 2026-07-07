# Calc1 Golden — ПОСЛЕ обновления price/rent (D1) · новый baseline

Дата снятия: 2026-07-06
Прогон enrich: `r.price`/`r.rent` теперь из июньского среза `idealista_raw.json`
(Madrid 4786 €/м² / 21.70 €/м²). Все build-time поля (growth/cagr/price/rent) —
от одного среза; derived (yield/pr/prAdj) считается в data.js от них.

Проверка единого среза (Madrid): `r.yield=5.441`, `r.yieldMean=5.691`,
`r.yieldZScore=−0.444` (было −0.508; Δ +0.064σ; фаза below сохранена).

Способ сбора и сценарии — идентичны `golden-calc1-pre-price-update.md`.

## Сдвиг ДО → ПОСЛЕ (finalDiff €, ROI %, cycleImpact €)

Паритет во всех 15 комбинациях **не изменился**. Знак finalDiff везде «+».

| Регион   | Сцен | Price ДО→ПОСЛЕ | finalDiff ДО→ПОСЛЕ | Δ% | ROI ДО→ПОСЛЕ | cycleImpact ДО→ПОСЛЕ |
|----------|:----:|:-------------:|:------------------:|---:|:------------:|:--------------------:|
| Madrid   | A | 330000→335000 | 174274→173838 | −0.3% | 8.5→8.5  | 35400→30755 |
| Madrid   | B | 330000→335000 | 158791→151019 | −4.9% | 7.8→7.7  | 15189→13196 |
| Madrid   | C | 330000→335000 |  80913→ 81059 | +0.2% | 11.3→11.3 | 7207→6259 |
| Baleares | A | 370000→375000 |  62979→ 53819 | −14.5%| 8.2→8.2  | 79667→76980 |
| Baleares | B | 370000→375000 |  31729→ 23686 | −25.4%| 6.3→6.3  | 34209→33054 |
| Baleares | C | 370000→375000 |  44241→ 41325 | −6.6% | 10.5→10.5 | 16271→15719 |
| Cataluña | A | 200000→205000 |  62303→ 63860 | +2.5% | 7.9→7.9  | −37865→−42247 |
| Cataluña | B | 200000→205000 | 204760→218835 | +6.9% | 9.3→9.5  | −16226→−18103 |
| Cataluña | C | 200000→205000 |  33833→ 34679 | +2.5% | 9.8→9.8  | −7666→−8552 |
| Murcia   | A | 120000→125000 |  51122→ 53252 | +4.2% | 8.2→8.2  | −2709→−771 |
| Murcia   | B | 120000→125000 |  98033→ 89990 | −8.2% | 8.9→8.5  | −1161→−331 |
| Murcia   | C | 120000→125000 |  25123→ 26170 | +4.2% | 10.5→10.5 | −550→−156 |
| CLM      | A |  75000→ 80000 |  27657→ 29502 | +6.7% | 8.1→8.1  | −81950→−80109 |
| CLM      | B |  75000→ 80000 | 145992→137813 | −5.6% | 11.7→11.2 | −35026→−34242 |
| CLM      | C |  75000→ 80000 |  14195→ 15141 | +6.7% | 10.2→10.2 | −16415→−16050 |

Сдвиг **не** равномерный: округление слайдеров (цена до 5000, аренда до 50)
квантует малое изменение €/м². Где аренда осталась на месте, а цена выросла
(Madrid, Baleares), тонкая маржа buy-vs-rent просела сильнее (ливеридж на
разности больших чисел). Ни одного скачка «в разы», ни смены знака.

## Сырой JSON ПОСЛЕ (новый baseline)

```json
[
 {"region":"madrid","scen":"A","price":335000,"rent":1500,"finalDiff":173838,"parityYear":3,"roi":8.5,"cycleImpact":30755},
 {"region":"madrid","scen":"B","price":335000,"rent":1500,"finalDiff":151019,"parityYear":3,"roi":7.7,"cycleImpact":13196},
 {"region":"madrid","scen":"C","price":335000,"rent":1500,"finalDiff":81059,"parityYear":3,"roi":11.3,"cycleImpact":6259},
 {"region":"baleares","scen":"A","price":375000,"rent":1400,"finalDiff":53819,"parityYear":5,"roi":8.2,"cycleImpact":76980},
 {"region":"baleares","scen":"B","price":375000,"rent":1400,"finalDiff":23686,"parityYear":5,"roi":6.3,"cycleImpact":33054},
 {"region":"baleares","scen":"C","price":375000,"rent":1400,"finalDiff":41325,"parityYear":5,"roi":10.5,"cycleImpact":15719},
 {"region":"cataluna","scen":"A","price":205000,"rent":1250,"finalDiff":63860,"parityYear":4,"roi":7.9,"cycleImpact":-42247},
 {"region":"cataluna","scen":"B","price":205000,"rent":1250,"finalDiff":218835,"parityYear":3,"roi":9.5,"cycleImpact":-18103},
 {"region":"cataluna","scen":"C","price":205000,"rent":1250,"finalDiff":34679,"parityYear":4,"roi":9.8,"cycleImpact":-8552},
 {"region":"murcia","scen":"A","price":125000,"rent":650,"finalDiff":53252,"parityYear":4,"roi":8.2,"cycleImpact":-771},
 {"region":"murcia","scen":"B","price":125000,"rent":650,"finalDiff":89990,"parityYear":3,"roi":8.5,"cycleImpact":-331},
 {"region":"murcia","scen":"C","price":125000,"rent":650,"finalDiff":26170,"parityYear":4,"roi":10.5,"cycleImpact":-156},
 {"region":"clm","scen":"A","price":80000,"rent":600,"finalDiff":29502,"parityYear":4,"roi":8.1,"cycleImpact":-80109},
 {"region":"clm","scen":"B","price":80000,"rent":600,"finalDiff":137813,"parityYear":2,"roi":11.2,"cycleImpact":-34242},
 {"region":"clm","scen":"C","price":80000,"rent":600,"finalDiff":15141,"parityYear":4,"roi":10.2,"cycleImpact":-16050}
]
```
