-- User profiles (extends Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  skill_level text check (skill_level in ('beginner', 'intermediate', 'advanced')) default 'beginner',
  dietary_restrictions text[] default '{}',
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Master ingredient list
create table public.ingredients (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  category text not null check (category in ('protein', 'vegetable', 'fruit', 'spice', 'pantry_staple', 'dairy', 'grain', 'sauce_condiment', 'other')),
  common_in_ph boolean default false,
  aliases text[] default '{}',
  created_at timestamptz default now()
);

-- User's pantry
create table public.user_pantry (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  ingredient_id uuid references public.ingredients(id) on delete cascade not null,
  quantity_level text check (quantity_level in ('plenty', 'some', 'running_low')) default 'some',
  added_at timestamptz default now(),
  unique(user_id, ingredient_id)
);

-- Curated recipes
create table public.recipes (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  cuisine text default 'filipino',
  difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')) not null,
  cook_time_minutes integer not null,
  servings integer default 4,
  steps jsonb not null default '[]',
  image_url text,
  created_at timestamptz default now()
);

-- Recipe-ingredient mapping
create table public.recipe_ingredients (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references public.recipes(id) on delete cascade not null,
  ingredient_id uuid references public.ingredients(id) on delete cascade not null,
  amount text,
  unit text,
  is_optional boolean default false
);

-- Cooking sessions (history + feedback)
create table public.cooking_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  recipe_id uuid references public.recipes(id) on delete set null,
  chef_chat_history jsonb default '[]',
  rating integer check (rating between 1 and 5),
  difficulty_feedback text check (difficulty_feedback in ('too_easy', 'just_right', 'too_hard')),
  completed_at timestamptz default now()
);

-- User preferences (learned over time)
create table public.user_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade unique not null,
  preferred_cuisines text[] default '{filipino}',
  avoided_ingredients uuid[] default '{}',
  flavor_preferences text[] default '{}',
  updated_at timestamptz default now()
);

-- Usage tracking for freemium gating
create table public.daily_usage (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date default current_date not null,
  suggestion_count integer default 0,
  chat_message_count integer default 0,
  unique(user_id, date)
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.user_pantry enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.cooking_sessions enable row level security;
alter table public.user_preferences enable row level security;
alter table public.daily_usage enable row level security;

-- Profiles: users can read/update their own
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Ingredients: everyone can read
create policy "Anyone can view ingredients" on public.ingredients for select using (true);

-- Recipes: everyone can read
create policy "Anyone can view recipes" on public.recipes for select using (true);
create policy "Anyone can view recipe ingredients" on public.recipe_ingredients for select using (true);

-- User pantry: users can CRUD their own
create policy "Users can view own pantry" on public.user_pantry for select using (auth.uid() = user_id);
create policy "Users can add to own pantry" on public.user_pantry for insert with check (auth.uid() = user_id);
create policy "Users can update own pantry" on public.user_pantry for update using (auth.uid() = user_id);
create policy "Users can delete from own pantry" on public.user_pantry for delete using (auth.uid() = user_id);

-- Cooking sessions: users can CRUD their own
create policy "Users can view own sessions" on public.cooking_sessions for select using (auth.uid() = user_id);
create policy "Users can create own sessions" on public.cooking_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" on public.cooking_sessions for update using (auth.uid() = user_id);

-- User preferences: users can CRUD their own
create policy "Users can view own preferences" on public.user_preferences for select using (auth.uid() = user_id);
create policy "Users can upsert own preferences" on public.user_preferences for insert with check (auth.uid() = user_id);
create policy "Users can update own preferences" on public.user_preferences for update using (auth.uid() = user_id);

-- Daily usage: users can CRUD their own
create policy "Users can view own usage" on public.daily_usage for select using (auth.uid() = user_id);
create policy "Users can insert own usage" on public.daily_usage for insert with check (auth.uid() = user_id);
create policy "Users can update own usage" on public.daily_usage for update using (auth.uid() = user_id);

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  insert into public.user_preferences (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
