"use client";

const SKILL_LEVELS = [
  {
    value: "beginner",
    label: "Beginner",
    description: "I can follow basic recipes and know kitchen basics",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    description: "I cook regularly and can handle most recipes",
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "I'm comfortable with complex techniques and improvising",
  },
] as const;

export default function SkillStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-stone-800">
        What&apos;s your cooking level?
      </h2>
      <p className="text-stone-500">This helps us suggest the right recipes for you.</p>
      <div className="space-y-3">
        {SKILL_LEVELS.map((level) => (
          <button
            key={level.value}
            type="button"
            onClick={() => onChange(level.value)}
            className={`w-full p-4 rounded-xl border-2 text-left transition ${
              value === level.value
                ? "border-amber-500 bg-amber-50"
                : "border-stone-200 hover:border-stone-300"
            }`}
          >
            <div className="font-semibold text-stone-800">{level.label}</div>
            <div className="text-sm text-stone-500">{level.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
