# Project Lutuin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered Filipino kitchen companion web app where users manage their pantry, get personalized dish suggestions from a Chef AI, chat with the Chef to plan meals, and cook step-by-step.

**Architecture:** Next.js App Router with Supabase (auth, database, RLS) and Claude API (Anthropic SDK) for AI features. AI-First approach — Claude is the core engine for suggestions, chat, and personalization.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Supabase (@supabase/ssr), Anthropic SDK (@anthropic-ai/sdk)

---

## Phase 1: Foundation

### Task 1: Project Scaffolding

**Files:**
- Create: `lutuin/` (Next.js project root)
- Create: `.env.local`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/middleware.ts`

**Step 1: Initialize Next.js project**

Run from `/home/grphx/lutuin`:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```
Expected: Project scaffolded with App Router, TypeScript, Tailwind, src/ directory.

**Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk
npm install -D supabase
```

**Step 3: Create `.env.local`**

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

**Step 4: Create Supabase browser client**

File: `src/lib/supabase/client.ts`
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 5: Create Supabase server client**

File: `src/lib/supabase/server.ts`
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — safe to ignore
          }
        },
      },
    }
  );
}
```

**Step 6: Create middleware for auth session refresh**

File: `src/middleware.ts`
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/signup") &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    request.nextUrl.pathname !== "/"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Step 7: Verify dev server starts**

```bash
npm run dev
```
Expected: App runs at localhost:3000.

**Step 8: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js project with Supabase and Anthropic SDK"
```

---

### Task 2: Supabase Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Step 1: Initialize Supabase locally**

```bash
npx supabase init
```

**Step 2: Write migration file**

File: `supabase/migrations/001_initial_schema.sql`
```sql
-- User profiles (extends Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  skill_level text check (skill_level in ('beginner', 'intermediate', 'advanced')) default 'beginner',
  dietary_restrictions text[] default '{}',
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Master ingredient list
create table public.ingredients (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  category text not null check (category in ('protein', 'vegetable', 'fruit', 'spice', 'pantry_staple', 'dairy', 'grain', 'sauce_condiment', 'other')),
  common_in_ph boolean default false,
  aliases text[] default '{}',
  created_at timestamptz default now()
);

-- User's pantry
create table public.user_pantry (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  ingredient_id uuid references public.ingredients(id) on delete cascade not null,
  quantity_level text check (quantity_level in ('plenty', 'some', 'running_low')) default 'some',
  added_at timestamptz default now(),
  unique(user_id, ingredient_id)
);

-- Curated recipes
create table public.recipes (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  cuisine text default 'filipino',
  difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')) not null,
  cook_time_minutes integer not null,
  servings integer default 4,
  steps jsonb not null default '[]',
  image_url text,
  created_at timestamptz default now()
);

-- Recipe-ingredient mapping
create table public.recipe_ingredients (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references public.recipes(id) on delete cascade not null,
  ingredient_id uuid references public.ingredients(id) on delete cascade not null,
  amount text,
  unit text,
  is_optional boolean default false
);

-- Cooking sessions (history + feedback)
create table public.cooking_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  recipe_id uuid references public.recipes(id) on delete set null,
  chef_chat_history jsonb default '[]',
  rating integer check (rating between 1 and 5),
  difficulty_feedback text check (difficulty_feedback in ('too_easy', 'just_right', 'too_hard')),
  completed_at timestamptz default now()
);

-- User preferences (learned over time)
create table public.user_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade unique not null,
  preferred_cuisines text[] default '{filipino}',
  avoided_ingredients uuid[] default '{}',
  flavor_preferences text[] default '{}',
  updated_at timestamptz default now()
);

-- Usage tracking for freemium gating
create table public.daily_usage (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date default current_date not null,
  suggestion_count integer default 0,
  chat_message_count integer default 0,
  unique(user_id, date)
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.user_pantry enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.cooking_sessions enable row level security;
alter table public.user_preferences enable row level security;
alter table public.daily_usage enable row level security;

-- Profiles: users can read/update their own
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Ingredients: everyone can read
create policy "Anyone can view ingredients" on public.ingredients for select using (true);

-- Recipes: everyone can read
create policy "Anyone can view recipes" on public.recipes for select using (true);
create policy "Anyone can view recipe ingredients" on public.recipe_ingredients for select using (true);

-- User pantry: users can CRUD their own
create policy "Users can view own pantry" on public.user_pantry for select using (auth.uid() = user_id);
create policy "Users can add to own pantry" on public.user_pantry for insert with check (auth.uid() = user_id);
create policy "Users can update own pantry" on public.user_pantry for update using (auth.uid() = user_id);
create policy "Users can delete from own pantry" on public.user_pantry for delete using (auth.uid() = user_id);

-- Cooking sessions: users can CRUD their own
create policy "Users can view own sessions" on public.cooking_sessions for select using (auth.uid() = user_id);
create policy "Users can create own sessions" on public.cooking_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" on public.cooking_sessions for update using (auth.uid() = user_id);

-- User preferences: users can CRUD their own
create policy "Users can view own preferences" on public.user_preferences for select using (auth.uid() = user_id);
create policy "Users can upsert own preferences" on public.user_preferences for insert with check (auth.uid() = user_id);
create policy "Users can update own preferences" on public.user_preferences for update using (auth.uid() = user_id);

-- Daily usage: users can CRUD their own
create policy "Users can view own usage" on public.daily_usage for select using (auth.uid() = user_id);
create policy "Users can insert own usage" on public.daily_usage for insert with check (auth.uid() = user_id);
create policy "Users can update own usage" on public.daily_usage for update using (auth.uid() = user_id);

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  insert into public.user_preferences (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

**Step 3: Apply migration to Supabase project**

If using Supabase cloud dashboard: paste the SQL into the SQL Editor and run.
If using CLI: `npx supabase db push`

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Supabase database schema with RLS policies"
```

---

### Task 3: Auth Pages

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/signup/page.tsx`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/components/auth/login-form.tsx`
- Create: `src/components/auth/signup-form.tsx`

**Step 1: Create auth callback route handler**

File: `src/app/auth/callback/route.ts`
```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

**Step 2: Create login form component**

File: `src/components/auth/login-form.tsx`
```tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <form onSubmit={handleEmailLogin} className="space-y-4 w-full max-w-sm">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full px-4 py-3 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="w-full px-4 py-3 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium"
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-stone-500">or</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleGoogleLogin}
        className="w-full py-3 border border-stone-300 rounded-lg hover:bg-stone-50 font-medium"
      >
        Continue with Google
      </button>
    </form>
  );
}
```

**Step 3: Create signup form component**

File: `src/components/auth/signup-form.tsx`
```tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/onboarding");
      router.refresh();
    }
  }

  async function handleGoogleSignup() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <form onSubmit={handleSignup} className="space-y-4 w-full max-w-sm">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full px-4 py-3 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <input
        type="password"
        placeholder="Password (min 6 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        className="w-full px-4 py-3 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium"
      >
        {loading ? "Creating account..." : "Create Account"}
      </button>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-stone-500">or</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleGoogleSignup}
        className="w-full py-3 border border-stone-300 rounded-lg hover:bg-stone-50 font-medium"
      >
        Continue with Google
      </button>
    </form>
  );
}
```

**Step 4: Create login page**

File: `src/app/login/page.tsx`
```tsx
import LoginForm from "@/components/auth/login-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
      <h1 className="text-3xl font-bold text-stone-800 mb-2">Welcome Back</h1>
      <p className="text-stone-500 mb-8">Sign in to your kitchen</p>
      <LoginForm />
      <p className="mt-6 text-stone-500 text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-amber-600 hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
```

**Step 5: Create signup page**

File: `src/app/signup/page.tsx`
```tsx
import SignupForm from "@/components/auth/signup-form";
import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
      <h1 className="text-3xl font-bold text-stone-800 mb-2">Join Project Lutuin</h1>
      <p className="text-stone-500 mb-8">Your AI Filipino Kitchen Companion</p>
      <SignupForm />
      <p className="mt-6 text-stone-500 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-amber-600 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
```

**Step 6: Test auth flow manually**

- Navigate to `/signup`, create account
- Check Supabase dashboard for new user + profile row
- Navigate to `/login`, sign in
- Verify redirect to `/dashboard`

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: add auth pages with email and Google OAuth"
```

---

## Phase 2: Core Data & Onboarding

### Task 4: Onboarding Flow

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Create: `src/components/onboarding/skill-step.tsx`
- Create: `src/components/onboarding/dietary-step.tsx`
- Create: `src/components/onboarding/pantry-step.tsx`

**Step 1: Create skill level step component**

File: `src/components/onboarding/skill-step.tsx`
```tsx
"use client";

const SKILL_LEVELS = [
  {
    value: "beginner",
    label: "Beginner",
    description: "I can follow basic recipes and know kitchen basics",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    description: "I cook regularly and can handle most recipes",
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "I'm comfortable with complex techniques and improvising",
  },
] as const;

export default function SkillStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-stone-800">
        What&apos;s your cooking level?
      </h2>
      <p className="text-stone-500">This helps us suggest the right recipes for you.</p>
      <div className="space-y-3">
        {SKILL_LEVELS.map((level) => (
          <button
            key={level.value}
            type="button"
            onClick={() => onChange(level.value)}
            className={`w-full p-4 rounded-xl border-2 text-left transition ${
              value === level.value
                ? "border-amber-500 bg-amber-50"
                : "border-stone-200 hover:border-stone-300"
            }`}
          >
            <div className="font-semibold text-stone-800">{level.label}</div>
            <div className="text-sm text-stone-500">{level.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Create dietary restrictions step component**

File: `src/components/onboarding/dietary-step.tsx`
```tsx
"use client";

const DIETARY_OPTIONS = [
  "No restrictions",
  "No pork",
  "No beef",
  "No seafood",
  "Vegetarian",
  "Vegan",
  "No nuts",
  "No dairy",
  "Halal",
];

export default function DietaryStep({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(option: string) {
    if (option === "No restrictions") {
      onChange(["No restrictions"]);
      return;
    }
    const filtered = value.filter((v) => v !== "No restrictions");
    if (filtered.includes(option)) {
      onChange(filtered.filter((v) => v !== option));
    } else {
      onChange([...filtered, option]);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-stone-800">
        Any dietary restrictions?
      </h2>
      <p className="text-stone-500">Select all that apply. We&apos;ll never suggest dishes that conflict.</p>
      <div className="flex flex-wrap gap-2">
        {DIETARY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`px-4 py-2 rounded-full border transition text-sm ${
              value.includes(option)
                ? "bg-amber-500 text-white border-amber-500"
                : "border-stone-300 text-stone-600 hover:border-stone-400"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Create quick pantry add step component**

File: `src/components/onboarding/pantry-step.tsx`
```tsx
"use client";

const COMMON_PH_STAPLES = [
  "Garlic", "Onion", "Rice", "Soy Sauce", "Vinegar",
  "Fish Sauce (Patis)", "Calamansi", "Salt", "Pepper",
  "Cooking Oil", "Tomato", "Ginger", "Bay Leaves",
  "Coconut Milk", "Brown Sugar", "Oyster Sauce",
];

export default function PantryStep({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(item: string) {
    if (value.includes(item)) {
      onChange(value.filter((v) => v !== item));
    } else {
      onChange([...value, item]);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-stone-800">
        What&apos;s in your kusina?
      </h2>
      <p className="text-stone-500">
        Tap the common staples you usually have. You can add more later.
      </p>
      <div className="flex flex-wrap gap-2">
        {COMMON_PH_STAPLES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => toggle(item)}
            className={`px-4 py-2 rounded-full border transition text-sm ${
              value.includes(item)
                ? "bg-amber-500 text-white border-amber-500"
                : "border-stone-300 text-stone-600 hover:border-stone-400"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <p className="text-xs text-stone-400">
        Selected: {value.length} items
      </p>
    </div>
  );
}
```

**Step 4: Create onboarding page (orchestrates the 3 steps)**

File: `src/app/onboarding/page.tsx`
```tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SkillStep from "@/components/onboarding/skill-step";
import DietaryStep from "@/components/onboarding/dietary-step";
import PantryStep from "@/components/onboarding/pantry-step";

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [skillLevel, setSkillLevel] = useState("beginner");
  const [dietary, setDietary] = useState<string[]>(["No restrictions"]);
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleComplete() {
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Update profile
    await supabase
      .from("profiles")
      .update({
        skill_level: skillLevel,
        dietary_restrictions: dietary.includes("No restrictions") ? [] : dietary,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    // Add pantry items — look up ingredient IDs by name
    if (pantryItems.length > 0) {
      const { data: ingredients } = await supabase
        .from("ingredients")
        .select("id, name")
        .in("name", pantryItems);

      if (ingredients && ingredients.length > 0) {
        await supabase.from("user_pantry").insert(
          ingredients.map((ing) => ({
            user_id: user.id,
            ingredient_id: ing.id,
            quantity_level: "some",
          }))
        );
      }
    }

    router.push("/dashboard");
    router.refresh();
  }

  const steps = [
    <SkillStep key="skill" value={skillLevel} onChange={setSkillLevel} />,
    <DietaryStep key="dietary" value={dietary} onChange={setDietary} />,
    <PantryStep key="pantry" value={pantryItems} onChange={setPantryItems} />,
  ];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition ${
                i === step ? "bg-amber-500" : i < step ? "bg-amber-300" : "bg-stone-300"
              }`}
            />
          ))}
        </div>

        {steps[step]}

        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-3 border border-stone-300 rounded-lg hover:bg-stone-100 font-medium"
            >
              Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex-1 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={saving}
              className="flex-1 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium"
            >
              {saving ? "Setting up..." : "Start Cooking!"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
```

**Step 5: Test onboarding flow manually**

- Sign up → redirected to `/onboarding`
- Go through 3 steps → verify profile updated in Supabase dashboard
- Verify redirect to `/dashboard`

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add 3-step onboarding flow"
```

---

### Task 5: Seed Ingredient & Recipe Data

**Files:**
- Create: `scripts/seed-ingredients.ts`
- Create: `scripts/seed-recipes.ts`

**Step 1: Create ingredient seed script**

File: `scripts/seed-ingredients.ts`
```typescript
// Run with: npx tsx scripts/seed-ingredients.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ingredients = [
  // Proteins
  { name: "Chicken", category: "protein", common_in_ph: true },
  { name: "Pork Belly", category: "protein", common_in_ph: true },
  { name: "Pork Shoulder", category: "protein", common_in_ph: true },
  { name: "Ground Pork", category: "protein", common_in_ph: true },
  { name: "Bangus (Milkfish)", category: "protein", common_in_ph: true },
  { name: "Tilapia", category: "protein", common_in_ph: true },
  { name: "Shrimp", category: "protein", common_in_ph: true },
  { name: "Squid", category: "protein", common_in_ph: true },
  { name: "Beef", category: "protein", common_in_ph: true },
  { name: "Eggs", category: "protein", common_in_ph: true },
  { name: "Tofu", category: "protein", common_in_ph: true },

  // Vegetables
  { name: "Onion", category: "vegetable", common_in_ph: true },
  { name: "Garlic", category: "vegetable", common_in_ph: true },
  { name: "Tomato", category: "vegetable", common_in_ph: true },
  { name: "Ginger", category: "vegetable", common_in_ph: true },
  { name: "Kangkong (Water Spinach)", category: "vegetable", common_in_ph: true },
  { name: "Sitaw (String Beans)", category: "vegetable", common_in_ph: true },
  { name: "Eggplant", category: "vegetable", common_in_ph: true },
  { name: "Ampalaya (Bitter Melon)", category: "vegetable", common_in_ph: true },
  { name: "Kalabasa (Squash)", category: "vegetable", common_in_ph: true },
  { name: "Sayote (Chayote)", category: "vegetable", common_in_ph: true },
  { name: "Green Beans", category: "vegetable", common_in_ph: true },
  { name: "Pechay (Bok Choy)", category: "vegetable", common_in_ph: true },
  { name: "Potato", category: "vegetable", common_in_ph: true },
  { name: "Carrots", category: "vegetable", common_in_ph: true },
  { name: "Green Chili (Siling Haba)", category: "vegetable", common_in_ph: true },
  { name: "Bell Pepper", category: "vegetable", common_in_ph: true },

  // Fruits
  { name: "Calamansi", category: "fruit", common_in_ph: true },
  { name: "Tamarind", category: "fruit", common_in_ph: true },
  { name: "Green Mango", category: "fruit", common_in_ph: true },
  { name: "Banana (Saba)", category: "fruit", common_in_ph: true },

  // Spices
  { name: "Bay Leaves", category: "spice", common_in_ph: true },
  { name: "Black Pepper", category: "spice", common_in_ph: true },
  { name: "Salt", category: "spice", common_in_ph: true },
  { name: "Paprika", category: "spice", common_in_ph: false },
  { name: "Chili Flakes", category: "spice", common_in_ph: true },
  { name: "Annatto (Atsuete)", category: "spice", common_in_ph: true },

  // Pantry staples
  { name: "Rice", category: "pantry_staple", common_in_ph: true },
  { name: "Cooking Oil", category: "pantry_staple", common_in_ph: true },
  { name: "All-Purpose Flour", category: "pantry_staple", common_in_ph: true },
  { name: "Cornstarch", category: "pantry_staple", common_in_ph: true },
  { name: "Brown Sugar", category: "pantry_staple", common_in_ph: true },
  { name: "White Sugar", category: "pantry_staple", common_in_ph: true },

  // Sauces & Condiments
  { name: "Soy Sauce", category: "sauce_condiment", common_in_ph: true },
  { name: "Vinegar", category: "sauce_condiment", common_in_ph: true },
  { name: "Fish Sauce (Patis)", category: "sauce_condiment", common_in_ph: true },
  { name: "Oyster Sauce", category: "sauce_condiment", common_in_ph: true },
  { name: "Shrimp Paste (Bagoong)", category: "sauce_condiment", common_in_ph: true },
  { name: "Tomato Sauce", category: "sauce_condiment", common_in_ph: true },
  { name: "Banana Ketchup", category: "sauce_condiment", common_in_ph: true },
  { name: "Coconut Milk", category: "sauce_condiment", common_in_ph: true },
  { name: "Coconut Cream", category: "sauce_condiment", common_in_ph: true },
  { name: "Worcestershire Sauce", category: "sauce_condiment", common_in_ph: false },
];

async function seed() {
  const { data, error } = await supabase
    .from("ingredients")
    .upsert(ingredients, { onConflict: "name" })
    .select();

  if (error) {
    console.error("Error seeding ingredients:", error);
  } else {
    console.log(`Seeded ${data.length} ingredients`);
  }
}

seed();
```

**Step 2: Create recipe seed script with 10 starter Filipino recipes**

File: `scripts/seed-recipes.ts`
```typescript
// Run with: npx tsx scripts/seed-recipes.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper to look up ingredient IDs by name
async function getIngredientMap(): Promise<Record<string, string>> {
  const { data } = await supabase.from("ingredients").select("id, name");
  const map: Record<string, string> = {};
  data?.forEach((i) => (map[i.name] = i.id));
  return map;
}

const recipes = [
  {
    name: "Chicken Adobo",
    description: "The quintessential Filipino dish — chicken braised in soy sauce, vinegar, garlic, and bay leaves.",
    cuisine: "filipino",
    difficulty: "beginner",
    cook_time_minutes: 45,
    servings: 4,
    steps: [
      { step: 1, instruction: "In a large pot, combine chicken pieces, soy sauce, vinegar, crushed garlic, bay leaves, and black peppercorns.", tip: "Don't stir the vinegar once it starts simmering — let it cook down naturally for better flavor." },
      { step: 2, instruction: "Bring to a boil, then reduce heat and simmer for 30 minutes until chicken is tender.", tip: "The longer you simmer, the more tender the chicken gets." },
      { step: 3, instruction: "Remove chicken pieces and fry in a hot pan with oil until golden brown.", tip: "Pat the chicken dry before frying for crispier skin." },
      { step: 4, instruction: "Reduce the remaining sauce until slightly thickened. Pour over the fried chicken.", tip: null },
      { step: 5, instruction: "Serve hot over steamed rice.", tip: "Adobo tastes even better the next day as the flavors deepen." },
    ],
    ingredients: [
      { name: "Chicken", amount: "1 kg", unit: "pieces", is_optional: false },
      { name: "Soy Sauce", amount: "1/2", unit: "cup", is_optional: false },
      { name: "Vinegar", amount: "1/4", unit: "cup", is_optional: false },
      { name: "Garlic", amount: "1", unit: "head", is_optional: false },
      { name: "Bay Leaves", amount: "3", unit: "pieces", is_optional: false },
      { name: "Black Pepper", amount: "1", unit: "tsp", is_optional: false },
      { name: "Cooking Oil", amount: "2", unit: "tbsp", is_optional: false },
      { name: "Rice", amount: "4", unit: "cups", is_optional: false },
    ],
  },
  {
    name: "Sinigang na Baboy",
    description: "A sour tamarind-based pork soup loaded with vegetables — the ultimate Filipino comfort food.",
    cuisine: "filipino",
    difficulty: "beginner",
    cook_time_minutes: 60,
    servings: 6,
    steps: [
      { step: 1, instruction: "Boil pork pieces in a large pot of water. Skim off the scum that rises to the surface.", tip: "Using pork ribs or belly gives the best flavor." },
      { step: 2, instruction: "Add onion and tomato. Simmer for 30 minutes until pork is tender.", tip: null },
      { step: 3, instruction: "Add tamarind soup base (or fresh tamarind pulp). Stir well.", tip: "For a more natural sourness, boil fresh tamarind in water and strain." },
      { step: 4, instruction: "Add harder vegetables first (radish, string beans, eggplant). Cook 5 minutes.", tip: null },
      { step: 5, instruction: "Add kangkong and green chili. Season with fish sauce to taste.", tip: "Add kangkong last — it wilts quickly and overcooking makes it slimy." },
      { step: 6, instruction: "Serve hot with steamed rice.", tip: "Sinigang is traditionally a rainy-day comfort food." },
    ],
    ingredients: [
      { name: "Pork Belly", amount: "500", unit: "g", is_optional: false },
      { name: "Tamarind", amount: "1", unit: "packet sinigang mix", is_optional: false },
      { name: "Kangkong (Water Spinach)", amount: "1", unit: "bunch", is_optional: false },
      { name: "Sitaw (String Beans)", amount: "1", unit: "bundle", is_optional: false },
      { name: "Eggplant", amount: "2", unit: "pieces", is_optional: false },
      { name: "Tomato", amount: "2", unit: "pieces", is_optional: false },
      { name: "Onion", amount: "1", unit: "large", is_optional: false },
      { name: "Green Chili (Siling Haba)", amount: "3", unit: "pieces", is_optional: true },
      { name: "Fish Sauce (Patis)", amount: "2", unit: "tbsp", is_optional: false },
      { name: "Rice", amount: "4", unit: "cups", is_optional: false },
    ],
  },
  {
    name: "Pancit Canton",
    description: "Stir-fried egg noodles with vegetables and meat — a Filipino party staple.",
    cuisine: "filipino",
    difficulty: "beginner",
    cook_time_minutes: 25,
    servings: 4,
    steps: [
      { step: 1, instruction: "Cook canton noodles according to package directions. Drain and set aside.", tip: "Slightly undercook the noodles since they'll continue cooking in the pan." },
      { step: 2, instruction: "Saut&eacute; garlic and onion in oil until fragrant. Add sliced chicken or pork, cook through.", tip: null },
      { step: 3, instruction: "Add carrots and green beans. Stir-fry for 2-3 minutes.", tip: null },
      { step: 4, instruction: "Add soy sauce, oyster sauce, and a splash of water. Toss in the noodles.", tip: "Keep the heat high and toss quickly so noodles don't clump." },
      { step: 5, instruction: "Toss everything together until well combined. Squeeze calamansi on top before serving.", tip: "The calamansi brightens everything — don't skip it!" },
    ],
    ingredients: [
      { name: "Chicken", amount: "200", unit: "g", is_optional: false },
      { name: "Garlic", amount: "4", unit: "cloves", is_optional: false },
      { name: "Onion", amount: "1", unit: "medium", is_optional: false },
      { name: "Carrots", amount: "1", unit: "medium", is_optional: false },
      { name: "Green Beans", amount: "100", unit: "g", is_optional: false },
      { name: "Soy Sauce", amount: "3", unit: "tbsp", is_optional: false },
      { name: "Oyster Sauce", amount: "2", unit: "tbsp", is_optional: false },
      { name: "Calamansi", amount: "4", unit: "pieces", is_optional: false },
      { name: "Cooking Oil", amount: "2", unit: "tbsp", is_optional: false },
    ],
  },
];

async function seed() {
  const ingredientMap = await getIngredientMap();

  for (const recipe of recipes) {
    const { ingredients: recipeIngredients, ...recipeData } = recipe;

    // Insert recipe
    const { data: insertedRecipe, error: recipeError } = await supabase
      .from("recipes")
      .insert(recipeData)
      .select()
      .single();

    if (recipeError) {
      console.error(`Error inserting ${recipe.name}:`, recipeError);
      continue;
    }

    // Insert recipe-ingredient mappings
    const mappings = recipeIngredients
      .filter((ri) => ingredientMap[ri.name])
      .map((ri) => ({
        recipe_id: insertedRecipe.id,
        ingredient_id: ingredientMap[ri.name],
        amount: ri.amount,
        unit: ri.unit,
        is_optional: ri.is_optional,
      }));

    const { error: mappingError } = await supabase
      .from("recipe_ingredients")
      .insert(mappings);

    if (mappingError) {
      console.error(`Error inserting ingredients for ${recipe.name}:`, mappingError);
    } else {
      console.log(`Seeded: ${recipe.name} (${mappings.length} ingredients)`);
    }
  }
}

seed();
```

**Step 3: Run seed scripts**

```bash
npx tsx scripts/seed-ingredients.ts
npx tsx scripts/seed-recipes.ts
```
Expected: Ingredients and 3 starter recipes seeded. More recipes to be added incrementally.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add ingredient and recipe seed data"
```

---

## Phase 3: Pantry & AI Features

### Task 6: Pantry Management (My Kusina)

**Files:**
- Create: `src/app/dashboard/kusina/page.tsx`
- Create: `src/components/kusina/ingredient-search.tsx`
- Create: `src/components/kusina/pantry-grid.tsx`

**Step 1: Create ingredient search component**

File: `src/components/kusina/ingredient-search.tsx`
```tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

type Ingredient = { id: string; name: string; category: string };

export default function IngredientSearch({
  onAdd,
}: {
  onAdd: (ingredient: Ingredient) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Ingredient[]>([]);
  const supabase = createClient();

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const { data } = await supabase
      .from("ingredients")
      .select("id, name, category")
      .ilike("name", `%${q}%`)
      .limit(10);
    setResults(data ?? []);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search ingredients to add..."
        className="w-full px-4 py-3 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      {results.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((ing) => (
            <li key={ing.id}>
              <button
                type="button"
                onClick={() => {
                  onAdd(ing);
                  setQuery("");
                  setResults([]);
                }}
                className="w-full px-4 py-3 text-left hover:bg-amber-50 flex justify-between"
              >
                <span>{ing.name}</span>
                <span className="text-xs text-stone-400">{ing.category}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Step 2: Create pantry grid component**

File: `src/components/kusina/pantry-grid.tsx`
```tsx
"use client";

import { createClient } from "@/lib/supabase/client";

type PantryItem = {
  id: string;
  quantity_level: string;
  ingredients: { id: string; name: string; category: string };
};

const QUANTITY_COLORS = {
  plenty: "bg-green-100 text-green-700 border-green-300",
  some: "bg-amber-100 text-amber-700 border-amber-300",
  running_low: "bg-red-100 text-red-700 border-red-300",
};

const QUANTITY_CYCLE = ["plenty", "some", "running_low"] as const;

export default function PantryGrid({
  items,
  onUpdate,
}: {
  items: PantryItem[];
  onUpdate: () => void;
}) {
  const supabase = createClient();

  async function cycleQuantity(item: PantryItem) {
    const currentIndex = QUANTITY_CYCLE.indexOf(
      item.quantity_level as (typeof QUANTITY_CYCLE)[number]
    );
    const next = QUANTITY_CYCLE[(currentIndex + 1) % QUANTITY_CYCLE.length];
    await supabase
      .from("user_pantry")
      .update({ quantity_level: next })
      .eq("id", item.id);
    onUpdate();
  }

  async function removeItem(id: string) {
    await supabase.from("user_pantry").delete().eq("id", id);
    onUpdate();
  }

  const grouped = items.reduce(
    (acc, item) => {
      const cat = item.ingredients.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {} as Record<string, PantryItem[]>
  );

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">
            {category.replace("_", " ")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {catItems.map((item) => (
              <div
                key={item.id}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm cursor-pointer ${
                  QUANTITY_COLORS[item.quantity_level as keyof typeof QUANTITY_COLORS]
                }`}
              >
                <span onClick={() => cycleQuantity(item)}>
                  {item.ingredients.name}
                </span>
                <button
                  onClick={() => removeItem(item.id)}
                  className="ml-1 opacity-50 hover:opacity-100"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Create My Kusina page**

File: `src/app/dashboard/kusina/page.tsx`
```tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import IngredientSearch from "@/components/kusina/ingredient-search";
import PantryGrid from "@/components/kusina/pantry-grid";

export default function KusinaPage() {
  const [items, setItems] = useState<any[]>([]);
  const supabase = createClient();

  const fetchPantry = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("user_pantry")
      .select("id, quantity_level, ingredients(id, name, category)")
      .eq("user_id", user.id)
      .order("added_at", { ascending: false });

    setItems(data ?? []);
  }, [supabase]);

  useEffect(() => {
    fetchPantry();
  }, [fetchPantry]);

  async function handleAdd(ingredient: { id: string; name: string }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("user_pantry").upsert(
      {
        user_id: user.id,
        ingredient_id: ingredient.id,
        quantity_level: "some",
      },
      { onConflict: "user_id,ingredient_id" }
    );
    fetchPantry();
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">My Kusina</h1>
      <p className="text-stone-500">
        {items.length} ingredients in your kitchen. Tap an item to cycle its quantity.
      </p>
      <IngredientSearch onAdd={handleAdd} />
      <PantryGrid items={items} onUpdate={fetchPantry} />
    </div>
  );
}
```

**Step 4: Test pantry flow manually**

- Navigate to `/dashboard/kusina`
- Search and add ingredients
- Tap to cycle quantity
- Remove items
- Verify data in Supabase dashboard

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add pantry management (My Kusina)"
```

---

### Task 7: Chef AI System Prompt & Suggestion Endpoint

**Files:**
- Create: `src/lib/chef-ai.ts`
- Create: `src/app/api/chef/suggest/route.ts`

**Step 1: Create Chef AI utility with system prompt**

File: `src/lib/chef-ai.ts`
```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
- When suggesting dishes, return structured JSON as specified in the user message`;

export { anthropic };
```

**Step 2: Create suggestion endpoint**

File: `src/app/api/chef/suggest/route.ts`
```typescript
import { createClient } from "@/lib/supabase/server";
import { anthropic, CHEF_SYSTEM_PROMPT } from "@/lib/chef-ai";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check daily usage limit
  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("suggestion_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .single();

  if (usage && usage.suggestion_count >= 5) {
    return NextResponse.json(
      { error: "Daily suggestion limit reached. Upgrade to premium for unlimited suggestions." },
      { status: 429 }
    );
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("skill_level, dietary_restrictions")
    .eq("id", user.id)
    .single();

  // Fetch user pantry
  const { data: pantry } = await supabase
    .from("user_pantry")
    .select("quantity_level, ingredients(name)")
    .eq("user_id", user.id);

  // Fetch recent cooking sessions
  const { data: recentSessions } = await supabase
    .from("cooking_sessions")
    .select("recipes(name), rating, difficulty_feedback")
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false })
    .limit(10);

  // Fetch available recipes for context
  const { data: recipes } = await supabase
    .from("recipes")
    .select("name, description, difficulty, cook_time_minutes, recipe_ingredients(ingredients(name), is_optional)")
    .limit(50);

  const pantryList = pantry?.map((p: any) => `${p.ingredients.name} (${p.quantity_level})`) ?? [];
  const recentDishes = recentSessions?.map((s: any) => `${s.recipes?.name} (rated ${s.rating}/5, ${s.difficulty_feedback})`).filter(Boolean) ?? [];

  const userMessage = `Here is the user's context:

SKILL LEVEL: ${profile?.skill_level ?? "beginner"}
DIETARY RESTRICTIONS: ${profile?.dietary_restrictions?.length ? profile.dietary_restrictions.join(", ") : "None"}

PANTRY (what they have):
${pantryList.join("\n")}

RECENT DISHES:
${recentDishes.length ? recentDishes.join("\n") : "None yet — this might be their first time!"}

AVAILABLE RECIPES IN OUR DATABASE:
${recipes?.map((r: any) => {
  const ings = r.recipe_ingredients?.map((ri: any) => ri.ingredients.name).join(", ");
  return `- ${r.name} (${r.difficulty}, ${r.cook_time_minutes}min): needs ${ings}`;
}).join("\n")}

Based on this, suggest 3-5 dishes they can cook right now. Prioritize recipes from our database but you can also suggest dishes not in our DB if they're a good fit.

Return ONLY valid JSON in this format:
{
  "suggestions": [
    {
      "name": "Dish Name",
      "description": "Brief appealing description",
      "match_percentage": 85,
      "difficulty": "beginner",
      "cook_time_minutes": 45,
      "missing_ingredients": ["ingredient1"],
      "in_database": true,
      "encouragement": "A short encouraging note from Chef Luto"
    }
  ]
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: CHEF_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  // Increment usage
  await supabase.from("daily_usage").upsert(
    {
      user_id: user.id,
      date: today,
      suggestion_count: (usage?.suggestion_count ?? 0) + 1,
    },
    { onConflict: "user_id,date" }
  );

  const textContent = message.content.find((c) => c.type === "text");
  try {
    const jsonText = textContent?.text ?? "";
    // Extract JSON from potential markdown code blocks
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] ?? jsonText);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ raw: textContent?.text }, { status: 200 });
  }
}
```

**Step 3: Test endpoint**

```bash
curl -X POST http://localhost:3000/api/chef/suggest -H "Cookie: <auth_cookie>"
```
Expected: JSON with 3-5 dish suggestions.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Chef AI system prompt and suggestion endpoint"
```

---

### Task 8: Chef Chat (Streaming)

**Files:**
- Create: `src/app/api/chef/chat/route.ts`
- Create: `src/components/chef/chat-interface.tsx`
- Create: `src/app/dashboard/chef/page.tsx`

**Step 1: Create streaming chat endpoint**

File: `src/app/api/chef/chat/route.ts`
```typescript
import { createClient } from "@/lib/supabase/server";
import { anthropic, CHEF_SYSTEM_PROMPT } from "@/lib/chef-ai";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Check daily chat limit
  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("chat_message_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .single();

  if (usage && usage.chat_message_count >= 10) {
    return new Response(
      JSON.stringify({ error: "Daily chat limit reached. Upgrade to premium for unlimited chat." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages, dish, pantry, skillLevel } = await request.json();

  // Fetch profile for dietary restrictions
  const { data: profile } = await supabase
    .from("profiles")
    .select("dietary_restrictions")
    .eq("id", user.id)
    .single();

  const contextMessage = `User context:
- Skill level: ${skillLevel ?? "beginner"}
- Dietary restrictions: ${profile?.dietary_restrictions?.join(", ") || "None"}
- Current pantry: ${pantry?.join(", ") || "Not provided"}
${dish ? `- Currently discussing: ${dish}` : "- No specific dish selected yet"}

Respond as Chef Luto. Be conversational, warm, and helpful. Keep responses concise (2-4 paragraphs max).`;

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: CHEF_SYSTEM_PROMPT + "\n\n" + contextMessage,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  });

  // Increment usage
  await supabase.from("daily_usage").upsert(
    {
      user_id: user.id,
      date: today,
      chat_message_count: (usage?.chat_message_count ?? 0) + 1,
    },
    { onConflict: "user_id,date" }
  );

  // Return as SSE stream
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      stream.on("text", (text) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
      });
      stream.on("error", (error) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)
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
```

**Step 2: Create chat interface component**

File: `src/components/chef/chat-interface.tsx`
```tsx
"use client";

import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatInterface({
  dish,
  pantry,
  skillLevel,
}: {
  dish?: string;
  pantry?: string[];
  skillLevel?: string;
}) {
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
      body: JSON.stringify({
        messages: newMessages,
        dish,
        pantry,
        skillLevel,
      }),
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

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
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
              {dish
                ? `Ask me anything about cooking ${dish}`
                : "Tell me what you're in the mood for"}
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                msg.role === "user"
                  ? "bg-amber-500 text-white"
                  : "bg-stone-100 text-stone-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
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
            placeholder="Ask Chef Luto..."
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

**Step 3: Create Chef Chat page**

File: `src/app/dashboard/chef/page.tsx`
```tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import ChatInterface from "@/components/chef/chat-interface";

export default function ChefPage() {
  const [pantry, setPantry] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState("beginner");
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("skill_level")
        .eq("id", user.id)
        .single();

      const { data: pantryData } = await supabase
        .from("user_pantry")
        .select("ingredients(name)")
        .eq("user_id", user.id);

      setSkillLevel(profile?.skill_level ?? "beginner");
      setPantry(pantryData?.map((p: any) => p.ingredients.name) ?? []);
    }
    load();
  }, [supabase]);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <ChatInterface pantry={pantry} skillLevel={skillLevel} />
    </div>
  );
}
```

**Step 4: Test chat flow**

- Navigate to `/dashboard/chef`
- Send a message, verify streaming response from Chef Luto
- Verify daily usage increments in Supabase

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Chef Chat with streaming AI responses"
```

---

## Phase 4: Suggestions & Cooking

### Task 9: Suggestions Page

**Files:**
- Create: `src/components/suggestions/suggestion-card.tsx`
- Create: `src/app/dashboard/suggest/page.tsx`

**Step 1: Create suggestion card component**

File: `src/components/suggestions/suggestion-card.tsx`
```tsx
type Suggestion = {
  name: string;
  description: string;
  match_percentage: number;
  difficulty: string;
  cook_time_minutes: number;
  missing_ingredients: string[];
  encouragement: string;
};

export default function SuggestionCard({
  suggestion,
  onSelect,
}: {
  suggestion: Suggestion;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-5 rounded-xl border border-stone-200 hover:border-amber-400 hover:shadow-md transition bg-white"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-bold text-stone-800">{suggestion.name}</h3>
        <span className="text-sm font-semibold text-amber-600">
          {suggestion.match_percentage}% match
        </span>
      </div>
      <p className="text-stone-500 text-sm mb-3">{suggestion.description}</p>
      <div className="flex gap-3 text-xs text-stone-400 mb-3">
        <span className="capitalize">{suggestion.difficulty}</span>
        <span>{suggestion.cook_time_minutes} min</span>
      </div>
      {suggestion.missing_ingredients.length > 0 && (
        <p className="text-xs text-stone-400">
          Missing: {suggestion.missing_ingredients.join(", ")}
        </p>
      )}
      <p className="text-sm text-amber-700 mt-3 italic">
        {suggestion.encouragement}
      </p>
    </button>
  );
}
```

**Step 2: Create suggestions page**

File: `src/app/dashboard/suggest/page.tsx`
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SuggestionCard from "@/components/suggestions/suggestion-card";

export default function SuggestPage() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function getSuggestions() {
    setLoading(true);
    setError("");

    const res = await fetch("/api/chef/suggest", { method: "POST" });

    if (res.status === 429) {
      setError("You've used all 5 free suggestions today. Upgrade for unlimited!");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setSuggestions(data.suggestions ?? []);
    setLoading(false);
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">What Should I Cook?</h1>

      {suggestions.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-stone-500 mb-6">
            Let Chef Luto look at your kusina and suggest something delicious.
          </p>
          <button
            onClick={getSuggestions}
            className="px-8 py-4 bg-amber-600 text-white rounded-xl hover:bg-amber-700 text-lg font-semibold"
          >
            Suggest Dishes
          </button>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <p className="text-stone-500 animate-pulse">
            Chef Luto is checking your kusina...
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      <div className="space-y-4">
        {suggestions.map((s, i) => (
          <SuggestionCard
            key={i}
            suggestion={s}
            onSelect={() =>
              router.push(`/dashboard/chef?dish=${encodeURIComponent(s.name)}`)
            }
          />
        ))}
      </div>

      {suggestions.length > 0 && (
        <button
          onClick={getSuggestions}
          disabled={loading}
          className="w-full py-3 border border-stone-300 rounded-lg hover:bg-stone-50"
        >
          Get new suggestions
        </button>
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add AI-powered dish suggestions page"
```

---

### Task 10: Cooking Mode

**Files:**
- Create: `src/components/cooking/cooking-mode.tsx`
- Create: `src/components/cooking/step-timer.tsx`
- Create: `src/app/dashboard/cook/page.tsx`

**Step 1: Create step timer component**

File: `src/components/cooking/step-timer.tsx`
```tsx
"use client";

import { useState, useEffect, useRef } from "react";

export default function StepTimer({ minutes }: { minutes: number }) {
  const [seconds, setSeconds] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => s - 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, seconds]);

  useEffect(() => {
    if (seconds === 0 && running) {
      setRunning(false);
      // Simple alert — could be replaced with a nicer notification
      alert("Timer done!");
    }
  }, [seconds, running]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="flex items-center gap-3 bg-stone-100 px-4 py-2 rounded-lg">
      <span className="text-2xl font-mono font-bold text-stone-800">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
      <button
        onClick={() => setRunning(!running)}
        className="px-4 py-1 bg-amber-500 text-white rounded-full text-sm"
      >
        {running ? "Pause" : "Start"}
      </button>
      <button
        onClick={() => {
          setRunning(false);
          setSeconds(minutes * 60);
        }}
        className="px-3 py-1 border border-stone-300 rounded-full text-sm"
      >
        Reset
      </button>
    </div>
  );
}
```

**Step 2: Create cooking mode component**

File: `src/components/cooking/cooking-mode.tsx`
```tsx
"use client";

import { useState } from "react";

type Step = {
  step: number;
  instruction: string;
  tip?: string | null;
  timer_minutes?: number;
};

export default function CookingMode({
  recipeName,
  steps,
  onComplete,
}: {
  recipeName: string;
  steps: Step[];
  onComplete: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="min-h-screen bg-stone-900 text-white flex flex-col items-center justify-center p-6">
      {/* Progress */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex justify-between text-sm text-stone-400 mb-2">
          <span>{recipeName}</span>
          <span>
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
        <div className="w-full bg-stone-700 rounded-full h-2">
          <div
            className="bg-amber-500 h-2 rounded-full transition-all"
            style={{
              width: `${((currentStep + 1) / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="max-w-lg text-center space-y-6">
        <p className="text-2xl md:text-3xl font-medium leading-relaxed">
          {step.instruction}
        </p>

        {step.tip && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-xl px-6 py-4">
            <p className="text-amber-300 text-sm">Chef Luto&apos;s tip: {step.tip}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-4 mt-12">
        {currentStep > 0 && (
          <button
            onClick={() => setCurrentStep(currentStep - 1)}
            className="px-8 py-4 border border-stone-600 rounded-xl text-stone-300 hover:bg-stone-800"
          >
            Previous
          </button>
        )}
        {isLast ? (
          <button
            onClick={onComplete}
            className="px-8 py-4 bg-green-600 rounded-xl text-white hover:bg-green-700 font-semibold"
          >
            Done Cooking!
          </button>
        ) : (
          <button
            onClick={() => setCurrentStep(currentStep + 1)}
            className="px-8 py-4 bg-amber-600 rounded-xl text-white hover:bg-amber-700 font-semibold"
          >
            Next Step
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Create cook page (ties recipe selection to cooking mode)**

File: `src/app/dashboard/cook/page.tsx`
```tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import CookingMode from "@/components/cooking/cooking-mode";

function CookContent() {
  const searchParams = useSearchParams();
  const recipeName = searchParams.get("recipe");
  const [recipe, setRecipe] = useState<any>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(0);
  const [difficulty, setDifficulty] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadRecipe() {
      if (!recipeName) return;
      const { data } = await supabase
        .from("recipes")
        .select("*")
        .ilike("name", recipeName)
        .single();
      setRecipe(data);
    }
    loadRecipe();
  }, [recipeName, supabase]);

  async function handleFeedback() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !recipe) return;

    await supabase.from("cooking_sessions").insert({
      user_id: user.id,
      recipe_id: recipe.id,
      rating,
      difficulty_feedback: difficulty,
    });

    router.push("/dashboard");
  }

  if (!recipeName) {
    return (
      <div className="p-8 text-center text-stone-500">
        No recipe selected. Go to suggestions first.
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="p-8 text-center text-stone-500 animate-pulse">
        Loading recipe...
      </div>
    );
  }

  if (showFeedback) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-6">
        <h2 className="text-2xl font-bold text-stone-800 mb-2">
          Nice work, Chef!
        </h2>
        <p className="text-stone-500 mb-8">How was {recipe.name}?</p>

        {/* Rating */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              className={`w-12 h-12 rounded-full text-lg ${
                n <= rating
                  ? "bg-amber-500 text-white"
                  : "bg-stone-200 text-stone-400"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Difficulty */}
        <div className="flex gap-3 mb-8">
          {[
            { value: "too_easy", label: "Too Easy" },
            { value: "just_right", label: "Just Right" },
            { value: "too_hard", label: "Too Hard" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDifficulty(opt.value)}
              className={`px-4 py-2 rounded-full border text-sm ${
                difficulty === opt.value
                  ? "bg-amber-500 text-white border-amber-500"
                  : "border-stone-300 text-stone-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleFeedback}
          disabled={!rating || !difficulty}
          className="px-8 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 font-medium"
        >
          Submit & Go Home
        </button>
      </div>
    );
  }

  return (
    <CookingMode
      recipeName={recipe.name}
      steps={recipe.steps}
      onComplete={() => setShowFeedback(true)}
    />
  );
}

export default function CookPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <CookContent />
    </Suspense>
  );
}
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add cooking mode with step-by-step UI and feedback"
```

---

## Phase 5: Dashboard & Landing

### Task 11: Dashboard Layout & Home

**Files:**
- Create: `src/app/dashboard/layout.tsx`
- Create: `src/app/dashboard/page.tsx`
- Create: `src/components/layout/nav-bar.tsx`

**Step 1: Create navigation bar**

File: `src/components/layout/nav-bar.tsx`
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/kusina", label: "My Kusina" },
  { href: "/dashboard/suggest", label: "Suggest" },
  { href: "/dashboard/chef", label: "Chef Chat" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-stone-200">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold text-amber-700">
          Lutuin
        </Link>
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                pathname === item.href
                  ? "bg-amber-100 text-amber-700"
                  : "text-stone-500 hover:text-stone-800 hover:bg-stone-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={handleSignOut}
            className="ml-2 px-3 py-2 text-sm text-stone-400 hover:text-stone-600"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
```

**Step 2: Create dashboard layout**

File: `src/app/dashboard/layout.tsx`
```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/layout/nav-bar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check onboarding
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) redirect("/onboarding");

  return (
    <div className="min-h-screen bg-stone-50">
      <NavBar />
      {children}
    </div>
  );
}
```

**Step 3: Create dashboard home page**

File: `src/app/dashboard/page.tsx`
```tsx
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, skill_level")
    .eq("id", user!.id)
    .single();

  const { count: pantryCount } = await supabase
    .from("user_pantry")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id);

  const { data: recentSessions } = await supabase
    .from("cooking_sessions")
    .select("recipes(name), rating, completed_at")
    .eq("user_id", user!.id)
    .order("completed_at", { ascending: false })
    .limit(5);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-8">
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold text-stone-800">
          Kumusta, {profile?.display_name || "Chef"}!
        </h1>
        <p className="text-stone-500 mt-1 capitalize">
          {profile?.skill_level} cook
        </p>
      </div>

      {/* Main CTA */}
      <Link
        href="/dashboard/suggest"
        className="block w-full py-6 bg-amber-600 text-white rounded-2xl text-center hover:bg-amber-700 transition shadow-lg"
      >
        <span className="text-2xl font-bold">What should I cook?</span>
        <br />
        <span className="text-amber-200 text-sm">
          Let Chef Luto check your kusina
        </span>
      </Link>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/dashboard/kusina"
          className="p-4 bg-white rounded-xl border border-stone-200 hover:border-amber-300 transition"
        >
          <div className="text-2xl font-bold text-stone-800">
            {pantryCount ?? 0}
          </div>
          <div className="text-sm text-stone-500">ingredients in kusina</div>
        </Link>
        <Link
          href="/dashboard/chef"
          className="p-4 bg-white rounded-xl border border-stone-200 hover:border-amber-300 transition"
        >
          <div className="text-2xl font-bold text-stone-800">Chef Luto</div>
          <div className="text-sm text-stone-500">Ask me anything</div>
        </Link>
      </div>

      {/* Recent dishes */}
      {recentSessions && recentSessions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-stone-800 mb-3">
            Recent Dishes
          </h2>
          <div className="space-y-2">
            {recentSessions.map((session: any, i: number) => (
              <div
                key={i}
                className="p-3 bg-white rounded-lg border border-stone-200 flex justify-between"
              >
                <span className="text-stone-700">
                  {session.recipes?.name ?? "Unknown dish"}
                </span>
                <span className="text-amber-500">
                  {"*".repeat(session.rating ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add dashboard layout, nav bar, and home page"
```

---

### Task 12: Landing Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Replace default Next.js page with landing page**

File: `src/app/page.tsx`
```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-stone-50">
      <nav className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        <span className="text-xl font-bold text-amber-700">Lutuin</span>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-stone-600 hover:text-stone-800"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-stone-800 leading-tight">
          Your AI Filipino
          <br />
          <span className="text-amber-600">Kitchen Companion</span>
        </h1>
        <p className="mt-6 text-xl text-stone-500 max-w-2xl mx-auto">
          Tell us what&apos;s in your kusina. Chef Luto will suggest delicious
          Filipino dishes you can cook right now — personalized to your skill
          level and taste.
        </p>
        <Link
          href="/signup"
          className="inline-block mt-10 px-8 py-4 bg-amber-600 text-white rounded-xl text-lg font-semibold hover:bg-amber-700 shadow-lg"
        >
          Start Cooking
        </Link>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-16 grid md:grid-cols-3 gap-8">
        <div className="text-center">
          <div className="text-4xl mb-3">🥘</div>
          <h3 className="font-semibold text-stone-800 mb-2">Stock Your Kusina</h3>
          <p className="text-sm text-stone-500">
            Add your ingredients. We&apos;ll remember what you usually have.
          </p>
        </div>
        <div className="text-center">
          <div className="text-4xl mb-3">🤖</div>
          <h3 className="font-semibold text-stone-800 mb-2">Chat with Chef Luto</h3>
          <p className="text-sm text-stone-500">
            Get personalized suggestions and plan your meal together.
          </p>
        </div>
        <div className="text-center">
          <div className="text-4xl mb-3">👨‍🍳</div>
          <h3 className="font-semibold text-stone-800 mb-2">Cook Step-by-Step</h3>
          <p className="text-sm text-stone-500">
            Follow guided instructions with tips from your AI chef.
          </p>
        </div>
      </section>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add landing page"
```

---

## Phase 6: Final Polish

### Task 13: Tailwind Theme & Global Styles

**Files:**
- Modify: `tailwind.config.ts` — extend theme with earthy color palette
- Modify: `src/app/globals.css` — add base styles
- Modify: `src/app/layout.tsx` — add font (Inter or similar), metadata

**Step 1: Update global layout with metadata and font**

File: `src/app/layout.tsx`
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lutuin — Your AI Filipino Kitchen Companion",
  description:
    "Tell us what's in your kusina. Chef Luto suggests delicious Filipino dishes personalized to your skill level.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: finalize layout, metadata, and global styles"
```

---

### Task 14: Manual Integration Testing

**No files to create — this is a testing checklist.**

**Step 1: Test full user journey**
1. Visit `/` — see landing page, click "Get Started"
2. Sign up with email → redirected to `/onboarding`
3. Complete 3 onboarding steps → redirected to `/dashboard`
4. Navigate to My Kusina → add 5-6 ingredients
5. Navigate to Suggest → click "Suggest Dishes" → see 3-5 suggestions
6. Click a suggestion → enter Chef Chat → have a conversation
7. (When cooking mode is wired up) → click "Let's Cook" → step through recipe → submit feedback
8. Return to dashboard → see recent dish in history

**Step 2: Test edge cases**
- Try to access `/dashboard` without logging in → redirected to `/login`
- Hit suggestion limit (5) → see upgrade message
- Hit chat limit (10) → see upgrade message
- Sign out → redirected to landing page

**Step 3: Fix any issues found during testing**

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: integration testing fixes"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1: Foundation | Tasks 1-3 | Project setup, DB schema, auth |
| 2: Core Data | Tasks 4-5 | Onboarding, seed data |
| 3: Pantry & AI | Tasks 6-8 | My Kusina, suggestions, Chef Chat |
| 4: Cooking | Tasks 9-10 | Suggestions page, Cooking Mode + feedback |
| 5: Dashboard | Tasks 11-12 | Dashboard, landing page |
| 6: Polish | Tasks 13-14 | Theme, testing |

**Total: 14 tasks across 6 phases.**
