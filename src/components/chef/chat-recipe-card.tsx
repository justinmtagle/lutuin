"use client";

import { useRouter } from "next/navigation";

export type ChatRecipe = {
  name: string;
  description: string;
  total_time_minutes: number;
  difficulty: string;
  servings: number;
  ingredients: {
    name: string;
    amount: string;
    note?: string | null;
    in_pantry?: boolean;
  }[];
  steps: {
    number: number;
    title: string;
    instruction: string;
    tip?: string | null;
  }[];
};

export default function ChatRecipeCard({ recipe }: { recipe: ChatRecipe }) {
  const router = useRouter();

  function handleStartCooking() {
    sessionStorage.setItem("chat-recipe", JSON.stringify(recipe));
    router.push("/dashboard/cook?from=chat");
  }

  const haveCount = recipe.ingredients.filter((i) => i.in_pantry).length;
  const needCount = recipe.ingredients.filter((i) => !i.in_pantry).length;

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-md overflow-hidden my-2">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-100 px-4 py-3 border-b border-amber-200">
        <h3 className="font-bold text-stone-800 text-lg">{recipe.name}</h3>
        <p className="text-sm text-stone-500 mt-0.5">{recipe.description}</p>
      </div>

      {/* Meta badges */}
      <div className="flex gap-2 px-4 pt-3 flex-wrap">
        <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
          {recipe.total_time_minutes} min
        </span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 capitalize">
          {recipe.difficulty}
        </span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
          {recipe.servings} servings
        </span>
      </div>

      {/* Ingredients */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
            Ingredients
          </p>
          <p className="text-xs text-stone-400">
            <span className="text-emerald-600 font-medium">{haveCount} have</span>
            {needCount > 0 && (
              <span className="text-rose-500 font-medium"> · {needCount} need</span>
            )}
          </p>
        </div>
        <div className="space-y-1.5">
          {recipe.ingredients.map((ing, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className={`mt-0.5 ${ing.in_pantry ? "text-emerald-500" : "text-stone-300"}`}>
                {ing.in_pantry ? "\u2713" : "\u25CB"}
              </span>
              <div>
                <span className="text-stone-700">
                  {ing.amount} {ing.name}
                </span>
                {ing.note && (
                  <span className="text-stone-400 text-xs ml-1">({ing.note})</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Steps preview */}
      <div className="px-4 pb-3">
        <p className="text-xs text-stone-400">
          {recipe.steps.length} steps
        </p>
      </div>

      {/* Start Cooking button */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={handleStartCooking}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 transition-all shadow-sm"
        >
          Start Cooking
        </button>
      </div>
    </div>
  );
}
