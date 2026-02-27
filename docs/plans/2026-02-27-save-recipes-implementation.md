# Save Recipes & Fix Unknown Dish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users save AI-generated recipes for re-cooking later, and fix "Unknown dish" in recent activity.

**Architecture:** A Supabase migration adds a `saved_recipes` table (stores full recipe JSON) and a `dish_name` column on `cooking_sessions`. The cook page stores dish names on feedback, supports loading saved recipes via a `saved` query param, and the recipe overview gets a bookmark button. The dashboard gets a new "Saved Recipes" section and the recent activity query is fixed.

**Tech Stack:** Next.js 16, React 19, Supabase (migrations, RLS, client queries), Tailwind CSS 4

---

### Task 1: Database Migration

**Files:**
- Applied via Supabase MCP: `saved_recipes` table + `dish_name` column on `cooking_sessions`

**Step 1: Apply migration**

Apply this migration via the Supabase MCP `apply_migration` tool with project ID `kwxnzymkskvzshlzabba` and name `add_saved_recipes_and_dish_name`:

```sql
-- New table: saved recipes (full recipe JSON per user)
create table public.saved_recipes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  dish_name text not null,
  recipe_data jsonb not null,
  saved_at timestamptz default now()
);

-- RLS
alter table public.saved_recipes enable row level security;

create policy "Users can view own saved recipes"
  on public.saved_recipes for select
  using (auth.uid() = user_id);

create policy "Users can save recipes"
  on public.saved_recipes for insert
  with check (auth.uid() = user_id);

create policy "Users can unsave recipes"
  on public.saved_recipes for delete
  using (auth.uid() = user_id);

-- Add dish_name to cooking_sessions for AI-generated recipes
alter table public.cooking_sessions add column dish_name text;
```

**Step 2: Verify migration**

Run via Supabase MCP `execute_sql`:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'saved_recipes' ORDER BY ordinal_position;
```

Expected: id (uuid), user_id (uuid), dish_name (text), recipe_data (jsonb), saved_at (timestamptz).

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'cooking_sessions' AND column_name = 'dish_name';
```

Expected: one row with `dish_name`.

**Step 3: Commit** (no local files changed — migration is remote only)

---

### Task 2: Fix "Unknown Dish" in Recent Activity + Store dish_name on Feedback

**Files:**
- Modify: `src/app/dashboard/page.tsx` (lines 31-36, line 188)
- Modify: `src/app/dashboard/cook/page.tsx` (lines 101-108)

**Step 1: Update dashboard query to include `dish_name`**

In `src/app/dashboard/page.tsx`, change line 33 from:

```typescript
.select("recipes(name), rating, completed_at")
```

to:

```typescript
.select("recipes(name), dish_name, rating, completed_at")
```

**Step 2: Update dashboard display to use `dish_name` fallback**

In `src/app/dashboard/page.tsx`, change line 188 from:

```typescript
{session.recipes?.name ?? "Unknown dish"}
```

to:

```typescript
{session.recipes?.name ?? session.dish_name ?? "Unknown dish"}
```

**Step 3: Store `dish_name` in cook page feedback**

In `src/app/dashboard/cook/page.tsx`, change the `cooking_sessions` insert (lines 101-108) from:

```typescript
const { error: insertError } = await supabase
  .from("cooking_sessions")
  .insert({
    user_id: user.id,
    recipe_id: null, // AI-generated recipes don't have a DB recipe_id
    rating,
    difficulty_feedback: difficulty,
  });
```

to:

```typescript
const { error: insertError } = await supabase
  .from("cooking_sessions")
  .insert({
    user_id: user.id,
    recipe_id: null,
    dish_name: recipe.name,
    rating,
    difficulty_feedback: difficulty,
  });
```

**Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx src/app/dashboard/cook/page.tsx
git commit -m "fix: store dish_name for AI recipes, fix Unknown dish in recent activity"
```

---

### Task 3: Add Bookmark Button to RecipeOverview

**Files:**
- Modify: `src/components/cooking/recipe-overview.tsx`

**Context:** The RecipeOverview component needs a bookmark icon in the header area. It receives the recipe data and needs access to Supabase to save/unsave. We add new props: `isSaved` (boolean) and `onToggleSave` (callback). The parent (cook page) will manage the save state and Supabase calls.

**Step 1: Add `isSaved` and `onToggleSave` props**

In `src/components/cooking/recipe-overview.tsx`, change the component props from:

```typescript
export default function RecipeOverview({
  recipe,
  onStart,
  onBack,
}: {
  recipe: Recipe;
  onStart: () => void;
  onBack: () => void;
}) {
```

to:

```typescript
export default function RecipeOverview({
  recipe,
  onStart,
  onBack,
  isSaved = false,
  onToggleSave,
}: {
  recipe: Recipe;
  onStart: () => void;
  onBack: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
}) {
```

**Step 2: Add bookmark button next to the dish name**

Replace the header `<div>` block (the `{/* Header */}` section, lines 59-63):

```tsx
{/* Header */}
<div className="mb-6">
  <h1 className="text-2xl font-bold text-stone-900">{recipe.name}</h1>
  <p className="text-sm text-stone-500 mt-1">{recipe.description}</p>
</div>
```

with:

```tsx
{/* Header */}
<div className="mb-6">
  <div className="flex items-start justify-between gap-2">
    <h1 className="text-2xl font-bold text-stone-900">{recipe.name}</h1>
    {onToggleSave && (
      <button
        type="button"
        onClick={onToggleSave}
        aria-label={isSaved ? "Remove from saved recipes" : "Save recipe"}
        className="shrink-0 p-2 -mr-2 -mt-1"
      >
        <svg
          className={`w-6 h-6 transition ${
            isSaved
              ? "fill-amber-500 text-amber-500"
              : "fill-none text-stone-400 hover:text-amber-500"
          }`}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
          />
        </svg>
      </button>
    )}
  </div>
  <p className="text-sm text-stone-500 mt-1">{recipe.description}</p>
</div>
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/cooking/recipe-overview.tsx
git commit -m "feat: add bookmark button to RecipeOverview"
```

---

### Task 4: Cook Page — Save/Unsave Logic + Load Saved Recipes

**Files:**
- Modify: `src/app/dashboard/cook/page.tsx`

**Context:** The cook page needs to: (1) read a `saved` query param to load recipes from DB instead of AI, (2) manage save state (check if recipe is saved, toggle save/unsave), and (3) pass `isSaved` and `onToggleSave` to RecipeOverview.

**Step 1: Add `saved` param support and save state**

In `src/app/dashboard/cook/page.tsx`, after line 24 (`const recipeName = searchParams.get("recipe");`), add:

```typescript
const savedId = searchParams.get("saved");
```

Add new state after the existing state declarations (after line 34):

```typescript
const [isSaved, setIsSaved] = useState(false);
const [savedRecipeId, setSavedRecipeId] = useState<string | null>(savedId);
```

**Step 2: Add effect to load saved recipe from DB**

Add a new useEffect after the existing recipe-fetch effect (after line 89). This handles the `saved` param — when present, load recipe from `saved_recipes` instead of calling AI:

```typescript
// Load saved recipe from DB (when navigating from dashboard saved recipes)
useEffect(() => {
  if (!savedId) return;

  let cancelled = false;

  async function loadSaved() {
    setStage("loading");
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("saved_recipes")
        .select("dish_name, recipe_data")
        .eq("id", savedId)
        .single();

      if (fetchError || !data) {
        throw new Error("Could not load saved recipe.");
      }

      if (!cancelled) {
        setRecipe(data.recipe_data as Recipe);
        setIsSaved(true);
        setSavedRecipeId(savedId);
        setStage("overview");
      }
    } catch (err: unknown) {
      if (!cancelled) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again."
        );
      }
    }
  }

  loadSaved();

  return () => {
    cancelled = true;
  };
}, [savedId, supabase]);
```

**Step 3: Modify the existing AI fetch effect to skip when `savedId` is present**

Change the existing useEffect condition (currently line 38: `if (!recipeName) return;`) to:

```typescript
if (!recipeName || savedId) return;
```

This prevents the AI fetch from firing when we're loading a saved recipe.

**Step 4: Add effect to check if current recipe is already saved**

Add another effect that checks save state when recipe is loaded from AI (not from saved):

```typescript
// Check if AI-generated recipe is already saved
useEffect(() => {
  if (!recipe || savedId) return;

  let cancelled = false;

  async function checkSaved() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || cancelled) return;

    const { data } = await supabase
      .from("saved_recipes")
      .select("id")
      .eq("user_id", user.id)
      .eq("dish_name", recipe.name)
      .maybeSingle();

    if (!cancelled) {
      setIsSaved(!!data);
      setSavedRecipeId(data?.id ?? null);
    }
  }

  checkSaved();

  return () => {
    cancelled = true;
  };
}, [recipe, savedId, supabase]);
```

**Step 5: Add toggleSave handler**

Add this function after `handleFeedback` (after line 137):

```typescript
async function handleToggleSave() {
  if (!recipe) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (isSaved && savedRecipeId) {
    // Unsave
    await supabase.from("saved_recipes").delete().eq("id", savedRecipeId);
    setIsSaved(false);
    setSavedRecipeId(null);
  } else {
    // Save
    const { data } = await supabase
      .from("saved_recipes")
      .insert({
        user_id: user.id,
        dish_name: recipe.name,
        recipe_data: recipe,
      })
      .select("id")
      .single();

    if (data) {
      setIsSaved(true);
      setSavedRecipeId(data.id);
    }
  }
}
```

**Step 6: Pass save props to RecipeOverview**

Change the overview stage rendering (currently lines 186-193):

```tsx
if (stage === "overview" && recipe) {
  return (
    <RecipeOverview
      recipe={recipe}
      onStart={() => setStage("cooking")}
      onBack={() => router.back()}
    />
  );
}
```

to:

```tsx
if (stage === "overview" && recipe) {
  return (
    <RecipeOverview
      recipe={recipe}
      onStart={() => setStage("cooking")}
      onBack={() => router.back()}
      isSaved={isSaved}
      onToggleSave={handleToggleSave}
    />
  );
}
```

**Step 7: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 8: Commit**

```bash
git add src/app/dashboard/cook/page.tsx
git commit -m "feat: support saving recipes and loading saved recipes from DB"
```

---

### Task 5: Dashboard — Add "Saved Recipes" Section

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Context:** Add a "Saved Recipes" section below "Recent Activity" on the dashboard. Shows up to 4 saved recipes as compact cards. Tapping a card navigates to the cook page with `?saved=<id>`.

**Step 1: Add saved recipes query to the parallel fetch**

In `src/app/dashboard/page.tsx`, add a fifth query to the `Promise.all` block. Change the destructuring (lines 12-17) from:

```typescript
const [
  { data: profile },
  { count: pantryCount },
  { count: dishCount },
  { data: recentSessions },
] = await Promise.all([
```

to:

```typescript
const [
  { data: profile },
  { count: pantryCount },
  { count: dishCount },
  { data: recentSessions },
  { data: savedRecipes },
] = await Promise.all([
```

And add this query after the `recentSessions` query (after line 36), before the closing `]);`:

```typescript
    supabase
      .from("saved_recipes")
      .select("id, dish_name, recipe_data")
      .eq("user_id", user!.id)
      .order("saved_at", { ascending: false })
      .limit(4),
```

**Step 2: Add "Saved Recipes" section to the JSX**

After the "Recent Activity" section closing `</div>` and its conditional `)}` (after line 203), add:

```tsx
{/* Saved Recipes */}
{savedRecipes && savedRecipes.length > 0 && (
  <div>
    <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">
      Saved Recipes
    </h2>
    <div className="grid grid-cols-2 gap-2">
      {savedRecipes.map((saved: any) => {
        const data = saved.recipe_data as any;
        return (
          <Link
            key={saved.id}
            href={`/dashboard/cook?saved=${saved.id}`}
            className="p-3 bg-white rounded-xl border border-stone-100 shadow-sm hover:border-amber-200 transition"
          >
            <p className="text-sm font-medium text-stone-700 truncate">
              {saved.dish_name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 capitalize">
                {data?.difficulty ?? "—"}
              </span>
              <span className="text-[10px] text-stone-400">
                {data?.total_time_minutes ?? "?"} min
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  </div>
)}
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: add Saved Recipes section to dashboard"
```
