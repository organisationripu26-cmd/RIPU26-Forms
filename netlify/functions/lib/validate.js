'use strict';
/** Validation SERVEUR des 3 formulaires. Le navigateur n'est jamais cru sur parole :
 *  types, listes de valeurs, champs conditionnels et bornes sont re-vérifiés ici.
 *  Les champs masqués par une condition sont ignorés (jamais stockés). */
const o = require('./options');

const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9][0-9 ().-]{6,18}$/;
const FLIGHT = /^[A-Za-z0-9]{2}\s?\d{1,4}[A-Za-z]?$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^2026-(10-(2[4-9]|3[01])|11-0[1-3])$/;           // fenêtre d'arrivée plausible
const AUTRE_DATE = 'Autre date';

const has = (d, k, v) => [].concat(d[k] || []).includes(v);
const isAuthor = d => has(d, 'roles', o.AUT);
const avion = () => true; // Formulaire simplifié : toujours avion
const party = d => 1 + (+d.adultes || 0) + (+d.enfants || 0);
const joins = d => d.participe !== 'Non';

// t: type · r: obligatoire · o: valeurs autorisées · max: longueur · if: champ actif ?
const SPEC = {
  1: {
    confirme: { t: 'bool', r: 1, must: 1 }, civilite: { t: 'enum', o: o.CIVILITE },
    prenom: { t: 'text', r: 1, max: 80 }, nom: { t: 'text', r: 1, max: 80 },
    email: { t: 'email', r: 1 }, telephone: { t: 'phone', r: 1 }, nom_badge: { t: 'text', max: 120 },
    institution: { t: 'text', r: 1, max: 200 }, pays: { t: 'enum', r: 1, o: o.PAYS }, fonction: { t: 'enum', r: 1, o: o.FONCTION },
    roles: { t: 'multi', r: 1, o: o.ROLES },
    titre: { t: 'text', r: 1, max: 300, if: isAuthor }, axe: { t: 'enum', r: 1, o: o.AXES, if: isAuthor },
    regime: { t: 'multi', r: 1, o: o.REGIME },
    allergie: { t: 'text', r: 1, max: 200, if: d => has(d, 'regime', o.ALL) },
    accessibilite: { t: 'enum', r: 1, o: o.YN },
    accessibilite_detail: { t: 'text', r: 1, max: 500, if: d => d.accessibilite === 'Oui' },
    open_badge: { t: 'enum', o: o.OPEN_BADGE },
    c_donnees: { t: 'bool', r: 1, must: 1 }, c_infos: { t: 'bool', r: 1, must: 1 }, c_photo: { t: 'bool' }, c_liste: { t: 'bool' },
  },
  2: {
    // Formulaire simplifié : Monastir uniquement, toujours en avion
    email: { t: 'email', r: 1 }, prenom: { t: 'text', r: 1, max: 80 }, nom: { t: 'text', r: 1, max: 80 },
    telephone: { t: 'phone', r: 1 },
    date_arrivee: { t: 'day', r: 1 },
    aeroport: { t: 'enum', r: 1, o: o.AEROPORT },
    compagnie: { t: 'text', max: 80 },
    vol: { t: 'flight', r: 1 },
    heure: { t: 'time', r: 1 },
    ville_depart: { t: 'text', max: 80 },
    correspondance: { t: 'enum', o: o.YN },
    ville_correspondance: { t: 'text', r: 1, max: 80, if: d => d.correspondance === 'Oui' },
    nb_accompagnants: { t: 'int', r: 1, min: 0, max: 10 },
    accompagnants: { t: 'text', r: 1, max: 600, if: d => (+d.nb_accompagnants || 0) > 0 },
    besoins: { t: 'multi', o: o.BESOINS },
    besoins_detail: { t: 'text', r: 1, max: 500, if: d => has(d, 'besoins', 'Autre') },
  },
  3: {
    email: { t: 'email', r: 1 }, prenom: { t: 'text', max: 80 }, nom: { t: 'text', max: 80 }, telephone: { t: 'phone' },
    participe: { t: 'enum', r: 1, o: o.PARTICIPE },
    formule: { t: 'enum', r: 1, o: o.FORMULE, if: joins },
    adultes: { t: 'int', min: 0, max: 5, if: joins }, enfants: { t: 'int', min: 0, max: 5, if: joins },
    accompagnants: { t: 'text', r: 1, max: 600, if: d => joins(d) && party(d) > 1 },
    mobilite: { t: 'enum', r: 1, o: o.YN, if: joins },
    mobilite_detail: { t: 'text', r: 1, max: 500, if: d => joins(d) && d.mobilite === 'Oui' },
    remarque: { t: 'text', max: 600, if: joins },
  },
};

const clean = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').trim();
// Neutralise l'injection de formules Excel/Sheets (=, +, -, @) dans les exports ; les numéros de téléphone sont préservés.
const csvSafe = s => (/^[=+\-@]/.test(s) && !PHONE.test(s) ? "'" + s : s);

function validate(form, raw) {
  const spec = SPEC[form];
  if (!spec) return { ok: false, errors: { _: 'Formulaire inconnu.' } };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: { _: 'Données invalides.' } };

  const d = {};                                              // passe 1 : normalisation
  for (const [k, s] of Object.entries(spec)) {
    const v = raw[k];
    if (v === undefined || v === null || v === '') continue;
    if (s.t === 'multi') d[k] = (Array.isArray(v) ? v : [v]).slice(0, 12).map(clean);
    else if (s.t === 'bool') d[k] = v === true || v === 'true';
    else if (typeof v === 'object') d[k] = '\u0000';          // objets imbriqués refusés plus bas
    else d[k] = clean(v);
  }

  const errors = {}, out = {};
  for (const [k, s] of Object.entries(spec)) {              // passe 2 : règles
    if (s.if && !s.if(d)) continue;
    let v = d[k];
    const empty = v === undefined || v === '' || (Array.isArray(v) && !v.length) || (s.t === 'bool' && s.must && v !== true);
    if (empty) { if (s.r) errors[k] = s.t === 'bool' ? 'Cette case doit être cochée.' : 'Ce champ est obligatoire.'; continue; }
    switch (s.t) {
      case 'email': if (!EMAIL.test(v) || v.length > 254) errors[k] = 'Adresse e-mail invalide.'; else v = v.toLowerCase(); break;
      case 'phone': if (!PHONE.test(v)) errors[k] = 'Numéro de téléphone invalide.'; break;
      case 'flight': if (!FLIGHT.test(v)) errors[k] = 'Numéro de vol invalide (ex. TU 718).'; else v = v.replace(/\s/g, '').toUpperCase(); break;
      case 'time': if (!TIME.test(v)) errors[k] = 'Heure invalide (HH:MM).'; break;
      case 'day': if (v !== AUTRE_DATE && !DAY.test(v)) errors[k] = 'Date non reconnue.'; break;
      case 'enum': if (!s.o.includes(v)) errors[k] = 'Valeur non autorisée.'; break;
      case 'multi': if (!v.every(x => s.o.includes(x))) errors[k] = 'Valeur non autorisée.'; break;
      case 'int': if (!/^\d{1,2}$/.test(String(v)) || +v < s.min || +v > s.max) errors[k] = `Entre ${s.min} et ${s.max}.`; else v = +v; break;
      case 'text': if (v.length > (s.max || 200) || v === '\u0000') errors[k] = 'Texte invalide ou trop long.'; else v = csvSafe(v); break;
    }
    out[k] = v;
  }
  if (form === 2) out.nb_accompagnants = out.nb_accompagnants || 0;
  if (form === 3 && joins(out)) { out.adultes = out.adultes || 0; out.enfants = out.enfants || 0; }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data: out };
}

module.exports = { validate, SPEC, party };
