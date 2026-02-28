# Lutuin Premium Subscription System — Design

## Overview

Add a premium subscription tier to Lutuin using PayMongo Checkout Sessions. Filipino users can pay ₱149/month via GCash, Maya, or credit/debit card for enhanced AI capabilities and higher usage limits.

## Pricing & Tiers

| Aspect | Free Tier | Premium (₱149/mo) |
|--------|-----------|-------------------|
| Suggestions/day | 5 | 50 |
| Chat messages/day | 10 | 50 |
| Recipes/day | 3 | 20 |
| Chat AI model | Haiku | Sonnet |
| Suggestion model | Haiku | Haiku |
| Recipe model | Haiku | Haiku |

## Payment Provider: PayMongo

- **Integration type**: Checkout Sessions (hosted payment page)
- **Supported methods**: GCash, Maya, credit/debit cards
- **Why not Subscriptions API**: PayMongo's Subscriptions API only supports card + Maya — no GCash. Since GCash is the most popular payment method in the Philippines, Checkout Sessions is the better choice.
- **Renewal model**: Manual monthly renewal. Users receive renewal prompts 3 days before expiry.

## Database Schema

### New table: `subscriptions`

```sql
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'inactive',  -- 'active', 'expired', 'inactive'
  started_at timestamptz,
  expires_at timestamptz,
  payment_method text,                       -- 'gcash', 'maya', 'card'
  paymongo_checkout_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### New table: `payments`

```sql
create table public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  subscription_id uuid references public.subscriptions(id),
  amount integer not null,                    -- in centavos (14900 = ₱149)
  currency text default 'PHP',
  status text not null,                       -- 'paid', 'failed', 'pending'
  paymongo_payment_id text,
  paymongo_checkout_id text,
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz default now()
);
```

### RLS policies

- Users can read their own subscriptions and payments
- Only the service role (webhook handler) can insert/update subscriptions and payments

## Payment Flow

### Subscribe / Renew

1. User taps "Upgrade to Premium" (or "Renew")
2. App calls `POST /api/subscribe/checkout`
   - Creates a PayMongo Checkout Session (₱149 PHP)
   - Attaches `user_id` in metadata
   - Returns `checkout_url`
3. App opens `checkout_url` in system browser or WebView
4. User pays via GCash, Maya, or card on PayMongo's hosted page
5. PayMongo redirects to success/cancel URL
6. PayMongo sends webhook → `POST /api/subscribe/webhook`
   - Verifies webhook signature
   - Extracts `user_id` from checkout session metadata
   - Creates/extends subscription (status: 'active', expires_at: +30 days)
   - Creates payment record
7. App detects active subscription on next API call or status check

### Renewal reminders

- 3 days before `expires_at`: show renewal banner in dashboard
- On expiry: subscription status changes to 'expired', user falls back to free tier
- Renewal extends from current `expires_at` (not from payment date) to reward early renewal

## New API Routes

### `POST /api/subscribe/checkout`

- Auth: requires valid session/Bearer token
- Creates PayMongo Checkout Session
- Returns: `{ checkout_url: string }`

### `POST /api/subscribe/webhook`

- Auth: PayMongo webhook signature verification (NOT Supabase auth)
- Handles `checkout_session.payment.paid` event
- Updates subscription and payment tables

### `GET /api/subscribe/status`

- Auth: requires valid session/Bearer token
- Returns: `{ tier: 'free' | 'premium', expires_at?: string, payment_method?: string }`

## API Route Changes

### Shared helper: `getUserTier()`

```typescript
async function getUserTier(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('subscriptions')
    .select('status, expires_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .single();
  return data ? 'premium' : 'free';
}
```

### Rate limit updates

Each API route (`/api/chef/suggest`, `/api/chef/chat`, `/api/chef/recipe`) will:

1. Call `getUserTier()` after authentication
2. Apply tier-specific limits:
   - Free: 5/10/3 per day
   - Premium: 50/50/20 per day
3. For chat route: select Claude model based on tier (Haiku for free, Sonnet for premium)

### Recipe route rate limiting

Currently `/api/chef/recipe` has no daily limit — add a limit (3 free, 20 premium) using the same `daily_usage` table pattern. Add `recipe_count` column to `daily_usage`.

## UI Components

### Web: Subscription management page (`/dashboard/subscription`)

- Current plan badge (Free / Premium)
- If premium: expiry date, payment method, "Renew Now" button
- Payment history table
- Feature comparison (free vs premium)

### Mobile: Subscription screen

- Same information as web, accessible from dashboard or profile
- "Upgrade" / "Renew" buttons open web checkout via system browser

### Upgrade prompts

- Rate limit error responses include upgrade CTA
- Dashboard banner for free users
- Settings/profile shows subscription status

## PayMongo Configuration

### Environment variables

```
PAYMONGO_SECRET_KEY=sk_test_...        # Server-side only
PAYMONGO_WEBHOOK_SECRET=whsk_...       # For webhook signature verification
```

### Checkout Session parameters

```json
{
  "data": {
    "attributes": {
      "line_items": [{
        "name": "Lutuin Premium - 1 Month",
        "amount": 14900,
        "currency": "PHP",
        "quantity": 1
      }],
      "payment_method_types": ["gcash", "card", "maya"],
      "success_url": "{base_url}/subscribe/success?session_id={CHECKOUT_SESSION_ID}",
      "cancel_url": "{base_url}/subscribe/cancel",
      "metadata": { "user_id": "..." }
    }
  }
}
```

### Webhook events

- `checkout_session.payment.paid` — primary event for activating subscriptions

## Security

- PayMongo secret key stored server-side only
- Webhook signature verification prevents spoofed payment events
- RLS on subscriptions/payments: users can only read their own records
- Webhook route uses service role for writes (bypasses RLS)
- No client-side payment handling — all through PayMongo's hosted checkout

## Cost Analysis

| User Type | Monthly AI Cost | Revenue | Margin |
|-----------|----------------|---------|--------|
| Free (casual) | ~₱7 | ₱0 | -₱7 |
| Free (maxed) | ~₱35 | ₱0 | -₱35 |
| Premium (casual) | ~₱97 | ₱146 | +₱49 (34%) |
| Premium (typical) | ~₱242 | ₱146 | -₱96 |
| Premium (heavy) | ~₱573 | ₱146 | -₱427 |

Sustainability relies on the casual-to-power ratio. Soft caps (50/50/20) protect against extreme usage. Most users will fall in the casual-to-typical range.
