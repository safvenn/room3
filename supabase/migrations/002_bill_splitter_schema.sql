-- ================================================================
-- BudgetBuddy — Bill Splitter & Group Expenses Database Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ================================================================

-- ── 1. Update profiles table ───────────────────────────────────
alter table public.profiles add column if not exists upi_id text;

-- ── 2. Friendships table ───────────────────────────────────────
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sender_id, receiver_id)
);

alter table public.friendships enable row level security;

create policy "Users can view friendships they are part of"
  on public.friendships for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can insert friendships where they are sender"
  on public.friendships for insert
  with check (auth.uid() = sender_id);

create policy "Users can update friendships they are part of"
  on public.friendships for update
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can delete friendships they are part of"
  on public.friendships for delete
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- ── 3. Groups table ───────────────────────────────────────────
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.groups enable row level security;

create policy "Users can view groups they are member of"
  on public.groups for select
  using (
    auth.uid() = created_by or 
    exists (
      select 1 from public.group_members 
      where group_members.group_id = id and group_members.user_id = auth.uid()
    )
  );

create policy "Users can insert groups they created"
  on public.groups for insert
  with check (auth.uid() = created_by);

create policy "Users can update groups they created"
  on public.groups for update
  using (auth.uid() = created_by);

create policy "Users can delete groups they created"
  on public.groups for delete
  using (auth.uid() = created_by);

-- ── 4. Group Members table ────────────────────────────────────
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(group_id, user_id)
);

alter table public.group_members enable row level security;

create policy "Members can view group members"
  on public.group_members for select
  using (
    exists (
      select 1 from public.group_members m 
      where m.group_id = group_id and m.user_id = auth.uid()
    ) or exists (
      select 1 from public.groups g 
      where g.id = group_id and g.created_by = auth.uid()
    )
  );

create policy "Users can add members to groups they belong to or created"
  on public.group_members for insert
  with check (
    exists (
      select 1 from public.groups g 
      where g.id = group_id and g.created_by = auth.uid()
    ) or exists (
      select 1 from public.group_members m 
      where m.group_id = group_id and m.user_id = auth.uid()
    ) or user_id = auth.uid()
  );

create policy "Members can leave or creators can remove members"
  on public.group_members for delete
  using (
    user_id = auth.uid() or 
    exists (
      select 1 from public.groups g 
      where g.id = group_id and g.created_by = auth.uid()
    )
  );

-- ── 5. Expenses table ─────────────────────────────────────────
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

alter table public.expenses enable row level security;

create policy "Users can view relevant expenses"
  on public.expenses for select
  using (
    paid_by = auth.uid() or 
    exists (
      select 1 from public.expense_splits s 
      where s.expense_id = id and s.user_id = auth.uid()
    ) or (
      group_id is not null and exists (
        select 1 from public.group_members m 
        where m.group_id = group_id and m.user_id = auth.uid()
      )
    )
  );

create policy "Users can insert expenses they paid for"
  on public.expenses for insert
  with check (paid_by = auth.uid());

create policy "Payers can update their expenses"
  on public.expenses for update
  using (paid_by = auth.uid());

create policy "Payers can delete their expenses"
  on public.expenses for delete
  using (paid_by = auth.uid());

-- ── 6. Expense Splits table ───────────────────────────────────
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

alter table public.expense_splits enable row level security;

create policy "Users can view relevant splits"
  on public.expense_splits for select
  using (
    user_id = auth.uid() or 
    exists (
      select 1 from public.expenses e 
      where e.id = expense_id and e.paid_by = auth.uid()
    )
  );

create policy "Payers can insert splits for their expenses"
  on public.expense_splits for insert
  with check (
    exists (
      select 1 from public.expenses e 
      where e.id = expense_id and e.paid_by = auth.uid()
    )
  );

create policy "Users can update their own split status or payers can edit splits"
  on public.expense_splits for update
  using (
    user_id = auth.uid() or 
    exists (
      select 1 from public.expenses e 
      where e.id = expense_id and e.paid_by = auth.uid()
    )
  );

create policy "Payers can delete splits"
  on public.expense_splits for delete
  using (
    exists (
      select 1 from public.expenses e 
      where e.id = expense_id and e.paid_by = auth.uid()
    )
  );

-- ── 7. Settlements table ──────────────────────────────────────
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

alter table public.settlements enable row level security;

create policy "Users can view settlements they are part of"
  on public.settlements for select
  using (auth.uid() = payer_id or auth.uid() = receiver_id);

create policy "Users can insert settlements they are part of"
  on public.settlements for insert
  with check (auth.uid() = payer_id or auth.uid() = receiver_id);

create policy "Users can update settlements they are part of"
  on public.settlements for update
  using (auth.uid() = payer_id or auth.uid() = receiver_id);

create policy "Users can delete settlements they are part of"
  on public.settlements for delete
  using (auth.uid() = payer_id or auth.uid() = receiver_id);

-- ── 8. Budgets table (Splitter-compatible) ────────────────────
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

alter table public.budgets enable row level security;

create policy "Users can manage their own budgets"
  on public.budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 9. Notifications table ────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can manage their own notifications"
  on public.notifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 10. Profile View Policy helper ────────────────────────────
-- Enable select for all users so friends searching works
create policy "Allow select profiles for auth users"
  on public.profiles for select
  using (auth.role() = 'authenticated');
