"use client";

import { useState } from "react";

type Ingredient = {
  name: string;
  amount: string;
  note?: string | null;
};

type Step = {
  number: number;
  title: string;
  instruction: string;
  tip?: string | null;
};

type Recipe = {
  name: string;
  description: string;
  total_time_minutes: number;
  difficulty: string;
  servings: number;
  ingredients: Ingredient[];
  steps: Step[];
};

export default function RecipeOverview({
  recipe,
  onStart,
  onBack,
  isSaved = false,
  onToggleSave,
}: {
  recipe: Recipe;
  onStart: () => void;
  onBack: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggleIngredient(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-32 md:pb-4">
      {/* Back link */}
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-stone-500 hover:text-stone-700 mb-4 flex items-center gap-1"
      >
        <span aria-hidden="true">&larr;</span> Back to suggestions
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold text-stone-900">{recipe.name}</h1>
          {onToggleSave && (
            <button
              type="button"
              onClick={onToggleSave}
              aria-label={isSaved ? "Remove from saved recipes" : "Save recipe"}
              className="shrink-0 p-2 -mr-2 -mt-1"
            >
              <svg
                className={`w-6 h-6 transition ${
                  isSaved
                    ? "fill-amber-500 text-amber-500"
                    : "fill-none text-stone-400 hover:text-amber-500"
                }`}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                />
              </svg>
            </button>
          )}
        </div>
        <p className="text-sm text-stone-500 mt-1">{recipe.description}</p>
      </div>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2 mb-8">
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          {recipe.difficulty}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
          {recipe.total_time_minutes} min
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
          {recipe.servings} {recipe.servings === 1 ? "serving" : "servings"}
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
          {recipe.steps.length} {recipe.steps.length === 1 ? "step" : "steps"}
        </span>
      </div>

      {/* Ingredient checklist */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-stone-600 mb-3">
          Ingredients
        </h2>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {recipe.ingredients.map((ingredient, index) => {
            const isChecked = checked.has(index);
            return (
              <button
                key={index}
                type="button"
                onClick={() => toggleIngredient(index)}
                aria-pressed={isChecked}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                  isChecked
                    ? "bg-stone-50 text-stone-400"
                    : "bg-white hover:bg-stone-50 text-stone-700"
                }`}
              >
                {/* Checkbox indicator */}
                <span
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                    isChecked
                      ? "bg-amber-500 border-amber-500 text-white"
                      : "border-stone-300"
                  }`}
                >
                  {isChecked && (
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </span>

                {/* Ingredient text */}
                <span
                  className={`text-sm ${isChecked ? "line-through" : ""}`}
                >
                  <span className="font-medium">{ingredient.amount}</span>{" "}
                  {ingredient.name}
                  {ingredient.note && (
                    <span className="text-stone-400 ml-1">
                      ({ingredient.note})
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Start Cooking button — fixed on mobile, static on desktop */}
      <div className="fixed bottom-20 left-0 right-0 px-4 md:static md:px-0">
        <div className="max-w-2xl mx-auto md:max-w-none">
          <button
            type="button"
            onClick={onStart}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl text-lg font-bold hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg"
          >
            Start Cooking
          </button>
        </div>
      </div>
    </div>
  );
}
