// merge_region.js slug "Region Name"
// Reads 4 tmp files from project root, merges into data/idealista_raw.json, deletes tmp files
const fs = require('fs');
const path = require('path');
const slug = process.argv[2];
const name = process.argv[3];
const ROOT = path.join(__dirname, '..');
const RAW_JSON = path.join(ROOT, 'data', 'idealista_raw.json');

function read(f) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); }
  catch(e) { return null; }
}

const vm = read(`${slug}_venta.json`);
const vh = read(`${slug}_venta_hist.json`);
const am = read(`${slug}_alquiler.json`);
const ah = read(`${slug}_alquiler_hist.json`);

if (!vm || !vh || !am || !ah) {
  const missing = [!vm&&'venta_main',!vh&&'venta_hist',!am&&'alquiler_main',!ah&&'alquiler_hist'].filter(Boolean);
  console.error(`ERROR: missing files for ${slug}:`, missing.join(', '));
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(RAW_JSON, 'utf8'));
raw.regions[slug] = {
  name,
  venta:    { url: vm.url, summary: vm.summary, provinces_table: vm.provinces_table, monthly_history: vh },
  alquiler: { url: am.url, summary: am.summary, provinces_table: am.provinces_table, monthly_history: ah }
};
fs.writeFileSync(RAW_JSON, JSON.stringify(raw, null, 2));

for (const f of [`${slug}_venta.json`,`${slug}_venta_hist.json`,`${slug}_alquiler.json`,`${slug}_alquiler_hist.json`]) {
  try { fs.unlinkSync(path.join(ROOT, f)); } catch(_) {}
}
console.log(`✓ ${name} (${slug}): venta ${vh.length} mes | alquiler ${ah.length} mes`);
