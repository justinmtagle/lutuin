import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getLevelForXP, getNextLevel } from "@/lib/gamification";
import { getOrCreateDailyQuest } from "@/lib/gamification-actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profile },
    { count: pantryCount },
    { count: dishCount },
    { data: recentSessions },
    { data: savedRecipes },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, skill_level, xp, level, streak_count, streak_last_date")
      .eq("id", user!.id)
      .single(),
    supabase
      .from("user_pantry")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("cooking_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("cooking_sessions")
      .select("recipes(name), dish_name, rating, completed_at")
      .eq("user_id", user!.id)
      .order("completed_at", { ascending: false })
      .limit(5),
    supabase
      .from("saved_recipes")
      .select("id, dish_name, recipe_data")
      .eq("user_id", user!.id)
      .order("saved_at", { ascending: false })
      .limit(4),
  ]);

  const xp = profile?.xp ?? 0;
  const currentLevel = getLevelForXP(xp);
  const nextLevel = getNextLevel(currentLevel.level);
  const xpProgress = nextLevel
    ? ((xp - currentLevel.xpRequired) / (nextLevel.xpRequired - currentLevel.xpRequired)) * 100
    : 100;

  const streak = profile?.streak_count ?? 0;

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const streakActive =
    profile?.streak_last_date === today ||
    profile?.streak_last_date === yesterdayStr;
  const displayStreak = streakActive ? streak : 0;

  const quest = await getOrCreateDailyQuest(supabase, user!.id);

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 md:pb-4 space-y-5">
      {/* Hero: Greeting + Level + XP */}
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-bold">
              Kumusta, {profile?.display_name || "Chef"}!
            </h1>
            <p className="text-amber-100 text-sm">
              Level {currentLevel.level} &middot; {currentLevel.title}
            </p>
          </div>
          <div className="text-4xl font-bold text-amber-200/60">
            {currentLevel.level}
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-amber-200 mb-1">
            <span>{xp} XP</span>
            <span>{nextLevel ? `${nextLevel.xpRequired} XP` : "MAX"}</span>
          </div>
          <div className="h-3 bg-amber-700/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/90 rounded-full animate-xp-fill"
              style={{ width: `${Math.min(xpProgress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Streak + Daily Quest */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm">
          <div className="text-3xl mb-1">
            {displayStreak > 0 ? "\u{1F525}" : "\u{2744}\u{FE0F}"}
          </div>
          <div className="text-lg font-bold text-stone-800">
            {displayStreak > 0 ? `${displayStreak}-day streak` : "No streak"}
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            {displayStreak > 0
              ? profile?.streak_last_date === today
                ? "You cooked today!"
                : "Cook today to keep it!"
              : "Cook today to start one!"}
          </p>
        </div>

        <div className={`bg-white rounded-2xl border p-4 shadow-sm ${
          quest?.completed ? "border-emerald-200 bg-emerald-50/50" : "border-rose-100"
        }`}>
          <div className="text-3xl mb-1">
            {quest?.completed ? "\u{2705}" : "\u{1F4CB}"}
          </div>
          <div className="text-sm font-bold text-stone-800">
            Daily Quest
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            {quest?.quest_description ?? "Loading..."}
          </p>
          {!quest?.completed && (
            <div className="mt-1.5 text-[10px] font-semibold text-rose-500">
              +{quest?.xp_reward ?? 10} XP
            </div>
          )}
        </div>
      </div>

      {/* Main CTA */}
      <Link
        href="/dashboard/suggest"
        className="block w-full py-5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-2xl text-center hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg hover:shadow-xl animate-pulse-glow"
      >
        <span className="text-xl font-bold">{"\u{1F373}"} What should I cook?</span>
        <br />
        <span className="text-amber-200 text-xs">
          Let Chef Luto check your kusina
        </span>
      </Link>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/dashboard/kusina"
          className="bg-white rounded-2xl border border-stone-100 p-4 text-center shadow-sm hover:border-amber-200 transition"
        >
          <div className="text-2xl font-bold text-amber-600">
            {pantryCount ?? 0}
          </div>
          <div className="text-[11px] text-stone-400 font-medium">
            Ingredients
          </div>
        </Link>
        <div className="bg-white rounded-2xl border border-stone-100 p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-amber-600">
            {dishCount ?? 0}
          </div>
          <div className="text-[11px] text-stone-400 font-medium">
            Dishes Cooked
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-100 p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-amber-600">
            {xp}
          </div>
          <div className="text-[11px] text-stone-400 font-medium">
            Total XP
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {recentSessions && recentSessions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">
            Recent Activity
          </h2>
          <div className="space-y-2">
            {recentSessions.map((session: any, i: number) => (
              <div
                key={i}
                className="p-3 bg-white rounded-xl border border-stone-100 flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{"\u{1F35B}"}</span>
                  <span className="text-sm font-medium text-stone-700">
                    {session.recipes?.name ?? session.dish_name ?? "Unknown dish"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 text-sm">
                    {"\u{2B50}".repeat(session.rating ?? 0)}
                  </span>
                  <span className="text-[10px] text-violet-500 font-semibold">
                    +15 XP
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Recipes */}
      {savedRecipes && savedRecipes.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">
            Saved Recipes
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {savedRecipes.map((saved: any) => {
              const data = saved.recipe_data as any;
              return (
                <Link
                  key={saved.id}
                  href={`/dashboard/cook?saved=${saved.id}`}
                  className="p-3 bg-white rounded-xl border border-stone-100 shadow-sm hover:border-amber-200 transition"
                >
                  <p className="text-sm font-medium text-stone-700 truncate">
                    {saved.dish_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 capitalize">
                      {data?.difficulty ?? "—"}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {data?.total_time_minutes ?? "?"} min
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
