'use strict';
/** Résumé quotidien envoyé à ORG_NOTIFY_EMAIL (planifié dans netlify.toml, 07h00 UTC).
 *  Ne contient que des totaux, aucune donnée nominative. */
const { send } = require('./lib/notify');
const { getDbConfig } = require('./lib/db');

async function fetchStats(form) {
  const { url, key } = getDbConfig(form);
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/v_stats?select=*`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
    });
    if (!r.ok) return null;
    const [stats] = await r.json();
    return stats;
  } catch (e) {
    console.error(`digest DB${form} error:`, e.message);
    return null;
  }
}

exports.handler = async () => {
  if (!process.env.ORG_NOTIFY_EMAIL) return { statusCode: 204 };

  // Fetch stats from DB1, DB2, DB3 (or fallback DB)
  const s1 = await fetchStats(1);
  const s2 = await fetchStats(2);
  const s3 = await fetchStats(3);

  const confirmes = s1 ? s1.confirmes : (s1 ? s1.confirmes : 0);
  const sansConfirmation = s1 ? s1.sans_confirmation : 0;
  const arriveesEnregistrees = s2 ? (s2.arrivees_enregistrees != null ? s2.arrivees_enregistrees : s1?.arrivees_enregistrees || 0) : (s1?.arrivees_enregistrees || 0);
  const arriveesAvion = s2 ? (s2.arrivees_avion != null ? s2.arrivees_avion : s1?.arrivees_avion || 0) : (s1?.arrivees_avion || 0);
  const personnesAccueillir = s2 ? (s2.personnes_a_accueillir != null ? s2.personnes_a_accueillir : s1?.personnes_a_accueillir || 0) : (s1?.personnes_a_accueillir || 0);
  const excursionOui = s3 ? (s3.excursion_oui != null ? s3.excursion_oui : s1?.excursion_oui || 0) : (s1?.excursion_oui || 0);
  const excursionPersonnesTotal = s3 ? (s3.excursion_personnes_total != null ? s3.excursion_personnes_total : s1?.excursion_personnes_total || 0) : (s1?.excursion_personnes_total || 0);

  await send(process.env.ORG_NOTIFY_EMAIL, '[RIPU26] Résumé quotidien', `
    <h3>RIPU26 — état des inscriptions</h3><ul>
    <li>Participants confirmés : <b>${confirmes}</b> (fiches sans confirmation : ${sansConfirmation})</li>
    <li>Arrivées enregistrées : <b>${arriveesEnregistrees}</b> (dont avion : ${arriveesAvion}) — personnes à accueillir : <b>${personnesAccueillir}</b></li>
    <li>Excursion : <b>${excursionOui}</b> participants « Oui » — personnes à transporter : <b>${excursionPersonnesTotal}</b></li></ul>`);
  return { statusCode: 200 };
};
