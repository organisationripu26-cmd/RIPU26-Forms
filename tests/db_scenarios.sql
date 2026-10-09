-- Scénarios de test du schéma (à lancer sur une base de TEST, jamais en production).
-- psql -v ON_ERROR_STOP=1 -f tests/db_scenarios.sql
\set ON_ERROR_STOP on
begin;
set local role service_role;  -- comme la fonction serveur
-- 1) confirmation
select submit_form(1, gen_random_uuid(), '{"email":"sonia@ex.tn","confirme":true,"prenom":"Sonia","nom":"Sahli","telephone":"+216 55 595 234","institution":"ISET Sousse","pays":"Tunisie","fonction":"Enseignant-chercheur","roles":["Participant"],"regime":["Aucun"],"accessibilite":"Non","c_donnees":true,"c_infos":true}');
-- 2) même e-mail resoumis avec une clé différente => mise à jour, pas de doublon
select submit_form(1, gen_random_uuid(), '{"email":"sonia@ex.tn","confirme":true,"prenom":"Sonia","nom":"Sahli","telephone":"+216 55 595 234","institution":"ISET Sousse (Dir.)","pays":"Tunisie","fonction":"Enseignant-chercheur","roles":["Participant","Membre du comité scientifique"],"regime":["Végétarien"],"accessibilite":"Non","c_donnees":true,"c_infos":true}');
-- 3) arrivée avec 2 accompagnants (3 personnes)
select submit_form(2, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"email":"sonia@ex.tn","mode":"Avion","date_arrivee":"2026-10-29","aeroport":"Monastir Habib-Bourguiba (MIR)","heure":"14:35","vol":"TU 718","compagnie":"Tunisair","navette":"Oui","nb_accompagnants":2,"accompagnants":"A ; B","besoins":["Siège enfant"]}');
-- 3b) renvoi avec la MÊME clé (double-clic) => ignoré
select submit_form(2, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"email":"sonia@ex.tn","mode":"Avion","nb_accompagnants":9}');
-- 4) excursion : personne jamais confirmée (fiche minimale) + 1 adulte + 2 enfants = 4
select submit_form(3, gen_random_uuid(), '{"email":"Marc@ex.fr","prenom":"Marc","nom":"Durand","participe":"Oui","formule":"Les deux","adultes":1,"enfants":2,"accompagnants":"x","mobilite":"Non"}');
-- 5) excursion "peut-être" (2 personnes à confirmer) et "Non"
select submit_form(3, gen_random_uuid(), '{"email":"lea@ex.ch","prenom":"Léa","nom":"Roy","participe":"Je ne sais pas encore","formule":"El Jem","adultes":1,"enfants":0,"accompagnants":"x","mobilite":"Oui","mobilite_detail":"canne"}');
select submit_form(3, gen_random_uuid(), '{"email":"non@ex.ch","participe":"Non","adultes":0,"enfants":0}');
-- 6) fiche créée via excursion puis confirmée ensuite : mêmes id, statut confirme
select submit_form(1, gen_random_uuid(), '{"email":"marc@ex.fr","confirme":true,"prenom":"Marc","nom":"Durand","telephone":"+33 6 12 34 56 78","institution":"AMU","pays":"France","fonction":"Doctorant","roles":["Participant"],"regime":["Aucun"],"accessibilite":"Non","c_donnees":true,"c_infos":true}');

-- Vérifications
do $$ declare n int; t int; begin
  select count(*) into n from participants;               assert n = 4,  'fiches: '||n;
  select count(*) into n from participants where email='marc@ex.fr'; assert n = 1, 'doublon marc';
  select count(*) into n from submissions;                assert n = 7,  'submissions: '||n;   -- 8 appels - 1 rejeu
  select total_personnes into t from arrivals;            assert t = 3,  'arrivée: '||t;
  select personnes_a_transporter into t from v_excursion_totaux; assert t = 4, 'transport: '||t;
  select personnes_a_confirmer into t from v_excursion_totaux;   assert t = 2, 'à confirmer: '||t;
  select confirmes into t from v_stats;                   assert t = 2,  'confirmés: '||t;
end $$;
select * from v_stats;
select * from v_excursion_totaux;
select * from v_accueil_aeroport;
rollback;

-- Sécurité : le rôle public ne peut ni lire ni appeler la fonction
begin; set local role anon;
do $$ begin
  begin perform 1 from participants; raise exception 'FAIL anon lit participants'; exception when insufficient_privilege then null; end;
  begin perform 1 from v_participants; raise exception 'FAIL anon lit la vue'; exception when insufficient_privilege then null; end;
  begin perform submit_form(1, gen_random_uuid(), '{}'); raise exception 'FAIL anon appelle submit_form'; exception when insufficient_privilege then null; end;
end $$;
rollback;
\echo === TOUS LES SCENARIOS OK ===
