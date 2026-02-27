# Save Recipes & Fix Unknown Dish Design

## Goal

Let users save AI-generated recipes for re-cooking later, and fix "Unknown dish" showing in recent activity for AI-generated cooking sessions.

## Architecture

Two targeted changes: (1) a new `saved_recipes` table that stores full recipe JSON when users explicitly bookmark a recipe, and (2) a `dish_name` column on `cooking_sessions` so recent activity can display the dish name even without a `recipe_id`.

### Database Changes

**New `saved_recipes` table:**

```sql
create table public.saved_recipes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  dish_name text not null,
  recipe_data jsonb not null,
  saved_at timestamptz default now()
);
```

RLS: users can only SELECT, INSERT, DELETE their own rows.

**Add `dish_name` to `cooking_sessions`:**

```sql
alter table public.cooking_sessions add column dish_name text;
```

Stores the dish name when `recipe_id` is null (AI-generated recipes).

### Save Recipe UX

- Bookmark icon on the recipe overview screen (top-right area near dish name)
- Tap to save: stores full recipe JSON to `saved_recipes` via client-side Supabase insert
- If already saved, icon is filled; tap again to unsave (delete from `saved_recipes`)
- Save state checked when overview loads by querying `saved_recipes` for matching `user_id` + `dish_name`

### Dashboard "Saved Recipes" Section

- Appears below "Recent Activity" on the main dashboard
- Shows up to 4 saved recipes as compact cards (dish name, difficulty badge, time)
- Tapping a card navigates to `/dashboard/cook?saved=<id>`
- Only shown when user has at least one saved recipe

### Cook Page Changes

- When `saved` query param is present: load recipe from `saved_recipes` table by ID instead of calling AI. Skip loading stage, go straight to overview.
- When completing cooking (feedback submission): store `dish_name` in the `cooking_sessions` insert alongside existing fields.
- The recipe overview's bookmark button does a client-side Supabase insert/delete on `saved_recipes`.

### Dashboard Recent Activity Fix

Change the dashboard query to also select `dish_name` from `cooking_sessions`:

```
.select("recipes(name), dish_name, rating, completed_at")
```

Display logic becomes: `session.recipes?.name ?? session.dish_name ?? "Unknown dish"`

### What Gets Changed

- `cooking_sessions` table: add `dish_name` column (migration)
- New `saved_recipes` table (migration)
- `src/app/dashboard/cook/page.tsx`: store `dish_name` in feedback, support `saved` param to load from DB
- `src/components/cooking/recipe-overview.tsx`: add bookmark/save button
- `src/app/dashboard/page.tsx`: fix "Unknown dish", add "Saved Recipes" section

### Out of Scope

- Search/filter saved recipes
- Edit saved recipes
- Share recipes with other users
- Categories or tags for saved recipes

## Tech Stack

- Next.js 16 / React 19
- Supabase (auth, database, RLS)
- Tailwind CSS 4
