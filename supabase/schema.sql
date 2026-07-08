-- Klirr v1.0 beta foundation
-- Kör detta i Supabase SQL Editor. Tabellerna är byggda för beta: snapshot-lagring + strukturerade tabeller för nästa steg.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);

create table if not exists public.app_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null default '1.0',
  state jsonb not null,
  created_at timestamptz default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  name text not null,
  bank_label text,
  is_own boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  client_id text,
  tx_date date not null,
  description text not null,
  amount numeric not null,
  raw jsonb,
  fingerprint text,
  created_at timestamptz default now()
);

create table if not exists public.manual_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  amount numeric not null,
  category text,
  cost_type text check (cost_type in ('fixed','variable')),
  frequency text check (frequency in ('monthly','quarterly','yearly','irregular')) default 'monthly',
  active boolean default true,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  amount numeric not null,
  frequency text check (frequency in ('monthly','quarterly','yearly','irregular')) default 'monthly',
  created_at timestamptz default now()
);

create table if not exists public.variable_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  amount numeric not null,
  category text,
  include boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_text text not null,
  category text not null,
  cost_type text not null,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.budget_buddy_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.app_snapshots enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.manual_expenses enable row level security;
alter table public.incomes enable row level security;
alter table public.variable_plan_items enable row level security;
alter table public.rules enable row level security;
alter table public.budget_buddy_messages enable row level security;

create policy "Users can manage own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users can manage own snapshots" on public.app_snapshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage own accounts" on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage own transactions" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage own manual expenses" on public.manual_expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage own incomes" on public.incomes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage own variable plan" on public.variable_plan_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage own rules" on public.rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage own buddy messages" on public.budget_buddy_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists app_snapshots_user_created_idx on public.app_snapshots(user_id, created_at desc);
create index if not exists transactions_user_date_idx on public.transactions(user_id, tx_date desc);
create index if not exists transactions_fingerprint_idx on public.transactions(user_id, fingerprint);
