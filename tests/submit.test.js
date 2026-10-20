'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'service-secret';
const { handler } = require('../netlify/functions/submit');

const call = (body, over = {}) => handler({
  httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': over.ip || '1.2.3.4' },
  body: typeof body === 'string' ? body : JSON.stringify(body), ...over.event,
});
const good = { form: 3, key: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', hp: '',
  data: { email: 'a@b.tn', participe: 'Oui', formule: 'El Jem', adultes: 1, enfants: 0, accompagnants: 'X', mobilite: 'Non' } };

test('succès : transmet des données validées avec la clé secrète, jamais renvoyée au client', async () => {
  let seen;
  global.fetch = async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ ok: true, total: 2, updated: false }) }; };
  const r = await call(good, { ip: '10.0.0.1' });
  assert.equal(r.statusCode, 200);
  const b = JSON.parse(r.body);
  assert.deepEqual([b.ok, b.total], [true, 2]);
  assert.match(seen.url, /\/rest\/v1\/rpc\/submit_form$/);
  assert.equal(seen.init.headers.apikey, 'service-secret');
  assert.equal(r.body.includes('service-secret'), false);
  assert.equal(JSON.parse(seen.init.body).p_data.adultes, 1);
});

test('validation : 400 avec erreurs par champ, la base n\'est pas appelée', async () => {
  let called = false; global.fetch = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  const r = await call({ ...good, data: { email: 'x', participe: 'Oui' } }, { ip: '10.0.0.2' });
  assert.equal(r.statusCode, 400);
  assert.ok(JSON.parse(r.body).errors.email);
  assert.equal(called, false);
});

test('honeypot : répond ok sans rien enregistrer', async () => {
  let called = false; global.fetch = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  const r = await call({ ...good, hp: 'http://spam' }, { ip: '10.0.0.3' });
  assert.equal(r.statusCode, 200); assert.equal(called, false);
});

test('méthode, JSON invalide, corps trop gros, formulaire inconnu', async () => {
  assert.equal((await handler({ httpMethod: 'GET', headers: {} })).statusCode, 405);
  assert.equal((await call('{pas du json', { ip: '10.0.0.4' })).statusCode, 400);
  assert.equal((await call('x'.repeat(30000), { ip: '10.0.0.5' })).statusCode, 413);
  assert.equal((await call({ ...good, form: 9 }, { ip: '10.0.0.6' })).statusCode, 400);
});

test('panne base : 502 sans fuite d\'information', async () => {
  global.fetch = async () => ({ ok: false, status: 500, json: async () => ({ message: 'secret detail' }) });
  const r = await call(good, { ip: '10.0.0.7' });
  assert.equal(r.statusCode, 502);
  assert.equal(r.body.includes('secret'), false);
});

test('origine non autorisée refusée quand ALLOWED_ORIGIN est défini', async () => {
  process.env.ALLOWED_ORIGIN = 'https://ripu26.netlify.app';
  const r = await call(good, { ip: '10.0.0.8', event: { headers: { origin: 'https://evil.example', 'x-nf-client-connection-ip': '10.0.0.8' } } });
  assert.equal(r.statusCode, 403);
  delete process.env.ALLOWED_ORIGIN;
});

test('limiteur : 429 après trop de tentatives depuis la même IP', async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  let last;
  for (let i = 0; i < 32; i++) last = await call(good, { ip: '10.9.9.9' });
  assert.equal(last.statusCode, 429);
});
