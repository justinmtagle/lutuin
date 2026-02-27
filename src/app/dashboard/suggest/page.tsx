"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import SuggestionCard from "@/components/suggestions/suggestion-card";
import ChatInterface from "@/components/chef/chat-interface";
import IngredientPicker from "@/components/suggestions/ingredient-picker";

type PantryItem = {
  name: string;
  category: string;
};

export default function SuggestPage() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDish, setSelectedDish] = useState<string | null>(null);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState("beginner");
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let ignore = false;
    async function loadContext() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || ignore) return;

      const [{ data: profile }, { data: pantryData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("skill_level")
          .eq("id", user.id)
          .single(),
        supabase
          .from("user_pantry")
          .select("ingredients(name, category)")
          .eq("user_id", user.id),
      ]);

      if (!ignore) {
        setUserId(user.id);
        setSkillLevel(profile?.skill_level ?? "beginner");
        setPantryItems(
          pantryData?.map((p: any) => ({
            name: p.ingredients.name,
            category: p.ingredients.category ?? "Other",
          })) ?? []
        );
      }
    }
    loadContext();
    return () => { ignore = true; };
  }, [supabase]);

  async function persistCustomIngredients(ingredients: string[]) {
    if (!userId) return;
    const customNames = ingredients.filter(
      (ing) => !pantryItems.some((p) => p.name.toLowerCase() === ing.toLowerCase())
    );
    if (customNames.length === 0) return;

    for (const name of customNames) {
      // Find or create the ingredient
      let { data: existing } = await supabase
        .from("ingredients")
        .select("id")
        .ilike("name", name)
        .maybeSingle();

      if (!existing) {
        const { data: created } = await supabase
          .from("ingredients")
          .insert({ name, category: "other" })
          .select("id")
          .single();
        existing = created;
      }

      if (existing) {
        await supabase.from("user_pantry").upsert(
          {
            user_id: userId,
            ingredient_id: existing.id,
            quantity_level: "some",
          },
          { onConflict: "user_id,ingredient_id" }
        );
      }
    }

    // Refresh pantry items so new ones appear as chips
    const { data: pantryData } = await supabase
      .from("user_pantry")
      .select("ingredients(name, category)")
      .eq("user_id", userId);

    setPantryItems(
      pantryData?.map((p: any) => ({
        name: p.ingredients.name,
        category: p.ingredients.category ?? "Other",
      })) ?? []
    );
  }

  async function getSuggestions(ingredients: string[]) {
    setLoading(true);
    setError("");
    setSelectedDish(null);
    setSelectedIngredients(ingredients);

    try {
      // Auto-create custom ingredients and add to pantry
      await persistCustomIngredients(ingredients);

      const res = await fetch("/api/chef/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedIngredients: ingredients }),
      });

      if (res.status === 429) {
        setError(
          "You've used all 5 free suggestions today. Upgrade for unlimited!"
        );
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch {
      setError("Failed to get suggestions. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleStartCooking() {
    if (selectedDish) {
      router.push(
        `/dashboard/cook?recipe=${encodeURIComponent(selectedDish)}`
      );
    }
  }

  function handleBack() {
    setSuggestions([]);
    setSelectedDish(null);
    setError("");
  }

  // Step 3: Chef Chat with selected dish
  if (selectedDish) {
    return (
      <div
        className="max-w-2xl mx-auto flex flex-col"
        style={{ height: "calc(100vh - 64px)" }}
      >
        <div className="p-4 border-b border-stone-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setSelectedDish(null)}
                className="text-sm text-stone-400 hover:text-stone-600 mb-1"
              >
                &larr; Back to suggestions
              </button>
              <h1 className="text-xl font-bold text-stone-800">
                {selectedDish}
              </h1>
            </div>
            <button
              onClick={handleStartCooking}
              className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold"
            >
              Let&apos;s Cook!
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            dish={selectedDish}
            pantry={pantryItems.map((p) => p.name)}
            skillLevel={skillLevel}
          />
        </div>
      </div>
    );
  }

  // Step 2: Show suggestions
  if (suggestions.length > 0) {
    return (
      <div className="max-w-2xl mx-auto p-4 pb-24 md:pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-stone-800">
            Chef Luto suggests...
          </h1>
          <button
            onClick={handleBack}
            className="text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            Pick new ingredients
          </button>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
        )}

        <div className="space-y-4">
          {suggestions.map((s, i) => (
            <SuggestionCard
              key={i}
              suggestion={s}
              onSelect={() => setSelectedDish(s.name)}
            />
          ))}
        </div>

        <button
          onClick={() => getSuggestions(selectedIngredients)}
          disabled={loading}
          className="w-full py-3 border border-stone-300 rounded-xl hover:bg-stone-50 text-sm font-medium text-stone-600"
        >
          {loading ? "Thinking..." : "Get new suggestions"}
        </button>
      </div>
    );
  }

  // Step 1: Ingredient picker
  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 md:pb-4 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">
          What Should I Cook?
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          Pick ingredients you want to use, and Chef Luto will suggest dishes.
        </p>
      </div>

      <IngredientPicker
        pantryItems={pantryItems}
        onSubmit={getSuggestions}
        loading={loading}
      />

      {error && (
        <div role="alert" className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}
    </div>
  );
}
