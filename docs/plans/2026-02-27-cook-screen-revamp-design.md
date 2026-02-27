# Cook Screen Revamp Design

## Goal

Replace the current cook screen (slideshow for DB recipes, chat for AI dishes) with a unified, AI-powered cook mode that works the same for every dish. Uses a scrollable step list with focus highlighting instead of a carousel/slideshow.

## Architecture

When the user taps "Let's Cook!" from the suggest screen, we always generate a full structured recipe via AI, then present it through a consistent 4-stage flow: loading -> overview -> cook mode -> feedback.

### Overall Flow

1. **Loading** - "Chef Luto is preparing your recipe..." while AI generates the full recipe as structured JSON.
2. **Recipe Overview** - Dish name, difficulty, total time, servings, scrollable ingredient checklist. User taps "Start Cooking" to enter cook mode.
3. **Cook Mode** - Scrollable step list with focus highlighting. Sticky header with progress bar. Large bottom nav buttons. Screen wake lock active.
4. **Feedback** - Existing rating (1-5) + difficulty feedback form. Unchanged.

### AI Recipe Generation

New API endpoint: `POST /api/chef/recipe`

Request: `{ dish: string }`

The route fetches user context (skill level, pantry, dietary restrictions) and asks Claude Haiku to generate:

```json
{
  "name": "Chicken Adobo",
  "description": "A tangy Filipino braised chicken dish",
  "total_time_minutes": 45,
  "difficulty": "beginner",
  "servings": 4,
  "ingredients": [
    { "name": "Chicken thighs", "amount": "1 lb", "note": "bone-in for best flavor" },
    { "name": "Soy sauce", "amount": "1/3 cup" }
  ],
  "steps": [
    {
      "number": 1,
      "title": "Prep ingredients",
      "instruction": "Pat chicken dry and season with salt and pepper.",
      "tip": "Dry chicken browns better!"
    }
  ]
}
```

The AI personalizes based on skill level (simpler steps for beginners), available pantry items (substitutions), and dietary restrictions.

### Recipe Overview Screen

- Header: dish name, difficulty badge, total time, servings
- Scrollable ingredient checklist (tap to check off, purely visual, not persisted)
- Large "Start Cooking" button at bottom
- Back link to return to suggestions

### Cook Mode UI

**Sticky header:**
- Back arrow, dish name (truncated), "Step 3 of 8" counter
- Thin amber progress bar underneath

**Step list (scrollable):**
- Completed steps: dimmed text, green checkmark, collapsed to ~1 line
- Active step: full opacity, amber left border, slightly larger text, chef tip shown if present, auto-scrolled into view
- Pending steps: dimmed (~50% opacity), full text visible but muted

**Bottom bar:**
- Two large fixed buttons: "Previous" and "Next Step"
- Last step: "Next Step" becomes "Done Cooking!" in green
- Large touch targets for messy kitchen hands

**Screen wake lock:**
- Uses Web Wake Lock API to prevent screen dimming
- Released when leaving cook mode

### What Gets Removed

- `CookingMode` component (src/components/cooking/cooking-mode.tsx) - replaced
- `StepTimer` component (src/components/cooking/step-timer.tsx) - dead code
- Chat-only path for AI-suggested dishes
- Old branching logic (DB recipe vs not-in-DB) in cook page

### What Gets Changed

- Cook page (src/app/dashboard/cook/page.tsx) - rewritten with new 4-stage flow
- New API route /api/chef/recipe for structured recipe generation

### What's New

- `RecipeOverview` component - ingredient checklist + start cooking button
- `CookMode` component - scrollable step list with focus highlighting
- `/api/chef/recipe` route - generates structured JSON recipe via AI

### Out of Scope (for now)

- Timers (tappable time highlights)
- Voice control
- Inline media (photos/GIFs per step)
- Persistent ingredient check-off state

## Tech Stack

- Next.js 16 / React 19
- Supabase (auth, user context)
- Anthropic Claude Haiku (recipe generation)
- Web Wake Lock API (screen stays on)
- Tailwind CSS 4
