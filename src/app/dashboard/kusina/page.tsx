"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import IngredientSearch from "@/components/kusina/ingredient-search";
import PantryGrid from "@/components/kusina/pantry-grid";
import { showAchievementToasts } from "@/components/ui/achievement-toast-manager";

export default function KusinaPage() {
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
      <h1 className="text-2xl font-bold text-stone-800">My Kusina</h1>
      <p className="text-stone-500">
        {items.length} ingredients in your kitchen. Tap an item to cycle its quantity.
      </p>
      <IngredientSearch onAdd={handleAdd} />
      <PantryGrid items={items} onUpdate={fetchPantry} />
    </div>
  );
}
