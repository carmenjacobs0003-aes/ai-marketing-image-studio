"use client";

import { useState } from "react";

export function CancelSubscriptionButton() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function cancelSubscription() {
    if (
      !window.confirm("Cancel your PayPal subscription and return to Free?")
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/paypal/subscriptions/cancel", {
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to cancel subscription.");
        return;
      }

      window.location.reload();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Unable to cancel subscription."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        className="rounded-xl border border-red-300/30 px-4 py-3 font-semibold text-red-100 transition hover:border-red-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading}
        onClick={cancelSubscription}
        type="button"
      >
        {isLoading ? "Cancelling..." : "Cancel subscription"}
      </button>
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
    </div>
  );
}
