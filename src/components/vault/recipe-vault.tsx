"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback, useMemo } from "react";
import VaultRecipeCard from "@/components/vault/vault-recipe-card";
import type { VaultRecipe } from "@/components/vault/vault-recipe-card";

export default function RecipeVault() {
  const supabase = useMemo(() => createClient(), []);
  const [recipes, setRecipes] = useState<VaultRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchRecipes = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Fetch saved recipes and cooking sessions in parallel
    const [savedRes, sessionsRes] = await Promise.all([
      supabase
        .from("saved_recipes")
        .select("id, dish_name, recipe_data, saved_at")
        .eq("user_id", user.id)
        .order("saved_at", { ascending: false }),
      supabase
        .from("cooking_sessions")
        .select("dish_name, rating, completed_at")
        .eq("user_id", user.id),
    ]);

    const saved = savedRes.data ?? [];
    const sessions = sessionsRes.data ?? [];

    // Aggregate cooking stats per dish_name
    const statsMap = new Map<
      string,
      { count: number; lastCooked: string | null; lastRating: number | null }
    >();

    for (const session of sessions) {
      const existing = statsMap.get(session.dish_name);
      if (!existing) {
        statsMap.set(session.dish_name, {
          count: 1,
          lastCooked: session.completed_at,
          lastRating: session.rating,
        });
      } else {
        existing.count += 1;
        if (
          session.completed_at &&
          (!existing.lastCooked || session.completed_at > existing.lastCooked)
        ) {
          existing.lastCooked = session.completed_at;
          existing.lastRating = session.rating;
        }
      }
    }

    // Enrich saved recipes with stats
    const enriched: VaultRecipe[] = saved.map((r) => {
      const stats = statsMap.get(r.dish_name);
      return {
        id: r.id,
        dish_name: r.dish_name,
        recipe_data: r.recipe_data,
        saved_at: r.saved_at,
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
    ? recipes.filter((r) =>
        r.dish_name.toLowerCase().includes(search.toLowerCase())
      )
    : recipes;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-stone-500">Loading your recipes...</p>
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-4xl mb-3">{"\uD83D\uDCD6"}</span>
        <p className="text-stone-600 font-medium">Your vault is empty</p>
        <p className="text-sm text-stone-400 mt-1">
          Save recipes while cooking to build your collection!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search recipes..."
        className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
      />

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-stone-400 py-8">
          No recipes match &ldquo;{search}&rdquo;
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((recipe) => (
            <VaultRecipeCard
              key={recipe.id}
              recipe={recipe}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
