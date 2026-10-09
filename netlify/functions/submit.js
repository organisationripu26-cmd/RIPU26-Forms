'use strict';
/** POST /api/submit — point d'entrée unique des 3 formulaires.
 *  Requis : SUPABASE_URL, SUPABASE_SERVICE_KEY (secrète, jamais dans le HTML).
 *  Optionnels : ALLOWED_ORIGIN (liste séparée par des virgules), RESEND_API_KEY, ORG_NOTIFY_EMAIL, MAIL_FROM. */
const { validate } = require('./lib/validate');
const { notify } = require('./lib/notify');
const { getDbConfig } = require('./lib/db');

const hits = new Map();                                    // limiteur best-effort (par instance)
function limited(ip) {
  const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 60000); a.push(now); hits.set(ip, a);
  if (hits.size > 5000) hits.clear();
  return a.length > 30;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

exports.handler = async (event) => {
  const h = event.headers || {};
  const origin = h.origin || h.Origin || '';
  const allowed = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const reply = (status, body) => ({
    statusCode: status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(allowed.length && allowed.includes(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}) },
    body: JSON.stringify(body),
  });
  if (event.httpMethod === 'OPTIONS') return { ...reply(204, {}), headers: { 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', ...(allowed.includes(origin) ? { 'access-control-allow-origin': origin } : {}) }, body: '' };
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Méthode non autorisée.' });
  if (allowed.length && origin && !allowed.includes(origin)) return reply(403, { ok: false, error: 'Origine refusée.' });
  if ((event.body || '').length > 20000) return reply(413, { ok: false, error: 'Requête trop volumineuse.' });

  const ip = String(h['x-nf-client-connection-ip'] || h['x-forwarded-for'] || '?').split(',')[0].trim();
  if (limited(ip)) return reply(429, { ok: false, error: 'Trop de tentatives. Réessayez dans une minute.' });

  let b; try { b = JSON.parse(event.body || ''); } catch { return reply(400, { ok: false, error: 'JSON invalide.' }); }
  if (!b || typeof b !== 'object') return reply(400, { ok: false, error: 'Requête invalide.' });
  if (b.hp) return reply(200, { ok: true });               // piège à robots : on feint le succès sans rien écrire

  const form = Number(b.form);
  if (![1, 2, 3].includes(form) || typeof b.key !== 'string' || !UUID.test(b.key)) return reply(400, { ok: false, error: 'Requête incomplète.' });

  const v = validate(form, b.data);
  if (!v.ok) return reply(400, { ok: false, errors: v.errors });

  const { url, key: sk } = getDbConfig(form);
  if (!url || !sk) { console.error('Configuration serveur manquante'); return reply(500, { ok: false, error: 'Service momentanément indisponible.' }); }
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/submit_form`, {
      method: 'POST', headers: { 'content-type': 'application/json', apikey: sk, authorization: `Bearer ${sk}` },
      body: JSON.stringify({ p_form: form, p_key: b.key, p_data: v.data }),
    });
    if (!r.ok) { console.error('submit_form HTTP', r.status); return reply(502, { ok: false, error: "L'enregistrement a échoué. Réessayez dans un instant." }); }
    const res = await r.json();
    if (!res.duplicate) { try { await notify(form, v.data, res); } catch (e) { console.error('notify:', e.message); } }
    return reply(200, { ok: true, total: res.total, updated: !!res.updated });
  } catch (e) {
    console.error('submit:', e.message);                  // jamais de données personnelles dans les logs
    return reply(502, { ok: false, error: "L'enregistrement a échoué. Réessayez dans un instant." });
  }
};
