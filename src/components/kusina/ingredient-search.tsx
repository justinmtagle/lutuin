"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

type Ingredient = { id: string; name: string; category: string };

export default function IngredientSearch({
  onAdd,
}: {
  onAdd: (ingredient: Ingredient) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Ingredient[]>([]);
  const supabase = createClient();

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const { data } = await supabase
      .from("ingredients")
      .select("id, name, category")
      .ilike("name", `%${q}%`)
      .limit(10);
    setResults(data ?? []);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search ingredients to add..."
        className="w-full px-4 py-3 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      {results.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((ing) => (
            <li key={ing.id}>
              <button
                type="button"
                onClick={() => {
                  onAdd(ing);
                  setQuery("");
                  setResults([]);
                }}
                className="w-full px-4 py-3 text-left hover:bg-amber-50 flex justify-between"
              >
                <span>{ing.name}</span>
                <span className="text-xs text-stone-400">{ing.category}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
