# Achievement System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a gamification system with 17 achievements (10 visible, 7 hidden) that reward cooking frequency and exploration, with toast notifications, dashboard display, and Chef Luto awareness.

**Architecture:** Code-defined achievement definitions in TypeScript, user progress tracked in a `user_achievements` Supabase table. A shared `checkAchievements()` function evaluates achievements after key user actions (cooking, pantry updates, chat). Results are returned to the client which shows toast notifications. The dashboard home page displays an achievements section.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL + RLS), TypeScript, Tailwind CSS

**Important:** This project requires Node 20. Before running any commands, run:
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 20
```

---

### Task 1: Database Migration — user_achievements Table

**Files:**
- Create: `supabase/migrations/002_achievements.sql`

**Context:** The existing schema is in `supabase/migrations/001_initial_schema.sql`. All tables use uuid PKs, `gen_random_uuid()`, RLS with `auth.uid()` checks, and FK references to `public.profiles(id)`.

**Step 1: Write the migration SQL**

Create `supabase/migrations/002_achievements.sql`:

```sql
-- Achievement progress tracking
create table public.user_achievements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  achievement_slug text not null,
  unlocked_at timestamptz,
  progress jsonb default '{}',
  created_at timestamptz default now(),
  unique(user_id, achievement_slug)
);

-- RLS
alter table public.user_achievements enable row level security;

create policy "Users can view own achievements"
  on public.user_achievements for select
  using (auth.uid() = user_id);

create policy "Users can insert own achievements"
  on public.user_achievements for insert
  with check (auth.uid() = user_id);

create policy "Users can update own achievements"
  on public.user_achievements for update
  using (auth.uid() = user_id);
```

**Step 2: Run the migration**

Go to the Supabase SQL Editor at `https://supabase.com/dashboard/project/kwxnzymkskvzshlzabba/sql/new` and paste the SQL above. Run it.

Expected: "Success. No rows returned"

**Step 3: Verify the table exists**

In the SQL Editor, run:
```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_achievements' ORDER BY ordinal_position;
```

Expected: 6 rows (id, user_id, achievement_slug, unlocked_at, progress, created_at)

**Step 4: Commit**

```bash
git add supabase/migrations/002_achievements.sql
git commit -m "feat: add user_achievements table migration"
```

---

### Task 2: Achievement Definitions

**Files:**
- Create: `src/lib/achievements.ts`

**Context:** This file defines all 17 achievements as a typed config. Each achievement has a slug, name, description, whether it's hidden, a target count (for progress tracking), and a trigger type that determines when it gets evaluated.

**Step 1: Create the achievement definitions file**

Create `src/lib/achievements.ts`:

```typescript
export type TriggerType = "cooking_session" | "pantry_update" | "chat_message" | "profile_update";

export type Achievement = {
  slug: string;
  name: string;
  description: string;
  hidden: boolean;
  target: number | null; // null = no progress bar (boolean unlock)
  trigger: TriggerType;
};

export const ACHIEVEMENTS: Achievement[] = [
  // === Visible (progress bars) ===
  {
    slug: "first_dish",
    name: "First Dish",
    description: "Complete your first cooking session",
    hidden: false,
    target: 1,
    trigger: "cooking_session",
  },
  {
    slug: "home_cook",
    name: "Home Cook",
    description: "Complete 10 cooking sessions",
    hidden: false,
    target: 10,
    trigger: "cooking_session",
  },
  {
    slug: "kitchen_master",
    name: "Kitchen Master",
    description: "Complete 50 cooking sessions",
    hidden: false,
    target: 50,
    trigger: "cooking_session",
  },
  {
    slug: "explorer",
    name: "Explorer",
    description: "Cook 5 different recipes",
    hidden: false,
    target: 5,
    trigger: "cooking_session",
  },
  {
    slug: "adventurer",
    name: "Adventurer",
    description: "Cook 15 different recipes",
    hidden: false,
    target: 15,
    trigger: "cooking_session",
  },
  {
    slug: "pantry_pro",
    name: "Pantry Pro",
    description: "Add 20 ingredients to your kusina",
    hidden: false,
    target: 20,
    trigger: "pantry_update",
  },
  {
    slug: "streak_3",
    name: "On a Roll",
    description: "Cook 3 days in a row",
    hidden: false,
    target: 3,
    trigger: "cooking_session",
  },
  {
    slug: "streak_7",
    name: "Week Warrior",
    description: "Cook 7 days in a row",
    hidden: false,
    target: 7,
    trigger: "cooking_session",
  },
  {
    slug: "rising_chef",
    name: "Rising Chef",
    description: "Reach intermediate skill level",
    hidden: false,
    target: null,
    trigger: "profile_update",
  },
  {
    slug: "master_chef",
    name: "Master Chef",
    description: "Reach advanced skill level",
    hidden: false,
    target: null,
    trigger: "profile_update",
  },

  // === Hidden (surprise unlocks) ===
  {
    slug: "perfect_score",
    name: "Perfect Score",
    description: "Rate a dish 5 stars",
    hidden: true,
    target: null,
    trigger: "cooking_session",
  },
  {
    slug: "night_owl",
    name: "Night Owl",
    description: "Complete a cooking session after 10 PM",
    hidden: true,
    target: null,
    trigger: "cooking_session",
  },
  {
    slug: "early_bird",
    name: "Early Bird",
    description: "Complete a cooking session before 7 AM",
    hidden: true,
    target: null,
    trigger: "cooking_session",
  },
  {
    slug: "comfort_food",
    name: "Comfort Food",
    description: "Cook the same recipe 3 times",
    hidden: true,
    target: null,
    trigger: "cooking_session",
  },
  {
    slug: "fearless",
    name: "Fearless",
    description: "Complete a recipe you found too hard",
    hidden: true,
    target: null,
    trigger: "cooking_session",
  },
  {
    slug: "chatty_chef",
    name: "Chatty Chef",
    description: "Send 50+ messages to Chef Luto",
    hidden: true,
    target: null,
    trigger: "chat_message",
  },
  {
    slug: "full_kusina",
    name: "Full Kusina",
    description: "Have 30+ ingredients in your pantry",
    hidden: true,
    target: null,
    trigger: "pantry_update",
  },
];

export function getAchievement(slug: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.slug === slug);
}

export function getAchievementsByTrigger(trigger: TriggerType): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.trigger === trigger);
}
```

**Step 2: Verify it compiles**

Run:
```bash
npx tsc --noEmit src/lib/achievements.ts 2>&1 | head -5
```

Expected: No errors (or the usual Next.js path alias warnings which are fine)

**Step 3: Commit**

```bash
git add src/lib/achievements.ts
git commit -m "feat: add achievement definitions config"
```

---

### Task 3: Achievement Checker Logic

**Files:**
- Create: `src/lib/achievement-checker.ts`

**Context:** This is the core logic that evaluates whether a user has earned new achievements. It takes a Supabase client and user ID, queries relevant stats, and returns newly unlocked achievements. It uses the server-side Supabase client (already authenticated with the user's session via cookies).

The Supabase client type is `SupabaseClient` from `@supabase/supabase-js`. The `createClient()` from `@/lib/supabase/server` returns this type.

**Step 1: Create the achievement checker**

Create `src/lib/achievement-checker.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { ACHIEVEMENTS, type Achievement, type TriggerType } from "./achievements";

export type UnlockedAchievement = {
  slug: string;
  name: string;
  description: string;
  hidden: boolean;
};

type UserStats = {
  totalSessions: number;
  uniqueRecipes: number;
  pantryCount: number;
  totalChatMessages: number;
  skillLevel: string;
  currentStreak: number;
  latestRating: number | null;
  latestDifficultyFeedback: string | null;
  latestSessionHour: number | null;
  maxRecipeCookCount: number;
};

async function getUserStats(
  supabase: SupabaseClient,
  userId: string,
  trigger: TriggerType
): Promise<UserStats> {
  // Always fetch what we need based on trigger type to avoid unnecessary queries
  const stats: UserStats = {
    totalSessions: 0,
    uniqueRecipes: 0,
    pantryCount: 0,
    totalChatMessages: 0,
    skillLevel: "beginner",
    currentStreak: 0,
    latestRating: null,
    latestDifficultyFeedback: null,
    latestSessionHour: null,
    maxRecipeCookCount: 0,
  };

  if (trigger === "cooking_session") {
    // Total sessions
    const { count: sessionCount } = await supabase
      .from("cooking_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    stats.totalSessions = sessionCount ?? 0;

    // Unique recipes
    const { data: sessions } = await supabase
      .from("cooking_sessions")
      .select("recipe_id")
      .eq("user_id", userId);
    const uniqueIds = new Set(sessions?.map((s) => s.recipe_id).filter(Boolean));
    stats.uniqueRecipes = uniqueIds.size;

    // Latest session info
    const { data: latest } = await supabase
      .from("cooking_sessions")
      .select("rating, difficulty_feedback, completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .single();

    if (latest) {
      stats.latestRating = latest.rating;
      stats.latestDifficultyFeedback = latest.difficulty_feedback;
      stats.latestSessionHour = new Date(latest.completed_at).getHours();
    }

    // Max times any single recipe was cooked
    const recipeCounts: Record<string, number> = {};
    sessions?.forEach((s) => {
      if (s.recipe_id) {
        recipeCounts[s.recipe_id] = (recipeCounts[s.recipe_id] || 0) + 1;
      }
    });
    stats.maxRecipeCookCount = Math.max(0, ...Object.values(recipeCounts));

    // Cooking streak (consecutive days)
    const { data: sessionDates } = await supabase
      .from("cooking_sessions")
      .select("completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false });

    if (sessionDates?.length) {
      const uniqueDays = [
        ...new Set(
          sessionDates.map((s) =>
            new Date(s.completed_at).toISOString().split("T")[0]
          )
        ),
      ].sort((a, b) => b.localeCompare(a)); // newest first

      let streak = 1;
      for (let i = 1; i < uniqueDays.length; i++) {
        const prev = new Date(uniqueDays[i - 1]);
        const curr = new Date(uniqueDays[i]);
        const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) {
          streak++;
        } else {
          break;
        }
      }
      stats.currentStreak = streak;
    }
  }

  if (trigger === "pantry_update") {
    const { count: pantryCount } = await supabase
      .from("user_pantry")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    stats.pantryCount = pantryCount ?? 0;
  }

  if (trigger === "chat_message") {
    // Sum all chat_message_count from daily_usage
    const { data: usage } = await supabase
      .from("daily_usage")
      .select("chat_message_count")
      .eq("user_id", userId);
    stats.totalChatMessages =
      usage?.reduce((sum, u) => sum + (u.chat_message_count ?? 0), 0) ?? 0;
  }

  if (trigger === "profile_update") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("skill_level")
      .eq("id", userId)
      .single();
    stats.skillLevel = profile?.skill_level ?? "beginner";
  }

  return stats;
}

function isAchievementMet(achievement: Achievement, stats: UserStats): { met: boolean; progress?: { count: number; target: number } } {
  switch (achievement.slug) {
    // Cooking count achievements
    case "first_dish":
      return { met: stats.totalSessions >= 1, progress: { count: stats.totalSessions, target: 1 } };
    case "home_cook":
      return { met: stats.totalSessions >= 10, progress: { count: stats.totalSessions, target: 10 } };
    case "kitchen_master":
      return { met: stats.totalSessions >= 50, progress: { count: stats.totalSessions, target: 50 } };

    // Unique recipe achievements
    case "explorer":
      return { met: stats.uniqueRecipes >= 5, progress: { count: stats.uniqueRecipes, target: 5 } };
    case "adventurer":
      return { met: stats.uniqueRecipes >= 15, progress: { count: stats.uniqueRecipes, target: 15 } };

    // Pantry achievements
    case "pantry_pro":
      return { met: stats.pantryCount >= 20, progress: { count: stats.pantryCount, target: 20 } };

    // Streak achievements
    case "streak_3":
      return { met: stats.currentStreak >= 3, progress: { count: stats.currentStreak, target: 3 } };
    case "streak_7":
      return { met: stats.currentStreak >= 7, progress: { count: stats.currentStreak, target: 7 } };

    // Skill level achievements
    case "rising_chef":
      return { met: stats.skillLevel === "intermediate" || stats.skillLevel === "advanced" };
    case "master_chef":
      return { met: stats.skillLevel === "advanced" };

    // Hidden achievements
    case "perfect_score":
      return { met: stats.latestRating === 5 };
    case "night_owl":
      return { met: stats.latestSessionHour !== null && stats.latestSessionHour >= 22 };
    case "early_bird":
      return { met: stats.latestSessionHour !== null && stats.latestSessionHour < 7 };
    case "comfort_food":
      return { met: stats.maxRecipeCookCount >= 3 };
    case "fearless":
      return { met: stats.latestDifficultyFeedback === "too_hard" };
    case "chatty_chef":
      return { met: stats.totalChatMessages >= 50 };
    case "full_kusina":
      return { met: stats.pantryCount >= 30 };

    default:
      return { met: false };
  }
}

export async function checkAchievements(
  supabase: SupabaseClient,
  userId: string,
  trigger: TriggerType
): Promise<UnlockedAchievement[]> {
  // Get achievements relevant to this trigger
  const relevantAchievements = ACHIEVEMENTS.filter((a) => a.trigger === trigger);
  if (relevantAchievements.length === 0) return [];

  // Get already-unlocked achievements for this user
  const { data: existing } = await supabase
    .from("user_achievements")
    .select("achievement_slug, unlocked_at")
    .eq("user_id", userId);

  const unlockedSlugs = new Set(
    existing?.filter((e) => e.unlocked_at !== null).map((e) => e.achievement_slug) ?? []
  );

  // Get user stats
  const stats = await getUserStats(supabase, userId, trigger);

  const newlyUnlocked: UnlockedAchievement[] = [];

  for (const achievement of relevantAchievements) {
    // Skip already unlocked
    if (unlockedSlugs.has(achievement.slug)) continue;

    const result = isAchievementMet(achievement, stats);

    if (result.met) {
      // Unlock it
      await supabase.from("user_achievements").upsert(
        {
          user_id: userId,
          achievement_slug: achievement.slug,
          unlocked_at: new Date().toISOString(),
          progress: result.progress ?? {},
        },
        { onConflict: "user_id,achievement_slug" }
      );

      newlyUnlocked.push({
        slug: achievement.slug,
        name: achievement.name,
        description: achievement.description,
        hidden: achievement.hidden,
      });
    } else if (result.progress && achievement.target) {
      // Update progress even if not yet unlocked
      await supabase.from("user_achievements").upsert(
        {
          user_id: userId,
          achievement_slug: achievement.slug,
          progress: result.progress,
        },
        { onConflict: "user_id,achievement_slug" }
      );
    }
  }

  return newlyUnlocked;
}
```

**Step 2: Verify it compiles**

Run:
```bash
npx tsc --noEmit src/lib/achievement-checker.ts 2>&1 | head -10
```

Expected: No errors (path alias warnings are fine since this needs the Next.js build context)

**Step 3: Commit**

```bash
git add src/lib/achievement-checker.ts
git commit -m "feat: add achievement checker logic"
```

---

### Task 4: Achievement Check API Endpoint

**Files:**
- Create: `src/app/api/achievements/route.ts`

**Context:** This endpoint serves two purposes:
1. `GET` — returns all achievement progress for the current user (used by dashboard)
2. `POST` — manually triggers an achievement check for a given trigger type (used by client pages after actions)

The existing API routes use `createClient` from `@/lib/supabase/server` for auth and `NextResponse` for responses. See `src/app/api/chef/suggest/route.ts` for the pattern.

**Step 1: Create the API route**

Create `src/app/api/achievements/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { checkAchievements } from "@/lib/achievement-checker";
import { ACHIEVEMENTS } from "@/lib/achievements";
import type { TriggerType } from "@/lib/achievements";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all user achievement rows
  const { data: userAchievements } = await supabase
    .from("user_achievements")
    .select("achievement_slug, unlocked_at, progress")
    .eq("user_id", user.id);

  // Merge with definitions
  const achievementMap = new Map(
    userAchievements?.map((ua) => [ua.achievement_slug, ua]) ?? []
  );

  const achievements = ACHIEVEMENTS.map((a) => {
    const userProgress = achievementMap.get(a.slug);
    return {
      slug: a.slug,
      name: a.hidden && !userProgress?.unlocked_at ? "???" : a.name,
      description: a.hidden && !userProgress?.unlocked_at ? "Keep cooking to discover this!" : a.description,
      hidden: a.hidden,
      target: a.target,
      unlocked: !!userProgress?.unlocked_at,
      unlockedAt: userProgress?.unlocked_at ?? null,
      progress: userProgress?.progress ?? null,
    };
  });

  return NextResponse.json({ achievements });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { trigger } = await request.json();
  const validTriggers: TriggerType[] = ["cooking_session", "pantry_update", "chat_message", "profile_update"];

  if (!validTriggers.includes(trigger)) {
    return NextResponse.json({ error: "Invalid trigger type" }, { status: 400 });
  }

  const newAchievements = await checkAchievements(supabase, user.id, trigger);

  return NextResponse.json({ newAchievements });
}
```

**Step 2: Verify by running the dev server**

Run:
```bash
curl -s http://localhost:3002/api/achievements 2>&1 | head -5
```

Expected: `{"error":"Unauthorized"}` (since no auth cookie — that's correct)

**Step 3: Commit**

```bash
git add src/app/api/achievements/route.ts
git commit -m "feat: add achievements API endpoint"
```

---

### Task 5: Toast Notification Component

**Files:**
- Create: `src/components/ui/achievement-toast.tsx`

**Context:** This is a client component that shows a celebratory toast when an achievement is unlocked. It receives an achievement object and auto-dismisses after 5 seconds. Uses Tailwind for amber/gold styling. No external toast library needed — we keep it simple.

**Step 1: Create the toast component**

Create `src/components/ui/achievement-toast.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";

type AchievementToastProps = {
  achievement: {
    name: string;
    description: string;
    hidden: boolean;
  };
  onDismiss: () => void;
};

export default function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // Wait for exit animation
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
      }`}
    >
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 min-w-[300px]">
        <span className="text-2xl">&#x1F3C6;</span>
        <div>
          <p className="font-bold text-sm">
            {achievement.hidden ? "Secret Achievement!" : "Achievement Unlocked!"}
          </p>
          <p className="font-semibold">{achievement.name}</p>
          <p className="text-amber-100 text-xs">{achievement.description}</p>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create a toast manager for showing multiple toasts**

Create `src/components/ui/achievement-toast-manager.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
import AchievementToast from "./achievement-toast";

type AchievementNotification = {
  id: string;
  name: string;
  description: string;
  hidden: boolean;
};

let showAchievementFn: ((achievements: AchievementNotification[]) => void) | null = null;

export function showAchievementToasts(achievements: { slug: string; name: string; description: string; hidden: boolean }[]) {
  if (showAchievementFn && achievements.length > 0) {
    showAchievementFn(
      achievements.map((a) => ({ id: a.slug, ...a }))
    );
  }
}

export default function AchievementToastManager() {
  const [toasts, setToasts] = useState<AchievementNotification[]>([]);

  showAchievementFn = useCallback((achievements: AchievementNotification[]) => {
    setToasts((prev) => [...prev, ...achievements]);
  }, []);

  function handleDismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  // Only show the first toast (queue them)
  const current = toasts[0];
  if (!current) return null;

  return (
    <AchievementToast
      key={current.id}
      achievement={current}
      onDismiss={() => handleDismiss(current.id)}
    />
  );
}
```

**Step 3: Add the toast manager to the dashboard layout**

Modify `src/app/dashboard/layout.tsx`. The current dashboard layout wraps all dashboard pages with the NavBar. Add the toast manager there.

First, read `src/app/dashboard/layout.tsx` to see the current content, then add the import and component.

Add to the top of `src/app/dashboard/layout.tsx`:
```typescript
import AchievementToastManager from "@/components/ui/achievement-toast-manager";
```

Add `<AchievementToastManager />` right before `{children}` in the JSX.

**Step 4: Verify the dev server loads without errors**

Check the browser at `http://localhost:3002/dashboard` — page should load with no console errors.

**Step 5: Commit**

```bash
git add src/components/ui/achievement-toast.tsx src/components/ui/achievement-toast-manager.tsx src/app/dashboard/layout.tsx
git commit -m "feat: add achievement toast notification system"
```

---

### Task 6: Hook Achievements into Cook Page

**Files:**
- Modify: `src/app/dashboard/cook/page.tsx` (the `handleFeedback` function around line 23-32)

**Context:** When a user submits cooking feedback (rating + difficulty), we need to call the achievements API with trigger `"cooking_session"`. If new achievements are returned, show toast notifications. The `handleFeedback` function currently inserts into `cooking_sessions` then redirects to dashboard.

**Step 1: Add achievement checking to handleFeedback**

In `src/app/dashboard/cook/page.tsx`, add the import at the top:
```typescript
import { showAchievementToasts } from "@/components/ui/achievement-toast-manager";
```

Then modify the `handleFeedback` function. After the `supabase.from("cooking_sessions").insert(...)` call (line 27-30), add the achievement check before the redirect:

```typescript
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
```

**Step 2: Verify by checking the page loads**

Navigate to `http://localhost:3002/dashboard/cook?recipe=Chicken%20Adobo` — the page should load without errors.

**Step 3: Commit**

```bash
git add src/app/dashboard/cook/page.tsx
git commit -m "feat: check achievements after cooking session feedback"
```

---

### Task 7: Hook Achievements into Kusina Page

**Files:**
- Modify: `src/app/dashboard/kusina/page.tsx` (the `handleAdd` function around line 26-36)

**Context:** When a user adds an ingredient to their pantry, check for pantry-related achievements (pantry_pro, full_kusina).

**Step 1: Add achievement checking to handleAdd**

In `src/app/dashboard/kusina/page.tsx`, add the import at the top:
```typescript
import { showAchievementToasts } from "@/components/ui/achievement-toast-manager";
```

Then modify the `handleAdd` function. After the `fetchPantry()` call, add the achievement check:

```typescript
  async function handleAdd(ingredient: { id: string; name: string }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("user_pantry").upsert(
      {
        user_id: user.id,
        ingredient_id: ingredient.id,
        quantity_level: "some",
      },
      { onConflict: "user_id,ingredient_id" }
    );
    fetchPantry();

    // Check for pantry achievements
    try {
      const res = await fetch("/api/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "pantry_update" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.newAchievements?.length) {
          showAchievementToasts(data.newAchievements);
        }
      }
    } catch {
      // Achievement check failure shouldn't block the flow
    }
  }
```

**Step 2: Verify by checking the page loads**

Navigate to `http://localhost:3002/dashboard/kusina` — the page should load without errors.

**Step 3: Commit**

```bash
git add src/app/dashboard/kusina/page.tsx
git commit -m "feat: check achievements after pantry updates"
```

---

### Task 8: Hook Achievements into Chat

**Files:**
- Modify: `src/components/chef/chat-interface.tsx` (the `sendMessage` function)

**Context:** After sending a chat message, check for chat-related achievements (chatty_chef). We do this client-side after the stream completes. The chat interface is at `src/components/chef/chat-interface.tsx`.

**Step 1: Add achievement checking after stream completes**

In `src/components/chef/chat-interface.tsx`, add the import at the top:
```typescript
import { showAchievementToasts } from "@/components/ui/achievement-toast-manager";
```

After the `while (reader)` loop ends (right before `setStreaming(false)` at the end of `sendMessage`), add:

```typescript
    // Check for chat achievements
    try {
      const achieveRes = await fetch("/api/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "chat_message" }),
      });
      if (achieveRes.ok) {
        const achieveData = await achieveRes.json();
        if (achieveData.newAchievements?.length) {
          showAchievementToasts(achieveData.newAchievements);
        }
      }
    } catch {
      // Achievement check failure shouldn't block the flow
    }

    setStreaming(false);
```

Make sure to remove the existing `setStreaming(false)` that was there before to avoid duplication.

**Step 2: Verify by checking the page loads**

Navigate to `http://localhost:3002/dashboard/suggest` — the page should load without errors.

**Step 3: Commit**

```bash
git add src/components/chef/chat-interface.tsx
git commit -m "feat: check achievements after chat messages"
```

---

### Task 9: Dashboard Achievements Section

**Files:**
- Create: `src/components/achievements/achievement-grid.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Context:** The dashboard at `src/app/dashboard/page.tsx` is a **server component** (no "use client" directive). It fetches data with the server Supabase client. We need to add an achievements section that shows progress bars for visible achievements and "???" for hidden ones.

Since the dashboard is a server component, we'll fetch achievements server-side and pass them to a client component for the interactive grid.

**Step 1: Create the achievement grid component**

Create `src/components/achievements/achievement-grid.tsx`:

```typescript
type AchievementDisplay = {
  slug: string;
  name: string;
  description: string;
  hidden: boolean;
  target: number | null;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: { count: number; target: number } | null;
};

export default function AchievementGrid({
  achievements,
}: {
  achievements: AchievementDisplay[];
}) {
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-stone-800">Achievements</h2>
        <span className="text-sm text-stone-400">
          {unlocked.length}/{achievements.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Show unlocked first, then locked */}
        {[...unlocked, ...locked].map((a) => (
          <div
            key={a.slug}
            className={`p-3 rounded-xl border ${
              a.unlocked
                ? "bg-amber-50 border-amber-200"
                : "bg-stone-50 border-stone-200 opacity-60"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg">
                {a.unlocked ? "\u{1F3C6}" : a.hidden ? "\u{2753}" : "\u{1F512}"}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-semibold truncate ${
                    a.unlocked ? "text-amber-700" : "text-stone-400"
                  }`}
                >
                  {a.name}
                </p>
                <p className="text-xs text-stone-400 truncate">
                  {a.description}
                </p>
                {/* Progress bar for visible, non-unlocked achievements with targets */}
                {!a.unlocked && !a.hidden && a.progress && a.target && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (a.progress.count / a.target) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      {a.progress.count}/{a.target}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Add achievements section to the dashboard**

Modify `src/app/dashboard/page.tsx`. This is a server component so we can fetch achievement data directly.

Add imports at the top:
```typescript
import { ACHIEVEMENTS } from "@/lib/achievements";
import AchievementGrid from "@/components/achievements/achievement-grid";
```

After the `recentSessions` query (around line 22), add:

```typescript
  // Fetch user achievements
  const { data: userAchievements } = await supabase
    .from("user_achievements")
    .select("achievement_slug, unlocked_at, progress")
    .eq("user_id", user!.id);

  const achievementMap = new Map(
    userAchievements?.map((ua: any) => [ua.achievement_slug, ua]) ?? []
  );

  const achievements = ACHIEVEMENTS.map((a) => {
    const userProgress = achievementMap.get(a.slug);
    return {
      slug: a.slug,
      name: a.hidden && !userProgress?.unlocked_at ? "???" : a.name,
      description: a.hidden && !userProgress?.unlocked_at ? "Keep cooking to discover this!" : a.description,
      hidden: a.hidden,
      target: a.target,
      unlocked: !!userProgress?.unlocked_at,
      unlockedAt: userProgress?.unlocked_at ?? null,
      progress: userProgress?.progress ?? null,
    };
  });
```

Then add the `<AchievementGrid achievements={achievements} />` component in the JSX. Place it after the grid of cards (pantry count / Chef Luto) and before the "Recent Dishes" section. It should go around line 57, right before the `{recentSessions && ...}` block:

```tsx
      <AchievementGrid achievements={achievements} />
```

**Step 3: Also update the "Chef Luto" card link**

While we're in this file, the dashboard has a "Chef Luto" card linking to `/dashboard/chef` (line 52-56). Since Chef Chat is now part of the suggest page, update this link to point to `/dashboard/suggest`:

Change:
```tsx
        <Link
          href="/dashboard/chef"
```
To:
```tsx
        <Link
          href="/dashboard/suggest"
```

**Step 4: Verify by checking the dashboard**

Navigate to `http://localhost:3002/dashboard` — should see the achievements grid with all 17 achievements (all locked initially, hidden ones showing "???").

**Step 5: Commit**

```bash
git add src/components/achievements/achievement-grid.tsx src/app/dashboard/page.tsx
git commit -m "feat: add achievements section to dashboard"
```

---

### Task 10: Chef Luto Achievement Awareness

**Files:**
- Modify: `src/app/api/chef/suggest/route.ts` (around line 61-94, the userMessage template)
- Modify: `src/app/api/chef/chat/route.ts` (around line 37-42, the contextMessage)

**Context:** We want Chef Luto to naturally reference achievements in conversation. We'll add recently unlocked achievements and approaching milestones to the context sent to the AI. Both endpoints already have a Supabase client and user ID available.

**Step 1: Create a helper to build achievement context**

Add to `src/lib/achievement-checker.ts` (at the bottom of the file):

```typescript
export async function getAchievementContext(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  // Recently unlocked (last 3 days)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("user_achievements")
    .select("achievement_slug, unlocked_at")
    .eq("user_id", userId)
    .not("unlocked_at", "is", null)
    .gte("unlocked_at", threeDaysAgo);

  // All progress (for approaching milestones)
  const { data: allProgress } = await supabase
    .from("user_achievements")
    .select("achievement_slug, progress")
    .eq("user_id", userId)
    .is("unlocked_at", null);

  const lines: string[] = [];

  if (recent?.length) {
    const names = recent
      .map((r) => ACHIEVEMENTS.find((a) => a.slug === r.achievement_slug)?.name)
      .filter(Boolean);
    lines.push(`RECENTLY EARNED ACHIEVEMENTS: ${names.join(", ")}`);
  }

  // Find achievements close to completion (80%+)
  const approaching = allProgress
    ?.map((p) => {
      const def = ACHIEVEMENTS.find((a) => a.slug === p.achievement_slug);
      if (!def?.target || !p.progress?.count) return null;
      const pct = p.progress.count / def.target;
      if (pct >= 0.8 && pct < 1) {
        return `${def.name} (${p.progress.count}/${def.target})`;
      }
      return null;
    })
    .filter(Boolean);

  if (approaching?.length) {
    lines.push(`CLOSE TO EARNING: ${approaching.join(", ")}`);
  }

  return lines.length
    ? `\nACHIEVEMENTS:\n${lines.join("\n")}`
    : "";
}
```

**Step 2: Add achievement context to the suggest endpoint**

In `src/app/api/chef/suggest/route.ts`, add the import at the top:
```typescript
import { getAchievementContext } from "@/lib/achievement-checker";
```

After the `recentDishes` line (around line 59), add:
```typescript
  const achievementContext = await getAchievementContext(supabase, user.id);
```

Then append it to the `userMessage` template string, right before the "Based on this, suggest 3-5 dishes" line:
```
${achievementContext}
```

**Step 3: Add achievement context to the chat endpoint**

In `src/app/api/chef/chat/route.ts`, add the import at the top:
```typescript
import { getAchievementContext } from "@/lib/achievement-checker";
```

After the profile query (around line 35), add:
```typescript
  const achievementContext = await getAchievementContext(supabase, user.id);
```

Then append it to the `contextMessage` string:
```typescript
  const contextMessage = `User context:
- Skill level: ${skillLevel ?? "beginner"}
- Dietary restrictions: ${profile?.dietary_restrictions?.join(", ") || "None"}
- Current pantry: ${pantry?.join(", ") || "Not provided"}
${dish ? `- Currently discussing: ${dish}` : "- No specific dish selected yet"}
${achievementContext}

Respond as Chef Luto. Be conversational, warm, and helpful. Keep responses concise (2-4 paragraphs max). If the user recently earned an achievement, briefly congratulate them naturally.`;
```

**Step 4: Verify by checking the dev server compiles**

Check the terminal running the dev server — no build errors.

**Step 5: Commit**

```bash
git add src/lib/achievement-checker.ts src/app/api/chef/suggest/route.ts src/app/api/chef/chat/route.ts
git commit -m "feat: add achievement awareness to Chef Luto"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migration | `supabase/migrations/002_achievements.sql` |
| 2 | Achievement definitions | `src/lib/achievements.ts` |
| 3 | Achievement checker logic | `src/lib/achievement-checker.ts` |
| 4 | Achievements API endpoint | `src/app/api/achievements/route.ts` |
| 5 | Toast notification components | `src/components/ui/achievement-toast.tsx`, `achievement-toast-manager.tsx`, dashboard layout |
| 6 | Hook into cook page | `src/app/dashboard/cook/page.tsx` |
| 7 | Hook into kusina page | `src/app/dashboard/kusina/page.tsx` |
| 8 | Hook into chat | `src/components/chef/chat-interface.tsx` |
| 9 | Dashboard achievements section | `src/components/achievements/achievement-grid.tsx`, `src/app/dashboard/page.tsx` |
| 10 | Chef Luto awareness | `src/lib/achievement-checker.ts`, suggest route, chat route |
