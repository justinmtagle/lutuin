# Ingredient-Based Suggestions — Design

**Date:** 2026-02-27
**Goal:** Let users pick specific ingredients (from pantry + free text) before generating dish suggestions, instead of auto-pulling the full pantry.

## User Flow

1. User lands on `/dashboard/suggest`
2. Sees pantry ingredients as tappable chips (grouped by category) + a text input for extras
3. Toggles on ingredients they want to use, optionally types extras not in pantry
4. Clicks "What can I cook with these?"
5. AI suggests dishes based on **only selected ingredients** — creative dishes encouraged, not limited to DB
6. Rest of flow unchanged: pick suggestion → chat with Chef Luto → cook

## Ingredient Picker UI

- Pantry chips pre-loaded from user's kusina (server-side)
- Tappable chips: selected = amber highlight, deselected = muted
- "Select All" toggle for quick full-pantry selection
- Free text input: type ingredient name, press Enter/comma to add as a custom chip
- Custom chips visually distinct (dashed border or different color)
- Button: "What can I cook with these?" — disabled until at least 1 ingredient selected

## API Changes

- Suggest API (`/api/chef/suggest`) accepts optional `selectedIngredients: string[]` body param
- If provided, use those instead of querying user_pantry
- If not provided, falls back to current behavior (full pantry)

## AI Prompt Changes

- When specific ingredients are provided, prompt emphasizes:
  - Suggest ANY dish (not limited to database recipes)
  - Be creative — suggest dishes from any cuisine
  - Still respect dietary restrictions and skill level
  - `in_database` field in response indicates whether we have the recipe stored

## What Changes

| Component | Change |
|-----------|--------|
| Suggest page | New ingredient picker step before suggestions |
| Suggest API | Accept optional `selectedIngredients` param |
| AI prompt | Emphasize creative suggestions when specific ingredients given |

## What Stays the Same

- Chat interface, cook page, suggestion cards, daily limits, XP awards, achievement checks
