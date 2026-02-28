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

  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await supabase
    .from("daily_usage")
    .select("suggestion_count, chat_message_count, recipe_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

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
