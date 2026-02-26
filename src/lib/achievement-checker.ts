import { SupabaseClient } from "@supabase/supabase-js";
import {
  ACHIEVEMENTS,
  type Achievement,
  type TriggerType,
} from "./achievements";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── getUserStats ──────────────────────────────────────────────────────────────

async function getUserStats(
  supabase: SupabaseClient,
  userId: string,
  trigger: TriggerType
): Promise<UserStats> {
  const stats: UserStats = {
    totalSessions: 0,
    uniqueRecipes: 0,
    pantryCount: 0,
    totalChatMessages: 0,
    skillLevel: "",
    currentStreak: 0,
    latestRating: null,
    latestDifficultyFeedback: null,
    latestSessionHour: null,
    maxRecipeCookCount: 0,
  };

  if (trigger === "cooking_session") {
    // Fetch all cooking sessions ordered by completed_at descending
    const { data: sessions } = await supabase
      .from("cooking_sessions")
      .select("recipe_id, rating, difficulty_feedback, completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false });

    if (sessions && sessions.length > 0) {
      stats.totalSessions = sessions.length;

      // Unique recipes
      const uniqueRecipeIds = new Set(
        sessions.map((s) => s.recipe_id).filter(Boolean)
      );
      stats.uniqueRecipes = uniqueRecipeIds.size;

      // Latest session info
      const latest = sessions[0];
      stats.latestRating = latest.rating;
      stats.latestDifficultyFeedback = latest.difficulty_feedback;

      if (latest.completed_at) {
        const completedDate = new Date(latest.completed_at);
        stats.latestSessionHour = completedDate.getHours();
      }

      // Max times a single recipe was cooked
      const recipeCounts = new Map<string, number>();
      for (const s of sessions) {
        if (s.recipe_id) {
          recipeCounts.set(
            s.recipe_id,
            (recipeCounts.get(s.recipe_id) || 0) + 1
          );
        }
      }
      stats.maxRecipeCookCount = Math.max(0, ...Array.from(recipeCounts.values()));

      // Calculate cooking streak (consecutive days from most recent)
      const sessionDates = new Set(
        sessions
          .filter((s) => s.completed_at)
          .map((s) => new Date(s.completed_at).toDateString())
      );
      const uniqueDays = Array.from(sessionDates)
        .map((d) => new Date(d))
        .sort((a, b) => b.getTime() - a.getTime());

      if (uniqueDays.length > 0) {
        let streak = 1;
        for (let i = 1; i < uniqueDays.length; i++) {
          const diffMs = uniqueDays[i - 1].getTime() - uniqueDays[i].getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            streak++;
          } else {
            break;
          }
        }
        stats.currentStreak = streak;
      }
    }
  }

  if (trigger === "pantry_update") {
    const { count } = await supabase
      .from("user_pantry")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    stats.pantryCount = count ?? 0;
  }

  if (trigger === "chat_message") {
    const { data: usage } = await supabase
      .from("daily_usage")
      .select("chat_message_count")
      .eq("user_id", userId);

    if (usage) {
      stats.totalChatMessages = usage.reduce(
        (sum, row) => sum + (row.chat_message_count || 0),
        0
      );
    }
  }

  if (trigger === "profile_update") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("skill_level")
      .eq("id", userId)
      .single();

    if (profile) {
      stats.skillLevel = profile.skill_level ?? "";
    }
  }

  return stats;
}

// ── isAchievementMet ──────────────────────────────────────────────────────────

function isAchievementMet(
  achievement: Achievement,
  stats: UserStats
): { met: boolean; progress?: { count: number; target: number } } {
  switch (achievement.slug) {
    case "first_dish":
      return {
        met: stats.totalSessions >= 1,
        progress: { count: stats.totalSessions, target: 1 },
      };

    case "home_cook":
      return {
        met: stats.totalSessions >= 10,
        progress: { count: stats.totalSessions, target: 10 },
      };

    case "kitchen_master":
      return {
        met: stats.totalSessions >= 50,
        progress: { count: stats.totalSessions, target: 50 },
      };

    case "explorer":
      return {
        met: stats.uniqueRecipes >= 5,
        progress: { count: stats.uniqueRecipes, target: 5 },
      };

    case "adventurer":
      return {
        met: stats.uniqueRecipes >= 15,
        progress: { count: stats.uniqueRecipes, target: 15 },
      };

    case "pantry_pro":
      return {
        met: stats.pantryCount >= 20,
        progress: { count: stats.pantryCount, target: 20 },
      };

    case "streak_3":
      return {
        met: stats.currentStreak >= 3,
        progress: { count: stats.currentStreak, target: 3 },
      };

    case "streak_7":
      return {
        met: stats.currentStreak >= 7,
        progress: { count: stats.currentStreak, target: 7 },
      };

    case "rising_chef":
      return {
        met:
          stats.skillLevel === "intermediate" ||
          stats.skillLevel === "advanced",
      };

    case "master_chef":
      return { met: stats.skillLevel === "advanced" };

    case "perfect_score":
      return { met: stats.latestRating === 5 };

    case "night_owl":
      return {
        met:
          stats.latestSessionHour !== null && stats.latestSessionHour >= 22,
      };

    case "early_bird":
      return {
        met:
          stats.latestSessionHour !== null && stats.latestSessionHour < 7,
      };

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

// ── checkAchievements ─────────────────────────────────────────────────────────

export async function checkAchievements(
  supabase: SupabaseClient,
  userId: string,
  trigger: TriggerType
): Promise<UnlockedAchievement[]> {
  // 1. Filter achievements to only those matching the trigger
  const relevant = ACHIEVEMENTS.filter((a) => a.trigger === trigger);

  if (relevant.length === 0) return [];

  // 2. Fetch already-unlocked achievement slugs for this user
  const { data: existing } = await supabase
    .from("user_achievements")
    .select("achievement_slug")
    .eq("user_id", userId)
    .not("unlocked_at", "is", null);

  const unlockedSlugs = new Set(
    (existing ?? []).map((row) => row.achievement_slug)
  );

  // 3. Get user stats for this trigger type
  const stats = await getUserStats(supabase, userId, trigger);

  // 4. Evaluate each relevant achievement
  const newlyUnlocked: UnlockedAchievement[] = [];

  for (const achievement of relevant) {
    if (unlockedSlugs.has(achievement.slug)) continue;

    const result = isAchievementMet(achievement, stats);

    if (result.met) {
      // Achievement met: upsert with unlocked_at
      await supabase.from("user_achievements").upsert(
        {
          user_id: userId,
          achievement_slug: achievement.slug,
          unlocked_at: new Date().toISOString(),
          progress: result.progress ?? null,
        },
        { onConflict: "user_id,achievement_slug" }
      );

      newlyUnlocked.push({
        slug: achievement.slug,
        name: achievement.name,
        description: achievement.description,
        hidden: achievement.hidden,
      });
    } else if (result.progress) {
      // Not met but has progress: upsert progress only (no unlocked_at)
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

// ── getAchievementContext ──────────────────────────────────────────────────────

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
