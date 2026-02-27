import { createClient } from "@/lib/supabase/server";
import { anthropic, CHEF_SYSTEM_PROMPT } from "@/lib/chef-ai";
import { getAchievementContext } from "@/lib/achievement-checker";
import { awardXP } from "@/lib/gamification-actions";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Check daily chat limit
  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("chat_message_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .single();

  if (usage && usage.chat_message_count >= 10) {
    return new Response(
      JSON.stringify({
        error:
          "Daily chat limit reached. Upgrade to premium for unlimited chat.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages, dish, pantry, skillLevel } = await request.json();

  // Fetch profile for dietary restrictions
  const { data: profile } = await supabase
    .from("profiles")
    .select("dietary_restrictions")
    .eq("id", user.id)
    .single();

  const achievementContext = await getAchievementContext(supabase, user.id);

  const contextMessage = `User context:
- Skill level: ${skillLevel ?? "beginner"}
- Dietary restrictions: ${profile?.dietary_restrictions?.join(", ") || "None"}
- Current pantry: ${pantry?.join(", ") || "Not provided"}
${dish ? `- Currently discussing: ${dish}` : "- No specific dish selected yet"}
${achievementContext}

Respond as Chef Luto. Be conversational, warm, and helpful. Keep responses concise (2-4 paragraphs max). If the user recently earned an achievement, briefly congratulate them naturally.`;

  let stream;
  try {
    stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: CHEF_SYSTEM_PROMPT + "\n\n" + contextMessage,
      messages: messages.map((m: { role: string; content: string }) => ({
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
