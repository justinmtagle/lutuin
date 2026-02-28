-- Subscriptions table
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'inactive'
    check (status in ('active', 'expired', 'inactive')),
  started_at timestamptz,
  expires_at timestamptz,
  payment_method text,
  paymongo_checkout_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Payment history
create table public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  subscription_id uuid references public.subscriptions(id),
  amount integer not null,
  currency text default 'PHP',
  status text not null check (status in ('paid', 'failed', 'pending')),
  paymongo_payment_id text,
  paymongo_checkout_id text,
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- Add recipe_count to daily_usage (currently missing)
alter table public.daily_usage add column recipe_count integer default 0;

-- RLS for subscriptions
alter table public.subscriptions enable row level security;
create policy "Users can view own subscription"
  on public.subscriptions for select using (auth.uid() = user_id);

-- RLS for payments
alter table public.payments enable row level security;
create policy "Users can view own payments"
  on public.payments for select using (auth.uid() = user_id);
