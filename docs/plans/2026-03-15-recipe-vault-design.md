# Recipe Vault — Design

## Overview

Replace the Kusina tab with "My Kitchen" — a combined space with Pantry (existing) and Vault (saved recipes with history). The Chef AI gets saved recipes as context so users can reference past recipes conversationally.

## Location & Navigation

- Replace **Kusina** tab with **"My Kitchen"** in both web and mobile nav
- Segmented control at top: **Pantry** | **Vault**
- Pantry sub-section: existing pantry management UI (moved here, unchanged)
- Vault sub-section: saved recipes grid with cooking stats

## Vault UI

### Recipe Cards

Rich cards showing:
- Recipe name
- Last cooked date (from `cooking_sessions`)
- User's rating (stars, from most recent session)
- Times cooked (count of cooking sessions for that dish)
- Difficulty + cook time badges
- Tap to expand full recipe detail + actions

### Actions Per Recipe

- **Cook Again** — navigates to cook mode with the saved recipe loaded
- **Modify Recipe** — opens Chef chat pre-filled with "I want to modify my [recipe name]"
- **Delete** — removes from vault with confirmation

### Search

Text search at top to filter recipes by name.

## AI Integration

### A) Chef Chat Knows Your Vault

Enhance `/api/chef/chat` context to include saved recipe names + descriptions (not full JSON — too large). The AI can then:
- Recognize references like "that chicken wrap I saved"
- Suggest cooking a saved recipe again
- Offer modifications to saved recipes

Context format added to system prompt:
```
- Saved recipes: Chicken Adobo (cooked 3x, rated 5/5), Sinigang na Baboy (cooked 1x, rated 4/5), ...
```

### B) Quick Actions on Recipe Cards

- "Cook Again" button navigates directly to `/dashboard/cook?saved={id}`
- "Modify Recipe" button navigates to `/dashboard/chef` with a pre-filled message about modifying that recipe

## Data Sources

- **Saved recipes**: `saved_recipes` table (id, user_id, dish_name, recipe_data, saved_at)
- **Cooking stats**: `cooking_sessions` table aggregated per dish_name (count, last completed_at, latest rating)
- **Chef context**: Query saved recipes + cooking sessions, format as compact text for AI context

## Pages & Components

### Web
- `src/app/dashboard/kusina/page.tsx` — refactor into "My Kitchen" with Pantry/Vault tabs
- `src/components/vault/recipe-vault.tsx` — vault grid with recipe cards
- `src/components/vault/vault-recipe-card.tsx` — individual recipe card
- Update `src/app/api/chef/chat/route.ts` — add saved recipes to AI context

### Mobile
- `lutuin-mobile/app/(tabs)/kusina.tsx` — refactor into "My Kitchen" with Pantry/Vault tabs
- `lutuin-mobile/components/recipe-vault.tsx` — vault list with recipe cards
- `lutuin-mobile/components/vault-recipe-card.tsx` — individual recipe card

### Navigation
- Rename "Kusina" to "My Kitchen" in nav-bar.tsx (web) and mobile tab layout
