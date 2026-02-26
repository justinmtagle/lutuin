"use client";

const DIETARY_OPTIONS = [
  "No restrictions",
  "No pork",
  "No beef",
  "No seafood",
  "Vegetarian",
  "Vegan",
  "No nuts",
  "No dairy",
  "Halal",
];

export default function DietaryStep({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(option: string) {
    if (option === "No restrictions") {
      onChange(["No restrictions"]);
      return;
    }
    const filtered = value.filter((v) => v !== "No restrictions");
    if (filtered.includes(option)) {
      onChange(filtered.filter((v) => v !== option));
    } else {
      onChange([...filtered, option]);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-stone-800">
        Any dietary restrictions?
      </h2>
      <p className="text-stone-500">Select all that apply. We&apos;ll never suggest dishes that conflict.</p>
      <div className="flex flex-wrap gap-2">
        {DIETARY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`px-4 py-2 rounded-full border transition text-sm ${
              value.includes(option)
                ? "bg-amber-500 text-white border-amber-500"
                : "border-stone-300 text-stone-600 hover:border-stone-400"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
