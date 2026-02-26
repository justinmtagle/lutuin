import { createClient } from "@/lib/supabase/server";
import { anthropic, CHEF_SYSTEM_PROMPT } from "@/lib/chef-ai";
import { NextResponse } from "next/server";
import { getAchievementContext } from "@/lib/achievement-checker";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check daily usage limit
  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("suggestion_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .single();

  if (usage && usage.suggestion_count >= 5) {
    return NextResponse.json(
      { error: "Daily suggestion limit reached. Upgrade to premium for unlimited suggestions." },
      { status: 429 }
    );
  }

  // Fetch all context in parallel
  const [
    { data: profile },
    { data: pantry },
    { data: recentSessions },
    { data: recipes },
    achievementContext,
  ] = await Promise.all([
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
      .select("recipes(name), rating, difficulty_feedback")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(10),
    supabase
      .from("recipes")
      .select("name, description, difficulty, cook_time_minutes, recipe_ingredients(ingredients(name), is_optional)")
      .limit(50),
    getAchievementContext(supabase, user.id),
  ]);

  const pantryList = pantry?.map((p: any) => `${p.ingredients.name} (${p.quantity_level})`) ?? [];
  const recentDishes = recentSessions?.map((s: any) => `${s.recipes?.name} (rated ${s.rating}/5, ${s.difficulty_feedback})`).filter(Boolean) ?? [];

  const userMessage = `Here is the user's context:

SKILL LEVEL: ${profile?.skill_level ?? "beginner"}
DIETARY RESTRICTIONS: ${profile?.dietary_restrictions?.length ? profile.dietary_restrictions.join(", ") : "None"}

PANTRY (what they have):
${pantryList.join("\n")}

RECENT DISHES:
${recentDishes.length ? recentDishes.join("\n") : "None yet — this might be their first time!"}

AVAILABLE RECIPES IN OUR DATABASE:
${recipes?.map((r: any) => {
  const ings = r.recipe_ingredients?.map((ri: any) => ri.ingredients.name).join(", ");
  return `- ${r.name} (${r.difficulty}, ${r.cook_time_minutes}min): needs ${ings}`;
}).join("\n")}
${achievementContext}

Based on this, suggest 3-5 dishes they can cook right now. Prioritize recipes from our database but you can also suggest dishes not in our DB if they're a good fit.

Return ONLY valid JSON in this format:
{
  "suggestions": [
    {
      "name": "Dish Name",
      "description": "Brief appealing description",
      "match_percentage": 85,
      "difficulty": "beginner",
      "cook_time_minutes": 45,
      "missing_ingredients": ["ingredient1"],
      "in_database": true,
      "encouragement": "A short encouraging note from Chef Luto"
    }
  ]
}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: CHEF_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Increment usage
    await supabase.from("daily_usage").upsert(
      {
        user_id: user.id,
        date: today,
        suggestion_count: (usage?.suggestion_count ?? 0) + 1,
      },
      { onConflict: "user_id,date" }
    );

    const textContent = message.content.find((c) => c.type === "text");
    try {
      const jsonText = textContent?.text ?? "";
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] ?? jsonText);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ raw: textContent?.text }, { status: 200 });
    }
  } catch (error: any) {
    console.error("Chef AI suggestion error:", error);

    // Map API errors to user-friendly messages
    const statusCode = error?.status ?? 500;
    let userMessage = "Chef Luto is taking a break. Please try again in a moment.";

    if (statusCode === 400 || statusCode === 402) {
      userMessage = "Chef Luto is temporarily unavailable. Our team has been notified — please try again later.";
    } else if (statusCode === 429) {
      userMessage = "Chef Luto is a bit overwhelmed right now. Please wait a minute and try again.";
    } else if (statusCode === 529) {
      userMessage = "Chef Luto's kitchen is packed! Please try again in a few minutes.";
    }

    return NextResponse.json({ error: userMessage }, { status: 503 });
  }
}
