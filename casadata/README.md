# CasaData — Аналитика недвижимости Испании

## Структура проекта

```
casadata/
  index.html          ← главная страница (только HTML-скелет)
  css/
    style.css         ← весь дизайн и стили
  js/
    data.js           ← ВСЕ данные: цены, регионы, ITP
    i18n.js           ← переводы (RU / EN / ES)
    app.js            ← логика: карта, калькулятор купить/снять, P/R
    rental-calc.js    ← калькулятор аренды (три стратегии)
```

---

## Как обновлять данные (раз в квартал)

### Обновить цены по регионам
Открой `js/data.js`, найди массив `REGIONS`, измени нужные числа:
```js
{ name:'Madrid', price:4234, rent:20.30, itp:0.06, growth10:86 },
//                     ↑              ↑
//               цена €/м²     аренда €/м²/мес
```
Источники: idealista.com/news → отчёты по регионам, INE.es → IPV

### Обновить данные тепловой карты (рост цен по годам)
В том же файле найди `GROWTH_DATA`, добавь/измени последнее число в строке региона:
```js
'Madrid': [6.1, 9.5, 12.2, 11.0, -1.2, 6.5, 5.8, 9.1, 11.9, 11.6],
//                                                           ↑
//                                                       рост за 2025
```

---

## Как добавить рекламный баннер

В `index.html` найди закомментированные блоки `<!-- Рекламный баннер -->` и раскомментируй:
```html
<div class="banner-slot">
  <a href="https://ваш-партнёр.com" target="_blank" rel="noopener">
    <img src="banner-top.jpg" alt="Описание">
  </a>
</div>
```
Класс `.banner-slot` уже задан в style.css.

---

## Как добавить новый язык

В `js/i18n.js` скопируй блок `ru: { ... }`, замени код языка и переведи все строки.
Затем в `index.html` добавь кнопку в `.lang-switcher`:
```html
<button class="lang-btn" onclick="setLang('de')...">DE</button>
```

---

## Как добавить новую страницу

1. В `index.html` добавь кнопку в навигацию:
```html
<button class="nav-btn" onclick="showPage('mypage', this)">Моя страница</button>
```
2. Добавь блок страницы:
```html
<div class="page" id="page-mypage">
  <!-- содержимое -->
</div>
```
3. Если нужна логика — добавь функцию в `app.js` и вызови её в `showPage()`.

---

## Публикация на Netlify

**Первый раз:**
1. Зайди на netlify.com/drop
2. Перетащи папку `casadata/` целиком
3. Получи ссылку вида `*.netlify.app`

**Обновление:**
- Просто перетащи папку снова — старая версия заменится
- Или подключи GitHub для автоматического деплоя при каждом сохранении

---

## Источники данных (обновляй раз в квартал)

- **Цены по регионам**: https://www.idealista.com/news/inmobiliario/vivienda/
- **Официальная статистика**: https://www.ine.es (раздел IPV — Índice de Precios de Vivienda)
- **Данные по сделкам**: https://www.registradores.org (Estadística Registral Inmobiliaria)
- **Аренда**: https://www.idealista.com/news/inmobiliario/alquiler/
