import { createClient } from "@/lib/supabase/server";
import { anthropic, CHEF_SYSTEM_PROMPT } from "@/lib/chef-ai";
import { NextResponse } from "next/server";
import { awardXP } from "@/lib/gamification-actions";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate dish name from request body
  let dish: string;
  try {
    const body = await request.json();
    if (typeof body.dish !== "string" || !body.dish.trim()) {
      return NextResponse.json(
        { error: "A dish name is required." },
        { status: 400 }
      );
    }
    dish = body.dish.trim().slice(0, 200);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  // Fetch user context in parallel
  const [{ data: profile }, { data: pantry }] = await Promise.all([
    supabase
      .from("profiles")
      .select("skill_level, dietary_restrictions")
      .eq("id", user.id)
      .single(),
    supabase
      .from("user_pantry")
      .select("ingredients(name)")
      .eq("user_id", user.id),
  ]);

  const skillLevel = profile?.skill_level ?? "beginner";
  const dietaryRestrictions = profile?.dietary_restrictions?.length
    ? profile.dietary_restrictions.join(", ")
    : "None";
  const pantryList =
    pantry?.map((p: any) => p.ingredients.name).filter(Boolean) ?? [];

  const userMessage = `Generate a full structured recipe for: ${dish}

USER CONTEXT:
- Skill level: ${skillLevel}
- Dietary restrictions: ${dietaryRestrictions}
- Available pantry ingredients: ${pantryList.length ? pantryList.join(", ") : "Not specified"}

INSTRUCTIONS:
- Tailor the recipe complexity to the user's skill level (${skillLevel}). For beginners, keep steps simple and include helpful tips. For advanced cooks, you can use more sophisticated techniques.
- ABSOLUTELY respect dietary restrictions: ${dietaryRestrictions}
- If the user has pantry ingredients available, note which ones they already have.
- Include Filipino culinary context or tips where relevant.

Return ONLY valid JSON in this exact format:
{
  "name": "Dish Name",
  "description": "Brief 1-sentence description",
  "total_time_minutes": 45,
  "difficulty": "beginner",
  "servings": 4,
  "ingredients": [
    { "name": "Chicken thighs", "amount": "1 lb", "note": "bone-in for best flavor" }
  ],
  "steps": [
    { "number": 1, "title": "Prep ingredients", "instruction": "Detailed instruction.", "tip": "Optional tip or null" }
  ]
}

Rules for the JSON:
- "difficulty" must be one of: "beginner", "intermediate", "advanced"
- "note" in ingredients can be null if no note is needed
- "tip" in steps can be null if no tip is needed
- Every step must have a "number", "title", and "instruction"
- Return ONLY the JSON object, no other text`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: CHEF_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textContent = message.content.find((c) => c.type === "text");
    const jsonText = textContent?.text ?? "";
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch?.[0] ?? jsonText);
    } catch {
      return NextResponse.json(
        { error: "Chef Luto's recipe didn't come out right. Please try again." },
        { status: 502 }
      );
    }

    // Award XP only after successful recipe generation
    await awardXP(supabase, user.id, "get_suggestion");

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Chef AI recipe error:", error);

    // Map API errors to user-friendly messages
    const statusCode = error?.status ?? 500;
    let friendlyMessage =
      "Chef Luto is taking a break. Please try again in a moment.";

    if (statusCode === 400 || statusCode === 402) {
      friendlyMessage =
        "Chef Luto is temporarily unavailable. Our team has been notified — please try again later.";
    } else if (statusCode === 429) {
      friendlyMessage =
        "Chef Luto is a bit overwhelmed right now. Please wait a minute and try again.";
    } else if (statusCode === 529) {
      friendlyMessage =
        "Chef Luto's kitchen is packed! Please try again in a few minutes.";
    }

    return NextResponse.json({ error: friendlyMessage }, { status: 503 });
  }
}
