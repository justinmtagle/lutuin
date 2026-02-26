"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import CookingMode from "@/components/cooking/cooking-mode";
import ChatInterface from "@/components/chef/chat-interface";
import { showAchievementToasts } from "@/components/ui/achievement-toast-manager";

function CookContent() {
  const searchParams = useSearchParams();
  const recipeName = searchParams.get("recipe");
  const [recipe, setRecipe] = useState<any>(null);
  const [notInDb, setNotInDb] = useState(false);
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
      if (data) {
        setRecipe(data);
      } else {
        // AI-suggested dish not in our database — still allow cooking
        setRecipe({ name: recipeName, steps: [] });
        setNotInDb(true);
      }
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
      recipe_id: notInDb ? null : recipe.id,
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
        <p className="text-stone-500 mb-8">How was {recipe.name ?? recipeName}?</p>

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

  // Recipe not in DB — Chef Luto guides the cooking via chat
  if (notInDb || !recipe.steps?.length) {
    return (
      <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
        <div className="p-4 border-b border-stone-200 bg-white">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div>
              <p className="text-xs text-amber-600 font-medium">Chef Luto's Recipe</p>
              <h1 className="text-xl font-bold text-stone-800">{recipe.name}</h1>
            </div>
            <button
              onClick={() => setShowFeedback(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold"
            >
              Done Cooking!
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden max-w-2xl mx-auto w-full">
          <ChatInterface
            dish={recipe.name}
            skillLevel="beginner"
          />
        </div>
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
