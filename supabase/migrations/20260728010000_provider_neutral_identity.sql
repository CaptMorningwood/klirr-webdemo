-- Issue #72: provider-neutral application identity and Clerk link foundation.
-- Apply unchanged through isolated environments. Never edit after shared use.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active'
    check (status in ('active', 'disabled', 'deletion_pending')),
  created_at timestamptz not null default now(),
  authenticated_at timestamptz
);

create table if not exists public.app_user_emails (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.app_users(id) on delete cascade,
  email_normalized text not null check (email_normalized = lower(trim(email_normalized))),
  verified_at timestamptz,
  link_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  unique (app_user_id, email_normalized)
);

create index if not exists app_user_emails_candidate_idx
  on public.app_user_emails (email_normalized)
  where link_eligible and verified_at is not null;

create table if not exists public.external_identities (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.app_users(id) on delete restrict,
  provider text not null check (provider in ('clerk', 'entra_external_id')),
  provider_subject text not null,
  primary_email_at_link_time text,
  email_verified_at_link_time timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (provider, provider_subject)
);

create index if not exists external_identities_app_user_idx
  on public.external_identities (app_user_id);

create table if not exists public.identity_link_events (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.app_users(id) on delete restrict,
  external_identity_id uuid not null references public.external_identities(id) on delete restrict,
  event_type text not null check (event_type in ('new_user', 'eligible_verified_email', 'exact_subject')),
  occurred_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.app_user_emails enable row level security;
alter table public.external_identities enable row level security;
alter table public.identity_link_events enable row level security;

revoke all on public.app_users from anon, authenticated;
revoke all on public.app_user_emails from anon, authenticated;
revoke all on public.external_identities from anon, authenticated;
revoke all on public.identity_link_events from anon, authenticated;

create or replace function public.resolve_external_identity(
  p_provider text,
  p_provider_subject text,
  p_email text,
  p_email_verified boolean
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_app_user_id uuid;
  v_external_identity_id uuid;
  v_app_user_status text;
  v_email text;
  v_candidate_count integer;
  v_event_type text;
begin
  if p_provider not in ('clerk', 'entra_external_id') then
    raise exception 'invalid_identity_provider';
  end if;
  if nullif(trim(p_provider_subject), '') is null then
    raise exception 'invalid_identity_subject';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_provider_subject, 0));
  v_email := case
    when p_email_verified and nullif(trim(p_email), '') is not null then lower(trim(p_email))
    else null
  end;

  select identity.app_user_id, identity.id, app_user.status
    into v_app_user_id, v_external_identity_id, v_app_user_status
    from public.external_identities identity
    join public.app_users app_user on app_user.id = identity.app_user_id
   where identity.provider = p_provider and identity.provider_subject = p_provider_subject;

  if found then
    if v_app_user_status <> 'active' then
      raise exception 'app_user_inactive';
    end if;
    update public.external_identities set last_seen_at = now() where id = v_external_identity_id;
    update public.app_users set authenticated_at = now() where id = v_app_user_id;
    return v_app_user_id;
  end if;

  if v_email is not null then
    perform pg_advisory_xact_lock(hashtextextended('verified-email:' || v_email, 0));
    select count(distinct email.app_user_id), min(email.app_user_id::text)::uuid
      into v_candidate_count, v_app_user_id
      from public.app_user_emails email
      join public.app_users app_user on app_user.id = email.app_user_id
     where email.email_normalized = v_email
       and email.verified_at is not null
       and email.link_eligible
       and app_user.status = 'active';

    if v_candidate_count > 1 then
      raise exception 'ambiguous_verified_email';
    end if;
  else
    v_candidate_count := 0;
  end if;

  if v_candidate_count = 1 then
    v_event_type := 'eligible_verified_email';
  else
    insert into public.app_users (authenticated_at)
    values (now())
    returning id into v_app_user_id;
    v_event_type := 'new_user';
  end if;

  insert into public.external_identities (
    app_user_id,
    provider,
    provider_subject,
    primary_email_at_link_time,
    email_verified_at_link_time
  ) values (
    v_app_user_id,
    p_provider,
    p_provider_subject,
    v_email,
    case when v_email is not null then now() else null end
  )
  returning id into v_external_identity_id;

  if v_email is not null then
    insert into public.app_user_emails (
      app_user_id,
      email_normalized,
      verified_at,
      link_eligible
    ) values (
      v_app_user_id,
      v_email,
      now(),
      false
    )
    on conflict (app_user_id, email_normalized)
    do update set verified_at = coalesce(public.app_user_emails.verified_at, excluded.verified_at);
  end if;

  insert into public.identity_link_events (app_user_id, external_identity_id, event_type)
  values (v_app_user_id, v_external_identity_id, v_event_type);

  return v_app_user_id;
end;
$$;

revoke all on function public.resolve_external_identity(text, text, text, boolean) from public;
revoke all on function public.resolve_external_identity(text, text, text, boolean) from anon, authenticated;
grant execute on function public.resolve_external_identity(text, text, text, boolean) to service_role;

-- Legacy Supabase-auth rows remain readable only through their existing path until
-- explicitly migrated. New Clerk-backed snapshot writes use app_user_id exclusively.
create table if not exists public.app_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  app_user_id uuid references public.app_users(id) on delete cascade,
  version text not null default '1.0',
  state jsonb not null,
  created_at timestamptz not null default now()
);

alter table if exists public.app_snapshots
  add column if not exists app_user_id uuid references public.app_users(id) on delete cascade;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'accounts',
    'transactions',
    'manual_expenses',
    'incomes',
    'variable_plan_items',
    'rules',
    'budget_buddy_messages'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format(
        'alter table public.%I add column if not exists app_user_id uuid references public.app_users(id) on delete cascade',
        table_name
      );
    end if;
  end loop;
end;
$$;

create index if not exists app_snapshots_app_user_created_idx
  on public.app_snapshots (app_user_id, created_at desc)
  where app_user_id is not null;

alter table if exists public.app_snapshots alter column user_id drop not null;
alter table if exists public.app_snapshots
  drop constraint if exists app_snapshots_exactly_one_owner;
alter table if exists public.app_snapshots
  add constraint app_snapshots_exactly_one_owner
  check (num_nonnulls(user_id, app_user_id) = 1);
