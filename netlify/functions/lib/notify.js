'use strict';
/** E-mails via Resend (https://resend.com). Entièrement OPTIONNEL : sans RESEND_API_KEY, rien n'est envoyé.
 *  Variables : RESEND_API_KEY, MAIL_FROM, ORG_NOTIFY_EMAIL, NOTIFY_ORG=off, NOTIFY_PARTICIPANT=off. */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function send(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'RIPU26 <onboarding@resend.dev>', to: [to], subject, html }),
  });
  if (!r.ok) throw new Error('resend ' + r.status);
  return true;
}

/** Appelée APRÈS l'enregistrement : une panne d'e-mail ne doit jamais faire échouer l'inscription. */
async function notify(form, d, res) {
  const who = esc(`${d.prenom || ''} ${d.nom || ''}`.trim() || d.email);
  const org = process.env.NOTIFY_ORG !== 'off' ? process.env.ORG_NOTIFY_EMAIL : null;
  const toP = process.env.NOTIFY_PARTICIPANT !== 'off' ? d.email : null;
  const hello = esc(d.prenom || '');
  if (form === 1) {
    await send(toP, 'RIPU26 — Votre participation est confirmée',
      `<p>Bonjour ${hello},</p><p>Votre participation à <b>RIPU26</b> (30 et 31 octobre 2026, Sousse) est bien enregistrée.</p>
       <p>Étapes suivantes : indiquer votre arrivée et, si vous le souhaitez, rejoindre l'excursion El Jem × Médina de Sousse. Utilisez la même adresse e-mail.</p><p>À très bientôt à Sousse,<br>Le comité d'organisation</p>`);
    await send(org, `[RIPU26] Confirmation : ${who}`, `<p>${who} — ${esc(d.institution)} (${esc(d.pays)}).</p>`);
  } else if (form === 2) {
    const l = d.mode === 'Avion' ? `${esc(d.date_arrivee)} ${esc(d.heure)} — ${esc(d.aeroport)} — vol ${esc(d.vol)}` : 'arrivée par ses propres moyens';
    await send(toP, "RIPU26 — Informations d'arrivée reçues", `<p>Bonjour ${hello}, nous avons bien reçu vos informations d'arrivée (${l}). Pour les modifier, renvoyez le formulaire avec la même adresse e-mail.</p>`);
    await send(org, `[RIPU26] Arrivée : ${who}`, `<p>${who} — ${l} — ${res.total} personne(s).</p>`);
  } else {
    const n = res.total || 0;
    await send(toP, 'RIPU26 — Excursion : réponse enregistrée', `<p>Bonjour ${hello}, votre réponse « ${esc(d.participe)} » pour l'excursion El Jem × Médina de Sousse est enregistrée${d.participe !== 'Non' ? ` (${n} personne(s))` : ''}.</p>`);
    await send(org, `[RIPU26] Excursion : ${who} — ${esc(d.participe)}`, `<p>${who} : ${esc(d.participe)}${d.participe !== 'Non' ? ` — ${n} personne(s)` : ''}.</p>`);
  }
}
module.exports = { notify, send };
