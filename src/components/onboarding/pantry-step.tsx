"use client";

const COMMON_PH_STAPLES = [
  "Garlic", "Onion", "Rice", "Soy Sauce", "Vinegar",
  "Fish Sauce (Patis)", "Calamansi", "Salt", "Pepper",
  "Cooking Oil", "Tomato", "Ginger", "Bay Leaves",
  "Coconut Milk", "Brown Sugar", "Oyster Sauce",
];

export default function PantryStep({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(item: string) {
    if (value.includes(item)) {
      onChange(value.filter((v) => v !== item));
    } else {
      onChange([...value, item]);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-stone-800">
        What&apos;s in your kusina?
      </h2>
      <p className="text-stone-500">
        Tap the common staples you usually have. You can add more later.
      </p>
      <div className="flex flex-wrap gap-2">
        {COMMON_PH_STAPLES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => toggle(item)}
            className={`px-4 py-2 rounded-full border transition text-sm ${
              value.includes(item)
                ? "bg-amber-500 text-white border-amber-500"
                : "border-stone-300 text-stone-600 hover:border-stone-400"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <p className="text-xs text-stone-400">
        Selected: {value.length} items
      </p>
    </div>
  );
}
