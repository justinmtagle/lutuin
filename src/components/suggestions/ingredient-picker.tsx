"use client";

import { useState } from "react";

type PantryItem = {
  name: string;
  category: string;
};

export default function IngredientPicker({
  pantryItems,
  onSubmit,
  loading,
}: {
  pantryItems: PantryItem[];
  onSubmit: (ingredients: string[]) => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customIngredients, setCustomIngredients] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");

  const allSelected =
    pantryItems.length > 0 && pantryItems.every((p) => selected.has(p.name));

  function toggleItem(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pantryItems.map((p) => p.name)));
    }
  }

  function addCustom(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (
      !customIngredients.includes(trimmed) &&
      !pantryItems.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setCustomIngredients((prev) => [...prev, trimmed]);
      setSelected((prev) => new Set(prev).add(trimmed));
    }
    setInputValue("");
  }

  function removeCustom(name: string) {
    setCustomIngredients((prev) => prev.filter((c) => c !== name));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCustom(inputValue);
    }
  }

  function handleSubmit() {
    onSubmit(Array.from(selected));
  }

  // Group pantry items by category
  const grouped = pantryItems.reduce(
    (acc, item) => {
      const cat = item.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {} as Record<string, PantryItem[]>
  );

  const totalSelected = selected.size;

  return (
    <div className="space-y-4">
      {/* Free text input */}
      <div>
        <label className="text-sm font-medium text-stone-600 block mb-1.5">
          Add ingredients
        </label>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type an ingredient and press Enter..."
          className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 bg-white"
        />
      </div>

      {/* Custom ingredient chips */}
      {customIngredients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customIngredients.map((name) => (
            <button
              key={name}
              onClick={() => removeCustom(name)}
              className="px-3 py-1.5 rounded-full text-sm font-medium border-2 border-dashed border-amber-400 bg-amber-50 text-amber-700 flex items-center gap-1"
            >
              {name} <span className="text-amber-400">&times;</span>
            </button>
          ))}
        </div>
      )}

      {/* Pantry section */}
      {pantryItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-stone-600">
              From your kusina
            </span>
            <button
              onClick={toggleAll}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="space-y-3">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="text-xs text-stone-400 font-medium uppercase tracking-wide mb-1.5">
                  {category}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => toggleItem(item.name)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                        selected.has(item.name)
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white text-stone-500 border-stone-200 hover:border-amber-300"
                      }`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={totalSelected === 0 || loading}
        className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl text-lg font-bold hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? "Chef Luto is thinking..."
          : totalSelected === 0
            ? "Select ingredients to start"
            : `What can I cook with ${totalSelected === 1 ? "this" : "these"}?`}
      </button>
    </div>
  );
}
