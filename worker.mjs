// Cloudflare Workers wrapper for the Brandon's Lists add-on, so phones and other
// homes can reach it over HTTPS. The add-on logic lives in addon.mjs.
import { createAddon, RESPONSE_HEADERS, cacheControl, CACHE_SECONDS } from './addon.mjs';
import data from './rows.json';

// Cache MDBList responses at Cloudflare's edge so each list is fetched at most every few hours.
async function fetchList(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'brandons-lists-addon/1.0' },
    cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`MDBList ${res.status} for ${url}`);
  return res.json();
}

const addon = createAddon(data.rows, { fetchList });

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: RESPONSE_HEADERS });
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const { status, body } = await addon.handle(pathname);
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...RESPONSE_HEADERS, 'Cache-Control': cacheControl(status) },
    });
  },
};
