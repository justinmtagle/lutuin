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
