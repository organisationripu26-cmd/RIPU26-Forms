-- =====================================================================
-- RIPU26 — BASE DE DONNÉES 1 : CONFIRMATION DE PARTICIPATION
-- À exécuter dans la Console SQL de la Base 1 (Supabase / Neon)
-- =====================================================================
create extension if not exists pgcrypto;

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
create unique index if not exists participants_email_uq on participants (lower(email));

create table if not exists submissions (
  id bigint generated always as identity primary key,
  idem_key uuid not null unique,
  form smallint not null check (form = 1),
  participant_id uuid references participants(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table participants enable row level security;
alter table submissions  enable row level security;
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

create or replace function submit_form(p_form int, p_key uuid, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(p_data->>'email'));
  v_id uuid; v_exists boolean; v_updated boolean := false;
begin
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

  v_updated := exists (select 1 from participants where id = v_id and confirme);

  update participants set
    prenom = coalesce(nullif(p_data->>'prenom',''), prenom),
    nom = coalesce(nullif(p_data->>'nom',''), nom),
    telephone = coalesce(nullif(p_data->>'telephone',''), telephone),
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
    confirmed_at = case when coalesce((p_data->>'confirme')::boolean,false) then coalesce(confirmed_at, now()) else confirmed_at end,
    updated_at = now()
  where id = v_id;

  insert into submissions(idem_key, form, participant_id) values (p_key, 1, v_id);
  return jsonb_build_object('ok', true, 'updated', v_updated, 'total', 1);
end $$;

revoke all on function submit_form(int, uuid, jsonb) from public, anon, authenticated;
grant execute on function submit_form(int, uuid, jsonb) to service_role;

create or replace view v_participants as
select p.created_at as inscrit_le, p.prenom, p.nom, p.email, p.telephone, p.institution, p.pays, p.fonction,
  array_to_string(p.roles,' | ') as roles, p.axe, p.titre,
  case when p.confirme then 'Confirmé' else 'Non confirmé' end as statut,
  array_to_string(p.regime,' | ') as regime, p.allergie,
  p.accessibilite, p.accessibilite_detail, p.open_badge
from participants p
order by p.created_at desc;

create or replace view v_stats as
select
  (select count(*) from participants where confirme) as confirmes,
  (select count(*) from participants where not confirme) as sans_confirmation;

revoke all on all tables in schema public from anon, authenticated;
