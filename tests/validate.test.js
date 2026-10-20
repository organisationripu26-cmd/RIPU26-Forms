'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validate } = require('../netlify/functions/lib/validate');
const opts = require('../netlify/functions/lib/options');

const id = { prenom: 'Amal', nom: 'Ben Ali', email: '  Amal@Example.com ', telephone: '+216 55 595 234' };
const f1 = { ...id, confirme: true, institution: 'ISET', pays: 'Tunisie', fonction: 'Doctorant', roles: ['Participant'], regime: ['Aucun'], accessibilite: 'Non', c_donnees: true, c_infos: true };
const f2 = { ...id, date_arrivee: '2026-10-29', aeroport: 'Monastir Habib-Bourguiba (MIR)', vol: 'tu 718', heure: '14:35', nb_accompagnants: '0' };

test('F1 valide : e-mail normalisé, champ masqué (titre) jamais stocké', () => {
  const r = validate(1, { ...f1, titre: 'ignoré' });
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.equal(r.data.email, 'amal@example.com'); assert.equal(r.data.titre, undefined);
});
test('F1 : confirmation et consentements obligatoires', () => {
  const r = validate(1, { ...f1, confirme: false, c_donnees: false });
  assert.ok(r.errors.confirme && r.errors.c_donnees && !r.errors.c_infos);
});
test('F1 : auteur => titre + axe requis ; valeur hors liste refusée', () => {
  const r = validate(1, { ...f1, pays: 'Mars', roles: [opts.AUT] });
  assert.ok(r.errors.titre && r.errors.axe && r.errors.pays);
});
test('F1 : allergie et accessibilité conditionnelles', () => {
  const r = validate(1, { ...f1, regime: [opts.ALL], accessibilite: 'Oui' });
  assert.ok(r.errors.allergie && r.errors.accessibilite_detail);
});
test('F2 avion valide : vol normalisé, entiers convertis', () => {
  const r = validate(2, f2);
  assert.ok(r.ok, JSON.stringify(r.errors)); assert.equal(r.data.vol, 'TU718'); assert.equal(r.data.nb_accompagnants, 0);
});
test('F2 avion : vol, heure, aéroport obligatoires et bien formés', () => {
  const r = validate(2, { ...id, date_arrivee: '2026-10-29', vol: 'TU-718', heure: '25:61' });
  assert.ok(r.errors.vol && r.errors.heure && r.errors.aeroport);
});
test('F2 : accompagnants => noms obligatoires ; bornes 0-10', () => {
  assert.ok(validate(2, { ...f2, nb_accompagnants: '2' }).errors.accompagnants);
  assert.ok(validate(2, { ...f2, nb_accompagnants: '11' }).errors.nb_accompagnants);
  assert.ok(validate(2, { ...f2, nb_accompagnants: '-1' }).errors.nb_accompagnants);
  assert.ok(validate(2, { ...f2, nb_accompagnants: '2', accompagnants: 'A ; B' }).ok);
});
test('F2 : aéroport non autorisé, correspondance, date hors fenêtre', () => {
  assert.ok(validate(2, { ...f2, aeroport: 'Autre' }).errors.aeroport);
  assert.ok(validate(2, { ...f2, correspondance: 'Oui' }).errors.ville_correspondance);
  assert.ok(validate(2, { ...f2, date_arrivee: '2025-01-01' }).errors.date_arrivee);
  assert.ok(validate(2, { ...f2, date_arrivee: 'Autre date' }).ok);
});
test('F2 simplifié : champs supprimés ou superflus ignorés', () => {
  const r = validate(2, { ...f2, mode: 'Autre', hotel: 'Hotel Sousse' });
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.equal(r.data.hotel, undefined);
  assert.equal(r.data.mode, undefined);
});
test('F3 : « Oui » valide ; « Non » ne stocke aucun détail', () => {
  const yes = validate(3, { email: 'a@b.tn', participe: 'Oui', formule: 'Les deux', adultes: '1', enfants: '2', accompagnants: 'A ; B ; C', mobilite: 'Non' });
  assert.ok(yes.ok, JSON.stringify(yes.errors)); assert.equal(yes.data.adultes, 1); assert.equal(yes.data.enfants, 2);
  const no = validate(3, { email: 'a@b.tn', participe: 'Non', adultes: 3, formule: 'El Jem' });
  assert.ok(no.ok); assert.equal(no.data.adultes, undefined); assert.equal(no.data.formule, undefined);
});
test('F3 : accompagnants déclarés => noms ; mobilité => détail ; max 5', () => {
  const r = validate(3, { email: 'a@b.tn', participe: 'Oui', formule: 'El Jem', adultes: 1, enfants: 0, mobilite: 'Oui' });
  assert.ok(r.errors.accompagnants && r.errors.mobilite_detail);
  assert.ok(validate(3, { email: 'a@b.tn', participe: 'Oui', formule: 'El Jem', adultes: 6, mobilite: 'Non' }).errors.adultes);
});
test('Neutralise formules CSV, caractères de contrôle, objets imbriqués', () => {
  const r = validate(3, { email: 'a@b.tn', participe: 'Non', prenom: '=HYPERLINK("x")\u0000' });
  assert.ok(r.ok); assert.ok(r.data.prenom.startsWith("'=")); assert.ok(!r.data.prenom.includes('\u0000'));
  assert.ok(validate(1, { ...f1, institution: { a: 1 } }).errors.institution);
});
test('Entrées invalides', () => {
  assert.ok(!validate(9, {}).ok); assert.ok(!validate(1, null).ok); assert.ok(!validate(1, []).ok);
  assert.ok(validate(1, { ...f1, email: 'pas-un-mail' }).errors.email);
});

// Garde-fou : chaque valeur autorisée côté serveur doit exister dans les formulaires (sinon un participant serait rejeté).
test('Options serveur = options des pages HTML', () => {
  const html = ['index.html', 'arrival.html', 'excursion.html'].map(f => fs.readFileSync(path.join(__dirname, '../frontend', f), 'utf8')).join('\n');
  const missing = [];
  for (const [name, list] of Object.entries(opts)) {
    if (!Array.isArray(list)) continue;
    for (const v of list) {
      if (!html.includes(JSON.stringify(v).slice(1, -1)) && !html.includes(v)) missing.push(`${name}: ${v}`);
    }
  }
  assert.deepEqual(missing, []);
});
