import { createClient } from "@/lib/supabase/server";
import { ACHIEVEMENTS, type TriggerType } from "@/lib/achievements";
import { checkAchievements } from "@/lib/achievement-checker";
import { NextResponse } from "next/server";

const VALID_TRIGGERS: TriggerType[] = [
  "cooking_session",
  "pantry_update",
  "chat_message",
  "profile_update",
];

// ── GET: Return all achievements with user progress ──────────────────────────

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch user's achievement rows
  const { data: userAchievements } = await supabase
    .from("user_achievements")
    .select("achievement_slug, unlocked_at, progress")
    .eq("user_id", user.id);

  // Index user achievements by slug for fast lookup
  const userMap = new Map(
    (userAchievements ?? []).map((ua) => [ua.achievement_slug, ua])
  );

  // Merge definitions with user data
  const achievements = ACHIEVEMENTS.map((def) => {
    const ua = userMap.get(def.slug);
    const unlocked = !!ua?.unlocked_at;

    // Hidden achievements that aren't unlocked yet: mask name & description
    const name = def.hidden && !unlocked ? "???" : def.name;
    const description =
      def.hidden && !unlocked
        ? "Keep cooking to discover this!"
        : def.description;

    return {
      slug: def.slug,
      name,
      description,
      hidden: def.hidden,
      target: def.target,
      unlocked,
      unlockedAt: ua?.unlocked_at ?? null,
      progress: ua?.progress ?? null,
    };
  });

  return NextResponse.json({ achievements });
}

// ── POST: Trigger an achievement check ───────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { trigger?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { trigger } = body;

  if (!trigger || !VALID_TRIGGERS.includes(trigger as TriggerType)) {
    return NextResponse.json(
      {
        error: `Invalid trigger. Must be one of: ${VALID_TRIGGERS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const newAchievements = await checkAchievements(
    supabase,
    user.id,
    trigger as TriggerType
  );

  return NextResponse.json({ newAchievements });
}
