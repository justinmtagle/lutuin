# Deployment Design — Lutuin

## Architecture

```
Mobile App (Expo/EAS) → Vercel (Next.js API) → Supabase (DB + Auth)
                                              → Anthropic (AI)
                                              → PayMongo (Payments)
```

- **Web API**: Next.js on Vercel — serves API routes for the mobile app. Web dashboard is internal-only for now.
- **Mobile App**: Expo with EAS Build — distributed via TestFlight (iOS) and internal testing track (Android).
- **Database**: Supabase hosted (project `kwxnzymkskvzshlzabba`) — already running with migrations applied.

## Vercel Deployment (Web API)

**Setup**: Connect `justinmtagle/lutuin` GitHub repo to Vercel. Auto-deploys on push to master.

**Environment variables** (set in Vercel dashboard):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `PAYMONGO_SECRET_KEY`
- `PAYMONGO_PUBLIC_KEY`

**Domain**: Will get a `*.vercel.app` URL. Custom domain optional later.

## EAS Build (Mobile App)

**Setup**: Create Expo account, login via CLI, configure `eas.json`.

**Build profiles**:
- `development` — development client for testing
- `preview` — internal distribution (TestFlight / Android internal)
- `production` — store release (future)

**Environment variables** (set in `eas.json` or Expo dashboard):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL` — points to the Vercel deployment URL

## PayMongo Webhook

Once the Vercel URL is live, register the webhook:
- URL: `https://<vercel-url>/api/subscribe/webhook`
- Events: `checkout_session.payment.paid`
- Register via PayMongo dashboard or API

## What Needs to Happen

1. Create `.env.example` in both repos (document required vars)
2. Create `eas.json` in mobile repo
3. Update mobile `.env` to use production API URL after Vercel deploys
4. Deploy web app to Vercel (connect repo + set env vars)
5. Build mobile app with EAS
6. Register PayMongo webhook with production URL
