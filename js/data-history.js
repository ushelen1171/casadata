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
