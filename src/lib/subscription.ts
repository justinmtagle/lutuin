import { SupabaseClient } from "@supabase/supabase-js";

export type Tier = "free" | "premium";

export interface TierLimits {
  suggestions: number;
  chatMessages: number;
  recipes: number;
  chatModel: string;
}

const TIER_CONFIG: Record<Tier, TierLimits> = {
  free: {
    suggestions: 5,
    chatMessages: 10,
    recipes: 3,
    chatModel: "claude-haiku-4-5-20251001",
  },
  premium: {
    suggestions: 50,
    chatMessages: 50,
    recipes: 20,
    chatModel: "claude-sonnet-4-6",
  },
};

export async function getUserTier(
  supabase: SupabaseClient,
  userId: string
): Promise<Tier> {
  const { data } = await supabase
    .from("subscriptions")
    .select("status, expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return data ? "premium" : "free";
}

export function getTierLimits(tier: Tier): TierLimits {
  return TIER_CONFIG[tier];
}
