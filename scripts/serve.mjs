import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
const allowed = new Set(['index.html','app.js','engine.js','content.js','styles.css','assets/planet.svg']);
const server = http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!allowed.has(relative) || !['GET','HEAD'].includes(req.method)) { res.writeHead(404); res.end('Not found'); return; }
    const data = await readFile(path.join(root,relative));
    res.writeHead(200, {'Content-Type': types[path.extname(relative)] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(Number(process.env.PORT || 4173),'127.0.0.1',() => console.log(`AI星球运行中：http://127.0.0.1:${server.address().port}`));
