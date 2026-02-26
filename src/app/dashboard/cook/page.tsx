"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import CookingMode from "@/components/cooking/cooking-mode";
import { showAchievementToasts } from "@/components/ui/achievement-toast-manager";

function CookContent() {
  const searchParams = useSearchParams();
  const recipeName = searchParams.get("recipe");
  const [recipe, setRecipe] = useState<any>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(0);
  const [difficulty, setDifficulty] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadRecipe() {
      if (!recipeName) return;
      const { data } = await supabase
        .from("recipes")
        .select("*")
        .ilike("name", recipeName)
        .single();
      setRecipe(data);
    }
    loadRecipe();
  }, [recipeName, supabase]);

  async function handleFeedback() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !recipe) return;

    await supabase.from("cooking_sessions").insert({
      user_id: user.id,
      recipe_id: recipe.id,
      rating,
      difficulty_feedback: difficulty,
    });

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
  }

  if (!recipeName) {
    return (
      <div className="p-8 text-center text-stone-500">
        No recipe selected. Go to suggestions first.
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="p-8 text-center text-stone-500 animate-pulse">
        Loading recipe...
      </div>
    );
  }

  if (showFeedback) {
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
          onClick={handleFeedback}
          disabled={!rating || !difficulty}
          className="px-8 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 font-medium"
        >
          Submit & Go Home
        </button>
      </div>
    );
  }

  return (
    <CookingMode
      recipeName={recipe.name}
      steps={recipe.steps}
      onComplete={() => setShowFeedback(true)}
    />
  );
}

export default function CookPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <CookContent />
    </Suspense>
  );
}
