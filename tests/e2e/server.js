'use strict';
/* Serveur de test local : sert frontend/ et exécute le VRAI handler /api/submit,
 * mais la base est un PostgreSQL local jetable (via psql) au lieu de Supabase.
 * Usage : PGHOST=/var/tmp/ripu_pg PGPORT=5544 PGUSER=postgres PGDATABASE=ripu26_test node tests/e2e/server.js */
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
process.env.SUPABASE_URL = 'http://fake.local'; process.env.SUPABASE_SERVICE_KEY = 'test';
const { handler } = require('../../netlify/functions/submit');
global.fetch = async (url, init) => {                       // émule PostgREST /rpc/submit_form
  const b = JSON.parse(init.body);
  try {
    const sql = `set role service_role; select submit_form(${+b.p_form}, '${b.p_key}', $j$${JSON.stringify(b.p_data)}$j$::jsonb)`;
    const out = execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql]).toString().trim().split('\n').pop();
    return { ok: true, status: 200, json: async () => JSON.parse(out) };
  } catch (e) { console.error('SQL', String(e.stderr || e.message).slice(0, 300)); return { ok: false, status: 500, json: async () => ({}) }; }
};
const root = path.join(__dirname, '../../frontend'), types = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.css': 'text/css' };
http.createServer((req, res) => {
  if (req.url === '/api/submit') {
    let body = ''; req.on('data', c => body += c);
    return req.on('end', async () => { const r = await handler({ httpMethod: req.method, headers: req.headers, body }); res.writeHead(r.statusCode, r.headers); res.end(r.body); });
  }
  const f = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
}).listen(8098, () => console.log('http://localhost:8098'));
