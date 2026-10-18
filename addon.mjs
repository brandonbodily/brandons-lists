// Shared core of the Brandon's Lists Stremio catalog add-on, used by server.js
// (Node, this Mac), worker.mjs (Cloudflare Workers) and build-static.mjs (GitHub Pages).
// No API keys: it reads MDBList's public list JSON and lets Cinemeta supply full metadata.

const PAGE_SIZE = 100;
const CACHE_SECONDS = 3 * 60 * 60;

// A row's catalog id stays fixed (row.id) even if its source list is swapped later,
// so Stremio's saved copy of the manifest keeps matching.
export const catalogId = (r) => r.id || `mdb.${r.mdblist_user}.${r.mdblist_slug}`;

// MDBList list items -> Stremio metas for this row's type.
export function toMetas(row, items) {
  const wanted = row.type === 'series' ? 'show' : 'movie';
  return items
    .filter((it) => it.imdb_id && it.mediatype === wanted)
    .map((it) => ({
      id: it.imdb_id,
      type: row.type,
      name: it.title,
      poster: `https://images.metahub.space/poster/medium/${it.imdb_id}/img`,
      releaseInfo: it.release_year ? String(it.release_year) : undefined,
    }));
}

export function createAddon(rows, { fetchList } = {}) {
  const byId = new Map(rows.map((r) => [catalogId(r), r]));

  const manifest = {
    id: 'family.mdblist.rows',
    version: '1.0.1',
    name: "Brandon's Lists",
    description: 'Top 10 and genre rows from public MDBList lists.',
    resources: ['catalog'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: rows.map((r) => ({
      id: catalogId(r),
      type: r.type,
      name: r.name,
      extra: [{ name: 'skip', isRequired: false }],
    })),
    behaviorHints: { configurable: false },
  };

  const memo = new Map();

  async function fetchPage(row, skip) {
    const key = `${catalogId(row)}:${skip}`;
    const hit = memo.get(key);
    if (hit && Date.now() - hit.at < CACHE_SECONDS * 1000) return hit.metas;

    const url = `${row.url}/json?limit=${PAGE_SIZE}&offset=${skip}`;
    const metas = toMetas(row, await (fetchList || defaultFetchList)(url));
    memo.set(key, { at: Date.now(), metas });
    return metas;
  }

  // Returns { status, body } for a request path.
  async function handle(pathname) {
    if (pathname === '/' || pathname === '/manifest.json') return { status: 200, body: manifest };

    // /catalog/:type/:id.json or /catalog/:type/:id/skip=N.json
    const m = pathname.match(/^\/catalog\/(movie|series)\/([^/]+?)(?:\/([^/]+))?\.json$/);
    if (!m) return { status: 404, body: { err: 'not found' } };

    const row = byId.get(m[2]);
    if (!row || row.type !== m[1]) return { status: 404, body: { err: 'unknown catalog' } };
    const skip = Number(new URLSearchParams(m[3] || '').get('skip') || 0);

    try {
      return { status: 200, body: { metas: await fetchPage(row, skip) } };
    } catch (err) {
      console.error(err.message);
      return { status: 502, body: { err: 'upstream failed' } };
    }
  }

  return { manifest, handle };
}

export async function defaultFetchList(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'brandons-lists-addon/1.0' } });
  if (!res.ok) throw new Error(`MDBList ${res.status} for ${url}`);
  return res.json();
}

export const RESPONSE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

export const cacheControl = (status) => (status === 200 ? 'public, max-age=1800' : 'no-store');
export { CACHE_SECONDS };
