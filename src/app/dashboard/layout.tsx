import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/layout/nav-bar";
import AchievementToastManager from "@/components/ui/achievement-toast-manager";
import { ACHIEVEMENTS } from "@/lib/achievements";
import AchievementPanel from "@/components/achievements/achievement-panel";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check onboarding
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, level, streak_count")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) redirect("/onboarding");

  const { data: userAchievements } = await supabase
    .from("user_achievements")
    .select("achievement_slug, unlocked_at, progress")
    .eq("user_id", user.id);

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
    <div className="min-h-screen bg-[var(--background)]">
      <NavBar level={profile?.level ?? 1} streak={profile?.streak_count ?? 0} />
      <AchievementToastManager />
      {children}
      <AchievementPanel achievements={achievements} />
    </div>
  );
}
