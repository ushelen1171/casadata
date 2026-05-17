#!/usr/bin/env node
// update-cache-version.js
// Перебирает теги <script src="…?v=…"> и <link href="…?v=…"> в index.html,
// считает SHA-256 от содержимого каждого локального файла, обновляет ?v=… на
// первые 8 символов hex-хэша. Внешние URL (cdn.* и т.п.) пропускаются.
//
// Запуск:   node scripts/update-cache-version.js
// Идемпотентно: повторный прогон без правок не меняет файл.
'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT     = path.join(__dirname, '..');
const HTML     = path.join(ROOT, 'index.html');
const HASH_LEN = 8;

const html = fs.readFileSync(HTML, 'utf8');

// Захватываем атрибут src/href, путь до файла, и текущую ?v=… (если есть).
// Работает и с одинарными, и с двойными кавычками.
const TAG_RE = /(<(?:script|link)\b[^>]*?(?:src|href)=["'])([^"'?]+)(\?v=[^"']*)?(["'])/g;

let touched = 0;
let skipped = 0;
const seen = new Map(); // path → hash, чтобы один файл считать один раз

const updated = html.replace(TAG_RE, (full, prefix, urlPath, vParam, quote) => {
  // Внешние ресурсы (cdn / https / //example.com) не трогаем.
  if (/^([a-z]+:)?\/\//i.test(urlPath)) {
    skipped++;
    return full;
  }
  const filePath = path.join(ROOT, urlPath);
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠ not found, skip: ${urlPath}`);
    skipped++;
    return full;
  }
  let hash = seen.get(filePath);
  if (!hash) {
    const buf = fs.readFileSync(filePath);
    hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, HASH_LEN);
    seen.set(filePath, hash);
  }
  const newV = `?v=${hash}`;
  if (vParam === newV) return full;       // уже актуально — не трогаем
  touched++;
  console.log(`  ${urlPath}  ${vParam || '(no ?v)'} → ${newV}`);
  return `${prefix}${urlPath}${newV}${quote}`;
});

if (updated !== html) {
  fs.writeFileSync(HTML, updated);
  console.log(`\n✓ index.html обновлён: ${touched} тегов с новыми хэшами, ${skipped} пропущено (внешние/отсутствуют)\n`);
} else {
  console.log(`\n✓ index.html без изменений: все ?v=… уже актуальны (${seen.size} локальных файлов, ${skipped} внешних)\n`);
}
