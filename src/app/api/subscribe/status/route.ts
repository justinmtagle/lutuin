import { createClientFromRequest } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getUserTier, getTierLimits } from "@/lib/subscription";

export async function GET(request: Request) {
  const supabase = await createClientFromRequest(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tier = await getUserTier(supabase, user.id);
  const limits = getTierLimits(tier);

  let subscription = null;
  if (tier === "premium") {
    const { data } = await supabase
      .from("subscriptions")
      .select("expires_at, payment_method, started_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .single();
    subscription = data;
  }

  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("suggestion_count, chat_message_count, recipe_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  return NextResponse.json({
    tier,
    limits,
    subscription,
    usage: {
      suggestions: usage?.suggestion_count ?? 0,
      chatMessages: usage?.chat_message_count ?? 0,
      recipes: usage?.recipe_count ?? 0,
    },
  });
}
