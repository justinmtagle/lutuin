"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SuggestionCard from "@/components/suggestions/suggestion-card";

export default function SuggestPage() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function getSuggestions() {
    setLoading(true);
    setError("");

    const res = await fetch("/api/chef/suggest", { method: "POST" });

    if (res.status === 429) {
      setError("You've used all 5 free suggestions today. Upgrade for unlimited!");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setSuggestions(data.suggestions ?? []);
    setLoading(false);
  }

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
            onSelect={() =>
              router.push(`/dashboard/chef?dish=${encodeURIComponent(s.name)}`)
            }
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
