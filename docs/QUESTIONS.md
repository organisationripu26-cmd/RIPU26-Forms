# Questions des 3 formulaires

Généré à partir du code (libellés des pages + règles de validation serveur). « Condition » = le champ n'apparaît (et n'est exigé) que si la condition est remplie ; un champ masqué n'est jamais enregistré.

## Formulaire 1 — Confirmation de participation (index.html)

| Clé | Question exacte | Type | Obligatoire | Valeurs autorisées | Condition |
|---|---|---|---|---|---|
| `confirme` | Oui, je confirme ma participation à RIPU26 (30-31 octobre 2026, Sousse) | bool | Oui |  |  |
| `civilite` | Civilité | enum | Non | Mme · M. · Dr · Pr · Ne pas préciser |  |
| `prenom` | Prénom | text | Oui |  |  |
| `nom` | Nom | text | Oui |  |  |
| `email` | Adresse e-mail | email | Oui |  |  |
| `telephone` | Téléphone (WhatsApp de préférence) | phone | Oui |  |  |
| `nom_badge` | Nom sur le badge (facultatif) | text | Non |  |  |
| `institution` | Institution / Université | text | Oui |  |  |
| `pays` | Pays de l'institution | enum | Oui | Tunisie · France · Suisse · Italie · Canada · Liban · Algérie · Maroc · Belgique · Autre |  |
| `fonction` | Fonction | enum | Oui | Enseignant-chercheur · Doctorant · Formateur / ingénieur pédagogique · Responsable académique · Professionnel EdTech · Étudiant · Autre |  |
| `roles` | Votre rôle à RIPU26 (plusieurs choix possibles) | multi | Oui | Auteur d'une communication · Participant · Membre du comité scientifique · Intervenant invité · Partenaire / sponsor |  |
| `titre` | Titre de votre communication | text | Oui |  | Rôle = Auteur d'une communication |
| `axe` | Axe de votre communication | enum | Oui | IA générative & enseignement · Approches pédagogiques · Genre & éducation | Rôle = Auteur d'une communication |
| `regime` | Régime alimentaire | multi | Oui | Aucun · Végétarien · Sans porc · Sans gluten · Sans lactose · Allergie (préciser) |  |
| `allergie` | Précisez votre allergie | text | Oui |  | Régime = Allergie |
| `accessibilite` | Avez-vous un besoin d'accessibilité ? | enum | Oui | Oui · Non |  |
| `accessibilite_detail` | Précisez votre besoin | text | Oui |  | Accessibilité = Oui |
| `open_badge` | Open Badge et attestation de participation | enum | Non | Les deux · Open Badge seulement · Attestation seulement · Non merci |  |
| `c_donnees` | J'accepte que mes données soient utilisées par le comité d'organisation pour gérer l'événement. | bool | Oui |  |  |
| `c_infos` | J'accepte de recevoir les informations pratiques par e-mail ou WhatsApp. | bool | Oui |  |  |
| `c_photo` | J'accepte d'être photographié(e) pendant l'événement. | bool | Non |  |  |
| `c_liste` | J'accepte de figurer sur la liste des participants partagée. | bool | Non |  |  |

## Formulaire 2 — Informations d'arrivée (arrival.html)

| Clé | Question exacte | Type | Obligatoire | Valeurs autorisées | Condition |
|---|---|---|---|---|---|
| `email` | Adresse e-mail | email | Oui |  |  |
| `prenom` | Prénom | text | Oui |  |  |
| `nom` | Nom | text | Oui |  |  |
| `telephone` | Téléphone joignable à votre arrivée (WhatsApp de préférence) | phone | Oui |  |  |
| `mode` | Comment arrivez-vous en Tunisie ? | enum | Oui | Avion · Autre |  |
| `date_arrivee` | Date d'arrivée en Tunisie | day | Oui |  |  |
| `aeroport` | Aéroport d'arrivée | enum | Oui | Monastir Habib-Bourguiba (MIR) · Enfidha-Hammamet (NBE) · Tunis-Carthage (TUN) · Autre | Arrivée en avion |
| `aeroport_autre` | Nom de l'aéroport | text | Oui |  | Aéroport = Autre |
| `compagnie` | Compagnie aérienne | text | Non |  | Arrivée en avion |
| `vol` | Numéro de vol de l'arrivée en Tunisie | flight | Oui |  | Arrivée en avion |
| `heure` | Heure d'atterrissage prévue (heure de Tunis) | time | Oui |  | Arrivée en avion |
| `ville_depart` | Ville de départ du vol | text | Non |  | Arrivée en avion |
| `correspondance` | Votre voyage comporte-t-il une correspondance ? | enum | Non | Oui · Non | Arrivée en avion |
| `ville_correspondance` | Ville de la correspondance | text | Oui |  | Correspondance = Oui |
| `nb_accompagnants` | Nombre de personnes qui voyagent avec vous (sans vous compter) | int | Oui | 0–10 |  |
| `accompagnants` | Prénoms, noms et, pour les enfants, l'âge | text | Oui |  | Au moins 1 accompagnant |
| `besoins` | Besoins particuliers pour l'accueil ou le transport | multi | Non | Mobilité réduite · Siège enfant · Bagages volumineux · Autre |  |
| `besoins_detail` | Précisez votre besoin | text | Oui |  | Besoins contient « Autre » |
| `navette` | Souhaitez-vous utiliser la navette RIPU26 depuis l'aéroport ? | enum | Oui | Oui · Non · Je ne sais pas encore | Arrivée en avion |
| `hotel` | Hôtel à Sousse (si vous le connaissez) | text | Non |  |  |
| `depart` | Date de départ de Tunisie | enum | Non | Samedi 31 octobre · Dimanche 1er novembre · Lundi 2 novembre · Plus tard · Je ne sais pas |  |
| `message` | Un message pour l'équipe d'accueil ? | text | Non |  |  |

## Formulaire 3 — Excursion El Jem × Médina de Sousse (excursion.html)

| Clé | Question exacte | Type | Obligatoire | Valeurs autorisées | Condition |
|---|---|---|---|---|---|
| `email` | Adresse e-mail | email | Oui |  |  |
| `prenom` | Prénom | text | Non |  |  |
| `nom` | Nom | text | Non |  |  |
| `telephone` | — | phone | Non |  |  |
| `participe` | Souhaitez-vous participer à l'excursion ? | enum | Oui | Oui · Non · Je ne sais pas encore |  |
| `formule` | Que souhaitez-vous découvrir ? | enum | Oui | El Jem · Médina · Les deux | Participation ≠ Non |
| `adultes` | Adultes qui vous accompagnent (sans vous compter) | int | Non | 0–5 | Participation ≠ Non |
| `enfants` | Enfants qui vous accompagnent | int | Non | 0–5 | Participation ≠ Non |
| `accompagnants` | Prénoms, noms et, pour les enfants, l'âge | text | Oui |  | Au moins 1 accompagnant |
| `mobilite` | Un participant a-t-il des difficultés de mobilité ? | enum | Oui | Oui · Non | Participation ≠ Non |
| `mobilite_detail` | Précisez pour que nous puissions adapter la visite | text | Oui |  | Mobilité = Oui |
| `remarque` | Un message pour l'équipe ? | text | Non |  | Participation ≠ Non |

## Justification des données
- **E-mail** : clé unique anti-doublon, relie les 3 formulaires.
- **Téléphone** : joindre la personne à l'aéroport (retard, changement de porte).
- **Vol, heure, aéroport** : planifier chauffeurs et navettes ; **accompagnants** : dimensionner véhicules et places.
- **Besoins d'accueil / mobilité** : prévoir véhicule adapté, siège enfant, assistance.
- **Excursion** : `personnes_a_transporter = 1 + adultes + enfants` si « Oui » (calcul en base) ; « Je ne sais pas encore » est compté à part (`personnes_a_confirmer`).
- Aucune donnée collectée « parce que c'est facile » : pas de naissance, passeport, adresse postale ni paiement.
