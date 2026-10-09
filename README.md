# RIPU26 — Système officiel de collecte (3 formulaires)

| Page | URL courte | Rôle |
|---|---|---|
| `frontend/index.html` | `/` | **Formulaire 1** — Confirmation de participation (design d'origine conservé) |
| `frontend/arrival.html` | `/arrivee` | **Formulaire 2** — Arrivée : vol, aéroport, accompagnants, besoins d'accueil |
| `frontend/excursion.html` | `/excursion` | **Formulaire 3** — Excursion El Jem × Médina de Sousse : nombre exact de personnes à transporter |

## Pourquoi cette architecture
HTML + JavaScript **ne peut pas** enregistrer de données à lui seul : une page web ne conserve rien. Il faut un serveur et une base.

```
Téléphone du participant ─► Page (Netlify) ─► /api/submit (fonction Netlify : valide) ─► Supabase (PostgreSQL)
                                                                                    └► vues + export CSV + e-mails
```
* **Supabase** : vraie base PostgreSQL, sauvegardes, interface tableau, gratuit pour ce volume.
* **Netlify** : héberge les pages et la fonction serveur, HTTPS automatique, gratuit pour ce volume.
* Les clés secrètes restent **dans Netlify**, jamais dans le HTML. La base n'est accessible qu'au serveur (RLS active, aucun accès public).
* Plus besoin d'Apps Script ni de votre ordinateur : tout tourne en ligne.

## Déploiement pas à pas (≈ 40 min)
**Étape 1 — Compte Supabase.** supabase.com → *Start your project* → New project. Nom `ripu26`, région **Europe (Frankfurt ou Paris)**, notez le mot de passe de la base.
**Étape 2 — Créer les tables.** Menu *SQL Editor* → *New query* → collez tout `database/schema.sql` → *Run*. Message « Success ».
**Étape 3 — Récupérer les clés.** *Project Settings → API* : copiez **Project URL** et la clé **service_role** (secrète, ne la partagez à personne).
**Étape 4 — Compte Netlify + dépôt.** Mettez ce dossier sur GitHub (dépôt **privé**), puis netlify.com → *Add new site → Import from Git*. Rien à saisir pour *build* : `netlify.toml` fait le reste.
**Étape 5 — Variables d'environnement.** Netlify → *Site configuration → Environment variables* → ajoutez (voir `.env.example`) : `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ADMIN_TOKEN` (`openssl rand -hex 24`), `ALLOWED_ORIGIN` (l'URL finale du site, après l'étape 6). Optionnel : `RESEND_API_KEY`, `MAIL_FROM`, `ORG_NOTIFY_EMAIL`.
**Étape 6 — Déployer.** *Deploys → Trigger deploy*. Vous obtenez `https://xxxx.netlify.app`. Renseignez cette URL dans `ALLOWED_ORIGIN`, puis redéployez.
**Étape 7 — Tester (obligatoire).** Remplissez les 3 formulaires avec **votre** adresse e-mail. Dans Supabase → *Table Editor*, ouvrez `participants`, `arrivals`, `excursions`. Vérifiez qu'une seule fiche existe pour vous.
**Étape 8 — Photos.** Déposez dans `frontend/assets/img/` : `medina.jpg` (ruelle de la Médina de Sousse) et `arrival.jpg` (voir plus bas), puis poussez sur GitHub : le site se met à jour seul.
**Étape 9 — Domaine (facultatif).** Netlify → *Domain management → Add domain*, ex. `inscription.ripusousse.com`, puis copiez les 2 enregistrements DNS chez votre registrar. HTTPS est automatique.

## Photos : ce qu'il faut déposer
* `eljem.jpg` : **déjà fournie** (photographie de votre dossier).
* `medina.jpg` : photographie **réelle** d'une ruelle ou d'une porte de la Médina de Sousse, ≥ 2000 px, lumière chaude. Elle apparaît dans l'arche d'El Jem, fondue dans la même colorimétrie. Sans elle, l'arche montre une arcade d'El Jem (le site reste correct).
* `arrival.jpg` (facultatif) : ciel / mer / aéroport lumineux. Sans elle, un dégradé ciel-mer s'affiche.
* Sources : photographe local ou banque libre (Wikimedia Commons, Unsplash) — vérifiez la licence et créditez si nécessaire.

## Consulter et exploiter les réponses
**Supabase → Table Editor → onglet « Views »** (lecture directe, recherche, filtres, export CSV par bouton) :
| Vue | À quoi elle sert |
|---|---|
| `v_participants` | Tous les inscrits, statut Confirmé / Non confirmé, arrivée et excursion renseignées ? |
| `v_arrivees` | Toutes les arrivées, triées par date, aéroport, heure |
| `v_accueil_aeroport` | **Feuille de route chauffeurs** : par vol, nombre de personnes, noms, navette demandée |
| `v_arrivees_par_jour`, `v_arrivees_par_tranche`, `v_arrivees_par_vol` | Statistiques d'arrivées |
| `v_excursion` | Liste nominative des participants à l'excursion et accompagnants |
| `v_excursion_totaux` | **`personnes_a_transporter`** = participants « Oui » + leurs accompagnants ; `personnes_a_confirmer` = « Je ne sais pas encore » |
| `v_stats` | Confirmés, arrivées, personnes à accueillir, personnes à transporter |

Le nombre de personnes est calculé **par la base** (colonnes générées), il ne peut pas être falsifié depuis le navigateur.
**Modifier une fiche** : Table Editor → cliquer une cellule. **Chercher** : barre de filtre. **Exporter** : bouton *Export → CSV*, ou
`curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://VOTRE-SITE/api/export?view=accueil" -o accueil.csv` (vues : participants, arrivees, accueil, excursion, totaux, stats, jour, tranche, vol).

**Google Sheets (facultatif)** : dans un Sheet → *Extensions → Apps Script*, collez :
```js
function importer() {
  const t = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');          // stocké dans les propriétés du script
  const r = UrlFetchApp.fetch('https://VOTRE-SITE/api/export?view=arrivees&format=json', { headers: { Authorization: 'Bearer ' + t } });
  const rows = JSON.parse(r.getContentText()); if (!rows.length) return;
  const cols = Object.keys(rows[0]), s = SpreadsheetApp.getActiveSheet(); s.clear();
  s.getRange(1, 1, rows.length + 1, cols.length).setValues([cols, ...rows.map(o => cols.map(c => Array.isArray(o[c]) ? o[c].join(' | ') : o[c] ?? ''))]);
}
```
puis *Déclencheurs* → toutes les heures. Le Sheet est une **copie de lecture** ; la vérité reste dans Supabase.

## Doublons
Clé d'identité = **e-mail** (insensible à la casse), index unique en base. Renvoyer un formulaire avec le même e-mail **met à jour** la fiche (la dernière réponse fait foi) ; un double-clic est neutralisé par une clé d'envoi unique. Les formulaires 2 et 3 créent une fiche « Non confirmé » si la personne n'a pas fait le formulaire 1 ; elle est complétée ensuite, jamais dupliquée.

## Notifications
Avec `RESEND_API_KEY` (resend.com, gratuit) : e-mail de confirmation au participant et alerte à `ORG_NOTIFY_EMAIL` à chaque envoi + résumé quotidien à 08h00 (Tunis), totaux seulement. Sans clé : rien n'est envoyé, le reste fonctionne. Une panne d'e-mail ne fait jamais échouer une inscription.

## Sécurité et données personnelles
* HTTPS + en-têtes de sécurité (`netlify.toml`), validation serveur de **chaque** champ (listes fermées, bornes, formats), requêtes paramétrées, neutralisation des formules Excel dans les exports, limiteur de débit, piège anti-robots, origine contrôlée.
* RLS Supabase active **sans aucune règle publique** : la clé publique ne peut rien lire.
* Aucun nom, e-mail ni téléphone dans les logs. Minimisation : pas de date de naissance, pas de passeport, pas de paiement.
* **À faire** : ne jamais coller la clé `service_role` dans le HTML ni sur WhatsApp ; dépôt GitHub privé ; activer l'authentification à 2 facteurs sur Supabase, Netlify et GitHub.
* Conservation conseillée : supprimer les données **3 mois après l'événement** (`delete from participants;` supprime tout en cascade). Droit d'accès / suppression : par e-mail au comité, traité depuis le Table Editor.
* ⚠️ Plan gratuit Supabase : pas de sauvegarde automatique restaurable. Avant l'événement, passez en plan Pro **un mois** (sauvegardes quotidiennes), ou exportez chaque jour `v_participants`, `v_arrivees`, `v_excursion` en CSV (route `/api/export`).

## Sauvegarde, restauration, mise à jour
* **Sauvegarde** : exports CSV ci-dessus, ou `pg_dump` avec la chaîne de connexion (*Project Settings → Database*).
* **Restauration** : *SQL Editor* → rejouer `database/schema.sql`, puis importer les CSV (Table Editor → *Import data*).
* **Mise à jour du site** : modifiez un fichier, `git push` : Netlify redéploie en ~1 min. Retour arrière : *Deploys → Publish deploy* sur une version précédente.
* **Schéma** : `schema.sql` est rejouable sans perte.

## QR codes et diffusion
Une fois l'URL finale connue : un QR par formulaire — `https://VOTRE-SITE/` (confirmation), `/arrivee`, `/excursion`. Générateur gratuit : qrcode-monkey.com (PNG haute définition, correction d'erreur *H*). Testez avec **deux téléphones** (iPhone + Android) avant impression. Pour suivre la provenance, ajoutez `?src=affiche` ou `?src=mail` à l'URL (visible dans les statistiques Netlify). Enchaînement conseillé : e-mail de confirmation → lien vers `/arrivee?email=…` → lien vers `/excursion?email=…` (l'e-mail est pré-rempli).

## Tests
`npm test` (validation + handler, 21 tests) · `PGHOST=… tests/run_db_tests.sh` (schéma et scénarios sur un PostgreSQL **jetable**, jamais la production) · `tests/e2e/` (parcours navigateur complets contre la vraie validation et une base locale).

## Structure
```
frontend/  index.html · arrival.html · excursion.html · js/engine.js · assets/img/
netlify/functions/  submit.js · export.js · daily-digest.js · lib/{validate,notify,options}.js
database/schema.sql      tests/      docs/QUESTIONS.md      netlify.toml · .env.example
```
