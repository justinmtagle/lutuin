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
