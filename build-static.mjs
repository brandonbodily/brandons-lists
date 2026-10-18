// Builds the add-on as plain JSON files for GitHub Pages:
//   docs/manifest.json
//   docs/catalog/<type>/<id>.json             (first page)
//   docs/catalog/<type>/<id>/skip=<n>.json    (later pages)
// Stremio asks for skip=<number of items it already has>, so pages are cut at
// exactly PAGE_SIZE items after filtering. Run by .github/workflows/refresh.yml.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAddon, catalogId, toMetas, defaultFetchList } from './addon.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FINAL = path.join(here, 'docs');
const OUT = path.join(here, '.docs-build');
const PAGE_SIZE = 100;
const MAX_ITEMS = 300;

const { rows } = JSON.parse(fs.readFileSync(path.join(here, 'rows.json'), 'utf8'));
const { manifest } = createAddon(rows);

function write(rel, body) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(body));
}

async function allItems(row) {
  const items = [];
  for (let offset = 0; offset < MAX_ITEMS; offset += PAGE_SIZE) {
    const page = await defaultFetchList(`${row.url}/json?limit=${PAGE_SIZE}&offset=${offset}`);
    items.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return items;
}

fs.rmSync(OUT, { recursive: true, force: true });
write('manifest.json', manifest);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

let failed = 0;
for (const row of rows) {
  const id = catalogId(row);
  try {
    const metas = toMetas(row, await allItems(row));
    for (let skip = 0; skip === 0 || skip < metas.length; skip += PAGE_SIZE) {
      const rel = skip === 0 ? `catalog/${row.type}/${id}.json` : `catalog/${row.type}/${id}/skip=${skip}.json`;
      write(rel, { metas: metas.slice(skip, skip + PAGE_SIZE) });
    }
    console.log(`${row.name}: ${metas.length} titles`);
  } catch (err) {
    failed++;
    console.error(`${row.name}: ${err.message} (keeping previous files)`);
    // Keep the last good pages for this row instead of dropping it.
    for (const rel of [`catalog/${row.type}/${id}.json`, `catalog/${row.type}/${id}`]) {
      const prev = path.join(FINAL, rel);
      if (fs.existsSync(prev)) fs.cpSync(prev, path.join(OUT, rel), { recursive: true });
    }
  }
}

// Fail the workflow (keeping the last good commit) if most lists broke.
if (failed > rows.length / 2) {
  console.error(`${failed} of ${rows.length} lists failed`);
  fs.rmSync(OUT, { recursive: true, force: true });
  process.exit(1);
}

fs.rmSync(FINAL, { recursive: true, force: true });
fs.renameSync(OUT, FINAL);
