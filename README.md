# Brandon's Lists

A small Stremio catalog add-on: Top 10 and genre rows built from public [MDBList](https://mdblist.com) lists. It needs no API keys. Rows only list titles; Cinemeta and your stream add-ons do the rest.

Install in Stremio: `https://brandonbodily.github.io/brandons-lists/manifest.json`

## How it works

- `rows.json` defines each row: its name, type, and source list. The row `id` stays fixed even if the source list is swapped.
- `addon.mjs` holds the shared add-on logic.
- `build-static.mjs` writes the add-on as static JSON into `docs/`, and GitHub Pages serves that folder.
- `.github/workflows/refresh.yml` rebuilds `docs/` every 3 hours and commits any changes.
- `server.js` (local Node server) and `worker.mjs` (Cloudflare Workers) serve the same add-on live, as alternatives.

## Changing rows

Edit `rows.json` and push. The workflow rebuilds the site. If you rename, add or remove a row, Stremio keeps its saved copy of the manifest until the add-on is reinstalled or refreshed.
