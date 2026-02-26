# Achievement System Design

## Goal

Gamify the cooking experience by rewarding users for both cooking frequently and exploring new dishes. Achievements should feel personal, celebratory, and naturally integrated with Chef Luto's personality.

## Approach

Code-defined achievements in TypeScript with user progress tracked in Supabase. Achievements are evaluated after key user actions and surfaced via toast notifications and a dashboard section.

## Data Model

Single new table — `user_achievements`:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| user_id | uuid (FK → profiles) | |
| achievement_slug | text | Matches TypeScript config key |
| unlocked_at | timestamptz | When the achievement was earned |
| progress | jsonb | e.g., `{ "count": 7, "target": 10 }` |

- Unique constraint on `(user_id, achievement_slug)`
- RLS: users can only read/write their own rows

No `achievements` table — definitions live in `src/lib/achievements.ts` as a typed config array.

## Achievement Definitions

### Visible (with progress bars)

| Slug | Name | Criteria | Target |
|------|------|----------|--------|
| first_dish | First Dish | Complete 1 cooking session | 1 |
| home_cook | Home Cook | Complete 10 cooking sessions | 10 |
| kitchen_master | Kitchen Master | Complete 50 cooking sessions | 50 |
| explorer | Explorer | Cook 5 different recipes | 5 |
| adventurer | Adventurer | Cook 15 different recipes | 15 |
| pantry_pro | Pantry Pro | Add 20 ingredients to pantry | 20 |
| streak_3 | On a Roll | Cook 3 days in a row | 3 |
| streak_7 | Week Warrior | Cook 7 days in a row | 7 |
| rising_chef | Rising Chef | Reach intermediate skill level | — |
| master_chef | Master Chef | Reach advanced skill level | — |

### Hidden (surprise unlocks)

| Slug | Name | Criteria |
|------|------|----------|
| perfect_score | Perfect Score | Rate a dish 5 stars |
| night_owl | Night Owl | Complete a session after 10 PM |
| early_bird | Early Bird | Complete a session before 7 AM |
| comfort_food | Comfort Food | Cook the same recipe 3 times |
| fearless | Fearless | Complete a recipe rated "too hard" |
| chatty_chef | Chatty Chef | Send 50+ messages to Chef Luto |
| full_kusina | Full Kusina | Have 30+ ingredients in pantry at once |

## Achievement Checking Flow

**Trigger points** (when we evaluate achievements):

1. After a cooking session is completed
2. After a pantry item is added/updated
3. After a chat message is sent
4. After a profile/skill level update

**Process:**

1. User completes an action via an API endpoint
2. Endpoint calls `checkAchievements(userId, triggerType)`
3. Function queries relevant user stats from Supabase
4. Compares against all achievement definitions for that trigger type
5. Inserts newly unlocked achievements into `user_achievements`
6. Updates progress for in-progress visible achievements
7. Returns `newAchievements: [...]` array in the API response

## Chef Luto Integration

When building the system prompt context for Chef Luto (suggest and chat endpoints), include:
- Recently unlocked achievements (last 3 days)
- Notable milestones approaching (e.g., "2 away from Home Cook")

Chef Luto can naturally reference these: "I see you just hit your 10th dish — you're really finding your rhythm!"

## UI Components

### Toast Notification
- Appears top-center when an achievement is unlocked
- Shows achievement name + description
- Auto-dismisses after 5 seconds
- Amber/gold celebratory styling

### Dashboard Achievements Section
- Added to existing `/dashboard` home page (no new route)
- Recently unlocked achievements highlighted
- Visible achievements: progress bar (current/target)
- Hidden achievements: shown as "???" until unlocked
- Locked achievements grayed out

## Decisions

- **Code-defined** over DB-defined: simpler for MVP, can migrate later if admin UI needed
- **Toast only** (no dedicated achievements page): keeps it lightweight
- **Mix of visible + hidden**: progress bars motivate grinding, surprises create delight
- **Chef Luto aware**: achievements feel integrated, not tacked on
