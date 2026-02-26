"use client";

import { createClient } from "@/lib/supabase/client";

type PantryItem = {
  id: string;
  quantity_level: string;
  ingredients: { id: string; name: string; category: string };
};

const QUANTITY_COLORS = {
  plenty: "bg-green-100 text-green-700 border-green-300",
  some: "bg-amber-100 text-amber-700 border-amber-300",
  running_low: "bg-red-100 text-red-700 border-red-300",
};

const QUANTITY_CYCLE = ["plenty", "some", "running_low"] as const;

export default function PantryGrid({
  items,
  onUpdate,
}: {
  items: PantryItem[];
  onUpdate: () => void;
}) {
  const supabase = createClient();

  async function cycleQuantity(item: PantryItem) {
    const currentIndex = QUANTITY_CYCLE.indexOf(
      item.quantity_level as (typeof QUANTITY_CYCLE)[number]
    );
    const next = QUANTITY_CYCLE[(currentIndex + 1) % QUANTITY_CYCLE.length];
    await supabase
      .from("user_pantry")
      .update({ quantity_level: next })
      .eq("id", item.id);
    onUpdate();
  }

  async function removeItem(id: string) {
    await supabase.from("user_pantry").delete().eq("id", id);
    onUpdate();
  }

  const grouped = items.reduce(
    (acc, item) => {
      const cat = item.ingredients.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {} as Record<string, PantryItem[]>
  );

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">
            {category.replace("_", " ")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {catItems.map((item) => (
              <div
                key={item.id}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm cursor-pointer ${
                  QUANTITY_COLORS[item.quantity_level as keyof typeof QUANTITY_COLORS]
                }`}
              >
                <span onClick={() => cycleQuantity(item)}>
                  {item.ingredients.name}
                </span>
                <button
                  onClick={() => removeItem(item.id)}
                  className="ml-1 opacity-50 hover:opacity-100"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
