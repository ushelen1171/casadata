# Calc1 Golden Numbers — снято перед удалением кнопок сценариев

Дата снятия: 2026-06-04
Коммит: 4ccec53 (cycle position popup + mean reversion в Advanced)

Цель: точка отката для удаления кнопок Pessimistic/Base/Optimistic и связанного
кода (`setStressTest1`, `getApprForScenario`, DEFAULTS-fallbacks, i18n-ключи) +
добавления видимого общего слайдера `c1-appr` для темпа роста цен и аренды.

После всех правок прогон 15 комбинаций должен дать **полностью идентичные** числа
(до евро / целой 0.1% / целого года паритета). Любое расхождение указывает на
ошибку переноса логики или нечайно сломанную формулу.

## Bonus: фиксация поведения «Base»

Замечено перед удалением:

- После `resetCalc1`: `c1-appr = 3`, `c1-rentg = 3` (`DEFAULTS.apprDefault` / `rentGrowthDefault`).
- После `setStressTest1('base')` на Madrid: `c1-appr = 10.7`, `c1-rentg = 3`.

То есть кнопка «Base» НЕ возвращает дефолты — она подставляет региональный
5-летний CAGR (`r.cagr5`) в `appr`. После удаления кнопок дефолт = 3% будет
однозначным.

## Сценарий A: Nominal, Realistic, 25 лет, sellAtEnd=OFF, mean reversion OFF

| Регион   | Разница (€) | Паритет | ROI (%) |
|----------|------------:|--------:|--------:|
| Madrid   | +174 274    | 3 года  | 8.5     |
| Baleares |  +62 979    | 5 лет   | 8.2     |
| Cataluña |  +62 303    | 4 года  | 7.9     |
| Murcia   |  +51 122    | 4 года  | 8.2     |
| CLM      |  +27 657    | 4 года  | 8.1     |

## Сценарий B: Real, Symmetric, 20 лет, sellAtEnd=ON, mean reversion OFF

| Регион   | Разница (€) | Паритет | ROI (%) |
|----------|------------:|--------:|--------:|
| Madrid   | +158 791    | 3 года  | 7.8     |
| Baleares |  +31 729    | 5 лет   | 6.3     |
| Cataluña | +204 760    | 3 года  | 9.3     |
| Murcia   |  +98 033    | 3 года  | 8.9     |
| CLM      | +145 992    | 2 года  | 11.7    |

## Сценарий C: Nominal, Realistic, 10 лет, sellAtEnd=OFF, mean reversion OFF

| Регион   | Разница (€) | Паритет | ROI (%) |
|----------|------------:|--------:|--------:|
| Madrid   |  +80 913    | 3 года  | 11.3    |
| Baleares |  +44 241    | 5 лет   | 10.5    |
| Cataluña |  +33 833    | 4 года  | 9.8     |
| Murcia   |  +25 123    | 4 года  | 10.5    |
| CLM      |  +14 195    | 4 года  | 10.2    |

---

Все строки сняты после `resetCalc1` (без нажатия Base) с дефолтами
`appr=3, rentg=3, inv=7, inflation=2, mortgageRate=2.9, mortgageTerm=25,
downPaymentPct=20, maintenancePct=1.2`. Mean reversion остаётся OFF во всех
строках (тест не проверяет влияние ON — это отдельный шаг).
