"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SuggestionCard from "@/components/suggestions/suggestion-card";
import ChatInterface from "@/components/chef/chat-interface";

export default function SuggestPage() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDish, setSelectedDish] = useState<string | null>(null);
  const [pantry, setPantry] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState("beginner");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadContext() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("skill_level")
        .eq("id", user.id)
        .single();

      const { data: pantryData } = await supabase
        .from("user_pantry")
        .select("ingredients(name)")
        .eq("user_id", user.id);

      setSkillLevel(profile?.skill_level ?? "beginner");
      setPantry(pantryData?.map((p: any) => p.ingredients.name) ?? []);
    }
    loadContext();
  }, [supabase]);

  async function getSuggestions() {
    setLoading(true);
    setError("");
    setSelectedDish(null);

    try {
      const res = await fetch("/api/chef/suggest", { method: "POST" });

      if (res.status === 429) {
        setError("You've used all 5 free suggestions today. Upgrade for unlimited!");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch (e) {
      setError("Failed to get suggestions. Please try again.");
    }
    setLoading(false);
  }

  function handleStartCooking() {
    if (selectedDish) {
      router.push(`/dashboard/cook?recipe=${encodeURIComponent(selectedDish)}`);
    }
  }

  // Step 2: Chef Chat with selected dish
  if (selectedDish) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
        {/* Header with dish name and actions */}
        <div className="p-4 border-b border-stone-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setSelectedDish(null)}
                className="text-sm text-stone-400 hover:text-stone-600 mb-1"
              >
                &larr; Back to suggestions
              </button>
              <h1 className="text-xl font-bold text-stone-800">{selectedDish}</h1>
            </div>
            <button
              onClick={handleStartCooking}
              className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold"
            >
              Let&apos;s Cook!
            </button>
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            dish={selectedDish}
            pantry={pantry}
            skillLevel={skillLevel}
          />
        </div>
      </div>
    );
  }

  // Step 1: Get and display suggestions
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">What Should I Cook?</h1>

      {suggestions.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-stone-500 mb-6">
            Let Chef Luto look at your kusina and suggest something delicious.
          </p>
          <button
            onClick={getSuggestions}
            className="px-8 py-4 bg-amber-600 text-white rounded-xl hover:bg-amber-700 text-lg font-semibold"
          >
            Suggest Dishes
          </button>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <p className="text-stone-500 animate-pulse">
            Chef Luto is checking your kusina...
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      <div className="space-y-4">
        {suggestions.map((s, i) => (
          <SuggestionCard
            key={i}
            suggestion={s}
            onSelect={() => setSelectedDish(s.name)}
          />
        ))}
      </div>

      {suggestions.length > 0 && (
        <button
          onClick={getSuggestions}
          disabled={loading}
          className="w-full py-3 border border-stone-300 rounded-lg hover:bg-stone-50"
        >
          Get new suggestions
        </button>
      )}
    </div>
  );
}
