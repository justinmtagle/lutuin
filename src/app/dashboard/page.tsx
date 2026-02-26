import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ACHIEVEMENTS } from "@/lib/achievements";
import AchievementGrid from "@/components/achievements/achievement-grid";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, skill_level")
    .eq("id", user!.id)
    .single();

  const { count: pantryCount } = await supabase
    .from("user_pantry")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id);

  const { data: recentSessions } = await supabase
    .from("cooking_sessions")
    .select("recipes(name), rating, completed_at")
    .eq("user_id", user!.id)
    .order("completed_at", { ascending: false })
    .limit(5);

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
      description:
        a.hidden && !userProgress?.unlocked_at
          ? "Keep cooking to discover this!"
          : a.description,
      hidden: a.hidden,
      target: a.target,
      unlocked: !!userProgress?.unlocked_at,
      unlockedAt: userProgress?.unlocked_at ?? null,
      progress: userProgress?.progress ?? null,
    };
  });

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-8">
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold text-stone-800">
          Kumusta, {profile?.display_name || "Chef"}!
        </h1>
        <p className="text-stone-500 mt-1 capitalize">
          {profile?.skill_level} cook
        </p>
      </div>

      <Link
        href="/dashboard/suggest"
        className="block w-full py-6 bg-amber-600 text-white rounded-2xl text-center hover:bg-amber-700 transition shadow-lg"
      >
        <span className="text-2xl font-bold">What should I cook?</span>
        <br />
        <span className="text-amber-200 text-sm">
          Let Chef Luto check your kusina
        </span>
      </Link>

      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/dashboard/kusina"
          className="p-4 bg-white rounded-xl border border-stone-200 hover:border-amber-300 transition"
        >
          <div className="text-2xl font-bold text-stone-800">
            {pantryCount ?? 0}
          </div>
          <div className="text-sm text-stone-500">ingredients in kusina</div>
        </Link>
        <Link
          href="/dashboard/suggest"
          className="p-4 bg-white rounded-xl border border-stone-200 hover:border-amber-300 transition"
        >
          <div className="text-2xl font-bold text-stone-800">Chef Luto</div>
          <div className="text-sm text-stone-500">Ask me anything</div>
        </Link>
      </div>

      <AchievementGrid achievements={achievements} />

      {recentSessions && recentSessions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-stone-800 mb-3">
            Recent Dishes
          </h2>
          <div className="space-y-2">
            {recentSessions.map((session: any, i: number) => (
              <div
                key={i}
                className="p-3 bg-white rounded-lg border border-stone-200 flex justify-between"
              >
                <span className="text-stone-700">
                  {session.recipes?.name ?? "Unknown dish"}
                </span>
                <span className="text-amber-500">
                  {"*".repeat(session.rating ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
