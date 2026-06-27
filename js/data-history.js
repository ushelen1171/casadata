// ============================================================
// data-history.js — загрузка помесячной истории и расчёт yield-агрегатов
// Подключается ПОСЛЕ data.js, ДО app.js. Не блокирует загрузку — async fetch.
// После готовности диспатчит CustomEvent 'historyLoaded' на document
// и выставляет window.historyReady = true.
//
// Прикрепляет к каждому объекту REGIONS поля:
//   yieldMean, yieldStd, yieldMin, yieldMax,
//   yieldCount, yieldFirstMonth, yieldLastMonth,
//   yieldZScore = (region.yield − yieldMean) / yieldStd
// ============================================================

window.historyReady = false;

// Сглаженный trailing-рост: mean(последние 12) / mean(предыдущие 12) − 1, в %.
// arr — массив чисел (по возрастанию даты). null если точек меньше 24.
function trailingGrowthPct(arr) {
  const vals = arr.filter(v => typeof v === 'number');
  if (vals.length < 24) return null;
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const m1 = mean(vals.slice(-12));
  const m0 = mean(vals.slice(-24, -12));
  if (m0 === 0) return null;
  return (m1 / m0 - 1) * 100;
}

(function loadHistory() {
  fetch('data/history.json')
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(history => {
      for (const [id, blob] of Object.entries(history.regions)) {
        const venta    = new Map(blob.venta.map(x => [x.mes, x.precio_m2]));
        const alquiler = new Map(blob.alquiler.map(x => [x.mes, x.precio_m2]));
        // Совмещаем по месяцам: yield считается только там, где есть и цена, и аренда.
        const months = [...venta.keys()].filter(m => alquiler.has(m)).sort();
        if (months.length === 0) continue;

        const yields = months.map(m => alquiler.get(m) * 12 / venta.get(m) * 100);
        const n = yields.length;
        const mean = yields.reduce((a, b) => a + b, 0) / n;
        // Sample stdev (делим на n−1).
        const variance = n > 1
          ? yields.reduce((s, y) => s + (y - mean) ** 2, 0) / (n - 1)
          : 0;
        const std = Math.sqrt(variance);
        const min = Math.min(...yields);
        const max = Math.max(...yields);

        const region = REGIONS.find(r => r.id === id);
        if (!region) continue;
        region.yieldMean       = mean;
        region.yieldStd        = std;
        region.yieldMin        = min;
        region.yieldMax        = max;
        region.yieldCount      = n;
        region.yieldFirstMonth = months[0];
        region.yieldLastMonth  = months[months.length - 1];
        region.yieldZScore     = std > 0 ? (region.yield - mean) / std : 0;
        // Помесячный yield (только месяцы с обеими ценами) — для sparkline и Шага 2.
        region.yieldHistory    = months.map((m, i) => ({ mes: m, yield: yields[i] }));
        // Помесячные цена покупки и аренда — для divergence (12m trailing).
        region.priceHistory    = months.map(m => ({ mes: m, price: venta.get(m) }));
        region.rentHistory     = months.map(m => ({ mes: m, rent:  alquiler.get(m) }));
        // Фаза цикла по z-score: порог ±0.5 — значимое (не шумовое) отклонение.
        region.cyclePhase = region.yieldZScore > 0.5 ? 'above'
                          : region.yieldZScore < -0.5 ? 'below'
                          : 'neutral';

        // Divergence: сглаженный trailing-рост цены минус рост аренды (п.п.).
        const priceGrowth12 = trailingGrowthPct(region.priceHistory.map(p => p.price));
        const rentGrowth12  = trailingGrowthPct(region.rentHistory.map(p => p.rent));
        if (priceGrowth12 !== null && rentGrowth12 !== null) {
          region.priceGrowth12m = priceGrowth12;
          region.rentGrowth12m  = rentGrowth12;
          region.divergence12m  = priceGrowth12 - rentGrowth12;
          region.divergenceClass =
              region.divergence12m >  2 ? 'prices_outpace'
            : region.divergence12m < -2 ? 'rents_outpace'
            : 'synchronous';
          region.priceDirection =
              priceGrowth12 >  1 ? 'up'
            : priceGrowth12 < -1 ? 'down'
            : 'flat';
        } else {
          region.divergence12m = null;
        }
      }

      window.historyReady = true;
      document.dispatchEvent(new CustomEvent('historyLoaded'));

      // Sanity-логи (можно удалить в финальной версии).
      console.log('History loaded:', Object.keys(history.regions).length, 'regions');
      const madrid = REGIONS.find(r => r.id === 'madrid');
      if (madrid && madrid.yieldMean != null) {
        console.log('Madrid yield stats:', {
          current: madrid.yield.toFixed(2),
          mean: madrid.yieldMean.toFixed(2),
          std: madrid.yieldStd.toFixed(2),
          range: `${madrid.yieldMin.toFixed(2)} — ${madrid.yieldMax.toFixed(2)}`,
          zScore: madrid.yieldZScore.toFixed(2),
          count: madrid.yieldCount + ' months',
        });
      }
    })
    .catch(err => {
      // Не блокируем приложение — yield*-поля у регионов остаются undefined,
      // а UI Калькулятора 1/2 на них пока не смотрит.
      console.error('Failed to load data/history.json:', err);
    });
})();
