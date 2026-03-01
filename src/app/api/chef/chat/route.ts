import { createClientFromRequest } from "@/lib/supabase/server";
import { anthropic, CHEF_SYSTEM_PROMPT } from "@/lib/chef-ai";
import { getAchievementContext } from "@/lib/achievement-checker";
import { awardXP } from "@/lib/gamification-actions";
import { getUserTier, getTierLimits } from "@/lib/subscription";

export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Check subscription tier and daily chat limit
  const tier = await getUserTier(supabase, user.id);
  const limits = getTierLimits(tier);
  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("chat_message_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .single();

  if (usage && usage.chat_message_count >= limits.chatMessages) {
    return new Response(
      JSON.stringify({
        error: tier === "free"
          ? "Daily chat limit reached. Upgrade to premium for more conversations with Chef Luto!"
          : "You've reached today's chat limit. It resets at midnight.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  let messages: Array<{ role: string; content: string }>;
  try {
    const body = await request.json();
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages are required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    messages = body.messages;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Fetch user context in parallel (server-side, richer data)
  const [{ data: profile }, { data: pantryData }, { data: recentSessions }, achievementContext] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("skill_level, dietary_restrictions")
        .eq("id", user.id)
        .single(),
      supabase
        .from("user_pantry")
        .select("quantity_level, ingredients(name)")
        .eq("user_id", user.id),
      supabase
        .from("cooking_sessions")
        .select("dish_name, rating, completed_at")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(10),
      getAchievementContext(supabase, user.id),
    ]);

  const skillLevel = profile?.skill_level ?? "beginner";
  const dietaryRestrictions = profile?.dietary_restrictions?.join(", ") || "None";

  const pantryList = pantryData
    ?.map((p: any) => {
      const name = p.ingredients?.name;
      return name ? `${name} (${p.quantity_level})` : null;
    })
    .filter(Boolean) ?? [];

  const recentCooking = recentSessions
    ?.map((s: any) => `${s.dish_name ?? "Unknown"} (rated ${s.rating ?? "?"}/5)`)
    .join(", ") || "None yet";

  const contextMessage = `User context:
- Skill level: ${skillLevel}
- Dietary restrictions: ${dietaryRestrictions}
- Pantry ingredients (with quantity levels): ${pantryList.length ? pantryList.join(", ") : "Empty pantry"}
- Recent dishes cooked: ${recentCooking}
${achievementContext}

Respond as Chef Luto. Be conversational, warm, and helpful. Keep responses concise (2-4 paragraphs max unless outputting a recipe). If the user recently earned an achievement, briefly congratulate them naturally.`;

  let stream;
  try {
    stream = anthropic.messages.stream({
      model: limits.chatModel,
      max_tokens: 2048,
      system: CHEF_SYSTEM_PROMPT + "\n\n" + contextMessage,
      messages: messages.slice(-20).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });
  } catch (error: any) {
    console.error("Chef AI chat error:", error);
    const friendlyMessage = getFriendlyErrorMessage(error?.status);
    return new Response(
      JSON.stringify({ error: friendlyMessage }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // Increment usage
  await supabase.from("daily_usage").upsert(
    {
      user_id: user.id,
      date: today,
      chat_message_count: (usage?.chat_message_count ?? 0) + 1,
    },
    { onConflict: "user_id,date" }
  );

  // Award XP for chatting
  await awardXP(supabase, user.id, "chat_message");

  // Return as SSE stream
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      stream.on("text", (text) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
        );
      });
      stream.on("error", (error: any) => {
        console.error("Chef AI chat stream error:", error);
        const friendlyMessage = getFriendlyErrorMessage(error?.status);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: friendlyMessage })}\n\n`
          )
        );
        controller.close();
      });
      stream.on("end", () => {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      });
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function getFriendlyErrorMessage(statusCode?: number): string {
  switch (statusCode) {
    case 400:
    case 402:
      return "Chef Luto is temporarily unavailable. Our team has been notified — please try again later.";
    case 429:
      return "Chef Luto is a bit overwhelmed right now. Please wait a minute and try again.";
    case 529:
      return "Chef Luto's kitchen is packed! Please try again in a few minutes.";
    default:
      return "Chef Luto is taking a break. Please try again in a moment.";
  }
}
