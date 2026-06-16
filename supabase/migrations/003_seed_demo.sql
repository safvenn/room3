-- ================================================================
-- BudgetBuddy — Supabase Schema & Seeding (Run this in SQL Editor)
-- This creates the demo user and populates the database with sample data.
-- ================================================================

-- 1. Initialize Tables (in case migration 002 was not run)
alter table public.profiles add column if not exists upi_id text;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sender_id, receiver_id)
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(group_id, user_id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  amount numeric(12, 2) not null check (amount >= 0),
  paid_by uuid not null references public.profiles(id) on delete cascade,
  payment_method text not null check (payment_method in ('GPay', 'Cash')),
  category text not null,
  split_type text not null check (split_type in ('equal', 'percentage', 'custom')),
  group_id uuid references public.groups(id) on delete set null,
  expense_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  share_amount numeric(12, 2) not null check (share_amount >= 0),
  status text not null check (status in ('pending', 'accepted', 'disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(expense_id, user_id)
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  payer_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_method text not null check (payment_method in ('GPay', 'Cash')),
  status text not null check (status in ('pending', 'completed')),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month integer not null check (month >= 1 and month <= 12),
  year integer not null,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, month, year)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Enable RLS policies (in case they weren't enabled)
alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.budgets enable row level security;
alter table public.notifications enable row level security;

-- 2. Create Users in auth.users
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo@budgetbuddy.app', extensions.crypt('Demo1234', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Demo User"}', false, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rahul@budgetbuddy.app', extensions.crypt('Friend1234', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Rahul"}', false, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'safvan@budgetbuddy.app', extensions.crypt('Friend1234', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Safvan"}', false, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'arjun@budgetbuddy.app', extensions.crypt('Friend1234', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Arjun"}', false, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'meera@budgetbuddy.app', extensions.crypt('Friend1234', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Meera"}', false, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'priya@budgetbuddy.app', extensions.crypt('Friend1234', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Priya"}', false, now(), now())
on conflict (id) do nothing;

-- 3. Ensure profiles are present
insert into public.profiles (id, email, display_name) values
  ('d0000000-0000-0000-0000-000000000000', 'demo@budgetbuddy.app', 'Demo User'),
  ('d0000000-0000-0000-0000-000000000001', 'rahul@budgetbuddy.app', 'Rahul'),
  ('d0000000-0000-0000-0000-000000000002', 'safvan@budgetbuddy.app', 'Safvan'),
  ('d0000000-0000-0000-0000-000000000003', 'arjun@budgetbuddy.app', 'Arjun'),
  ('d0000000-0000-0000-0000-000000000004', 'meera@budgetbuddy.app', 'Meera'),
  ('d0000000-0000-0000-0000-000000000005', 'priya@budgetbuddy.app', 'Priya')
on conflict (id) do nothing;

-- 4. Seed friendships
insert into public.friendships (id, sender_id, receiver_id, status) values
  ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'accepted'),
  ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002', 'accepted'),
  ('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003', 'accepted'),
  ('f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000004', 'accepted'),
  ('f0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000005', 'accepted')
on conflict (id) do nothing;

-- 5. Seed groups
insert into public.groups (id, name, description, created_by) values
  ('g0000000-0000-0000-0000-000000000001', 'Goa Trip', 'Trip to Goa with friends', 'd0000000-0000-0000-0000-000000000000'),
  ('g0000000-0000-0000-0000-000000000002', 'Flat Expenses', 'Shared apartment bills', 'd0000000-0000-0000-0000-000000000000'),
  ('g0000000-0000-0000-0000-000000000003', 'Office Lunch', 'Lunch splits at work', 'd0000000-0000-0000-0000-000000000000')
on conflict (id) do nothing;

-- 6. Seed group members
insert into public.group_members (id, group_id, user_id) values
  ('m0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000000'),
  ('m0000000-0000-0000-0000-000000000002', 'g0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001'),
  ('m0000000-0000-0000-0000-000000000003', 'g0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002'),
  ('m0000000-0000-0000-0000-000000000004', 'g0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000000'),
  ('m0000000-0000-0000-0000-000000000005', 'g0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002'),
  ('m0000000-0000-0000-0000-000000000006', 'g0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003'),
  ('m0000000-0000-0000-0000-000000000007', 'g0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004'),
  ('m0000000-0000-0000-0000-000000000008', 'g0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000000'),
  ('m0000000-0000-0000-0000-000000000009', 'g0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001'),
  ('m0000000-0000-0000-0000-000000000010', 'g0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003'),
  ('m0000000-0000-0000-0000-000000000011', 'g0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004'),
  ('m0000000-0000-0000-0000-000000000012', 'g0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000005')
on conflict (id) do nothing;

-- 7. Seed expenses
insert into public.expenses (id, title, description, amount, paid_by, payment_method, category, split_type, group_id, expense_date) values
  ('e0000000-0000-0000-0000-000000000001', 'Dinner at Raj''s', 'Automated demo expense', 850.00, 'd0000000-0000-0000-0000-000000000000', 'Cash', 'Food', 'equal', 'g0000000-0000-0000-0000-000000000003', current_date),
  ('e0000000-0000-0000-0000-000000000002', 'Goa Trip Tickets', 'Automated demo expense', 4200.00, 'd0000000-0000-0000-0000-000000000001', 'GPay', 'Travel', 'equal', 'g0000000-0000-0000-0000-000000000001', current_date),
  ('e0000000-0000-0000-0000-000000000003', 'Groceries', 'Automated demo expense', 1500.00, 'd0000000-0000-0000-0000-000000000000', 'Cash', 'Shopping', 'equal', 'g0000000-0000-0000-0000-000000000002', current_date)
on conflict (id) do nothing;

-- 8. Seed expense splits
insert into public.expense_splits (id, expense_id, user_id, share_amount, status) values
  ('s0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000000', 283.33, 'accepted'),
  ('s0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 283.33, 'accepted'),
  ('s0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 283.34, 'accepted'),
  ('s0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000000', 1400.00, 'accepted'),
  ('s0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 1400.00, 'accepted'),
  ('s0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 1400.00, 'accepted'),
  ('s0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000000', 750.00, 'accepted'),
  ('s0000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 750.00, 'accepted')
on conflict (id) do nothing;

-- 8. Seed budget
insert into public.budgets (id, user_id, month, year, amount) values
  ('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000000', extract(month from current_date)::integer, extract(year from current_date)::integer, 20000.00)
on conflict (id) do nothing;
