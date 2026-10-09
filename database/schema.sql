-- =====================================================================
-- RIPU26 — Schéma PostgreSQL / Supabase
-- À exécuter UNE fois : Supabase > SQL Editor > New query > Run.
-- Relançable sans perte de données (create ... if not exists / create or replace).
-- =====================================================================
create extension if not exists pgcrypto;

-- 1. PARTICIPANTS : 1 ligne = 1 personne. Clé d'identité = e-mail (insensible à la casse).
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  civilite text, prenom text, nom text, nom_badge text, telephone text,
  institution text, pays text, fonction text,
  roles text[] not null default '{}', titre text, axe text,
  regime text[] not null default '{}', allergie text,
  accessibilite boolean, accessibilite_detail text, open_badge text,
  c_donnees boolean not null default false, c_infos boolean not null default false,
  c_photo boolean not null default false,  c_liste boolean not null default false,
  confirme boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participants_email_ck check (email = lower(btrim(email)) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')
);
-- Anti-doublon : impossible d'avoir deux fiches pour le même e-mail.
create unique index if not exists participants_email_uq on participants (lower(email));

-- 2. ARRIVÉES : 0 ou 1 ligne par participant (la dernière réponse remplace la précédente).
create table if not exists arrivals (
  participant_id uuid primary key references participants(id) on delete cascade,
  mode text not null check (mode in ('Avion','Autre')),
  date_arrivee date, date_autre boolean not null default false,
  aeroport text, aeroport_autre text, heure time, vol text, compagnie text, ville_depart text,
  correspondance boolean, ville_correspondance text, navette text,
  nb_accompagnants int not null default 0 check (nb_accompagnants between 0 and 10),
  accompagnants text, besoins text[] not null default '{}', besoins_detail text,
  hotel text, depart text, message text,
  total_personnes int generated always as (1 + nb_accompagnants) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- 3. EXCURSION : 0 ou 1 ligne par participant.
create table if not exists excursions (
  participant_id uuid primary key references participants(id) on delete cascade,
  participe text not null check (participe in ('Oui','Non','Je ne sais pas encore')),
  formule text check (formule in ('El Jem','Médina','Les deux')),
  adultes int not null default 0 check (adultes between 0 and 5),
  enfants int not null default 0 check (enfants between 0 and 5),
  accompagnants text, mobilite boolean, mobilite_detail text, remarque text,
  -- Calculés PAR LA BASE : le navigateur ne peut pas falsifier ces totaux.
  personnes_a_transporter int generated always as (case when participe = 'Oui' then 1 + adultes + enfants else 0 end) stored,
  personnes_a_confirmer   int generated always as (case when participe = 'Je ne sais pas encore' then 1 + adultes + enfants else 0 end) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- 4. JOURNAL DES ENVOIS : la clé unique rend le double-clic / le renvoi réseau inoffensif.
create table if not exists submissions (
  id bigint generated always as identity primary key,
  idem_key uuid not null unique,
  form smallint not null check (form in (1,2,3)),
  participant_id uuid references participants(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 5. SÉCURITÉ : RLS active et AUCUNE policy => aucun accès via la clé publique "anon".
alter table participants enable row level security;
alter table arrivals     enable row level security;
alter table excursions   enable row level security;
alter table submissions  enable row level security;
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

-- 6. ENREGISTREMENT : une seule transaction, appelée par le serveur APRÈS validation.
create or replace function submit_form(p_form int, p_key uuid, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(p_data->>'email'));
  v_id uuid; v_exists boolean; v_total int := 0; v_updated boolean := false;
begin
  if p_form not in (1,2,3) then raise exception 'form invalide'; end if;
  -- Même clé déjà reçue (double-clic, renvoi réseau) : succès sans réécriture.
  if exists (select 1 from submissions where idem_key = p_key) then
    select participant_id into v_id from submissions where idem_key = p_key;
    return jsonb_build_object('ok', true, 'duplicate', true, 'updated', false);
  end if;

  select id into v_id from participants where lower(email) = v_email for update;
  v_exists := v_id is not null;
  if not v_exists then
    insert into participants(email) values (v_email)
    on conflict (lower(email)) do nothing;
    select id into v_id from participants where lower(email) = v_email;
  end if;

  -- Identité : n'efface jamais une valeur existante par du vide.
  update participants set
    prenom = coalesce(nullif(p_data->>'prenom',''), prenom),
    nom = coalesce(nullif(p_data->>'nom',''), nom),
    telephone = coalesce(nullif(p_data->>'telephone',''), telephone),
    updated_at = now()
  where id = v_id;

  -- « updated » = CE formulaire avait déjà été rempli par cette personne (et non simplement « fiche existante »)
  v_updated := case p_form
    when 1 then exists (select 1 from participants where id = v_id and confirme)
    when 2 then exists (select 1 from arrivals where participant_id = v_id)
    else exists (select 1 from excursions where participant_id = v_id) end;

  if p_form = 1 then
    update participants set
      civilite = nullif(p_data->>'civilite',''), nom_badge = nullif(p_data->>'nom_badge',''),
      institution = nullif(p_data->>'institution',''), pays = nullif(p_data->>'pays',''),
      fonction = nullif(p_data->>'fonction',''),
      roles = coalesce(array(select jsonb_array_elements_text(p_data->'roles')), '{}'),
      titre = nullif(p_data->>'titre',''), axe = nullif(p_data->>'axe',''),
      regime = coalesce(array(select jsonb_array_elements_text(p_data->'regime')), '{}'),
      allergie = nullif(p_data->>'allergie',''),
      accessibilite = case p_data->>'accessibilite' when 'Oui' then true when 'Non' then false end,
      accessibilite_detail = nullif(p_data->>'accessibilite_detail',''),
      open_badge = nullif(p_data->>'open_badge',''),
      c_donnees = coalesce((p_data->>'c_donnees')::boolean,false), c_infos = coalesce((p_data->>'c_infos')::boolean,false),
      c_photo = coalesce((p_data->>'c_photo')::boolean,false),     c_liste = coalesce((p_data->>'c_liste')::boolean,false),
      confirme = coalesce((p_data->>'confirme')::boolean,false),
      confirmed_at = case when coalesce((p_data->>'confirme')::boolean,false) then coalesce(confirmed_at, now()) else confirmed_at end
    where id = v_id;

  elsif p_form = 2 then
    insert into arrivals(participant_id, mode, date_arrivee, date_autre, aeroport, aeroport_autre, heure, vol, compagnie,
      ville_depart, correspondance, ville_correspondance, navette, nb_accompagnants, accompagnants, besoins, besoins_detail,
      hotel, depart, message)
    values (v_id, p_data->>'mode',
      case when p_data->>'date_arrivee' ~ '^\d{4}-\d{2}-\d{2}$' then (p_data->>'date_arrivee')::date end,
      p_data->>'date_arrivee' = 'Autre date',
      nullif(p_data->>'aeroport',''), nullif(p_data->>'aeroport_autre',''), nullif(p_data->>'heure','')::time,
      nullif(upper(regexp_replace(coalesce(p_data->>'vol',''),'\s','','g')),''), nullif(p_data->>'compagnie',''),
      nullif(p_data->>'ville_depart',''),
      case p_data->>'correspondance' when 'Oui' then true when 'Non' then false end,
      nullif(p_data->>'ville_correspondance',''), nullif(p_data->>'navette',''),
      coalesce(nullif(p_data->>'nb_accompagnants','')::int,0), nullif(p_data->>'accompagnants',''),
      coalesce(array(select jsonb_array_elements_text(p_data->'besoins')),'{}'), nullif(p_data->>'besoins_detail',''),
      nullif(p_data->>'hotel',''), nullif(p_data->>'depart',''), nullif(p_data->>'message',''))
    on conflict (participant_id) do update set
      mode=excluded.mode, date_arrivee=excluded.date_arrivee, date_autre=excluded.date_autre, aeroport=excluded.aeroport,
      aeroport_autre=excluded.aeroport_autre, heure=excluded.heure, vol=excluded.vol, compagnie=excluded.compagnie,
      ville_depart=excluded.ville_depart, correspondance=excluded.correspondance,
      ville_correspondance=excluded.ville_correspondance, navette=excluded.navette,
      nb_accompagnants=excluded.nb_accompagnants, accompagnants=excluded.accompagnants, besoins=excluded.besoins,
      besoins_detail=excluded.besoins_detail, hotel=excluded.hotel, depart=excluded.depart, message=excluded.message,
      updated_at=now()
    returning total_personnes into v_total;

  else
    insert into excursions(participant_id, participe, formule, adultes, enfants, accompagnants, mobilite, mobilite_detail, remarque)
    values (v_id, p_data->>'participe', nullif(p_data->>'formule',''),
      coalesce(nullif(p_data->>'adultes','')::int,0), coalesce(nullif(p_data->>'enfants','')::int,0),
      nullif(p_data->>'accompagnants',''),
      case p_data->>'mobilite' when 'Oui' then true when 'Non' then false end,
      nullif(p_data->>'mobilite_detail',''), nullif(p_data->>'remarque',''))
    on conflict (participant_id) do update set
      participe=excluded.participe, formule=excluded.formule, adultes=excluded.adultes, enfants=excluded.enfants,
      accompagnants=excluded.accompagnants, mobilite=excluded.mobilite, mobilite_detail=excluded.mobilite_detail,
      remarque=excluded.remarque, updated_at=now()
    returning case when participe='Non' then 0 else 1 + adultes + enfants end into v_total;
  end if;

  insert into submissions(idem_key, form, participant_id) values (p_key, p_form, v_id);
  return jsonb_build_object('ok', true, 'updated', v_updated, 'total', v_total);
end $$;
revoke all on function submit_form(int, uuid, jsonb) from public, anon, authenticated;
grant execute on function submit_form(int, uuid, jsonb) to service_role;

-- 7. VUES D'ADMINISTRATION (visibles dans Supabase > Table Editor ; exportables en CSV)
create or replace view v_participants as
select p.created_at as inscrit_le, p.prenom, p.nom, p.email, p.telephone, p.institution, p.pays, p.fonction,
  array_to_string(p.roles,' | ') as roles, p.axe, p.titre,
  case when p.confirme then 'Confirmé' else 'Non confirmé' end as statut,
  array_to_string(p.regime,' | ') as regime, p.allergie,
  p.accessibilite, p.accessibilite_detail, p.open_badge,
  (a.participant_id is not null) as arrivee_renseignee, coalesce(e.participe,'—') as excursion
from participants p left join arrivals a on a.participant_id = p.id left join excursions e on e.participant_id = p.id
order by p.created_at desc;

create or replace view v_arrivees as
select a.date_arrivee, case when a.date_autre then 'Autre date' end as date_autre, a.heure, a.aeroport, a.aeroport_autre, a.vol, a.compagnie,
  p.prenom, p.nom, p.telephone, p.email, a.ville_depart, a.correspondance, a.ville_correspondance, a.navette,
  a.total_personnes, a.nb_accompagnants, a.accompagnants, array_to_string(a.besoins,' | ') as besoins, a.besoins_detail,
  a.hotel, a.depart, a.message, a.mode, a.updated_at
from arrivals a join participants p on p.id = a.participant_id
order by a.date_arrivee nulls last, a.aeroport, a.heure;

create or replace view v_accueil_aeroport as   -- la feuille de route des chauffeurs / hôtesses
select a.date_arrivee, a.aeroport, a.heure, a.vol, a.compagnie, count(*) as groupes, sum(a.total_personnes) as personnes,
  string_agg(p.prenom||' '||p.nom, ' ; ' order by p.nom) as qui,
  bool_or(a.navette = 'Oui') as navette_demandee
from arrivals a join participants p on p.id = a.participant_id
where a.mode = 'Avion'
group by a.date_arrivee, a.aeroport, a.heure, a.vol, a.compagnie
order by a.date_arrivee nulls last, a.aeroport, a.heure;

create or replace view v_excursion as
select p.nom, p.prenom, p.email, p.telephone, e.participe, e.formule, e.adultes, e.enfants,
  e.personnes_a_transporter, e.personnes_a_confirmer, e.accompagnants, e.mobilite, e.mobilite_detail,
  array_to_string(p.regime,' | ') as regime, p.allergie, e.remarque, e.updated_at
from excursions e join participants p on p.id = e.participant_id
order by e.participe, p.nom;

create or replace view v_excursion_totaux as
select
  coalesce(sum(personnes_a_transporter),0) as personnes_a_transporter,
  coalesce(sum(personnes_a_confirmer),0)   as personnes_a_confirmer,
  count(*) filter (where participe = 'Oui') as participants_oui,
  coalesce(sum(adultes + enfants) filter (where participe = 'Oui'),0) as accompagnants_oui,
  coalesce(sum(adultes) filter (where participe = 'Oui'),0) as adultes_accompagnants,
  coalesce(sum(enfants) filter (where participe = 'Oui'),0) as enfants_accompagnants,
  count(*) filter (where participe = 'Je ne sais pas encore') as participants_peut_etre,
  count(*) filter (where participe = 'Non') as participants_non,
  count(*) filter (where participe = 'Oui' and mobilite) as mobilite_reduite,
  count(*) filter (where participe = 'Oui' and formule = 'El Jem')  as formule_el_jem,
  count(*) filter (where participe = 'Oui' and formule = 'Médina')  as formule_medina,
  count(*) filter (where participe = 'Oui' and formule = 'Les deux') as formule_les_deux
from excursions;

create or replace view v_stats as
select
  (select count(*) from participants where confirme) as confirmes,
  (select count(*) from participants where not confirme) as sans_confirmation,
  (select count(*) from arrivals) as arrivees_enregistrees,
  (select count(*) from arrivals where mode = 'Avion') as arrivees_avion,
  (select coalesce(sum(total_personnes),0) from arrivals) as personnes_a_accueillir,
  (select count(*) from excursions where participe = 'Oui') as excursion_oui,
  (select coalesce(sum(personnes_a_transporter),0) from excursions) as excursion_personnes_total;

create or replace view v_arrivees_par_jour as
select date_arrivee, count(*) as arrivees, sum(total_personnes) as personnes from arrivals where mode='Avion' group by 1 order by 1;

create or replace view v_arrivees_par_tranche as
select date_arrivee,
  case when heure is null then 'Heure inconnue' when heure < time '06:00' then '00h-06h' when heure < time '12:00' then '06h-12h'
       when heure < time '18:00' then '12h-18h' else '18h-24h' end as tranche,
  count(*) as arrivees, sum(total_personnes) as personnes
from arrivals where mode='Avion' group by 1,2 order by 1,2;

create or replace view v_arrivees_par_vol as
select date_arrivee, vol, compagnie, aeroport, min(heure) as heure, count(*) as arrivees, sum(total_personnes) as personnes
from arrivals where mode='Avion' group by 1,2,3,4 order by 1,5;

revoke all on all tables in schema public from anon, authenticated;
