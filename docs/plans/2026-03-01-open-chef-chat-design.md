# Enhanced Chef Chat — Open Cooking Conversation Design

## Overview

Upgrade the existing Chef Luto chat to support natural cooking requests. Users can say "I want to make chicken tinola" and the AI will check their pantry, tell them what they have/need, and generate a full recipe inline in the conversation with a "Start Cooking" button.

## How It Works

1. **User opens Chef tab** — app loads pantry (with quantity levels), skill level, dietary restrictions, recent cooking history, and available database recipes. This is the same rich context the suggest route already uses.

2. **User says "I want to make chicken tinola"** — Chef Luto checks their pantry and responds conversationally:
   > "Great choice! Looking at your kusina, you have chicken and ginger already. You'll need to pick up lemon grass and chili leaves. Want me to give you the full recipe?"

3. **User says "yes"** — Chef Luto generates a structured recipe embedded in a `:::recipe ... :::` delimiter block within the streaming response.

4. **Frontend detects the recipe block** — parses the JSON and renders it as a styled recipe card with ingredients (marking which the user has), cook time, difficulty, and a "Start Cooking" button.

5. **"Start Cooking" button** — navigates to `/dashboard/cook` with the recipe data, entering the existing step-by-step cook mode.

6. **Regular chat still works** — advice, substitutions, technique questions all flow naturally. The AI gained the ability to also output structured recipes when asked.

## Approach

Enhanced system prompt + structured output detection. No tool use or separate endpoints needed.

- The system prompt tells Chef Luto to use `:::recipe{...}:::` delimiters when outputting a full recipe
- The frontend parses these delimiters from streamed text and renders recipe cards
- Everything goes through the existing `/api/chef/chat` endpoint

## Changes Required

### 1. System Prompt Update (`src/lib/chef-ai.ts`)

Add instructions for:
- When user mentions wanting to cook a specific dish, check their pantry and respond conversationally about what they have/need
- When user confirms they want the recipe, output it in `:::recipe{...}:::` format
- Recipe JSON format matches the existing recipe structure (name, description, difficulty, cook_time, ingredients, steps)

### 2. Chat API Route (`src/app/api/chef/chat/route.ts`)

Send richer context to the AI (currently only sends skill level, dietary restrictions, pantry, and dish name):
- Pantry items with quantity levels (not just names)
- Recent cooking sessions with ratings (last 10)
- Achievement context (already done)

Track recipe generation: when the AI outputs a `:::recipe` block, increment `recipe_count` in daily_usage.

### 3. Web Chat Frontend (`src/app/dashboard/chef/page.tsx` + chat components)

- Parse `:::recipe{...}:::` blocks in streamed messages
- Render detected recipes as styled card components (ingredient checklist, meta badges, "Start Cooking" button)
- "Start Cooking" navigates to `/dashboard/cook` with recipe data as URL params or state

### 4. Mobile Chat Frontend (`lutuin-mobile/components/chat-interface.tsx`)

- Same `:::recipe` parsing logic
- Render recipe cards in React Native
- "Start Cooking" navigates to the mobile cook screen with recipe data

## Rate Limiting

- Chat messages continue counting toward `chat_message_count`
- Recipe output in chat does NOT separately count toward `recipe_count` (it's part of the conversation, not a separate generation — the user already "spent" chat messages to get there)

## Recipe JSON Format

```json
:::recipe
{
  "name": "Chicken Tinola",
  "description": "A light Filipino ginger soup with chicken and greens",
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
```

The `in_pantry` field lets the frontend visually mark which ingredients the user already has vs. needs to get.
