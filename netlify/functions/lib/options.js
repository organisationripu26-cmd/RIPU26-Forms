'use strict';
/** Listes de valeurs autorisées — doivent rester identiques aux options des formulaires.
 *  `npm test` vérifie que chaque valeur apparaît bien dans les pages HTML. */
const AUT = "Auteur d'une communication";
const ALL = 'Allergie (préciser)';

module.exports = {
  AUT, ALL,
  YN: ['Oui', 'Non'],
  CIVILITE: ['Mme', 'M.', 'Dr', 'Pr', 'Ne pas préciser'],
  PAYS: ['Tunisie', 'France', 'Suisse', 'Italie', 'Canada', 'Liban', 'Algérie', 'Maroc', 'Belgique', 'Autre'],
  FONCTION: ['Enseignant-chercheur', 'Doctorant', 'Formateur / ingénieur pédagogique', 'Responsable académique', 'Professionnel EdTech', 'Étudiant', 'Autre'],
  ROLES: [AUT, 'Participant', 'Membre du comité scientifique', 'Intervenant invité', 'Partenaire / sponsor'],
  AXES: ['IA générative & enseignement', 'Approches pédagogiques', 'Genre & éducation'],
  REGIME: ['Aucun', 'Végétarien', 'Sans porc', 'Sans gluten', 'Sans lactose', ALL],
  OPEN_BADGE: ['Les deux', 'Open Badge seulement', 'Attestation seulement', 'Non merci'],
  MODE: ['Avion', 'Autre'],
  AEROPORT: ['Monastir Habib-Bourguiba (MIR)'],
  NAVETTE: ['Oui', 'Non', 'Je ne sais pas encore'],
  BESOINS: ['Mobilité réduite', 'Siège enfant', 'Bagages volumineux', 'Autre'],
  DEPART: ['Samedi 31 octobre', 'Dimanche 1er novembre', 'Lundi 2 novembre', 'Plus tard', 'Je ne sais pas'],
  PARTICIPE: ['Oui', 'Non', 'Je ne sais pas encore'],
  FORMULE: ['El Jem', 'Médina', 'Les deux'],
};
