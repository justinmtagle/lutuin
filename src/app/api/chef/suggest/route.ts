import { createClientFromRequest } from "@/lib/supabase/server";
import { anthropic, CHEF_SYSTEM_PROMPT } from "@/lib/chef-ai";
import { NextResponse } from "next/server";
import { getAchievementContext } from "@/lib/achievement-checker";
import { awardXP } from "@/lib/gamification-actions";
import { getUserTier, getTierLimits } from "@/lib/subscription";

export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check subscription tier and daily usage limit
  const tier = await getUserTier(supabase, user.id);
  const limits = getTierLimits(tier);
  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("suggestion_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .single();

  if (usage && usage.suggestion_count >= limits.suggestions) {
    return NextResponse.json(
      {
        error: tier === "free"
          ? "Daily suggestion limit reached. Upgrade to premium for more suggestions!"
          : "You've reached today's suggestion limit. It resets at midnight.",
      },
      { status: 429 }
    );
  }

  // Parse optional selected ingredients from request body
  let selectedIngredients: string[] | null = null;
  try {
    const body = await request.json();
    if (Array.isArray(body.selectedIngredients)) {
      const sanitized = body.selectedIngredients
        .filter((item: unknown): item is string => typeof item === "string")
        .slice(0, 50)
        .map((s: string) => s.slice(0, 100).trim())
        .filter(Boolean);
      if (sanitized.length > 0) selectedIngredients = sanitized;
    }
  } catch {
    // No body or invalid JSON — use full pantry (backwards compatible)
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

${selectedIngredients
  ? `SELECTED INGREDIENTS (user specifically wants to cook with these):
${selectedIngredients.join("\n")}

FULL PANTRY (other things they also have):
${pantryList.join("\n")}`
  : `PANTRY (what they have):
${pantryList.join("\n")}`}

RECENT DISHES:
${recentDishes.length ? recentDishes.join("\n") : "None yet — this might be their first time!"}

AVAILABLE RECIPES IN OUR DATABASE:
${recipes?.map((r: any) => {
  const ings = r.recipe_ingredients?.map((ri: any) => ri.ingredients.name).join(", ");
  return `- ${r.name} (${r.difficulty}, ${r.cook_time_minutes}min): needs ${ings}`;
}).join("\n")}
${achievementContext}

${selectedIngredients
  ? `The user specifically wants to cook with: ${selectedIngredients.join(", ")}. Suggest 3-5 dishes that USE THESE INGREDIENTS as the star. Be creative — suggest dishes from any cuisine, not just Filipino. Include database recipes if they fit, but prioritize creative ideas that match what the user asked for.`
  : `Based on this, suggest 3-5 dishes they can cook right now. Prioritize recipes from our database but you can also suggest dishes not in our DB if they're a good fit.`}

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

    // Award XP for getting a suggestion
    await awardXP(supabase, user.id, "get_suggestion");

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
    let friendlyMessage = "Chef Luto is taking a break. Please try again in a moment.";

    if (statusCode === 400 || statusCode === 402) {
      friendlyMessage = "Chef Luto is temporarily unavailable. Our team has been notified — please try again later.";
    } else if (statusCode === 429) {
      friendlyMessage = "Chef Luto is a bit overwhelmed right now. Please wait a minute and try again.";
    } else if (statusCode === 529) {
      friendlyMessage = "Chef Luto's kitchen is packed! Please try again in a few minutes.";
    }

    return NextResponse.json({ error: friendlyMessage }, { status: 503 });
  }
}
