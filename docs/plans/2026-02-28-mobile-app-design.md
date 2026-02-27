# Lutuin Mobile App Design

## Goal

Build a native iOS + Android mobile app using Expo / React Native with full feature parity to the existing web app. The web app continues running alongside the mobile app, sharing the same Supabase backend and API routes.

## Architecture

A new Expo project (`lutuin-mobile/`) sits alongside the existing Next.js web app. The mobile app talks directly to Supabase for CRUD operations (protected by RLS) and calls the web app's API routes for AI-powered features that need server-side secrets (Anthropic API key). Auth uses Supabase with `expo-secure-store` for token persistence.

## Tech Stack

- Expo SDK + Expo Router (file-based routing)
- React Native
- NativeWind v4 (Tailwind CSS for React Native)
- @supabase/supabase-js + expo-secure-store (auth)
- expo-keep-awake (replaces Web Wake Lock API)
- expo-auth-session (Google OAuth)

## Project Structure

```
lutuin-mobile/
  app/                    # Expo Router file-based routing
    (auth)/
      login.tsx
      signup.tsx
    (tabs)/
      _layout.tsx         # Bottom tab navigator
      index.tsx           # Dashboard
      suggest.tsx         # Suggest flow
      kusina.tsx          # Pantry
      chef.tsx            # Chef chat
    cook.tsx              # Cook mode (stack screen, not tab)
    onboarding.tsx
  components/             # Reusable components
  lib/
    supabase.ts           # Supabase client with SecureStore
    api.ts                # API call helpers (fetch to web app's API routes)
    types.ts              # Shared types (Recipe, Achievement, etc.)
  app.json                # Expo config
```

## Authentication

Supabase client uses `expo-secure-store` for token persistence instead of cookies:

```typescript
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: (key) => SecureStore.getItemAsync(key),
      setItem: (key, value) => SecureStore.setItemAsync(key, value),
      removeItem: (key) => SecureStore.deleteItemAsync(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- Email/password login and signup via `signInWithPassword()` / `signUp()`
- Google OAuth via `expo-auth-session` with deep linking for redirect
- Protected routes: Expo Router layout checks auth state, redirects to login if no session, to onboarding if not completed

## API Communication

### Direct Supabase (CRUD via RLS):
- Pantry management (user_pantry)
- Saved recipes (saved_recipes)
- Cooking session feedback (cooking_sessions)
- Profile reads/updates (profiles)
- Ingredient search (ingredients)
- Achievement reads (user_achievements)

### Web App API Routes (AI features needing server-side secrets):
- `POST /api/chef/suggest` — dish suggestions
- `POST /api/chef/recipe` — structured recipe generation
- `POST /api/chef/chat` — streaming chat (SSE)
- `GET/POST /api/achievements` — achievement list/checks

Mobile sends the Supabase auth token in the `Authorization` header. The web app's base URL is configured via environment variable.

For streaming chat, the mobile app uses `fetch()` with a response body reader to process SSE chunks.

## Screens & Navigation

### Bottom Tab Navigator (4 tabs):
1. **Home** — Dashboard: XP, streak, daily quest, recent activity, saved recipes
2. **Kusina** — Pantry: ingredient search + pantry grid
3. **Suggest** — Pick ingredients, view suggestions, tap to cook
4. **Chef** — Streaming chat with Chef Luto

### Stack Screens (pushed on top of tabs):
- **Cook** — 4-stage flow: loading, overview, cook mode, feedback. Uses `expo-keep-awake`.
- **Onboarding** — 3-step setup: skill level, dietary restrictions, pantry items.

### Auth Screens (shown when not logged in):
- **Login** — email/password + Google OAuth
- **Signup** — email/password + Google OAuth

## Styling with NativeWind

NativeWind v4 allows Tailwind class names on React Native components. ~80% of existing classes work unchanged.

### Adaptations needed:
- `hover:` states → `Pressable` with `onPressIn`/`onPressOut`
- `fixed bottom-0` → absolute positioning within safe areas
- `min-h-screen` → `flex-1` on root view
- `overflow-y-auto` → `ScrollView` or `FlatList`
- `animate-spin` → `react-native-reanimated` or `Animated` API
- `grid grid-cols-2` → flex row with wrap + 50% width
- Safe areas → `SafeAreaView` from `react-native-safe-area-context`

## Out of Scope (for now)

- Push notifications
- Offline mode / local caching
- App store submission (build first, submit later)
- Deep linking from web to mobile
- Shared monorepo / code sharing with web
