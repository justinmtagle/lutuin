# Cook Screen Revamp Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the slideshow/chat cook screen with a unified AI-powered cook mode that uses a scrollable step list with focus highlighting.

**Architecture:** When user taps "Let's Cook!", a new `/api/chef/recipe` endpoint generates a structured JSON recipe via Claude Haiku, personalized to the user's skill level and pantry. The cook page displays a 4-stage flow: loading → recipe overview → cook mode → feedback. Cook mode uses a scrollable step list where the active step is highlighted, completed steps are dimmed with checkmarks, and large bottom nav buttons enable one-handed use.

**Tech Stack:** Next.js 16, React 19, Supabase, Anthropic Claude Haiku, Web Wake Lock API, Tailwind CSS 4

---

### Task 1: Create `/api/chef/recipe` API Route

**Files:**
- Create: `src/app/api/chef/recipe/route.ts`

**Context:** This new endpoint generates a full structured recipe as JSON. It follows the same patterns as `src/app/api/chef/suggest/route.ts` (auth check, daily usage, Supabase context fetching, Claude Haiku call). The existing `suggest` route and `chat` route are left untouched.

**Step 1: Create the API route**

```typescript
// src/app/api/chef/recipe/route.ts
import { createClient } from "@/lib/supabase/server";
import { anthropic, CHEF_SYSTEM_PROMPT } from "@/lib/chef-ai";
import { NextResponse } from "next/server";
import { awardXP } from "@/lib/gamification-actions";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let dish: string;
  try {
    const body = await request.json();
    dish = typeof body.dish === "string" ? body.dish.slice(0, 200).trim() : "";
    if (!dish) {
      return NextResponse.json({ error: "Missing dish name" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Fetch user context in parallel
  const [{ data: profile }, { data: pantry }] = await Promise.all([
    supabase
      .from("profiles")
      .select("skill_level, dietary_restrictions")
      .eq("id", user.id)
      .single(),
    supabase
      .from("user_pantry")
      .select("quantity_level, ingredients(name)")
      .eq("user_id", user.id),
  ]);

  const pantryList =
    pantry?.map((p: any) => p.ingredients.name).join(", ") ?? "Not provided";

  const userMessage = `Generate a complete recipe for: ${dish}

USER CONTEXT:
- Skill level: ${profile?.skill_level ?? "beginner"}
- Dietary restrictions: ${profile?.dietary_restrictions?.length ? profile.dietary_restrictions.join(", ") : "None"}
- Available ingredients: ${pantryList}

INSTRUCTIONS:
- Tailor the complexity of steps to the user's skill level
- If possible, use ingredients from their pantry; suggest substitutions if needed
- Each step should have a short title (2-4 words) and a clear instruction
- Include a helpful tip for steps where it adds value (null otherwise)
- Be specific with amounts, temperatures, and times

Return ONLY valid JSON in this exact format:
{
  "name": "Dish Name",
  "description": "Brief appealing 1-sentence description",
  "total_time_minutes": 45,
  "difficulty": "beginner",
  "servings": 4,
  "ingredients": [
    { "name": "Chicken thighs", "amount": "1 lb", "note": "bone-in for best flavor" }
  ],
  "steps": [
    { "number": 1, "title": "Prep ingredients", "instruction": "Detailed instruction here.", "tip": "Optional helpful tip or null" }
  ]
}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: CHEF_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Award XP
    await awardXP(supabase, user.id, "get_suggestion");

    const textContent = message.content.find((c) => c.type === "text");
    const jsonText = textContent?.text ?? "";
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? jsonText);
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Chef AI recipe generation error:", error);

    const statusCode = error?.status ?? 500;
    let friendlyMessage =
      "Chef Luto is taking a break. Please try again in a moment.";

    if (statusCode === 400 || statusCode === 402) {
      friendlyMessage =
        "Chef Luto is temporarily unavailable. Our team has been notified — please try again later.";
    } else if (statusCode === 429) {
      friendlyMessage =
        "Chef Luto is a bit overwhelmed right now. Please wait a minute and try again.";
    } else if (statusCode === 529) {
      friendlyMessage =
        "Chef Luto's kitchen is packed! Please try again in a few minutes.";
    }

    return NextResponse.json({ error: friendlyMessage }, { status: 503 });
  }
}
```

**Step 2: Verify it compiles**

Run: `cd /home/grphx/lutuin && npx next lint --file src/app/api/chef/recipe/route.ts`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/api/chef/recipe/route.ts
git commit -m "feat: add /api/chef/recipe endpoint for structured recipe generation"
```

---

### Task 2: Create `RecipeOverview` Component

**Files:**
- Create: `src/components/cooking/recipe-overview.tsx`

**Context:** This component shows the recipe summary (name, difficulty, time, servings) and a scrollable ingredient checklist. The user reviews ingredients, then taps "Start Cooking" to enter cook mode.

**Step 1: Create the component**

```tsx
// src/components/cooking/recipe-overview.tsx
"use client";

import { useState } from "react";

type Ingredient = {
  name: string;
  amount: string;
  note?: string | null;
};

type Recipe = {
  name: string;
  description: string;
  total_time_minutes: number;
  difficulty: string;
  servings: number;
  ingredients: Ingredient[];
  steps: { number: number; title: string; instruction: string; tip?: string | null }[];
};

export default function RecipeOverview({
  recipe,
  onStart,
  onBack,
}: {
  recipe: Recipe;
  onStart: () => void;
  onBack: () => void;
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggleIngredient(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-32 md:pb-4">
      {/* Back link */}
      <button
        onClick={onBack}
        className="text-sm text-stone-400 hover:text-stone-600 mb-4"
        type="button"
      >
        &larr; Back to suggestions
      </button>

      {/* Header */}
      <h1 className="text-2xl font-bold text-stone-800 mb-1">{recipe.name}</h1>
      <p className="text-stone-500 text-sm mb-4">{recipe.description}</p>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full capitalize">
          {recipe.difficulty}
        </span>
        <span className="px-3 py-1 bg-stone-100 text-stone-600 text-xs font-medium rounded-full">
          {recipe.total_time_minutes} min
        </span>
        <span className="px-3 py-1 bg-stone-100 text-stone-600 text-xs font-medium rounded-full">
          {recipe.servings} servings
        </span>
        <span className="px-3 py-1 bg-stone-100 text-stone-600 text-xs font-medium rounded-full">
          {recipe.steps.length} steps
        </span>
      </div>

      {/* Ingredients */}
      <h2 className="text-lg font-semibold text-stone-800 mb-3">Ingredients</h2>
      <ul className="space-y-2 mb-8">
        {recipe.ingredients.map((ing, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => toggleIngredient(i)}
              className="w-full flex items-start gap-3 text-left p-2 rounded-lg hover:bg-stone-50 transition"
            >
              <span
                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                  checked.has(i)
                    ? "bg-green-500 border-green-500 text-white"
                    : "border-stone-300"
                }`}
              >
                {checked.has(i) && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className={checked.has(i) ? "text-stone-400 line-through" : "text-stone-700"}>
                <span className="font-medium">{ing.amount}</span> {ing.name}
                {ing.note && (
                  <span className="text-stone-400 text-sm"> — {ing.note}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Start button */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-stone-200 md:static md:border-0 md:p-0 md:bg-transparent">
        <button
          onClick={onStart}
          className="w-full py-4 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-semibold text-lg"
          type="button"
        >
          Start Cooking
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `cd /home/grphx/lutuin && npx next lint --file src/components/cooking/recipe-overview.tsx`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/cooking/recipe-overview.tsx
git commit -m "feat: add RecipeOverview component with ingredient checklist"
```

---

### Task 3: Create `CookMode` Component

**Files:**
- Create: `src/components/cooking/cook-mode.tsx`
- Delete: `src/components/cooking/cooking-mode.tsx` (old slideshow)
- Delete: `src/components/cooking/step-timer.tsx` (dead code)

**Context:** This is the main cook mode UI. Shows a scrollable step list with focus highlighting, sticky header with progress, and large bottom nav buttons. Uses the Web Wake Lock API to keep the screen on.

**Step 1: Create the component**

```tsx
// src/components/cooking/cook-mode.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Step = {
  number: number;
  title: string;
  instruction: string;
  tip?: string | null;
};

export default function CookMode({
  recipeName,
  steps,
  onComplete,
}: {
  recipeName: string;
  steps: Step[];
  onComplete: () => void;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Screen wake lock
  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Wake lock not supported or denied — not critical
      }
    }
    requestWakeLock();

    return () => {
      wakeLockRef.current?.release();
    };
  }, []);

  // Auto-scroll to active step
  useEffect(() => {
    stepRefs.current[activeStep]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeStep]);

  const goToStep = useCallback(
    (index: number) => {
      // Mark current step as completed when advancing forward
      if (index > activeStep) {
        setCompletedSteps((prev) => {
          const next = new Set(prev);
          next.add(activeStep);
          return next;
        });
      }
      setActiveStep(index);
    },
    [activeStep]
  );

  function handlePrevious() {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  }

  function handleNext() {
    if (activeStep < steps.length - 1) {
      goToStep(activeStep + 1);
    }
  }

  const isLast = activeStep === steps.length - 1;
  const progress = ((activeStep + 1) / steps.length) * 100;

  return (
    <div className="flex flex-col bg-white" style={{ height: "calc(100vh - 64px)" }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-4 pt-3 pb-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-sm font-medium text-stone-800 truncate mr-4">
              {recipeName}
            </h1>
            <span className="text-xs text-stone-400 whitespace-nowrap">
              Step {activeStep + 1} of {steps.length}
            </span>
          </div>
          <div className="w-full bg-stone-200 rounded-full h-1.5 mb-3">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Scrollable step list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {steps.map((step, index) => {
            const isActive = index === activeStep;
            const isCompleted = completedSteps.has(index);

            return (
              <div
                key={step.number}
                ref={(el) => { stepRefs.current[index] = el; }}
                onClick={() => setActiveStep(index)}
                className={`rounded-xl p-4 transition-all cursor-pointer ${
                  isActive
                    ? "border-2 border-amber-400 bg-amber-50 shadow-sm"
                    : isCompleted
                    ? "border border-stone-200 bg-stone-50 opacity-60"
                    : "border border-stone-200 bg-white opacity-50"
                }`}
              >
                {/* Step header */}
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : isActive
                        ? "bg-amber-500 text-white"
                        : "bg-stone-200 text-stone-500"
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </span>
                  <span
                    className={`font-semibold text-sm ${
                      isActive ? "text-stone-800" : "text-stone-500"
                    }`}
                  >
                    {step.title}
                  </span>
                </div>

                {/* Instruction (always visible but dimmed for non-active) */}
                <p
                  className={`ml-10 ${
                    isActive
                      ? "text-stone-700 text-base leading-relaxed"
                      : "text-stone-400 text-sm"
                  }`}
                >
                  {step.instruction}
                </p>

                {/* Chef tip (only on active step) */}
                {isActive && step.tip && (
                  <div className="ml-10 mt-3 bg-amber-100 border border-amber-200 rounded-lg px-4 py-3">
                    <p className="text-amber-800 text-sm">
                      <span className="font-medium">Chef Luto&apos;s tip:</span>{" "}
                      {step.tip}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="sticky bottom-0 bg-white border-t border-stone-200 px-4 py-3 pb-safe">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={activeStep === 0}
            className="flex-1 py-4 border border-stone-300 rounded-xl text-stone-600 font-medium disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={() => {
                setCompletedSteps((prev) => new Set([...prev, activeStep]));
                onComplete();
              }}
              className="flex-1 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700"
            >
              Done Cooking!
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 py-4 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700"
            >
              Next Step
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Delete old components**

```bash
rm src/components/cooking/cooking-mode.tsx
rm src/components/cooking/step-timer.tsx
```

**Step 3: Verify it compiles**

Run: `cd /home/grphx/lutuin && npx next lint --file src/components/cooking/cook-mode.tsx`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/cooking/cook-mode.tsx
git add -u src/components/cooking/cooking-mode.tsx src/components/cooking/step-timer.tsx
git commit -m "feat: add CookMode component, remove old slideshow and dead timer"
```

---

### Task 4: Rewrite Cook Page

**Files:**
- Modify: `src/app/dashboard/cook/page.tsx`

**Context:** Rewrite the cook page with the 4-stage flow: loading → overview → cook mode → feedback. This replaces both the old slideshow path (for DB recipes) and the chat path (for AI-suggested dishes). The feedback form is preserved as-is.

**Step 1: Rewrite the page**

```tsx
// src/app/dashboard/cook/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense, useMemo, useCallback } from "react";
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
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [stage, setStage] = useState<Stage>("loading");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(0);
  const [difficulty, setDifficulty] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Generate recipe on mount
  const generateRecipe = useCallback(async () => {
    if (!recipeName) return;
    setStage("loading");
    setError("");

    try {
      const res = await fetch("/api/chef/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish: recipeName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to generate recipe. Please try again.");
        return;
      }

      const data = await res.json();

      // Validate response has required fields
      if (!data.name || !data.ingredients?.length || !data.steps?.length) {
        setError("Chef Luto couldn't create a proper recipe. Please try again.");
        return;
      }

      setRecipe(data);
      setStage("overview");
    } catch {
      setError("Failed to connect. Please check your internet and try again.");
    }
  }, [recipeName]);

  // Trigger generation on first render
  useState(() => {
    generateRecipe();
  });

  async function handleFeedback() {
    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !recipe) return;

    await supabase.from("cooking_sessions").insert({
      user_id: user.id,
      recipe_id: null,
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
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    } catch {
      // Achievement check failure shouldn't block the flow
    }

    router.push("/dashboard");
  }

  // No recipe param
  if (!recipeName) {
    return (
      <div className="p-8 text-center text-stone-500">
        No recipe selected. Go to suggestions first.
      </div>
    );
  }

  // Loading stage
  if (stage === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        {error ? (
          <div className="text-center space-y-4">
            <p role="alert" className="text-red-600">{error}</p>
            <button
              onClick={generateRecipe}
              className="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-medium"
              type="button"
            >
              Try Again
            </button>
            <button
              onClick={() => router.back()}
              className="block mx-auto text-sm text-stone-400 hover:text-stone-600 mt-2"
              type="button"
            >
              Go back to suggestions
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-stone-600 font-medium">Chef Luto is preparing your recipe...</p>
            <p className="text-stone-400 text-sm">{recipeName}</p>
          </div>
        )}
      </div>
    );
  }

  // Overview stage
  if (stage === "overview" && recipe) {
    return (
      <RecipeOverview
        recipe={recipe}
        onStart={() => setStage("cooking")}
        onBack={() => router.back()}
      />
    );
  }

  // Cook mode stage
  if (stage === "cooking" && recipe) {
    return (
      <CookMode
        recipeName={recipe.name}
        steps={recipe.steps}
        onComplete={() => setStage("feedback")}
      />
    );
  }

  // Feedback stage
  if (stage === "feedback") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-6">
        <h2 className="text-2xl font-bold text-stone-800 mb-2">
          Nice work, Chef!
        </h2>
        <p className="text-stone-500 mb-8">
          How was {recipe?.name ?? recipeName}?
        </p>

        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              type="button"
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
              type="button"
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
          disabled={!rating || !difficulty || submitting}
          type="button"
          className="px-8 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 font-medium"
        >
          {submitting ? "Saving..." : "Submit & Go Home"}
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
```

**Step 2: Verify it compiles**

Run: `cd /home/grphx/lutuin && npx next lint --file src/app/dashboard/cook/page.tsx`
Expected: No errors.

**Step 3: Manual test**

1. Go to suggest page, pick ingredients, get suggestions
2. Select a dish, tap "Let's Cook!"
3. Verify: loading spinner appears with "Chef Luto is preparing your recipe..."
4. Verify: recipe overview appears with ingredients and "Start Cooking" button
5. Verify: cook mode shows scrollable step list with active step highlighted
6. Verify: prev/next buttons work, completed steps show checkmarks
7. Verify: "Done Cooking!" shows feedback form
8. Verify: feedback submission works and redirects to dashboard

**Step 4: Commit**

```bash
git add src/app/dashboard/cook/page.tsx
git commit -m "feat: rewrite cook page with unified AI recipe generation and scrollable cook mode"
```

---

### Task 5: Update Suggest Page Navigation

**Files:**
- Modify: `src/app/dashboard/suggest/page.tsx`

**Context:** The suggest page currently has a "Let's Cook!" button in the chef chat view (step 3). Since we're removing the chat pre-cooking step and going straight to the cook page, simplify the suggest flow: pick ingredients → see suggestions → tap a suggestion card → go directly to cook page. Remove the intermediate chef chat step.

**Step 1: Simplify navigation**

In `src/app/dashboard/suggest/page.tsx`, change the `onSelect` handler on suggestion cards to navigate directly to the cook page instead of entering the chef chat:

Replace the `selectedDish` chat view (the `if (selectedDish)` block, approximately lines 165-201) and the `handleStartCooking` function (lines 150-156) with a direct navigation:

```tsx
// Remove: selectedDish state, setSelectedDish, handleStartCooking
// Remove: the entire `if (selectedDish)` block (chat view)

// In the suggestions view, change onSelect to navigate directly:
<SuggestionCard
  key={i}
  suggestion={s}
  onSelect={() => router.push(`/dashboard/cook?recipe=${encodeURIComponent(s.name)}`)}
/>
```

Also remove the unused `ChatInterface` import and `selectedDish` state.

**Step 2: Verify it compiles**

Run: `cd /home/grphx/lutuin && npx next lint --file src/app/dashboard/suggest/page.tsx`
Expected: No errors.

**Step 3: Manual test**

1. Go to suggest page, pick ingredients, get suggestions
2. Tap a suggestion card
3. Verify: navigates directly to cook page (no chat step)

**Step 4: Commit**

```bash
git add src/app/dashboard/suggest/page.tsx
git commit -m "feat: simplify suggest flow — tap suggestion goes directly to cook page"
```
