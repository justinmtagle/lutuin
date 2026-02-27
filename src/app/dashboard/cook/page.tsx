"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, Suspense } from "react";
import RecipeOverview from "@/components/cooking/recipe-overview";
import CookMode from "@/components/cooking/cook-mode";
import { showAchievementToasts } from "@/components/ui/achievement-toast-manager";

type Recipe = {
  name: string;
  description: string;
  total_time_minutes: number;
  difficulty: string;
  servings: number;
  ingredients: { name: string; amount: string; note?: string | null }[];
  steps: { number: number; title: string; instruction: string; tip?: string | null }[];
};

type Stage = "loading" | "overview" | "cooking" | "feedback";

function CookContent() {
  const searchParams = useSearchParams();
  const recipeName = searchParams.get("recipe");
  const savedId = searchParams.get("saved");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [stage, setStage] = useState<Stage>("loading");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [rating, setRating] = useState(0);
  const [difficulty, setDifficulty] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(savedId);

  // Fetch AI-generated recipe on mount (and on retry)
  useEffect(() => {
    if (!recipeName || savedId) return;

    let cancelled = false;

    async function fetchRecipe() {
      setStage("loading");
      setError(null);

      try {
        const res = await fetch("/api/chef/recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dish: recipeName }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(
            data?.error ?? "Something went wrong. Please try again."
          );
        }

        const data = await res.json();

        // Validate response has required recipe fields
        if (!data.name || !data.ingredients?.length || !data.steps?.length) {
          throw new Error(
            "Chef Luto couldn't create a proper recipe. Please try again."
          );
        }

        if (!cancelled) {
          setRecipe(data as Recipe);
          setStage("overview");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong. Please try again."
          );
        }
      }
    }

    fetchRecipe();

    return () => {
      cancelled = true;
    };
  }, [recipeName, retryCount]);

  // Load saved recipe from DB
  useEffect(() => {
    if (!savedId) return;

    let cancelled = false;

    async function loadSaved() {
      setStage("loading");
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("saved_recipes")
          .select("dish_name, recipe_data")
          .eq("id", savedId)
          .single();

        if (fetchError || !data) {
          throw new Error("Could not load saved recipe.");
        }

        if (!cancelled) {
          setRecipe(data.recipe_data as Recipe);
          setIsSaved(true);
          setSavedRecipeId(savedId);
          setStage("overview");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong. Please try again."
          );
        }
      }
    }

    loadSaved();

    return () => {
      cancelled = true;
    };
  }, [savedId, supabase]);

  // Check if AI-generated recipe is already saved
  useEffect(() => {
    if (!recipe || savedId) return;

    let cancelled = false;

    async function checkSaved() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data } = await supabase
        .from("saved_recipes")
        .select("id")
        .eq("user_id", user.id)
        .eq("dish_name", recipe!.name)
        .maybeSingle();

      if (!cancelled) {
        setIsSaved(!!data);
        setSavedRecipeId(data?.id ?? null);
      }
    }

    checkSaved();

    return () => {
      cancelled = true;
    };
  }, [recipe, savedId, supabase]);

  async function handleFeedback() {
    if (submitting) return;
    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !recipe) return;

      const { error: insertError } = await supabase
        .from("cooking_sessions")
        .insert({
          user_id: user.id,
          recipe_id: null,
          dish_name: recipe.name,
          rating,
          difficulty_feedback: difficulty,
        });

      if (insertError) {
        console.error("Failed to save cooking session:", insertError);
      }

      // Check for new achievements
      try {
        const res = await fetch("/api/achievements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger: "cooking_session" }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.newAchievements?.length) {
            showAchievementToasts(data.newAchievements);
            // Delay redirect so user sees the toast
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      } catch {
        // Achievement check failure shouldn't block the flow
      }

      router.push("/dashboard");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleSave() {
    if (!recipe) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (isSaved && savedRecipeId) {
      await supabase.from("saved_recipes").delete().eq("id", savedRecipeId);
      setIsSaved(false);
      setSavedRecipeId(null);
    } else {
      const { data } = await supabase
        .from("saved_recipes")
        .insert({
          user_id: user.id,
          dish_name: recipe.name,
          recipe_data: recipe,
        })
        .select("id")
        .single();

      if (data) {
        setIsSaved(true);
        setSavedRecipeId(data.id);
      }
    }
  }

  // No recipe selected
  if (!recipeName && !savedId) {
    return (
      <div className="p-8 text-center text-stone-500">
        No recipe selected. Go to suggestions first.
      </div>
    );
  }

  // Stage: Loading
  if (stage === "loading") {
    if (error) {
      return (
        <div
          role="alert"
          className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-6 text-center"
        >
          <p className="text-red-600 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-medium mb-3"
          >
            Try Again
          </button>
          <a
            href="/dashboard"
            className="text-sm text-stone-500 hover:text-stone-700 underline"
          >
            Go back to suggestions
          </a>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-6">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-stone-700 font-medium">
          Chef Luto is preparing your recipe...
        </p>
        <p className="text-stone-500 text-sm mt-1">{recipeName}</p>
      </div>
    );
  }

  // Stage: Overview
  if (stage === "overview" && recipe) {
    return (
      <RecipeOverview
        recipe={recipe}
        onStart={() => setStage("cooking")}
        onBack={() => router.back()}
        isSaved={isSaved}
        onToggleSave={handleToggleSave}
      />
    );
  }

  // Stage: Cooking
  if (stage === "cooking" && recipe) {
    return (
      <CookMode
        recipeName={recipe.name}
        steps={recipe.steps}
        onComplete={() => setStage("feedback")}
      />
    );
  }

  // Stage: Feedback
  if (stage === "feedback" && recipe) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-6">
        <h2 className="text-2xl font-bold text-stone-800 mb-2">
          Nice work, Chef!
        </h2>
        <p className="text-stone-500 mb-8">How was {recipe.name}?</p>

        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={`w-12 h-12 rounded-full text-lg ${
                n <= rating
                  ? "bg-amber-500 text-white"
                  : "bg-stone-200 text-stone-400"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="flex gap-3 mb-8">
          {[
            { value: "too_easy", label: "Too Easy" },
            { value: "just_right", label: "Just Right" },
            { value: "too_hard", label: "Too Hard" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDifficulty(opt.value)}
              className={`px-4 py-2 rounded-full border text-sm ${
                difficulty === opt.value
                  ? "bg-amber-500 text-white border-amber-500"
                  : "border-stone-300 text-stone-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleFeedback}
          disabled={!rating || !difficulty || submitting}
          className="px-8 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 font-medium"
        >
          {submitting ? "Submitting..." : "Submit & Go Home"}
        </button>
      </div>
    );
  }

  return null;
}

export default function CookPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <CookContent />
    </Suspense>
  );
}
