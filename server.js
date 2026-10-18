// Node wrapper for the Brandon's Lists add-on, kept running on this Mac by the
// com.brandonbodily.stremio-lists LaunchAgent. The add-on logic lives in addon.mjs.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 7000);
const HOST = process.env.HOST || '127.0.0.1';
const ROWS_FILE = process.env.ROWS_FILE || path.join(__dirname, 'rows.json');

async function main() {
  const { createAddon, RESPONSE_HEADERS, cacheControl } = await import('./addon.mjs');
  const rows = JSON.parse(fs.readFileSync(ROWS_FILE, 'utf8')).rows;
  const addon = createAddon(rows);

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, RESPONSE_HEADERS);
      return res.end();
    }
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const { status, body } = await addon.handle(pathname);
    res.writeHead(status, { ...RESPONSE_HEADERS, 'Cache-Control': cacheControl(status) });
    res.end(JSON.stringify(body));
  });

  server.listen(PORT, HOST, () => {
    console.log(`Brandon's Lists add-on: http://${HOST}:${PORT}/manifest.json (${rows.length} rows)`);
  });
}

main();
