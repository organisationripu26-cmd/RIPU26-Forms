'use strict';
/** GET /api/export?view=participants|arrivees|accueil|excursion|totaux|stats|jour|tranche|vol[&format=json]
 *  Protégé : en-tête « Authorization: Bearer <ADMIN_TOKEN> » (jamais dans l'URL). Lecture seule. */
const crypto = require('crypto');
const { getDbConfig } = require('./lib/db');
const VIEWS = { participants: 'v_participants', arrivees: 'v_arrivees', accueil: 'v_accueil_aeroport', excursion: 'v_excursion',
  totaux: 'v_excursion_totaux', stats: 'v_stats', jour: 'v_arrivees_par_jour', tranche: 'v_arrivees_par_tranche', vol: 'v_arrivees_par_vol' };

const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const cell = v => {
  if (v == null) return '';
  let s = Array.isArray(v) ? v.join(' | ') : String(v);
  if (/^[=+\-@]/.test(s) && !/^\+?[0-9][0-9 ().-]{6,18}$/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

exports.handler = async (event) => {
  const tok = process.env.ADMIN_TOKEN, h = event.headers || {};
  const given = String(h.authorization || h.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok || tok.length < 24 || !same(given, tok)) return { statusCode: 401, body: 'Non autorisé' };
  const q = event.queryStringParameters || {}, name = q.view || 'participants', view = VIEWS[name];
  if (!view) return { statusCode: 400, body: 'Vue inconnue : ' + Object.keys(VIEWS).join(', ') };

  const { url, key: sk } = getDbConfig(name);
  if (!url || !sk) return { statusCode: 500, body: 'Configuration base de données manquante' };

  const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${view}?select=*`,
    { headers: { apikey: sk, authorization: `Bearer ${sk}` } });
  if (!r.ok) return { statusCode: 502, body: 'Erreur base de données' };
  const rows = await r.json();
  if (q.format === 'json') return { statusCode: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(rows) };
  const cols = rows.length ? Object.keys(rows[0]) : [];
  return { statusCode: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="ripu26_${name}.csv"`, 'cache-control': 'no-store' },
    body: '﻿' + [cols.join(','), ...rows.map(o => cols.map(c => cell(o[c])).join(','))].join('\r\n') };
};
