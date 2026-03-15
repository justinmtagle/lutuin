"use client";

import { useRouter } from "next/navigation";
import type { Recipe } from "@/types/recipe";

export type VaultRecipe = {
  id: string;
  dish_name: string;
  recipe_data: Recipe;
  saved_at: string;
  cook_count: number;
  last_cooked: string | null;
  last_rating: number | null;
};

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) {
    return <span className="text-sm text-stone-400">Not rated</span>;
  }
  return (
    <span className="text-amber-500 text-sm tracking-wide">
      {Array.from({ length: 5 }, (_, i) =>
        i < rating ? "\u2605" : "\u2606"
      ).join("")}
    </span>
  );
}

export default function VaultRecipeCard({
  recipe,
  onDelete,
}: {
  recipe: VaultRecipe;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const { recipe_data } = recipe;

  function handleCookAgain() {
    router.push(`/dashboard/cook?saved=${recipe.id}`);
  }

  function handleModify() {
    sessionStorage.setItem(
      "chef-prefill",
      `I want to modify my ${recipe.dish_name} recipe`
    );
    router.push("/dashboard/chef");
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-stone-800 truncate">
            {recipe.dish_name}
          </h3>
          {recipe_data.description && (
            <p className="text-sm text-stone-500 line-clamp-2 mt-0.5">
              {recipe_data.description}
            </p>
          )}
        </div>
        <StarRating rating={recipe.last_rating} />
      </div>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2 text-xs">
        {recipe_data.difficulty && (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {recipe_data.difficulty}
          </span>
        )}
        {recipe_data.total_time_minutes > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
            {recipe_data.total_time_minutes} min
          </span>
        )}
        {recipe.cook_count > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
            Cooked {recipe.cook_count}x
          </span>
        )}
        {recipe.last_cooked && (
          <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
            Last:{" "}
            {new Date(recipe.last_cooked).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1">
        <button
          type="button"
          onClick={handleCookAgain}
          className="flex-1 px-3 py-2 text-sm font-medium rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition"
        >
          Cook Again
        </button>
        <button
          type="button"
          onClick={handleModify}
          className="px-3 py-2 text-sm font-medium rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition"
        >
          Modify
        </button>
        <button
          type="button"
          onClick={() => onDelete(recipe.id)}
          className="px-3 py-2 text-sm font-medium rounded-xl border border-stone-200 text-red-500 hover:bg-red-50 hover:border-red-200 transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
