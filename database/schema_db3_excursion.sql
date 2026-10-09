-- =====================================================================
-- RIPU26 — BASE DE DONNÉES 3 : INSCRIPTIONS À L'EXCURSION
-- À exécuter dans la Console SQL de la Base 3 (Supabase / Neon)
-- =====================================================================
create extension if not exists pgcrypto;

create table if not exists excursions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  prenom text, nom text, telephone text,
  participe text not null check (participe in ('Oui','Non','Je ne sais pas encore')),
  formule text check (formule in ('El Jem','Médina','Les deux')),
  adultes int not null default 0 check (adultes between 0 and 5),
  enfants int not null default 0 check (enfants between 0 and 5),
  accompagnants text, mobilite boolean, mobilite_detail text, remarque text,
  personnes_a_transporter int generated always as (case when participe = 'Oui' then 1 + adultes + enfants else 0 end) stored,
  personnes_a_confirmer   int generated always as (case when participe = 'Je ne sais pas encore' then 1 + adultes + enfants else 0 end) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint excursions_email_ck check (email = lower(btrim(email)) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')
);
create unique index if not exists excursions_email_uq on excursions (lower(email));

create table if not exists submissions (
  id bigint generated always as identity primary key,
  idem_key uuid not null unique,
  form smallint not null check (form = 3),
  excursion_id uuid references excursions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table excursions enable row level security;
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
    select excursion_id into v_id from submissions where idem_key = p_key;
    return jsonb_build_object('ok', true, 'duplicate', true, 'updated', false);
  end if;

  select id into v_id from excursions where lower(email) = v_email for update;
  v_updated := v_id is not null;

  insert into excursions(email, prenom, nom, telephone, participe, formule, adultes, enfants, accompagnants, mobilite, mobilite_detail, remarque)
  values (v_email, nullif(p_data->>'prenom',''), nullif(p_data->>'nom',''), nullif(p_data->>'telephone',''),
    p_data->>'participe', nullif(p_data->>'formule',''),
    coalesce(nullif(p_data->>'adultes','')::int,0), coalesce(nullif(p_data->>'enfants','')::int,0),
    nullif(p_data->>'accompagnants',''),
    case p_data->>'mobilite' when 'Oui' then true when 'Non' then false end,
    nullif(p_data->>'mobilite_detail',''), nullif(p_data->>'remarque',''))
  on conflict (lower(email)) do update set
    prenom=coalesce(excluded.prenom, excursions.prenom),
    nom=coalesce(excluded.nom, excursions.nom),
    telephone=coalesce(excluded.telephone, excursions.telephone),
    participe=excluded.participe, formule=excluded.formule, adultes=excluded.adultes, enfants=excluded.enfants,
    accompagnants=excluded.accompagnants, mobilite=excluded.mobilite, mobilite_detail=excluded.mobilite_detail,
    remarque=excluded.remarque, updated_at=now()
  returning id, case when participe='Non' then 0 else 1 + adultes + enfants end into v_id, v_total;

  insert into submissions(idem_key, form, excursion_id) values (p_key, 3, v_id);
  return jsonb_build_object('ok', true, 'updated', v_updated, 'total', v_total);
end $$;

revoke all on function submit_form(int, uuid, jsonb) from public, anon, authenticated;
grant execute on function submit_form(int, uuid, jsonb) to service_role;

create or replace view v_excursion as
select e.nom, e.prenom, e.email, e.telephone, e.participe, e.formule, e.adultes, e.enfants,
  e.personnes_a_transporter, e.personnes_a_confirmer, e.accompagnants, e.mobilite, e.mobilite_detail,
  e.remarque, e.updated_at
from excursions e
order by e.participe, e.nom;

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
  (select count(*) from excursions where participe = 'Oui') as excursion_oui,
  (select coalesce(sum(personnes_a_transporter),0) from excursions) as excursion_personnes_total;

revoke all on all tables in schema public from anon, authenticated;
