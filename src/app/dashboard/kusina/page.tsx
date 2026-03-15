"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import IngredientSearch from "@/components/kusina/ingredient-search";
import PantryGrid from "@/components/kusina/pantry-grid";
import RecipeVault from "@/components/vault/recipe-vault";
import { showAchievementToasts } from "@/components/ui/achievement-toast-manager";

type Tab = "vault" | "pantry";

export default function KusinaPage() {
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

    // Check for pantry achievements
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
    } catch {
      // Achievement check failure shouldn't block the flow
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">My Kitchen</h1>

      {/* Segmented control */}
      <div className="bg-stone-100 rounded-xl p-1 flex">
        <button
          type="button"
          onClick={() => setTab("vault")}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition ${
            tab === "vault"
              ? "bg-white shadow-sm text-stone-800"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Recipe Vault
        </button>
        <button
          type="button"
          onClick={() => setTab("pantry")}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition ${
            tab === "pantry"
              ? "bg-white shadow-sm text-stone-800"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Pantry ({items.length})
        </button>
      </div>

      {/* Tab content */}
      {tab === "vault" ? (
        <RecipeVault />
      ) : (
        <>
          <p className="text-stone-500">
            {items.length} ingredients in your kitchen. Tap an item to cycle its
            quantity.
          </p>
          <IngredientSearch onAdd={handleAdd} />
          <PantryGrid items={items} onUpdate={fetchPantry} />
        </>
      )}
    </div>
  );
}
