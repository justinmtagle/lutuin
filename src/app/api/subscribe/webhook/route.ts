import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY!;
const PAYMONGO_WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY
  );
}

function verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
  const parts = signatureHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const testSig = parts.find((p) => p.startsWith("te="))?.slice(3);
  const liveSig = parts.find((p) => p.startsWith("li="))?.slice(3);

  if (!timestamp) return false;

  const payload = `${timestamp}.${rawBody}`;
  const computed = createHmac("sha256", PAYMONGO_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  const signature = liveSig || testSig;
  if (!signature) return false;

  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  // Verify webhook signature
  const signatureHeader = request.headers.get("paymongo-signature");
  if (!signatureHeader || !verifyWebhookSignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  const eventType = body?.data?.attributes?.type;
  if (eventType !== "checkout_session.payment.paid") {
    return NextResponse.json({ received: true });
  }

  const checkoutSessionId =
    body?.data?.attributes?.data?.attributes?.payment_intent?.attributes
      ?.metadata?.checkout_session_id ??
    body?.data?.attributes?.data?.id;

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

  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id, expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("expires_at", now.toISOString())
    .maybeSingle();

  let subscriptionId: string;

  if (existingSub) {
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

    await supabase
      .from("subscriptions")
      .update({ status: "expired", updated_at: now.toISOString() })
      .eq("user_id", userId)
      .neq("id", subscriptionId)
      .eq("status", "active");
  }

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
