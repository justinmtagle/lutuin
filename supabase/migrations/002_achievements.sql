-- Achievement progress tracking
create table public.user_achievements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  achievement_slug text not null,
  unlocked_at timestamptz,
  progress jsonb default '{}',
  created_at timestamptz default now(),
  unique(user_id, achievement_slug)
);

-- RLS
alter table public.user_achievements enable row level security;

create policy "Users can view own achievements"
  on public.user_achievements for select
  using (auth.uid() = user_id);

create policy "Users can insert own achievements"
  on public.user_achievements for insert
  with check (auth.uid() = user_id);

create policy "Users can update own achievements"
  on public.user_achievements for update
  using (auth.uid() = user_id);
