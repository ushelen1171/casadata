// Вычислить оптимальный viewBox для полной видимости всех территорий

const https = require('https');

function computeOptimalViewBox() {
  https.get('https://cdn.jsdelivr.net/npm/datamaps@0.5.10/src/js/data/esp.topo.json', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const topo = JSON.parse(data);
      
      // Использует таких же параметров как в коде:
      const projection = {
        scale: 2800,
        center: [-3.5, 40],
        translate: [250, 210]  // Это будет изменено на width/2, height/2
      };
      
      // Симуляция D3 geoMercator
      function mercatorProject(center, scale, translate) {
        return (lonLat) => {
          const lambda = (lonLat[0] - center[0]) * Math.PI / 180;
          const phi = (lonLat[1] - center[1]) * Math.PI / 180;
          const sinPhi = Math.sin(phi);
          
          const x = scale * lambda;
          const y = scale * Math.log((1 + sinPhi) / (1 - sinPhi)) / 2;
          
          return [translate[0] + x, translate[1] - y];
        };
      }
      
      const project = mercatorProject([projection.center[0], projection.center[1]], projection.scale, [0, 0]);
      
      // Найти границы всех геометрий
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      const features = topo.objects.esp.geometries;
      features.forEach((feature, idx) => {
        if (!feature.type || !feature.arcs) return;
        
        // Получить примерные границы на основе nombres регионов
        const name = feature.properties?.name;
        
        // Для простоты, получить все точки из координат (это сложно/требует декодирования)
        // Вместо этого используем известные границы Испании + Канарских/Балеарских остров
        
        // Приблизительные координаты ключевых точек:
        // Northwest (Galicia): -9.5, 43
        // Northeast (Catalonia): 3, 42
        // Southwest (Andalusia): -3.5, 36
        // Southeast (Murcia): -1, 37
        // Canarias: -16, 28
        // Baleares: 3.5, 39
        
        if (name === 'Barcelona' || name === 'Tarragona' || name === 'Gerona') {
          // Northeast - extend east
          maxX = Math.max(maxX, 3.5);
          maxY = Math.max(maxY, 42.5);
          minY = Math.min(minY, 41);
        }
        if (name === 'Baleares') {
          // Islands east
          maxX = Math.max(maxX, 4);
        }
        if (name === 'Las Palmas' || name === 'Santa Cruz de Tenerife' || name === 'Las Palmas') {
          // Canarias far west
          minX = Math.min(minX, -17);
        }
        if (name === 'La Coruña' || name === 'Pontevedra') {
          // Galicia west
          minX = Math.min(minX, -9);
        }
      });
      
      // Если autodetect не сработал, используем известные границы Испании
      if (!isFinite(minX)) {
        minX = -17.2;  // Canary Islands west
        maxX = 4.3;    // Catalonia + Baleares east
        minY = 27.6;   // Canary Islands south
        maxY = 43.8;   // Galicia north
      }
      
      console.log('Примерные границы Испании (географические координаты):');
      console.log(`Запад: ${minX.toFixed(1)}°, Восток: ${maxX.toFixed(1)}°`);
      console.log(`Юг: ${minY.toFixed(1)}°, Север: ${maxY.toFixed(1)}°`);
      
      // Проект границ
      const p1 = project([minX, minY]);
      const p2 = project([minX, maxY]);
      const p3 = project([maxX, minY]);
      const p4 = project([maxX, maxY]);
      
      console.log('Спроектированные координаты:');
      console.log(`  Юго-Западный угол: (${p1[0].toFixed(0)}, ${p1[1].toFixed(0)})`);
      console.log(`  Северо-Западный угол: (${p2[0].toFixed(0)}, ${p2[1].toFixed(0)})`);
      console.log(`  Юго-Восточный угол: (${p3[0].toFixed(0)}, ${p3[1].toFixed(0)})`);
      console.log(`  Северо-Восточный угол: (${p4[0].toFixed(0)}, ${p4[1].toFixed(0)})`);
      
      // Найти границы проектированных точек
      const projMinX = Math.min(p1[0], p2[0], p3[0], p4[0]);
      const projMaxX = Math.max(p1[0], p2[0], p3[0], p4[0]);
      const projMinY = Math.min(p1[1], p2[1], p3[1], p4[1]);
      const projMaxY = Math.max(p1[1], p2[1], p3[1], p4[1]);
      
      console.log('');
      console.log('Границы проектированных координат:');
      console.log(`X: от ${projMinX.toFixed(0)} до ${projMaxX.toFixed(0)} (ширина: ${(projMaxX - projMinX).toFixed(0)})`);
      console.log(`Y: от ${projMinY.toFixed(0)} до ${projMaxY.toFixed(0)} (высота: ${(projMaxY - projMinY).toFixed(0)})`);
      
      const projWidth = projMaxX - projMinX;
      const projHeight = projMaxY - projMinY;
      const pad = 50;  // Отступ вокруг карты
      
      const suggestedWidth = Math.ceil(projWidth + 2*pad);
      const suggestedHeight = Math.ceil(projHeight + 2*pad);
      
      console.log('');
      console.log('РЕКОМЕНДУЕМЫЙ viewBox:');
      console.log(`width: ${suggestedWidth}, height: ${suggestedHeight}`);
      console.log(`viewBox: "0 0 ${suggestedWidth} ${suggestedHeight}"`);
      console.log(`translate: [${(suggestedWidth/2).toFixed(0)}, ${(suggestedHeight/2).toFixed(0)}]`);
      
      console.log('');
      console.log('Текущие значения в коде:');
      console.log(`width: 580, height: 500`);
      console.log(`translate: [290, 250]`);
      
      if (suggestedWidth > 580 || suggestedHeight > 500) {
        console.log('');
        console.warn('⚠ ВНИМАНИЕ: Текущий viewBox может быть недостаточным!');
        console.warn(`Рекомендуется увеличить до ${suggestedWidth}x${suggestedHeight}`);
      } else {
        console.log('');
        console.log('✓ Текущий viewBox (580x500) должен быть достаточным');
      }
    });
  }).on('error', e => console.error(e));
}

computeOptimalViewBox();
