-- ================================================================
-- BudgetBuddy — Supabase Database Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ================================================================

-- ── Enable UUID extension ────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ================================================================
-- 1. PROFILES
-- ================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  display_name text,
  avatar_url  text,
  currency    text not null default 'USD',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ── RLS: Profiles ────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ================================================================
-- 2. CATEGORIES
-- ================================================================
create table if not exists public.categories (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id) on delete cascade,
  name        text not null,
  icon        text not null default '💰',
  color       text not null default '#6366f1',
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  unique(user_id, name)
);

-- ── Seed: Default categories ─────────────────────────────────
insert into public.categories (name, icon, color, is_default) values
  ('Food & Dining',     '🍔', '#f59e0b', true),
  ('Transport',         '🚗', '#3b82f6', true),
  ('Housing & Rent',    '🏠', '#8b5cf6', true),
  ('Entertainment',     '🎬', '#ec4899', true),
  ('Healthcare',        '💊', '#10b981', true),
  ('Shopping',          '🛍️', '#f97316', true),
  ('Education',         '📚', '#06b6d4', true),
  ('Savings',           '🏦', '#22c55e', true),
  ('Salary',            '💵', '#22c55e', true),
  ('Freelance',         '💻', '#a855f7', true),
  ('Investments',       '📈', '#14b8a6', true),
  ('Other',             '📌', '#6b7280', true)
on conflict do nothing;

-- ── RLS: Categories ──────────────────────────────────────────
alter table public.categories enable row level security;

create policy "Anyone can view default categories"
  on public.categories for select
  using (is_default = true or auth.uid() = user_id);

create policy "Users can insert own categories"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update own categories"
  on public.categories for update
  using (auth.uid() = user_id and is_default = false);

create policy "Users can delete own categories"
  on public.categories for delete
  using (auth.uid() = user_id and is_default = false);

-- ================================================================
-- 3. BUDGETS
-- ================================================================
create table if not exists public.budgets (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  category_id  uuid not null references public.categories(id) on delete cascade,
  month        char(7) not null, -- 'YYYY-MM'
  amount       numeric(12, 2) not null check (amount >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(user_id, category_id, month)
);

create trigger budgets_updated_at
  before update on public.budgets
  for each row execute procedure public.set_updated_at();

-- ── RLS: Budgets ─────────────────────────────────────────────
alter table public.budgets enable row level security;

create policy "Users can manage their own budgets"
  on public.budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ================================================================
-- 4. TRANSACTIONS
-- ================================================================
create type if not exists public.transaction_type as enum ('income', 'expense');

create table if not exists public.transactions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  category_id  uuid not null references public.categories(id) on delete restrict,
  title        text not null,
  amount       numeric(12, 2) not null check (amount > 0),
  type         public.transaction_type not null,
  date         date not null default current_date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger transactions_updated_at
  before update on public.transactions
  for each row execute procedure public.set_updated_at();

-- Index for fast queries by user + month
create index if not exists idx_transactions_user_date
  on public.transactions (user_id, date desc);

create index if not exists idx_transactions_user_category
  on public.transactions (user_id, category_id);

-- ── RLS: Transactions ────────────────────────────────────────
alter table public.transactions enable row level security;

create policy "Users can manage their own transactions"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ================================================================
-- 5. RECEIPT ATTACHMENTS
-- ================================================================
create table if not exists public.receipt_attachments (
  id              uuid primary key default uuid_generate_v4(),
  transaction_id  uuid not null references public.transactions(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  storage_path    text not null,
  file_name       text not null,
  file_size       integer not null,
  created_at      timestamptz not null default now()
);

-- ── RLS: Attachments ─────────────────────────────────────────
alter table public.receipt_attachments enable row level security;

create policy "Users can manage their own attachments"
  on public.receipt_attachments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ================================================================
-- 6. STORAGE: receipts bucket
-- ================================================================
-- Run this via Supabase Dashboard → Storage → New Bucket
-- OR uncomment and run via SQL (requires storage extension):
--
-- insert into storage.buckets (id, name, public)
-- values ('receipts', 'receipts', false)
-- on conflict do nothing;
--
-- create policy "Users can upload their own receipts"
--   on storage.objects for insert
--   with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- create policy "Users can view their own receipts"
--   on storage.objects for select
--   using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- create policy "Users can delete their own receipts"
--   on storage.objects for delete
--   using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
