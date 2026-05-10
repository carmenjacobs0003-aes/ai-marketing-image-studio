"use client";

import { useState } from "react";
import type { AppPlan } from "@/lib/db/types";

type UpgradeButtonProps = {
  plan: Exclude<AppPlan, "free">;
  className?: string;
  children: React.ReactNode;
};

export function UpgradeButton({
  plan,
  className,
  children
}: UpgradeButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function startCheckout() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/paypal/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan })
      });
      const payload = (await response.json()) as {
        approvalUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.approvalUrl) {
        setError(payload.error ?? "Unable to start PayPal checkout.");
        return;
      }

      window.location.href = payload.approvalUrl;
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to start PayPal checkout."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        className={className}
        disabled={isLoading}
        onClick={startCheckout}
        type="button"
      >
        {isLoading ? "Opening PayPal..." : children}
      </button>
      {error ? <p className="text-xs text-red-200">{error}</p> : null}
    </div>
  );
}
