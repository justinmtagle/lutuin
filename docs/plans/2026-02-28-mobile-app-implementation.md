# Lutuin Mobile App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a native iOS + Android mobile app with Expo that has full feature parity with the existing Next.js web app, sharing the same Supabase backend and API routes.

**Architecture:** A new Expo project (`lutuin-mobile/`) sits alongside the web app. The mobile app talks directly to Supabase for CRUD operations and calls the web app's API routes (with Bearer token auth) for AI features. Expo Router provides file-based navigation, NativeWind provides Tailwind-compatible styling.

**Tech Stack:** Expo SDK 54, Expo Router, React Native, NativeWind v4, @supabase/supabase-js, expo-secure-store, expo-keep-awake

---

### Task 1: Web App API Compatibility — Accept Bearer Tokens

**Files:**
- Modify: `src/lib/supabase/server.ts`

**Context:** The web app's API routes use cookie-based auth via `@supabase/ssr`. The mobile app can't send cookies — it sends a Bearer token in the Authorization header. We need to modify the server-side Supabase client factory to accept Bearer tokens as a fallback.

**Step 1: Read the current server.ts**

Read `src/lib/supabase/server.ts` to understand the current cookie-based setup.

**Step 2: Modify createClient to support Bearer tokens**

The server `createClient` function should check for an `Authorization: Bearer <token>` header in the incoming request. If present, create a Supabase client that uses that token instead of cookies.

Add a new exported function `createClientFromRequest` that accepts a `Request` object:

```typescript
export async function createClientFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );
    return supabase;
  }
  // Fall back to cookie-based auth
  return createClient();
}
```

**Step 3: Update API routes to use `createClientFromRequest`**

In each API route that needs mobile support, change:
```typescript
const supabase = await createClient();
```
to:
```typescript
const supabase = await createClientFromRequest(request);
```

Update these files:
- `src/app/api/chef/suggest/route.ts`
- `src/app/api/chef/recipe/route.ts`
- `src/app/api/chef/chat/route.ts`
- `src/app/api/achievements/route.ts` (both GET and POST handlers)

Each route already receives `request: Request` as its first parameter, so just pass it through.

**Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/lib/supabase/server.ts src/app/api/
git commit -m "feat: add Bearer token auth support for mobile API clients"
```

---

### Task 2: Expo Project Scaffolding

**Files:**
- Create: `lutuin-mobile/` (new Expo project)

**Context:** Create a new Expo project with Expo Router, NativeWind, and all required dependencies. This project lives as a sibling to the web app directory.

**Step 1: Create the Expo project**

```bash
cd /home/grphx
npx create-expo-app@latest lutuin-mobile --template tabs
cd lutuin-mobile
```

**Step 2: Install dependencies**

```bash
npx expo install nativewind react-native-reanimated react-native-safe-area-context
npx expo install @supabase/supabase-js react-native-url-polyfill expo-secure-store expo-keep-awake
npm install --save-dev tailwindcss@^3.4.17
```

**Step 3: Configure NativeWind**

Create `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        amber: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        stone: {
          50: "#fafaf9",
          100: "#f5f5f4",
          200: "#e7e5e3",
          300: "#d6d3d1",
          400: "#a8a29e",
          500: "#78716c",
          600: "#57534e",
          700: "#44403c",
          800: "#292524",
          900: "#1c1917",
        },
      },
    },
  },
  plugins: [],
};
```

Create `global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Update `babel.config.js`:

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

Update `metro.config.js`:

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

Create `nativewind-env.d.ts`:

```typescript
/// <reference types="nativewind/types" />
```

**Step 4: Create environment config**

Create `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://kwxnzymkskvzshlzabba.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<copy from web app's .env.local>
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

**Step 5: Clean up template files**

Remove the template's default screens and components that came with `create-expo-app`. Clear out `app/` directory to start fresh.

**Step 6: Verify it runs**

```bash
npx expo start
```

Expected: Expo dev server starts without errors.

**Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Expo project with NativeWind"
```

---

### Task 3: Supabase Client + Auth Screens

**Files:**
- Create: `lib/supabase.ts`
- Create: `lib/auth-context.tsx`
- Create: `app/(auth)/login.tsx`
- Create: `app/(auth)/signup.tsx`
- Create: `app/(auth)/_layout.tsx`

**Context:** Set up Supabase client with secure token storage and build login/signup screens. The auth context provides session state to the entire app.

**Step 1: Create Supabase client**

`lib/supabase.ts`:

```typescript
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: SecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

**Step 2: Create auth context**

`lib/auth-context.tsx`:

```tsx
import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

**Step 3: Create auth layout**

`app/(auth)/_layout.tsx`:

```tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**Step 4: Create login screen**

`app/(auth)/login.tsx`:

Build a login screen with:
- Email + password inputs using React Native `TextInput`
- "Sign In" button that calls `supabase.auth.signInWithPassword()`
- Link to signup screen
- Error display for failed login
- Styling with NativeWind classes matching the web app's amber/stone theme

**Step 5: Create signup screen**

`app/(auth)/signup.tsx`:

Build a signup screen with:
- Email + password + display name inputs
- "Create Account" button that calls `supabase.auth.signUp()`
- Link back to login
- Error display

**Step 6: Verify auth flow works**

Test login and signup in the Expo dev client.

**Step 7: Commit**

```bash
git add .
git commit -m "feat: add Supabase auth with SecureStore, login and signup screens"
```

---

### Task 4: App Layout + Navigation

**Files:**
- Create: `app/_layout.tsx` (root layout with auth provider)
- Create: `app/(tabs)/_layout.tsx` (bottom tab navigator)
- Create: `app/(tabs)/index.tsx` (placeholder dashboard)
- Create: `app/(tabs)/kusina.tsx` (placeholder)
- Create: `app/(tabs)/suggest.tsx` (placeholder)
- Create: `app/(tabs)/chef.tsx` (placeholder)

**Context:** Set up the navigation structure. The root layout wraps everything in `AuthProvider` and redirects based on auth state. The tabs layout creates the bottom navigation bar with 4 tabs.

**Step 1: Create root layout**

`app/_layout.tsx`:

```tsx
import "../global.css";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../lib/auth-context";

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, loading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
```

**Step 2: Create tabs layout**

`app/(tabs)/_layout.tsx`:

Create a bottom tab navigator with 4 tabs:
- Home (index) — house icon
- Kusina — grid/pantry icon
- Suggest — sparkle/lightbulb icon
- Chef — chat icon

Use `Tabs` from `expo-router` with custom tab bar styling matching the web app's amber/stone theme. Each tab has an icon and label.

**Step 3: Create placeholder tab screens**

Create minimal placeholder screens for each tab (`index.tsx`, `kusina.tsx`, `suggest.tsx`, `chef.tsx`) that just show the screen name and confirm navigation works.

**Step 4: Test navigation**

Verify:
- Unauthenticated → redirects to login
- After login → redirects to tabs
- All 4 tabs are visible and navigable
- Tab bar styling matches the amber/stone theme

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add app layout with auth redirect and bottom tab navigation"
```

---

### Task 5: Shared Types + API Helpers

**Files:**
- Create: `lib/types.ts`
- Create: `lib/api.ts`

**Context:** Extract shared types (Recipe, Achievement, etc.) and create an API helper that sends authenticated requests to the web app's API routes.

**Step 1: Create shared types**

`lib/types.ts`:

```typescript
export type Recipe = {
  name: string;
  description: string;
  total_time_minutes: number;
  difficulty: string;
  servings: number;
  ingredients: { name: string; amount: string; note?: string | null }[];
  steps: {
    number: number;
    title: string;
    instruction: string;
    tip?: string | null;
  }[];
};

export type Suggestion = {
  name: string;
  description: string;
  match_percentage: number;
  difficulty: string;
  cook_time_minutes: number;
  missing_ingredients: string[];
  in_database: boolean;
  encouragement: string;
};

export type PantryItem = {
  name: string;
  category: string;
};

export type Achievement = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  hidden: boolean;
  unlocked_at: string | null;
  progress: Record<string, any> | null;
};
```

**Step 2: Create API helper**

`lib/api.ts`:

```typescript
import { supabase } from "./supabase";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL!;

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
      ...options.headers,
    },
  });
}
```

**Step 3: Commit**

```bash
git add lib/types.ts lib/api.ts
git commit -m "feat: add shared types and authenticated API helper"
```

---

### Task 6: Dashboard Screen

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Context:** Build the full dashboard matching the web app: hero greeting with XP/level, streak + daily quest cards, "What should I cook?" CTA, quick stats, recent activity, saved recipes section.

**Step 1: Implement dashboard**

The dashboard is a `ScrollView` that fetches data from Supabase on mount:
- Profile (display_name, xp, level, streak_count, streak_last_date, skill_level)
- Pantry count
- Cooking session count
- Recent sessions (last 5, with `recipes(name), dish_name, rating, completed_at`)
- Saved recipes (last 4, with `id, dish_name, recipe_data`)
- Daily quest (via the API or direct Supabase query)

Use the same visual design as the web dashboard:
- Amber gradient hero card with level/XP progress bar
- 2-column grid for streak + daily quest
- Large amber CTA button linking to suggest tab
- 3-column stats row (ingredients, dishes cooked, XP)
- Recent activity list
- 2-column saved recipes grid (cards link to cook screen with `?saved=<id>`)

For navigation to cook screen, use `router.push({ pathname: "/cook", params: { saved: id } })`.

**Step 2: Verify dashboard renders**

Test with a logged-in user. All sections should appear with real data.

**Step 3: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: implement dashboard screen with XP, streaks, activity, saved recipes"
```

---

### Task 7: Kusina (Pantry) Screen

**Files:**
- Modify: `app/(tabs)/kusina.tsx`
- Create: `components/ingredient-search.tsx`
- Create: `components/pantry-grid.tsx`

**Context:** Build the pantry management screen. Users can search/add ingredients and see their current pantry organized by category.

**Step 1: Build ingredient search component**

`components/ingredient-search.tsx`:
- `TextInput` for searching ingredients
- Queries `ingredients` table with `ilike` as user types (debounced)
- Shows results in a dropdown/list below the input
- Tapping a result adds it to user's pantry via `user_pantry` upsert
- Matches web app's search behavior

**Step 2: Build pantry grid component**

`components/pantry-grid.tsx`:
- Fetches `user_pantry` with joined `ingredients(name, category)`
- Groups by category
- Renders each category as a section header + row of chips
- Long-press or swipe to remove an ingredient

**Step 3: Build kusina screen**

Combine search + grid in `app/(tabs)/kusina.tsx`. Header says "My Kusina" with ingredient count.

**Step 4: Commit**

```bash
git add .
git commit -m "feat: implement kusina pantry screen with ingredient search"
```

---

### Task 8: Suggest Screen

**Files:**
- Modify: `app/(tabs)/suggest.tsx`
- Create: `components/ingredient-picker.tsx`
- Create: `components/suggestion-card.tsx`

**Context:** Two-step flow: (1) pick ingredients from pantry, (2) view AI suggestions. Tapping a suggestion navigates to the cook screen.

**Step 1: Build ingredient picker**

`components/ingredient-picker.tsx`:
- Shows user's pantry items as tappable chips (toggle selection)
- Text input for adding custom ingredients not in pantry
- "Get Suggestions" button at bottom
- Matches web app's `IngredientPicker` behavior

**Step 2: Build suggestion card**

`components/suggestion-card.tsx`:
- Displays suggestion name, description, difficulty, cook time, match %
- Shows missing ingredients
- Tappable — navigates to cook screen

**Step 3: Build suggest screen**

`app/(tabs)/suggest.tsx`:
- State machine: `picking` → `suggestions`
- In `picking` state: show ingredient picker, on submit call `apiFetch("/api/chef/suggest", { method: "POST", body: ... })`
- In `suggestions` state: show suggestion cards, "Pick new ingredients" button to go back
- Tapping a suggestion card: `router.push({ pathname: "/cook", params: { recipe: suggestion.name } })`

**Step 4: Commit**

```bash
git add .
git commit -m "feat: implement suggest screen with ingredient picker and suggestion cards"
```

---

### Task 9: Cook Screen

**Files:**
- Create: `app/cook.tsx` (stack screen, not in tabs)
- Create: `components/recipe-overview.tsx`
- Create: `components/cook-mode.tsx`

**Context:** The cook screen is a stack screen pushed on top of the tabs. It has the same 4-stage flow as the web app: loading → overview → cooking → feedback. Supports both AI-generated recipes (`recipe` param) and saved recipes (`saved` param).

**Step 1: Create cook screen**

`app/cook.tsx`:
- Read params: `recipe` (dish name) and `saved` (saved recipe ID) via `useLocalSearchParams()`
- Same state machine as web: `Stage = "loading" | "overview" | "cooking" | "feedback"`
- Loading: call `apiFetch("/api/chef/recipe", ...)` or load from `saved_recipes` table
- Overview: render `RecipeOverview` with bookmark button
- Cooking: render `CookMode` with `activateKeepAwakeAsync()` from `expo-keep-awake`
- Feedback: rating buttons + difficulty buttons + submit

**Step 2: Create RecipeOverview component**

`components/recipe-overview.tsx`:
- ScrollView with recipe name (+ bookmark icon), description, meta badges, ingredient checklist
- "Start Cooking" button at bottom
- Same props as web: `recipe`, `onStart`, `onBack`, `isSaved`, `onToggleSave`

**Step 3: Create CookMode component**

`components/cook-mode.tsx`:
- ScrollView with step list (active/completed/pending states)
- Sticky-style header with progress bar (use absolute positioning at top)
- Bottom nav buttons (Previous / Next Step / Done Cooking!)
- Auto-scroll to active step using `scrollTo` ref
- Uses `activateKeepAwakeAsync()` / `deactivateKeepAwake()` instead of Web Wake Lock

**Step 4: Verify cook flow**

Test: suggest → tap suggestion → loading → overview → cook mode → feedback → submit

**Step 5: Commit**

```bash
git add .
git commit -m "feat: implement cook screen with 4-stage flow and keep-awake"
```

---

### Task 10: Chef Chat Screen

**Files:**
- Modify: `app/(tabs)/chef.tsx`
- Create: `components/chat-interface.tsx`

**Context:** Streaming chat with Chef Luto. The web app uses SSE via `fetch()` and reads the response stream. React Native's `fetch()` also supports streaming via `response.body.getReader()`.

**Step 1: Build chat interface**

`components/chat-interface.tsx`:
- Message list in a `FlatList` (inverted for chat-style bottom-anchoring)
- Text input + send button at bottom (above keyboard)
- Use `KeyboardAvoidingView` to handle keyboard
- Messages state: `{ role: "user" | "assistant", content: string }[]`

**Step 2: Implement SSE streaming**

When user sends a message:
1. Add user message to state
2. Add empty assistant message
3. Call `apiFetch("/api/chef/chat", { method: "POST", body: JSON.stringify({ messages, dish, pantry, skillLevel }) })`
4. Read the response body as a stream:

```typescript
const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader!.read();
  if (done) break;

  const chunk = decoder.decode(value);
  // Parse SSE: split by "data: ", parse each JSON chunk
  const lines = chunk.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const data = JSON.parse(line.slice(6));
      if (data.text) {
        // Append to the last assistant message
      }
    }
  }
}
```

**Step 3: Build the chef tab screen**

`app/(tabs)/chef.tsx`:
- Fetch user's pantry items and skill level on mount
- Render `ChatInterface` with full height
- Welcome message from Chef Luto

**Step 4: Commit**

```bash
git add .
git commit -m "feat: implement chef chat screen with SSE streaming"
```

---

### Task 11: Onboarding Screen

**Files:**
- Create: `app/onboarding.tsx`
- Modify: `app/_layout.tsx` (add onboarding redirect)

**Context:** 3-step onboarding flow shown once after signup: (1) select skill level, (2) set dietary restrictions, (3) add initial pantry items. Matches the web app's onboarding.

**Step 1: Build onboarding screen**

`app/onboarding.tsx`:
- Step state: 1, 2, or 3
- Step 1: Skill level selection (beginner/intermediate/advanced) — large tappable cards
- Step 2: Dietary restrictions — multi-select chips (vegetarian, vegan, halal, etc.)
- Step 3: Common pantry items — multi-select grid of common Filipino ingredients
- "Next" button advances steps, final step saves to Supabase and sets `onboarding_completed = true`

**Step 2: Add onboarding redirect to root layout**

Modify `app/_layout.tsx` to check `profiles.onboarding_completed`. If false and user is authenticated, redirect to `/onboarding` instead of tabs.

```typescript
useEffect(() => {
  if (loading) return;
  const inAuthGroup = segments[0] === "(auth)";
  const inOnboarding = segments[0] === "onboarding";

  if (!session && !inAuthGroup) {
    router.replace("/(auth)/login");
  } else if (session && inAuthGroup) {
    // Check onboarding
    checkOnboarding();
  }
}, [session, loading, segments]);

async function checkOnboarding() {
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", session!.user.id)
    .single();

  if (!data?.onboarding_completed) {
    router.replace("/onboarding");
  } else {
    router.replace("/(tabs)");
  }
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: implement onboarding flow with skill level, dietary, and pantry setup"
```
