# Gamified Dashboard Redesign — Design

**Date:** 2026-02-27
**Goal:** Transform the bland, sparse dashboard into a Duolingo-style gamified hub with XP, levels, streaks, daily quests, and a vibrant color system. Redesign dashboard + navbar; other pages get a style refresh.

## Color & Style System

| Role | New |
|------|-----|
| Primary | amber-500 (brighter, playful) |
| Background | Soft gradient amber-50 to white |
| Cards | White with colored left borders or top accents, rounded-2xl, shadows |
| Accent: Streaks | emerald-500 |
| Accent: XP/Levels | violet-500 |
| Accent: Challenges | rose-500 |
| Shapes | rounded-2xl everywhere, bigger shadows |

## Navbar Redesign

- Bottom tab bar on mobile, top nav on desktop
- Icons + labels for each tab (Home, Kusina, Cook)
- Active tab: filled icon + colored underline
- XP level badge (shield icon with level number)
- Streak flame counter

## Dashboard Layout

Top-down:
1. Greeting + Level + XP progress bar (violet)
2. Streak card + Daily Quest card (side by side)
3. Main CTA "What should I cook?" (gradient, larger)
4. Quick Stats grid (3 cols: ingredients, dishes cooked, achievements)
5. Recent Activity (richer dish cards with XP earned)

## XP System

| Action | XP |
|--------|-----|
| Complete cooking session | +15 |
| Rate a dish | +5 |
| Add ingredient to kusina | +2 |
| Chat with Chef Luto | +3 |
| Get a suggestion | +3 |
| Unlock achievement | +20 |

## Levels

| Level | XP | Title |
|-------|-----|-------|
| 1 | 0 | Kitchen Newbie |
| 2 | 100 | Rice Washer |
| 3 | 300 | Home Cook |
| 4 | 600 | Kusina Regular |
| 5 | 1000 | Aspiring Chef |
| 6 | 1500 | Sinigang Master |
| 7 | 2500 | Lutong Bahay Pro |
| 8 | 4000 | Chef Luto's Apprentice |
| 9 | 6000 | Master Chef |
| 10 | 10000 | Legendary Filipino Chef |

## Cooking Streak

- Track consecutive days with 1+ cooking session
- Fire emoji with count, dashboard card
- Resets at midnight if no session

## Daily Quest

- One challenge per day from a pool
- Examples: "Cook a dish with chicken", "Try a new recipe", "Add 3 ingredients"
- Dashboard card with progress indicator
- +10 XP on completion

## Database Changes

- `profiles` — add: xp (int), level (int), streak_count (int), streak_last_date (date)
- `daily_quests` — new table: user_id, date, quest_type, quest_description, completed, xp_reward

## Scope

| Changes | Stays |
|---------|-------|
| Dashboard page (full redesign) | Kusina page layout |
| Navbar (icons, mobile bottom bar, badges) | Suggest page layout |
| Color palette + globals.css | Cook page layout |
| New XP/streak/quest DB + logic | Chef chat |
| | Achievement system |
