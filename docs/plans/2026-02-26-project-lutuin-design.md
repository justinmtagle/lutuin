# Project Lutuin - Design Document

**Date:** 2026-02-26
**Status:** Approved
**Working Name:** Project Lutuin (brand name TBD)

## Vision

An AI-powered kitchen companion that helps home cooks in the Philippines make great dishes with what they already have. Users manage their kitchen inventory, and a Chef AI suggests personalized Filipino dishes, offers cooking guidance through conversation, and adapts to their skill level over time.

## Platform & Stack

- **Web app** (Next.js) — mobile app planned for v2 via shared API
- **Database/Auth/Storage:** Supabase
- **AI Engine:** Claude API (Anthropic)
- **Architecture:** AI-First — Claude is the core engine for suggestions, chat, and personalization

## Core User Flow

### 1. Onboarding
- Sign up via email or Google (Supabase Auth)
- Set cooking skill level: Beginner / Intermediate / Advanced
- Set cuisine preferences (Filipino by default)
- Optional: dietary restrictions (no pork, vegetarian, allergies, etc.)

### 2. My Kusina (Pantry Management)
- Search and add ingredients from a categorized master list (proteins, vegetables, spices, pantry staples)
- Quantity levels: "plenty" / "some" / "running low" (no exact measurements)
- Smart suggestions based on cooking history ("You usually have garlic and onions — add them?")
- Quick-add common Filipino pantry staples (soy sauce, vinegar, calamansi, fish sauce, etc.)

### 3. "What Should I Cook?" (AI Suggestions)
- User taps the main CTA
- Claude receives: pantry contents, skill level, preferences, dietary restrictions, cooking history
- Returns 3-5 dish suggestions with: name, description, ingredient match %, difficulty, cook time
- User picks a dish to proceed

### 4. Chef Chat (Conversational Planning)
- Opens a chat interface with the Chef AI after selecting a dish (or when undecided)
- User can:
  - Ask about substitutions ("What if I don't have coconut milk?")
  - Request adjustments ("Can I make this less spicy for the kids?")
  - Discuss time constraints ("I only have 30 minutes")
  - Ask for pairings ("What goes well as a side dish?")
  - Discuss plating, portions, and prep
- Chef persona: warm, encouraging, knowledgeable about Filipino cooking traditions
- When ready, user taps "Let's cook!" to enter Cooking Mode

### 5. Cooking Mode (Step-by-Step)
- Full-screen, one step at a time, large text (hands may be messy)
- AI-powered tips per step
- Timer integration for timed steps
- "I don't have X" button for on-the-fly substitutions
- Recipe is personalized based on Chef Chat conversation

### 6. Post-Cooking Feedback
- Rate the dish (1-5 stars)
- Difficulty feedback: "Too easy / Just right / Too hard"
- Feeds into the adaptive skill system

## Data Model

### Supabase Tables

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `users` | id, email, skill_level, dietary_restrictions, preferences | User profile (extends Supabase Auth) |
| `ingredients` | id, name, category, common_in_ph, aliases | Master ingredient list |
| `user_pantry` | user_id, ingredient_id, quantity_level, added_at | User's kitchen inventory |
| `recipes` | id, name, description, cuisine, difficulty, cook_time, servings, steps (JSON), image_url | Curated recipe database |
| `recipe_ingredients` | recipe_id, ingredient_id, amount, unit, is_optional | Recipe-ingredient mapping |
| `cooking_sessions` | id, user_id, recipe_id, chef_chat_history (JSON), rating, difficulty_feedback, completed_at | Cooking history + feedback |
| `user_preferences` | user_id, preferred_cuisines, avoided_ingredients, flavor_preferences | Learned preferences over time |

### API Routes (Next.js)

- `POST /api/chef/suggest` — Pantry + profile → dish suggestions (Claude API)
- `POST /api/chef/chat` — Conversational Chef AI (streaming)
- `CRUD /api/pantry` — Manage pantry items
- `GET /api/recipes/:id` — Full recipe details
- `POST /api/sessions` — Log cooking session + feedback
- `GET /api/suggestions/restock` — Smart restock suggestions

## AI Chef Design

### Persona
- One Chef persona for all users (personalization via user context, not separate personas)
- Warm, encouraging, knowledgeable about Filipino cooking traditions
- Speaks English, naturally uses Filipino food terms (adobo, sinigang, sawsawan)
- Adjusts explanation complexity based on user's skill level
- Gives cultural context when relevant

### Behavior Rules
- Suggests dishes with 70%+ ingredient match from user's pantry
- Clearly flags missing ingredients with substitutions
- Never suggests dangerous combinations (raw meat for beginners, allergy risks)
- Respects dietary restrictions absolutely
- Adapts over time based on ratings and feedback

### Skill Adaptation
- Self-assessed initial level (Beginner / Intermediate / Advanced)
- Track: recipes completed, difficulty ratings, cuisine variety, cooking frequency
- After ~5 completed sessions, begin adjusting baseline skill assessment
- Nudge users to try harder dishes when ready (don't force)

## Monetization (Freemium)

### Free Tier
- 5 AI suggestions per day
- 10 Chef Chat messages per day
- Full access to curated recipe database
- Basic pantry management

### Premium (~$5/mo)
- Unlimited AI suggestions and Chef Chat
- Meal planning (v2)
- Shopping list generation (v2)
- Advanced substitutions
- Cooking history analytics (v2)

## UI/UX

### Key Screens
1. **Landing / Auth** — "Your AI Filipino Kitchen Companion" + sign up/login
2. **Onboarding** — 3-step wizard: skill → dietary → first ingredients
3. **Dashboard** — "What should I cook?" CTA, pantry summary, recent dishes
4. **My Kusina** — Ingredient grid/list by category, search, add
5. **Suggestions** — Card layout: 3-5 dishes with match %, difficulty, cook time
6. **Chef Chat** — Chat UI with dish card pinned at top
7. **Cooking Mode** — Full-screen, large text, step-by-step, timer
8. **Profile/Settings** — Skill level, preferences, subscription

### Design Direction
- Clean, warm, food-forward
- Earthy tones (not typical blue SaaS)
- Photography-heavy for recipes
- Mobile-first responsive

## MVP Scope

### In v1
- User auth (email + Google)
- Onboarding flow
- Pantry management (manual entry with search)
- AI dish suggestions
- Chef Chat (conversational planning)
- Cooking Mode (step-by-step)
- Post-cooking feedback
- Filipino dishes (~50-100 curated recipes)
- Freemium gating
- Responsive web design

### Out (v2+)
- Mobile app (React Native)
- Meal planning / weekly planner
- Shopping list generation
- Photo/barcode scanning
- Other cuisines beyond Filipino
- Customizable Chef personas
- Social features
- Smart restock suggestions
- Cooking history analytics
- Recipe bookmarking / favorites
