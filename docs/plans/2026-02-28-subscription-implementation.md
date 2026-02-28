# Lutuin Premium Subscription Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a ₱149/month premium subscription system using PayMongo Checkout Sessions, with tier-based rate limits and a subscription management UI.

**Architecture:** PayMongo Checkout Sessions handle payments (supporting GCash, Maya, cards). Webhooks update a `subscriptions` table in Supabase. API routes check subscription status to apply free or premium rate limits. Chat model upgrades to Sonnet for premium users.

**Tech Stack:** PayMongo Checkout API, Supabase (Postgres + RLS), Next.js API routes, React (web UI), React Native/Expo (mobile UI)

---

### Task 1: Database Migration — subscriptions, payments, daily_usage update

**Files:**
- Create: `supabase/migrations/003_subscriptions.sql`

**Context:** The existing schema has `daily_usage` with `suggestion_count` and `chat_message_count` columns (see `supabase/migrations/001_initial_schema.sql:79-86`). Recipe generation currently has NO rate limiting — we need to add `recipe_count` to `daily_usage`.

**Step 1: Write the migration SQL**

Create `supabase/migrations/003_subscriptions.sql`:

```sql
-- Subscriptions table
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'inactive'
    check (status in ('active', 'expired', 'inactive')),
  started_at timestamptz,
  expires_at timestamptz,
  payment_method text,
  paymongo_checkout_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Payment history
create table public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  subscription_id uuid references public.subscriptions(id),
  amount integer not null,
  currency text default 'PHP',
  status text not null check (status in ('paid', 'failed', 'pending')),
  paymongo_payment_id text,
  paymongo_checkout_id text,
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- Add recipe_count to daily_usage (currently missing)
alter table public.daily_usage add column recipe_count integer default 0;

-- RLS for subscriptions
alter table public.subscriptions enable row level security;
create policy "Users can view own subscription"
  on public.subscriptions for select using (auth.uid() = user_id);

-- RLS for payments
alter table public.payments enable row level security;
create policy "Users can view own payments"
  on public.payments for select using (auth.uid() = user_id);
```

**Step 2: Apply the migration via Supabase MCP**

Use the `apply_migration` MCP tool with project_id `kwxnzymkskvzshlzabba`, name `add_subscriptions_and_payments`, and the SQL above.

**Step 3: Verify tables exist**

Run SQL: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('subscriptions', 'payments');`

Expected: Both tables returned.

Run SQL: `SELECT column_name FROM information_schema.columns WHERE table_name = 'daily_usage' AND column_name = 'recipe_count';`

Expected: `recipe_count` column exists.

**Step 4: Commit**

```bash
git add supabase/migrations/003_subscriptions.sql
git commit -m "feat: add subscriptions and payments tables, recipe_count to daily_usage"
```

---

### Task 2: getUserTier helper + tier config

**Files:**
- Create: `src/lib/subscription.ts`

**Context:** Every API route needs to check whether a user is premium. This helper queries the `subscriptions` table and returns the tier + associated limits. It will be imported by all `/api/chef/*` routes.

**Step 1: Create the subscription helper**

Create `src/lib/subscription.ts`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";

export type Tier = "free" | "premium";

export interface TierLimits {
  suggestions: number;
  chatMessages: number;
  recipes: number;
  chatModel: string;
}

const TIER_CONFIG: Record<Tier, TierLimits> = {
  free: {
    suggestions: 5,
    chatMessages: 10,
    recipes: 3,
    chatModel: "claude-haiku-4-5-20251001",
  },
  premium: {
    suggestions: 50,
    chatMessages: 50,
    recipes: 20,
    chatModel: "claude-sonnet-4-6",
  },
};

export async function getUserTier(
  supabase: SupabaseClient,
  userId: string
): Promise<Tier> {
  const { data } = await supabase
    .from("subscriptions")
    .select("status, expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return data ? "premium" : "free";
}

export function getTierLimits(tier: Tier): TierLimits {
  return TIER_CONFIG[tier];
}
```

**Step 2: Commit**

```bash
git add src/lib/subscription.ts
git commit -m "feat: add getUserTier helper and tier configuration"
```

---

### Task 3: Update suggest route with tier-based limits

**Files:**
- Modify: `src/app/api/chef/suggest/route.ts:17-31` (rate limiting section)

**Context:** Currently hard-coded to `suggestion_count >= 5` (line 26). Replace with tier-aware limit check.

**Step 1: Add imports and tier check**

At the top of the file, add import:

```typescript
import { getUserTier, getTierLimits } from "@/lib/subscription";
```

**Step 2: Replace the rate limiting block**

Replace lines 17-31 (the hard-coded limit check) with:

```typescript
  // Check subscription tier and daily usage limit
  const tier = await getUserTier(supabase, user.id);
  const limits = getTierLimits(tier);
  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("suggestion_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .single();

  if (usage && usage.suggestion_count >= limits.suggestions) {
    return NextResponse.json(
      {
        error: tier === "free"
          ? "Daily suggestion limit reached. Upgrade to premium for more suggestions!"
          : "You've reached today's suggestion limit. It resets at midnight.",
      },
      { status: 429 }
    );
  }
```

**Step 3: Verify the rest of the file still works**

The usage increment on lines 134-142 and the rest of the route logic don't need changes — they already increment `suggestion_count` correctly.

**Step 4: Commit**

```bash
git add src/app/api/chef/suggest/route.ts
git commit -m "feat: use tier-based limits for suggest endpoint"
```

---

### Task 4: Update chat route with tier-based limits + model selection

**Files:**
- Modify: `src/app/api/chef/chat/route.ts:16-33` (rate limiting) and line 58 (model selection)

**Context:** Currently hard-coded to `chat_message_count >= 10` (line 25) and model `claude-sonnet-4-6` (line 58). Premium users keep Sonnet; free users switch to Haiku.

**Step 1: Add imports**

```typescript
import { getUserTier, getTierLimits } from "@/lib/subscription";
```

**Step 2: Replace the rate limiting block (lines 16-33)**

```typescript
  // Check subscription tier and daily chat limit
  const tier = await getUserTier(supabase, user.id);
  const limits = getTierLimits(tier);
  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("chat_message_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .single();

  if (usage && usage.chat_message_count >= limits.chatMessages) {
    return new Response(
      JSON.stringify({
        error: tier === "free"
          ? "Daily chat limit reached. Upgrade to premium for more conversations with Chef Luto!"
          : "You've reached today's chat limit. It resets at midnight.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }
```

**Step 3: Update model selection (line 58)**

Replace the hard-coded model:

```typescript
    stream = anthropic.messages.stream({
      model: limits.chatModel,
```

This way free users get Haiku, premium users get Sonnet.

**Step 4: Commit**

```bash
git add src/app/api/chef/chat/route.ts
git commit -m "feat: use tier-based limits and model selection for chat endpoint"
```

---

### Task 5: Add rate limiting to recipe route

**Files:**
- Modify: `src/app/api/chef/recipe/route.ts` (add rate limiting — currently has NONE)

**Context:** The recipe route at `src/app/api/chef/recipe/route.ts` has zero rate limiting. It should have 3 free / 20 premium daily recipes. The `daily_usage` table now has a `recipe_count` column (added in Task 1).

**Step 1: Add imports after line 4**

```typescript
import { getUserTier, getTierLimits } from "@/lib/subscription";
```

**Step 2: Add rate limiting after the auth check (after line 14, before "Parse and validate dish name")**

Insert between line 14 and line 16:

```typescript
  // Check subscription tier and daily recipe limit
  const tier = await getUserTier(supabase, user.id);
  const limits = getTierLimits(tier);
  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("recipe_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .single();

  if (usage && usage.recipe_count >= limits.recipes) {
    return NextResponse.json(
      {
        error: tier === "free"
          ? "Daily recipe limit reached. Upgrade to premium for more recipes!"
          : "You've reached today's recipe limit. It resets at midnight.",
      },
      { status: 429 }
    );
  }
```

**Step 3: Add usage increment after successful recipe generation**

After the `awardXP` call (currently line 112), add:

```typescript
    // Increment recipe usage
    await supabase.from("daily_usage").upsert(
      {
        user_id: user.id,
        date: today,
        recipe_count: (usage?.recipe_count ?? 0) + 1,
      },
      { onConflict: "user_id,date" }
    );
```

**Step 4: Commit**

```bash
git add src/app/api/chef/recipe/route.ts
git commit -m "feat: add tier-based rate limiting to recipe endpoint"
```

---

### Task 6: PayMongo checkout API route

**Files:**
- Create: `src/app/api/subscribe/checkout/route.ts`

**Context:** This route creates a PayMongo Checkout Session and returns the `checkout_url`. The mobile app and web app both call this endpoint. The user is redirected to PayMongo's hosted payment page to pay via GCash, Maya, or card.

**Step 1: Add PayMongo env vars**

Add to `.env.local`:
```
PAYMONGO_SECRET_KEY=sk_test_your_key_here
```

**Step 2: Create the checkout route**

Create `src/app/api/subscribe/checkout/route.ts`:

```typescript
import { createClientFromRequest } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY!;
const PREMIUM_PRICE_CENTAVOS = 14900; // ₱149.00

export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Determine success/cancel URLs from request origin or env
  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ":").toString("base64")}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                name: "Lutuin Premium - 1 Month",
                amount: PREMIUM_PRICE_CENTAVOS,
                currency: "PHP",
                quantity: 1,
              },
            ],
            payment_method_types: ["gcash", "card", "maya"],
            success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/subscribe/cancel`,
            metadata: {
              user_id: user.id,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      console.error("PayMongo checkout error:", err);
      return NextResponse.json(
        { error: "Could not create checkout session. Please try again." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const checkoutUrl = data.data.attributes.checkout_url;

    return NextResponse.json({ checkout_url: checkoutUrl });
  } catch (error) {
    console.error("PayMongo checkout error:", error);
    return NextResponse.json(
      { error: "Payment service unavailable. Please try again later." },
      { status: 503 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/subscribe/checkout/route.ts
git commit -m "feat: add PayMongo checkout session API route"
```

---

### Task 7: PayMongo webhook handler

**Files:**
- Create: `src/app/api/subscribe/webhook/route.ts`

**Context:** PayMongo sends a POST request to this endpoint when a payment succeeds. The handler verifies the webhook signature, extracts the `user_id` from checkout session metadata, and creates/extends the subscription in Supabase. This route must NOT require Supabase auth — it's called by PayMongo's servers, not by users. It uses the Supabase service role key to bypass RLS when writing subscription/payment records.

**Step 1: Add webhook secret to env**

Add to `.env.local`:
```
PAYMONGO_WEBHOOK_SECRET=whsk_your_webhook_secret_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Step 2: Create the webhook route**

Create `src/app/api/subscribe/webhook/route.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request: Request) {
  const body = await request.json();

  const eventType = body?.data?.attributes?.type;
  if (eventType !== "checkout_session.payment.paid") {
    return NextResponse.json({ received: true });
  }

  const checkoutSessionId =
    body?.data?.attributes?.data?.attributes?.payment_intent?.attributes
      ?.metadata?.checkout_session_id ??
    body?.data?.attributes?.data?.id;

  // Retrieve the checkout session from PayMongo to get metadata
  let userId: string;
  try {
    const sessionResponse = await fetch(
      `https://api.paymongo.com/v1/checkout_sessions/${checkoutSessionId}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ":").toString("base64")}`,
        },
      }
    );

    if (!sessionResponse.ok) {
      console.error("Failed to retrieve checkout session:", checkoutSessionId);
      return NextResponse.json({ error: "Session not found" }, { status: 400 });
    }

    const sessionData = await sessionResponse.json();
    userId = sessionData.data.attributes.metadata?.user_id;

    if (!userId) {
      console.error("No user_id in checkout session metadata");
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error retrieving checkout session:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Check for existing active subscription to extend it
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id, expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("expires_at", now.toISOString())
    .maybeSingle();

  let subscriptionId: string;

  if (existingSub) {
    // Extend existing subscription by 30 days from current expiry
    const newExpiry = new Date(existingSub.expires_at);
    newExpiry.setDate(newExpiry.getDate() + 30);

    await supabase
      .from("subscriptions")
      .update({
        expires_at: newExpiry.toISOString(),
        paymongo_checkout_id: checkoutSessionId,
        updated_at: now.toISOString(),
      })
      .eq("id", existingSub.id);

    subscriptionId = existingSub.id;
  } else {
    // Create new subscription
    const { data: newSub } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        status: "active",
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        paymongo_checkout_id: checkoutSessionId,
      })
      .select("id")
      .single();

    subscriptionId = newSub!.id;

    // Expire any old subscriptions for this user
    await supabase
      .from("subscriptions")
      .update({ status: "expired", updated_at: now.toISOString() })
      .eq("user_id", userId)
      .neq("id", subscriptionId)
      .eq("status", "active");
  }

  // Record payment
  const paymentData = body?.data?.attributes?.data?.attributes;
  await supabase.from("payments").insert({
    user_id: userId,
    subscription_id: subscriptionId,
    amount: 14900,
    currency: "PHP",
    status: "paid",
    paymongo_payment_id: paymentData?.payments?.[0]?.id ?? null,
    paymongo_checkout_id: checkoutSessionId,
    payment_method: paymentData?.payment_method_used ?? null,
    paid_at: now.toISOString(),
  });

  return NextResponse.json({ received: true, subscription_id: subscriptionId });
}
```

**Step 3: Update middleware to skip auth for webhook route**

In `src/middleware.ts`, the webhook route already falls under `/api/` which is excluded from auth redirects (line 49). No change needed.

**Step 4: Commit**

```bash
git add src/app/api/subscribe/webhook/route.ts
git commit -m "feat: add PayMongo webhook handler for subscription activation"
```

---

### Task 8: Subscription status API route

**Files:**
- Create: `src/app/api/subscribe/status/route.ts`

**Context:** Both web and mobile apps need to check the user's subscription status (for UI display and upgrade prompts). Returns tier, expiry, and payment method.

**Step 1: Create the status route**

Create `src/app/api/subscribe/status/route.ts`:

```typescript
import { createClientFromRequest } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getUserTier, getTierLimits } from "@/lib/subscription";

export async function GET(request: Request) {
  const supabase = await createClientFromRequest(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tier = await getUserTier(supabase, user.id);
  const limits = getTierLimits(tier);

  // Get subscription details if premium
  let subscription = null;
  if (tier === "premium") {
    const { data } = await supabase
      .from("subscriptions")
      .select("expires_at, payment_method, started_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .single();
    subscription = data;
  }

  // Get today's usage
  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("suggestion_count, chat_message_count, recipe_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  return NextResponse.json({
    tier,
    limits,
    subscription,
    usage: {
      suggestions: usage?.suggestion_count ?? 0,
      chatMessages: usage?.chat_message_count ?? 0,
      recipes: usage?.recipe_count ?? 0,
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/subscribe/status/route.ts
git commit -m "feat: add subscription status API endpoint"
```

---

### Task 9: Web subscription management page

**Files:**
- Create: `src/app/dashboard/subscription/page.tsx`

**Context:** This page shows the user's current plan, subscription status, usage, payment history, and an upgrade/renew button. It lives under the dashboard layout (`src/app/dashboard/layout.tsx`) which already handles auth + onboarding checks. The page should match the existing dashboard style (see `src/app/dashboard/page.tsx` for patterns: stone/amber color scheme, rounded-2xl cards, shadow-sm).

**Step 1: Create the subscription page**

Create `src/app/dashboard/subscription/page.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserTier, getTierLimits } from "@/lib/subscription";
import SubscriptionClient from "@/components/subscription/subscription-client";

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tier = await getUserTier(supabase, user.id);
  const limits = getTierLimits(tier);

  // Get subscription details
  let subscription = null;
  if (tier === "premium") {
    const { data } = await supabase
      .from("subscriptions")
      .select("expires_at, payment_method, started_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .single();
    subscription = data;
  }

  // Get today's usage
  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("suggestion_count, chat_message_count, recipe_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  // Get payment history
  const { data: payments } = await supabase
    .from("payments")
    .select("amount, currency, status, payment_method, paid_at")
    .eq("user_id", user.id)
    .order("paid_at", { ascending: false })
    .limit(10);

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 md:pb-4 space-y-5">
      <h1 className="text-xl font-bold text-stone-800">Subscription</h1>

      {/* Current Plan Card */}
      <div className={`rounded-2xl p-5 shadow-lg ${
        tier === "premium"
          ? "bg-gradient-to-br from-amber-500 to-amber-600 text-white"
          : "bg-white border border-stone-200"
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-xs font-semibold uppercase tracking-wide ${
              tier === "premium" ? "text-amber-200" : "text-stone-400"
            }`}>
              Current Plan
            </div>
            <div className={`text-2xl font-bold mt-1 ${
              tier === "premium" ? "text-white" : "text-stone-800"
            }`}>
              {tier === "premium" ? "Premium" : "Free"}
            </div>
          </div>
          {tier === "premium" && (
            <div className="text-right">
              <div className="text-amber-200 text-xs">Expires</div>
              <div className="text-white font-semibold text-sm">
                {subscription?.expires_at
                  ? new Date(subscription.expires_at).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </div>
            </div>
          )}
        </div>
        {tier === "premium" && subscription?.payment_method && (
          <div className="mt-3 text-xs text-amber-200">
            Paid via {subscription.payment_method}
          </div>
        )}
      </div>

      {/* Upgrade / Renew Button */}
      <SubscriptionClient tier={tier} />

      {/* Today's Usage */}
      <div>
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">
          Today&apos;s Usage
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Suggestions", used: usage?.suggestion_count ?? 0, limit: limits.suggestions },
            { label: "Chat", used: usage?.chat_message_count ?? 0, limit: limits.chatMessages },
            { label: "Recipes", used: usage?.recipe_count ?? 0, limit: limits.recipes },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl border border-stone-100 p-4 text-center shadow-sm">
              <div className="text-xl font-bold text-amber-600">
                {item.used}/{item.limit}
              </div>
              <div className="text-[11px] text-stone-400 font-medium">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Comparison */}
      {tier === "free" && (
        <div>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">
            Free vs Premium
          </h2>
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left p-3 text-stone-500 font-medium">Feature</th>
                  <th className="text-center p-3 text-stone-500 font-medium">Free</th>
                  <th className="text-center p-3 text-amber-600 font-medium">Premium</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-stone-50">
                  <td className="p-3 text-stone-700">Suggestions/day</td>
                  <td className="p-3 text-center text-stone-500">5</td>
                  <td className="p-3 text-center font-semibold text-amber-600">50</td>
                </tr>
                <tr className="border-b border-stone-50">
                  <td className="p-3 text-stone-700">Chat messages/day</td>
                  <td className="p-3 text-center text-stone-500">10</td>
                  <td className="p-3 text-center font-semibold text-amber-600">50</td>
                </tr>
                <tr className="border-b border-stone-50">
                  <td className="p-3 text-stone-700">Recipes/day</td>
                  <td className="p-3 text-center text-stone-500">3</td>
                  <td className="p-3 text-center font-semibold text-amber-600">20</td>
                </tr>
                <tr>
                  <td className="p-3 text-stone-700">Chef Luto AI</td>
                  <td className="p-3 text-center text-stone-500">Standard</td>
                  <td className="p-3 text-center font-semibold text-amber-600">Advanced</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment History */}
      {payments && payments.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">
            Payment History
          </h2>
          <div className="space-y-2">
            {payments.map((payment: any, i: number) => (
              <div
                key={i}
                className="p-3 bg-white rounded-xl border border-stone-100 flex items-center justify-between shadow-sm"
              >
                <div>
                  <div className="text-sm font-medium text-stone-700">
                    Lutuin Premium
                  </div>
                  <div className="text-xs text-stone-400">
                    {payment.paid_at
                      ? new Date(payment.paid_at).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                    {payment.payment_method && ` · ${payment.payment_method}`}
                  </div>
                </div>
                <div className="text-sm font-semibold text-stone-700">
                  ₱{(payment.amount / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create the client component for checkout button**

Create `src/components/subscription/subscription-client.tsx`:

```typescript
"use client";

import { useState } from "react";
import type { Tier } from "@/lib/subscription";

export default function SubscriptionClient({ tier }: { tier: Tier }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCheckout() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/subscribe/checkout", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error || "Something went wrong.");
        return;
      }

      const { checkout_url } = await response.json();
      window.location.href = checkout_url;
    } catch {
      setError("Could not connect to payment service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleCheckout}
        disabled={loading}
        className={`w-full py-4 rounded-2xl text-center font-bold text-base transition-all shadow-lg hover:shadow-xl ${
          tier === "premium"
            ? "bg-amber-500 text-white hover:bg-amber-600"
            : "bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700"
        } ${loading ? "opacity-70" : ""}`}
      >
        {loading
          ? "Redirecting to payment..."
          : tier === "premium"
            ? "Renew Premium — ₱149/month"
            : "Upgrade to Premium — ₱149/month"}
      </button>
      {error && (
        <div className="mt-2 text-sm text-red-500 text-center">{error}</div>
      )}
    </div>
  );
}
```

**Step 3: Create success and cancel pages**

Create `src/app/subscribe/success/page.tsx`:

```typescript
import Link from "next/link";

export default function SubscribeSuccess() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-bold text-stone-800">
          Welcome to Premium!
        </h1>
        <p className="text-stone-500">
          Your subscription is now active. Enjoy unlimited Chef Luto and advanced AI features.
        </p>
        <Link
          href="/dashboard"
          className="inline-block w-full py-4 bg-amber-500 text-white rounded-2xl font-bold hover:bg-amber-600 transition"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
```

Create `src/app/subscribe/cancel/page.tsx`:

```typescript
import Link from "next/link";

export default function SubscribeCancel() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-5xl">🤔</div>
        <h1 className="text-2xl font-bold text-stone-800">
          Changed your mind?
        </h1>
        <p className="text-stone-500">
          No worries! You can upgrade anytime from your dashboard.
        </p>
        <Link
          href="/dashboard"
          className="inline-block w-full py-4 bg-stone-200 text-stone-700 rounded-2xl font-bold hover:bg-stone-300 transition"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/dashboard/subscription/ src/components/subscription/ src/app/subscribe/
git commit -m "feat: add subscription management page with checkout, success, and cancel flows"
```

---

### Task 10: Dashboard upgrade banner for free users

**Files:**
- Modify: `src/app/dashboard/page.tsx` (add upgrade banner between hero and streak cards)
- Modify: `src/app/dashboard/layout.tsx` (pass tier to children if needed)

**Context:** The dashboard page at `src/app/dashboard/page.tsx` shows the hero card, streaks, CTA, stats, and activity. We add a small upgrade banner for free users between the hero and the streak section. The layout already fetches profile data (line 21-25).

**Step 1: Add tier check to dashboard page**

At the top of `DashboardPage`, add after the existing parallel queries (after line 44):

```typescript
  const { getUserTier } = await import("@/lib/subscription");
  const tier = await getUserTier(supabase, user!.id);
```

**Step 2: Add upgrade banner in the JSX**

Insert after the hero card closing `</div>` (after line 97), before the streak grid:

```tsx
      {/* Premium Upgrade Banner (free users only) */}
      {tier === "free" && (
        <Link
          href="/dashboard/subscription"
          className="block w-full p-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-2xl shadow-md hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-sm">Unlock Premium</div>
              <div className="text-xs text-violet-200">
                Unlimited AI + Advanced Chef Luto — ₱149/mo
              </div>
            </div>
            <div className="text-lg">→</div>
          </div>
        </Link>
      )}
```

**Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: add premium upgrade banner to dashboard for free users"
```

---

### Task 11: Mobile subscription screen + upgrade flow

**Files:**
- Create: `lutuin-mobile/app/(tabs)/subscription.tsx`
- Modify: `lutuin-mobile/app/(tabs)/_layout.tsx` (add subscription tab or make it accessible)

**Context:** The mobile app at `/home/grphx/lutuin-mobile/` uses Expo Router with a tab layout. The subscription screen shows status and opens a web checkout via `Linking.openURL()`. We don't need a full new tab — add a settings/subscription button accessible from the dashboard header or a profile section.

Instead of a tab, create a stack route `app/subscription.tsx` (like `app/cook.tsx` pattern) that the dashboard can link to.

**Step 1: Create mobile subscription screen**

Create `lutuin-mobile/app/subscription.tsx`:

```typescript
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";

type SubscriptionStatus = {
  tier: "free" | "premium";
  limits: {
    suggestions: number;
    chatMessages: number;
    recipes: number;
  };
  subscription: {
    expires_at: string;
    payment_method: string;
    started_at: string;
  } | null;
  usage: {
    suggestions: number;
    chatMessages: number;
    recipes: number;
  };
};

export default function SubscriptionScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      const response = await apiFetch("/api/subscribe/status");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch {
      // Best effort
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout() {
    setCheckoutLoading(true);
    try {
      const response = await apiFetch("/api/subscribe/checkout", {
        method: "POST",
      });
      if (response.ok) {
        const { checkout_url } = await response.json();
        await Linking.openURL(checkout_url);
      }
    } catch {
      // Handle error
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-stone-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#d97706" />
        </View>
      </SafeAreaView>
    );
  }

  const isPremium = status?.tier === "premium";

  return (
    <SafeAreaView className="flex-1 bg-stone-50" edges={["top"]}>
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="flex-row items-center mb-5">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Text className="text-2xl text-stone-600">←</Text>
          </TouchableOpacity>
          <Text className="text-xl font-bold text-stone-800">Subscription</Text>
        </View>

        {/* Plan Card */}
        <View
          className={`rounded-2xl p-5 mb-4 ${
            isPremium
              ? "bg-amber-500"
              : "bg-white border border-stone-200"
          }`}
        >
          <Text
            className={`text-xs font-semibold uppercase tracking-wide ${
              isPremium ? "text-amber-200" : "text-stone-400"
            }`}
          >
            Current Plan
          </Text>
          <Text
            className={`text-2xl font-bold mt-1 ${
              isPremium ? "text-white" : "text-stone-800"
            }`}
          >
            {isPremium ? "Premium" : "Free"}
          </Text>
          {isPremium && status?.subscription?.expires_at && (
            <Text className="text-amber-200 text-xs mt-2">
              Expires{" "}
              {new Date(status.subscription.expires_at).toLocaleDateString(
                "en-PH",
                { month: "short", day: "numeric", year: "numeric" }
              )}
            </Text>
          )}
        </View>

        {/* Checkout Button */}
        <TouchableOpacity
          className={`w-full py-4 rounded-2xl items-center mb-5 ${
            checkoutLoading ? "bg-amber-400" : "bg-amber-500"
          }`}
          onPress={handleCheckout}
          disabled={checkoutLoading}
          activeOpacity={0.8}
        >
          {checkoutLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white font-bold text-base">
              {isPremium ? "Renew Premium — ₱149/month" : "Upgrade to Premium — ₱149/month"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Today's Usage */}
        <Text className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">
          Today&apos;s Usage
        </Text>
        <View className="flex-row gap-3 mb-5">
          {[
            {
              label: "Suggests",
              used: status?.usage.suggestions ?? 0,
              limit: status?.limits.suggestions ?? 5,
            },
            {
              label: "Chat",
              used: status?.usage.chatMessages ?? 0,
              limit: status?.limits.chatMessages ?? 10,
            },
            {
              label: "Recipes",
              used: status?.usage.recipes ?? 0,
              limit: status?.limits.recipes ?? 3,
            },
          ].map((item) => (
            <View
              key={item.label}
              className="flex-1 bg-white rounded-2xl border border-stone-100 p-4 items-center"
            >
              <Text className="text-xl font-bold text-amber-600">
                {item.used}/{item.limit}
              </Text>
              <Text className="text-[11px] text-stone-400 font-medium">
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Feature Comparison (free users only) */}
        {!isPremium && (
          <>
            <Text className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">
              Free vs Premium
            </Text>
            <View className="bg-white rounded-2xl border border-stone-100 p-4 mb-5">
              {[
                { feature: "Suggestions/day", free: "5", premium: "50" },
                { feature: "Chat messages/day", free: "10", premium: "50" },
                { feature: "Recipes/day", free: "3", premium: "20" },
                { feature: "Chef Luto AI", free: "Standard", premium: "Advanced" },
              ].map((row) => (
                <View
                  key={row.feature}
                  className="flex-row justify-between py-2 border-b border-stone-50"
                >
                  <Text className="text-sm text-stone-700 flex-1">
                    {row.feature}
                  </Text>
                  <Text className="text-sm text-stone-400 w-16 text-center">
                    {row.free}
                  </Text>
                  <Text className="text-sm font-semibold text-amber-600 w-16 text-center">
                    {row.premium}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

**Step 2: Add subscription link to mobile dashboard**

In `lutuin-mobile/app/(tabs)/index.tsx`, add a small "Manage Subscription" link or upgrade banner. Use the same pattern as the web dashboard (Task 10). Import `useRouter` and add a link that navigates to `/subscription`.

**Step 3: Commit**

```bash
cd /home/grphx/lutuin-mobile
git add app/subscription.tsx app/(tabs)/index.tsx
git commit -m "feat: add mobile subscription screen with checkout and status display"
```

---

### Task 12: Register PayMongo webhook

**Files:** None (configuration step)

**Context:** PayMongo needs to know where to send webhook events. This is done via the PayMongo dashboard or API. For local development, use a tunneling tool (like ngrok or Expo's `--tunnel`) to expose your local endpoint.

**Step 1: For development (ngrok or similar)**

```bash
# In a separate terminal, expose your local server
npx ngrok http 3000
```

Take the HTTPS URL (e.g., `https://abc123.ngrok.io`) and register the webhook via PayMongo API:

```bash
curl -X POST https://api.paymongo.com/v1/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'sk_test_YOUR_KEY:' | base64)" \
  -d '{
    "data": {
      "attributes": {
        "url": "https://abc123.ngrok.io/api/subscribe/webhook",
        "events": ["checkout_session.payment.paid"]
      }
    }
  }'
```

Save the webhook secret from the response as `PAYMONGO_WEBHOOK_SECRET` in `.env.local`.

**Step 2: For production**

Register the webhook with your production domain:

```
https://your-domain.com/api/subscribe/webhook
```

**Step 3: Document the setup**

Note the webhook ID for future reference. Update `.env.local` with the webhook secret.

---

### Task 13: End-to-end testing

**Files:** None (manual testing)

**Context:** PayMongo provides test mode with test payment methods. Test the full flow.

**Step 1: Test checkout flow**

1. Log in as a free user
2. Navigate to `/dashboard/subscription`
3. Click "Upgrade to Premium"
4. Verify redirect to PayMongo checkout
5. Pay with test card: `4343 4343 4343 4345` (PayMongo test card)
6. Verify redirect to success page
7. Check subscription status: `GET /api/subscribe/status` should return `tier: "premium"`

**Step 2: Test rate limits**

1. As a free user, make 5 suggestion requests — 6th should fail with 429
2. As a premium user, make 5 suggestion requests — all should succeed (limit is 50)
3. Check chat model: free user should get Haiku responses, premium should get Sonnet

**Step 3: Test mobile flow**

1. Open mobile app at `http://localhost:8081`
2. Navigate to subscription screen
3. Tap "Upgrade" — should open browser to PayMongo checkout
4. After payment, check `/api/subscribe/status` returns premium

**Step 4: Test renewal**

1. As a premium user, click "Renew"
2. Complete payment
3. Verify `expires_at` extended by 30 days from previous expiry

**Step 5: Commit any fixes discovered during testing**
