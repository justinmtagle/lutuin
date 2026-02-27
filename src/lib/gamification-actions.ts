import { SupabaseClient } from "@supabase/supabase-js";
import { XP_VALUES, getLevelForXP, QUEST_POOL } from "./gamification";

type XPAction = keyof typeof XP_VALUES;

export async function awardXP(
  supabase: SupabaseClient,
  userId: string,
  action: XPAction
) {
  const xpGain = XP_VALUES[action];

  const { data: profile } = await supabase
    .from("profiles")
    .select("xp, level")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  const newXP = profile.xp + xpGain;
  const newLevel = getLevelForXP(newXP).level;

  await supabase
    .from("profiles")
    .update({ xp: newXP, level: newLevel })
    .eq("id", userId);

  return { xpGain, newXP, newLevel, leveledUp: newLevel > profile.level };
}

export async function updateStreak(
  supabase: SupabaseClient,
  userId: string
) {
  const today = new Date().toISOString().split("T")[0];

  const { data: profile } = await supabase
    .from("profiles")
    .select("streak_count, streak_last_date")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  if (profile.streak_last_date === today) {
    return { streak: profile.streak_count, isNew: false };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const newStreak =
    profile.streak_last_date === yesterdayStr
      ? profile.streak_count + 1
      : 1;

  await supabase
    .from("profiles")
    .update({ streak_count: newStreak, streak_last_date: today })
    .eq("id", userId);

  return { streak: newStreak, isNew: true };
}

export async function getOrCreateDailyQuest(
  supabase: SupabaseClient,
  userId: string
) {
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("daily_quests")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .single();

  if (existing) return existing;

  const quest = QUEST_POOL[Math.floor(Math.random() * QUEST_POOL.length)];

  const { data: created } = await supabase
    .from("daily_quests")
    .insert({
      user_id: userId,
      date: today,
      quest_type: quest.type,
      quest_description: quest.description,
      xp_reward: 10,
    })
    .select()
    .single();

  return created;
}
