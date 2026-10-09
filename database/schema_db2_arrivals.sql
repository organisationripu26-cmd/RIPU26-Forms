-- =====================================================================
-- RIPU26 — BASE DE DONNÉES 2 : INFORMATIONS D'ARRIVÉE
-- À exécuter dans la Console SQL de la Base 2 (Supabase / Neon)
-- =====================================================================
create extension if not exists pgcrypto;

create table if not exists arrivals (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  prenom text, nom text, telephone text,
  mode text not null check (mode in ('Avion','Autre')),
  date_arrivee date, date_autre boolean not null default false,
  aeroport text, aeroport_autre text, heure time, vol text, compagnie text, ville_depart text,
  correspondance boolean, ville_correspondance text, navette text,
  nb_accompagnants int not null default 0 check (nb_accompagnants between 0 and 10),
  accompagnants text, besoins text[] not null default '{}', besoins_detail text,
  hotel text, depart text, message text,
  total_personnes int generated always as (1 + nb_accompagnants) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint arrivals_email_ck check (email = lower(btrim(email)) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')
);
create unique index if not exists arrivals_email_uq on arrivals (lower(email));

create table if not exists submissions (
  id bigint generated always as identity primary key,
  idem_key uuid not null unique,
  form smallint not null check (form = 2),
  arrival_id uuid references arrivals(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table arrivals enable row level security;
alter table submissions enable row level security;
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

create or replace function submit_form(p_form int, p_key uuid, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(p_data->>'email'));
  v_id uuid; v_updated boolean := false; v_total int := 0;
begin
  if exists (select 1 from submissions where idem_key = p_key) then
    select arrival_id into v_id from submissions where idem_key = p_key;
    return jsonb_build_object('ok', true, 'duplicate', true, 'updated', false);
  end if;

  select id into v_id from arrivals where lower(email) = v_email for update;
  v_updated := v_id is not null;

  insert into arrivals(email, prenom, nom, telephone, mode, date_arrivee, date_autre, aeroport, aeroport_autre, heure, vol, compagnie,
    ville_depart, correspondance, ville_correspondance, navette, nb_accompagnants, accompagnants, besoins, besoins_detail,
    hotel, depart, message)
  values (v_email, nullif(p_data->>'prenom',''), nullif(p_data->>'nom',''), nullif(p_data->>'telephone',''),
    p_data->>'mode',
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
  on conflict (lower(email)) do update set
    prenom=coalesce(excluded.prenom, arrivals.prenom),
    nom=coalesce(excluded.nom, arrivals.nom),
    telephone=coalesce(excluded.telephone, arrivals.telephone),
    mode=excluded.mode, date_arrivee=excluded.date_arrivee, date_autre=excluded.date_autre, aeroport=excluded.aeroport,
    aeroport_autre=excluded.aeroport_autre, heure=excluded.heure, vol=excluded.vol, compagnie=excluded.compagnie,
    ville_depart=excluded.ville_depart, correspondance=excluded.correspondance,
    ville_correspondance=excluded.ville_correspondance, navette=excluded.navette,
    nb_accompagnants=excluded.nb_accompagnants, accompagnants=excluded.accompagnants, besoins=excluded.besoins,
    besoins_detail=excluded.besoins_detail, hotel=excluded.hotel, depart=excluded.depart, message=excluded.message,
    updated_at=now()
  returning id, total_personnes into v_id, v_total;

  insert into submissions(idem_key, form, arrival_id) values (p_key, 2, v_id);
  return jsonb_build_object('ok', true, 'updated', v_updated, 'total', v_total);
end $$;

revoke all on function submit_form(int, uuid, jsonb) from public, anon, authenticated;
grant execute on function submit_form(int, uuid, jsonb) to service_role;

create or replace view v_arrivees as
select a.date_arrivee, case when a.date_autre then 'Autre date' end as date_autre, a.heure, a.aeroport, a.aeroport_autre, a.vol, a.compagnie,
  a.prenom, a.nom, a.telephone, a.email, a.ville_depart, a.correspondance, a.ville_correspondance, a.navette,
  a.total_personnes, a.nb_accompagnants, a.accompagnants, array_to_string(a.besoins,' | ') as besoins, a.besoins_detail,
  a.hotel, a.depart, a.message, a.mode, a.updated_at
from arrivals a
order by a.date_arrivee nulls last, a.aeroport, a.heure;

create or replace view v_accueil_aeroport as
select a.date_arrivee, a.aeroport, a.heure, a.vol, a.compagnie, count(*) as groupes, sum(a.total_personnes) as personnes,
  string_agg(coalesce(a.prenom,'')||' '||coalesce(a.nom,''), ' ; ' order by a.nom) as qui,
  bool_or(a.navette = 'Oui') as navette_demandee
from arrivals a
where a.mode = 'Avion'
group by a.date_arrivee, a.aeroport, a.heure, a.vol, a.compagnie
order by a.date_arrivee nulls last, a.aeroport, a.heure;

create or replace view v_stats as
select
  (select count(*) from arrivals) as arrivees_enregistrees,
  (select count(*) from arrivals where mode = 'Avion') as arrivees_avion,
  (select coalesce(sum(total_personnes),0) from arrivals) as personnes_a_accueillir;

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
