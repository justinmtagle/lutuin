# Recipe Vault Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Kusina tab with "My Kitchen" — a combined Pantry + Vault view with rich recipe cards and AI context integration.

**Architecture:** Refactor the existing Kusina page into a tabbed "My Kitchen" page with a segmented control. The Vault tab queries `saved_recipes` joined with aggregated `cooking_sessions` data. The Chef chat API gets saved recipes injected into its context so users can reference them conversationally.

**Tech Stack:** Next.js, React Native (Expo), Supabase, Tailwind CSS, NativeWind

---

### Task 1: Create Vault Recipe Card Component (Web)

**Files:**
- Create: `src/components/vault/vault-recipe-card.tsx`

**Step 1: Create the component**

A card showing recipe name, last cooked date, rating, cook count, difficulty, time, and action buttons.

```typescript
"use client";

import { useRouter } from "next/navigation";

export type VaultRecipe = {
  id: string;
  dish_name: string;
  recipe_data: {
    name: string;
    description: string;
    total_time_minutes: number;
    difficulty: string;
    servings: number;
    ingredients: any[];
    steps: any[];
  };
  saved_at: string;
  cook_count: number;
  last_cooked: string | null;
  last_rating: number | null;
};

export default function VaultRecipeCard({
  recipe,
  onDelete,
}: {
  recipe: VaultRecipe;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();

  const stars = recipe.last_rating
    ? Array.from({ length: 5 }, (_, i) => (i < recipe.last_rating! ? "\u2605" : "\u2606")).join("")
    : null;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-stone-800 truncate">{recipe.dish_name}</h3>
            <p className="text-xs text-stone-400 mt-0.5 truncate">
              {recipe.recipe_data.description}
            </p>
          </div>
          {stars && (
            <span className="text-amber-500 text-sm flex-shrink-0">{stars}</span>
          )}
        </div>

        {/* Meta */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
            {recipe.recipe_data.total_time_minutes} min
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 capitalize">
            {recipe.recipe_data.difficulty}
          </span>
          {recipe.cook_count > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
              Cooked {recipe.cook_count}x
            </span>
          )}
        </div>

        {/* Last cooked */}
        {recipe.last_cooked && (
          <p className="text-xs text-stone-400 mt-2">
            Last cooked {new Date(recipe.last_cooked).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-stone-100 px-4 py-2.5 flex gap-2">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/cook?saved=${recipe.id}`)}
          className="flex-1 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition"
        >
          Cook Again
        </button>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem("chef-prefill", `I want to modify my ${recipe.dish_name} recipe`);
            router.push("/dashboard/chef");
          }}
          className="flex-1 py-2 bg-stone-100 text-stone-600 text-sm font-medium rounded-lg hover:bg-stone-200 transition"
        >
          Modify
        </button>
        <button
          type="button"
          onClick={() => onDelete(recipe.id)}
          className="py-2 px-3 text-stone-400 text-sm hover:text-red-500 transition"
          aria-label="Delete recipe"
        >
          {"\u{1F5D1}"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/vault/vault-recipe-card.tsx
git commit -m "feat: add VaultRecipeCard component"
```

---

### Task 2: Create Recipe Vault Component (Web)

**Files:**
- Create: `src/components/vault/recipe-vault.tsx`

**Step 1: Create the vault grid component**

Fetches saved recipes with cooking stats and renders a searchable grid of VaultRecipeCards.

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import VaultRecipeCard, { type VaultRecipe } from "@/components/vault/vault-recipe-card";

export default function RecipeVault() {
  const [recipes, setRecipes] = useState<VaultRecipe[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchRecipes = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch saved recipes
    const { data: saved } = await supabase
      .from("saved_recipes")
      .select("id, dish_name, recipe_data, saved_at")
      .eq("user_id", user.id)
      .order("saved_at", { ascending: false });

    if (!saved) {
      setRecipes([]);
      setLoading(false);
      return;
    }

    // Fetch cooking sessions for stats
    const { data: sessions } = await supabase
      .from("cooking_sessions")
      .select("dish_name, rating, completed_at")
      .eq("user_id", user.id);

    // Aggregate cooking stats per dish
    const statsMap = new Map<string, { count: number; lastCooked: string | null; lastRating: number | null }>();
    for (const s of sessions ?? []) {
      const name = s.dish_name;
      if (!name) continue;
      const existing = statsMap.get(name);
      if (!existing) {
        statsMap.set(name, {
          count: 1,
          lastCooked: s.completed_at,
          lastRating: s.rating,
        });
      } else {
        existing.count++;
        if (s.completed_at && (!existing.lastCooked || s.completed_at > existing.lastCooked)) {
          existing.lastCooked = s.completed_at;
          existing.lastRating = s.rating;
        }
      }
    }

    const enriched: VaultRecipe[] = saved.map((r) => {
      const stats = statsMap.get(r.dish_name);
      return {
        ...r,
        recipe_data: r.recipe_data as VaultRecipe["recipe_data"],
        cook_count: stats?.count ?? 0,
        last_cooked: stats?.lastCooked ?? null,
        last_rating: stats?.lastRating ?? null,
      };
    });

    setRecipes(enriched);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  async function handleDelete(id: string) {
    await supabase.from("saved_recipes").delete().eq("id", id);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }

  const filtered = search
    ? recipes.filter((r) => r.dish_name.toLowerCase().includes(search.toLowerCase()))
    : recipes;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      {recipes.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes..."
          className="w-full px-4 py-2.5 rounded-full bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <p className="text-4xl mb-3">{"\u{1F4D6}"}</p>
          <p className="font-medium">
            {recipes.length === 0
              ? "No saved recipes yet"
              : "No recipes match your search"}
          </p>
          <p className="text-sm mt-1">
            {recipes.length === 0
              ? "Save recipes from the Cook page or ask Chef Luto"
              : "Try a different search term"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((recipe) => (
            <VaultRecipeCard key={recipe.id} recipe={recipe} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/vault/recipe-vault.tsx
git commit -m "feat: add RecipeVault component with search and cooking stats"
```

---

### Task 3: Refactor Kusina Page into "My Kitchen" (Web)

**Files:**
- Modify: `src/app/dashboard/kusina/page.tsx`
- Modify: `src/components/layout/nav-bar.tsx`

**Step 1: Update the kusina page with segmented control**

Replace the current kusina page with a tabbed "My Kitchen" view. The Pantry sub-tab renders the existing pantry UI, the Vault sub-tab renders the RecipeVault component.

```typescript
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import IngredientSearch from "@/components/kusina/ingredient-search";
import PantryGrid from "@/components/kusina/pantry-grid";
import RecipeVault from "@/components/vault/recipe-vault";
import { showAchievementToasts } from "@/components/ui/achievement-toast-manager";

type Tab = "pantry" | "vault";

export default function MyKitchenPage() {
  const [tab, setTab] = useState<Tab>("vault");
  const [items, setItems] = useState<any[]>([]);
  const supabase = createClient();

  const fetchPantry = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("user_pantry")
      .select("id, quantity_level, ingredients(id, name, category)")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false });

    setItems(data ?? []);
  }, [supabase]);

  useEffect(() => {
    fetchPantry();
  }, [fetchPantry]);

  async function handleAdd(ingredient: { id: string; name: string }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("user_pantry").upsert(
      {
        user_id: user.id,
        ingredient_id: ingredient.id,
        quantity_level: "some",
      },
      { onConflict: "user_id,ingredient_id" }
    );
    fetchPantry();

    try {
      const res = await fetch("/api/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "pantry_update" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.newAchievements?.length) {
          showAchievementToasts(data.newAchievements);
        }
      }
    } catch {}
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold text-stone-800">My Kitchen</h1>

      {/* Segmented Control */}
      <div className="flex bg-stone-100 rounded-xl p-1">
        <button
          type="button"
          onClick={() => setTab("vault")}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
            tab === "vault"
              ? "bg-white text-stone-800 shadow-sm"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Recipe Vault
        </button>
        <button
          type="button"
          onClick={() => setTab("pantry")}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
            tab === "pantry"
              ? "bg-white text-stone-800 shadow-sm"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Pantry ({items.length})
        </button>
      </div>

      {/* Tab Content */}
      {tab === "vault" ? (
        <RecipeVault />
      ) : (
        <div className="space-y-6">
          <IngredientSearch onAdd={handleAdd} />
          <PantryGrid items={items} onUpdate={fetchPantry} />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Update nav-bar.tsx — rename "Kusina" to "My Kitchen"**

Change the NAV_ITEMS entry:

```typescript
// Change this line:
{ href: "/dashboard/kusina", label: "Kusina", icon: "\u{1F9C5}" },
// To:
{ href: "/dashboard/kusina", label: "Kitchen", icon: "\u{1F9C5}" },
```

Keep the same href (`/dashboard/kusina`) to avoid routing changes.

**Step 3: Commit**

```bash
git add src/app/dashboard/kusina/page.tsx src/components/layout/nav-bar.tsx
git commit -m "feat: refactor Kusina into My Kitchen with Pantry + Vault tabs"
```

---

### Task 4: Add Saved Recipes to Chef Chat Context

**Files:**
- Modify: `src/app/api/chef/chat/route.ts`

**Step 1: Fetch saved recipes in the Promise.all and add to context**

Add a fifth query to the existing `Promise.all` to fetch saved recipe names and descriptions. Add the results to the context message.

In the `Promise.all` array, add:

```typescript
supabase
  .from("saved_recipes")
  .select("dish_name, recipe_data")
  .eq("user_id", user.id)
  .order("saved_at", { ascending: false })
  .limit(20),
```

Destructure the result as `{ data: savedRecipes }`.

Format the saved recipes for context:

```typescript
const savedRecipesList = savedRecipes
  ?.map((r: any) => {
    const desc = r.recipe_data?.description ?? "";
    return `${r.dish_name}${desc ? ` (${desc})` : ""}`;
  })
  .join(", ") || "None";
```

Add to the contextMessage string:

```
- Saved recipes in vault: ${savedRecipesList}
```

Place this line after the "Recent dishes cooked" line.

**Step 2: Commit**

```bash
git add src/app/api/chef/chat/route.ts
git commit -m "feat: add saved recipes to Chef Luto chat context"
```

---

### Task 5: Support Chef Chat Pre-fill from Vault

**Files:**
- Modify: `src/components/chef/chat-interface.tsx`

**Step 1: Read and clear sessionStorage prefill on mount**

The Vault's "Modify" button stores a prefill message in `sessionStorage("chef-prefill")`. The chat interface should read it on mount and auto-send it.

Add a `useEffect` after the existing state declarations:

```typescript
useEffect(() => {
  const prefill = sessionStorage.getItem("chef-prefill");
  if (prefill) {
    sessionStorage.removeItem("chef-prefill");
    setInput(prefill);
  }
}, []);
```

**Step 2: Commit**

```bash
git add src/components/chef/chat-interface.tsx
git commit -m "feat: support chat pre-fill from vault modify button"
```

---

### Task 6: Refactor Mobile Kusina into "My Kitchen"

**Files:**
- Modify: `lutuin-mobile/app/(tabs)/kusina.tsx`
- Modify: `lutuin-mobile/app/(tabs)/_layout.tsx`
- Create: `lutuin-mobile/components/recipe-vault.tsx`
- Create: `lutuin-mobile/components/vault-recipe-card.tsx`

**Step 1: Create mobile VaultRecipeCard**

A React Native card matching the web version's design with Cook Again, Modify, and Delete actions.

Uses `useRouter` from `expo-router` for navigation:
- Cook Again: `router.push({ pathname: "/cook", params: { saved: recipe.id } })`
- Modify: `router.push({ pathname: "/(tabs)/chef" })` (with global prefill variable)

**Step 2: Create mobile RecipeVault**

A `FlatList`-based vault that fetches saved recipes with cooking stats from Supabase. Includes a search `TextInput` at the top.

**Step 3: Refactor kusina.tsx into My Kitchen**

Add a segmented control (`TouchableOpacity` row) to toggle between Pantry and Vault. Default to Vault tab. Pantry tab renders existing pantry UI.

**Step 4: Update _layout.tsx**

Rename the "Kusina" tab to "Kitchen":

```typescript
<Tabs.Screen
  name="kusina"
  options={{
    title: "Kitchen",
    tabBarIcon: ({ focused }) => (
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{"🥘"}</Text>
    ),
  }}
/>
```

**Step 5: Commit**

```bash
cd ~/lutuin-mobile
git add components/vault-recipe-card.tsx components/recipe-vault.tsx app/\(tabs\)/kusina.tsx app/\(tabs\)/_layout.tsx
git commit -m "feat: refactor mobile Kusina into My Kitchen with Vault"
```

---

### Task 7: Manual Testing & Polish

**Step 1: Test web vault**

1. Navigate to My Kitchen → Vault tab
2. Verify saved recipes show with cooking stats
3. Test search filtering
4. Click "Cook Again" → verify cook page loads
5. Click "Modify" → verify Chef chat opens with prefill
6. Click Delete → verify recipe removed
7. Switch to Pantry tab → verify pantry still works

**Step 2: Test AI context**

1. Go to Chef chat
2. Type "What recipes do I have saved?"
3. Verify Chef Luto references your saved recipes by name

**Step 3: Test mobile**

1. Build and test the mobile app
2. Verify Kitchen tab with Vault/Pantry segmented control
3. Test Cook Again and Modify actions

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during testing"
```
