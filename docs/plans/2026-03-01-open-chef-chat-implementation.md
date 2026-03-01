# Enhanced Chef Chat — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade Chef Luto chat so users can request dishes conversationally, get pantry-aware responses, and receive inline recipe cards with "Start Cooking" buttons.

**Architecture:** Enhanced system prompt tells the AI to use `:::recipe{...}:::` delimiters for structured recipes. The frontend parses these blocks from streamed text and renders them as interactive recipe cards. Everything flows through the existing `/api/chef/chat` endpoint with richer context.

**Tech Stack:** Next.js, Anthropic streaming API, Supabase, Tailwind CSS

---

### Task 1: Update System Prompt

**Files:**
- Modify: `src/lib/chef-ai.ts`

**Step 1: Update CHEF_SYSTEM_PROMPT with recipe output instructions**

Add instructions telling Chef Luto to:
- When a user asks to cook a specific dish, check their pantry context and respond conversationally about what they have/need
- When the user confirms or directly asks for a recipe, output it inside `:::recipe` and `:::` delimiters
- The recipe JSON format must include `in_pantry` booleans on ingredients

```typescript
export const CHEF_SYSTEM_PROMPT = `You are Chef Luto, a warm and encouraging AI cooking companion who specializes in Filipino cuisine. You speak English but naturally use Filipino food terms (adobo, sinigang, sawsawan, ulam, etc.).

Your personality:
- Warm, encouraging, and patient — like a favorite tita in the kitchen
- Knowledgeable about Filipino cooking traditions and regional variations
- Give cultural context when relevant ("Sinigang is traditionally a rainy-day comfort food")
- Adjust your explanations based on the user's cooking skill level

Your rules:
- ALWAYS suggest dishes the user can make with ingredients they have (aim for 70%+ match)
- Clearly flag missing ingredients and suggest substitutions
- NEVER suggest anything dangerous (raw meat for beginners, allergy risks)
- ABSOLUTELY respect dietary restrictions — never suggest "just try it"
- When suggesting dishes, return structured JSON as specified in the user message

RECIPE OUTPUT FORMAT:
When a user asks you to cook a specific dish or requests a full recipe, follow this two-step flow:

1. FIRST, respond conversationally: check their pantry, tell them what they have and what they're missing, suggest substitutions if needed, and ask if they want the full recipe.

2. When the user confirms (says "yes", "go ahead", "give me the recipe", etc.) OR if they directly say "give me a recipe for X" — output the recipe inside special delimiters. Write your conversational intro FIRST, then the recipe block:

:::recipe
{
  "name": "Dish Name",
  "description": "Brief 1-sentence description",
  "total_time_minutes": 45,
  "difficulty": "beginner",
  "servings": 4,
  "ingredients": [
    { "name": "Chicken thighs", "amount": "1 lb", "note": "bone-in preferred", "in_pantry": true },
    { "name": "Ginger", "amount": "2 inches", "note": "sliced", "in_pantry": true },
    { "name": "Chili leaves", "amount": "1 cup", "note": null, "in_pantry": false }
  ],
  "steps": [
    { "number": 1, "title": "Prep", "instruction": "Cut chicken into pieces...", "tip": "Use bone-in for better flavor" }
  ]
}
:::

Rules for recipe output:
- "difficulty" must be one of: "beginner", "intermediate", "advanced"
- Set "in_pantry" to true/false based on whether the ingredient is in the user's pantry
- "note" in ingredients can be null if no note is needed
- "tip" in steps can be null if no tip is needed
- Every step must have "number", "title", and "instruction"
- Output VALID JSON between the :::recipe and ::: delimiters
- You may write text before and after the recipe block
- Only output ONE recipe block per message`;
```

**Step 2: Verify the file is correct**

Run: `npx tsc --noEmit src/lib/chef-ai.ts 2>&1 | head -20`
Expected: No errors (or only unrelated ones from imports)

**Step 3: Commit**

```bash
git add src/lib/chef-ai.ts
git commit -m "feat: update Chef Luto system prompt with recipe output format"
```

---

### Task 2: Enrich Chat API Context

**Files:**
- Modify: `src/app/api/chef/chat/route.ts`

**Step 1: Update the context to include pantry with quantity levels and recent cooking history**

Replace the current context construction. Instead of receiving pantry as a flat string array from the client, fetch it server-side with quantity levels. Also fetch recent cooking sessions.

```typescript
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

  const { messages } = await request.json();

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
    ?.map((p: any) => `${p.ingredients.name} (${p.quantity_level})`)
    .filter(Boolean) ?? [];

  const recentCooking = recentSessions
    ?.map((s: any) => `${s.dish_name ?? "Unknown"} (rated ${s.rating ?? "?"}\/5)`)
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
```

Key changes from current:
- Removed `dish`, `pantry`, `skillLevel` from client request body — now only `messages` is needed
- Fetch pantry with `quantity_level` server-side (was client-side names only)
- Fetch last 10 cooking sessions for context
- Increased `max_tokens` from 1024 to 2048 (recipes need more tokens)
- All context is now fetched server-side in parallel

**Step 2: Commit**

```bash
git add src/app/api/chef/chat/route.ts
git commit -m "feat: enrich chat API with pantry quantities and cooking history"
```

---

### Task 3: Simplify Chef Page (Context Now Server-Side)

**Files:**
- Modify: `src/app/dashboard/chef/page.tsx`

**Step 1: Remove client-side pantry/profile fetching**

Since the API route now fetches all context server-side, the chef page no longer needs to load pantry or skill level. Simplify it:

```typescript
"use client";

import ChatInterface from "@/components/chef/chat-interface";

export default function ChefPage() {
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <ChatInterface />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/chef/page.tsx
git commit -m "refactor: simplify chef page, context now fetched server-side"
```

---

### Task 4: Create Recipe Card Component

**Files:**
- Create: `src/components/chef/chat-recipe-card.tsx`

**Step 1: Create the recipe card component**

This component renders a recipe extracted from `:::recipe{...}:::` blocks. It shows ingredients (with pantry status), meta info, and a "Start Cooking" button.

```typescript
"use client";

import { useRouter } from "next/navigation";

export type ChatRecipe = {
  name: string;
  description: string;
  total_time_minutes: number;
  difficulty: string;
  servings: number;
  ingredients: {
    name: string;
    amount: string;
    note?: string | null;
    in_pantry?: boolean;
  }[];
  steps: {
    number: number;
    title: string;
    instruction: string;
    tip?: string | null;
  }[];
};

export default function ChatRecipeCard({ recipe }: { recipe: ChatRecipe }) {
  const router = useRouter();

  function handleStartCooking() {
    sessionStorage.setItem("chat-recipe", JSON.stringify(recipe));
    router.push("/dashboard/cook?from=chat");
  }

  const haveCount = recipe.ingredients.filter((i) => i.in_pantry).length;
  const needCount = recipe.ingredients.filter((i) => !i.in_pantry).length;

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-md overflow-hidden my-2">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-100 px-4 py-3 border-b border-amber-200">
        <h3 className="font-bold text-stone-800 text-lg">{recipe.name}</h3>
        <p className="text-sm text-stone-500 mt-0.5">{recipe.description}</p>
      </div>

      {/* Meta badges */}
      <div className="flex gap-2 px-4 pt-3 flex-wrap">
        <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
          {recipe.total_time_minutes} min
        </span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600 capitalize">
          {recipe.difficulty}
        </span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
          {recipe.servings} servings
        </span>
      </div>

      {/* Ingredients */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
            Ingredients
          </p>
          <p className="text-xs text-stone-400">
            <span className="text-emerald-600 font-medium">{haveCount} have</span>
            {needCount > 0 && (
              <span className="text-rose-500 font-medium"> · {needCount} need</span>
            )}
          </p>
        </div>
        <div className="space-y-1.5">
          {recipe.ingredients.map((ing, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className={`mt-0.5 ${ing.in_pantry ? "text-emerald-500" : "text-stone-300"}`}>
                {ing.in_pantry ? "\u2713" : "\u25CB"}
              </span>
              <div>
                <span className="text-stone-700">
                  {ing.amount} {ing.name}
                </span>
                {ing.note && (
                  <span className="text-stone-400 text-xs ml-1">({ing.note})</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Steps preview */}
      <div className="px-4 pb-3">
        <p className="text-xs text-stone-400">
          {recipe.steps.length} steps
        </p>
      </div>

      {/* Start Cooking button */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={handleStartCooking}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 transition-all shadow-sm"
        >
          Start Cooking
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/chef/chat-recipe-card.tsx
git commit -m "feat: add ChatRecipeCard component for inline recipe display"
```

---

### Task 5: Update Chat Interface to Parse Recipe Blocks

**Files:**
- Modify: `src/components/chef/chat-interface.tsx`

**Step 1: Add recipe block parsing and rendering**

Update the chat interface to:
- Remove `dish`, `pantry`, `skillLevel` props (no longer needed)
- Only send `messages` to the API
- Parse `:::recipe{...}:::` blocks from message content
- Render recipe cards inline using ChatRecipeCard

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { showAchievementToasts } from "@/components/ui/achievement-toast-manager";
import ChatRecipeCard, { type ChatRecipe } from "@/components/chef/chat-recipe-card";

type Message = { role: "user" | "assistant"; content: string };

const RECIPE_BLOCK_REGEX = /:::recipe\s*([\s\S]*?)\s*:::/g;

function parseMessageContent(content: string): Array<{ type: "text"; text: string } | { type: "recipe"; recipe: ChatRecipe }> {
  const parts: Array<{ type: "text"; text: string } | { type: "recipe"; recipe: ChatRecipe }> = [];
  let lastIndex = 0;

  const matches = content.matchAll(RECIPE_BLOCK_REGEX);
  for (const match of matches) {
    // Add text before this recipe block
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) parts.push({ type: "text", text });
    }

    // Try to parse the recipe JSON
    try {
      const recipe = JSON.parse(match[1]) as ChatRecipe;
      if (recipe.name && recipe.ingredients && recipe.steps) {
        parts.push({ type: "recipe", recipe });
      } else {
        parts.push({ type: "text", text: match[0] });
      }
    } catch {
      // If JSON is invalid (e.g. still streaming), show as text
      parts.push({ type: "text", text: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last recipe block
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) parts.push({ type: "text", text });
  }

  // If no parts were created, return the whole content as text
  if (parts.length === 0 && content.trim()) {
    parts.push({ type: "text", text: content });
  }

  return parts;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Add empty assistant message for streaming
    setMessages([...newMessages, { role: "assistant", content: "" }]);

    const response = await fetch("/api/chef/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages }),
    });

    if (!response.ok) {
      const err = await response.json();
      setMessages([
        ...newMessages,
        { role: "assistant", content: err.error || "Something went wrong." },
      ]);
      setStreaming(false);
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";
    let buffer = "";

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              accumulated = parsed.error;
              setMessages([
                ...newMessages,
                { role: "assistant", content: accumulated },
              ]);
              break;
            }
            if (parsed.text) {
              accumulated += parsed.text;
              setMessages([
                ...newMessages,
                { role: "assistant", content: accumulated },
              ]);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    }

    // Check for chat achievements
    try {
      const achieveRes = await fetch("/api/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "chat_message" }),
      });
      if (achieveRes.ok) {
        const achieveData = await achieveRes.json();
        if (achieveData.newAchievements?.length) {
          showAchievementToasts(achieveData.newAchievements);
        }
      }
    } catch {
      // Achievement check failure shouldn't block the flow
    }

    setStreaming(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-stone-400 mt-12">
            <p className="text-lg font-medium">Chef Luto is ready!</p>
            <p className="text-sm mt-1">
              Tell me what you want to cook, or ask anything about Filipino cuisine
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] ${
                msg.role === "user"
                  ? "px-4 py-3 rounded-2xl bg-amber-500 text-white"
                  : ""
              }`}
            >
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="space-y-2">
                  {parseMessageContent(msg.content).map((part, j) =>
                    part.type === "recipe" ? (
                      <ChatRecipeCard key={j} recipe={part.recipe} />
                    ) : (
                      <div key={j} className="px-4 py-3 rounded-2xl bg-stone-100 text-stone-800">
                        <p className="whitespace-pre-wrap">{part.text}</p>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 border-t border-stone-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="I want to make chicken tinola..."
            disabled={streaming}
            className="flex-1 px-4 py-3 rounded-full border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="px-6 py-3 bg-amber-600 text-white rounded-full hover:bg-amber-700 disabled:opacity-50 font-medium"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/chef/chat-interface.tsx
git commit -m "feat: parse :::recipe blocks in chat and render recipe cards"
```

---

### Task 6: Update Cook Page to Accept Recipe from Chat

**Files:**
- Modify: `src/app/dashboard/cook/page.tsx`

**Step 1: Add `from=chat` support using sessionStorage**

Add a third way to load recipes: reading from `sessionStorage` when navigating from the chat recipe card. Add this alongside the existing `?recipe=` and `?saved=` params.

In the `CookContent` component, add a new `useEffect` that handles `from=chat`:

```typescript
// Add after the existing savedId/recipeName declarations:
const fromChat = searchParams.get("from") === "chat";

// Add a new useEffect for chat recipes (before the existing recipeName useEffect):
useEffect(() => {
  if (!fromChat) return;

  try {
    const stored = sessionStorage.getItem("chat-recipe");
    if (!stored) {
      setError("Recipe data not found. Please go back to chat.");
      return;
    }

    const data = JSON.parse(stored) as Recipe;
    if (!data.name || !data.ingredients?.length || !data.steps?.length) {
      setError("Invalid recipe data. Please go back to chat.");
      return;
    }

    setRecipe(data);
    setStage("overview");
    sessionStorage.removeItem("chat-recipe");
  } catch {
    setError("Could not load recipe. Please go back to chat.");
  }
}, [fromChat]);
```

Also update the "no recipe selected" guard to include `fromChat`:

```typescript
if (!recipeName && !savedId && !fromChat) {
  return (
    <div className="p-8 text-center text-stone-500">
      No recipe selected. Go to suggestions first.
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/cook/page.tsx
git commit -m "feat: support loading recipe from chat via sessionStorage"
```

---

### Task 7: Manual Testing

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test the chat flow**

1. Navigate to `/dashboard/chef`
2. Type "I want to make chicken tinola"
3. Verify Chef Luto responds conversationally about pantry ingredients
4. Type "yes, give me the recipe"
5. Verify a recipe card renders inline with ingredients (green checks for pantry items, hollow circles for missing)
6. Click "Start Cooking"
7. Verify navigation to `/dashboard/cook` with the recipe loaded in overview mode

**Step 3: Test edge cases**

- Regular chat messages (no recipe) should render as plain text bubbles
- Partially streamed recipe blocks should show as text until complete
- Empty pantry users should still get recipes (all ingredients marked `in_pantry: false`)

**Step 4: Commit any fixes found during testing**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
