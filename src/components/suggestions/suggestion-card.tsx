type Suggestion = {
  name: string;
  description: string;
  match_percentage: number;
  difficulty: string;
  cook_time_minutes: number;
  missing_ingredients: string[];
  encouragement: string;
};

export default function SuggestionCard({
  suggestion,
  onSelect,
}: {
  suggestion: Suggestion;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-5 rounded-xl border border-stone-200 hover:border-amber-400 hover:shadow-md transition bg-white"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-bold text-stone-800">{suggestion.name}</h3>
        <span className="text-sm font-semibold text-amber-600">
          {suggestion.match_percentage}% match
        </span>
      </div>
      <p className="text-stone-500 text-sm mb-3">{suggestion.description}</p>
      <div className="flex gap-3 text-xs text-stone-400 mb-3">
        <span className="capitalize">{suggestion.difficulty}</span>
        <span>{suggestion.cook_time_minutes} min</span>
      </div>
      {suggestion.missing_ingredients.length > 0 && (
        <p className="text-xs text-stone-400">
          Missing: {suggestion.missing_ingredients.join(", ")}
        </p>
      )}
      <p className="text-sm text-amber-700 mt-3 italic">
        {suggestion.encouragement}
      </p>
    </button>
  );
}
