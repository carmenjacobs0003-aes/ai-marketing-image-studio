import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { cancelPayPalSubscription } from "@/lib/paypal/client";
import { getProfile, updateProfileSubscription } from "@/lib/db/queries";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const profile = await getProfile(supabase, user.id);

  if (!profile?.paypal_subscription_id) {
    return NextResponse.json(
      { error: "No PayPal subscription is attached to this profile." },
      { status: 400 }
    );
  }

  await cancelPayPalSubscription(
    profile.paypal_subscription_id,
    "Customer cancelled from billing dashboard."
  );

  const updatedProfile = await updateProfileSubscription(supabase, user.id, {
    plan: "free",
    subscription_status: "cancelled",
    subscription_cancel_at: new Date().toISOString()
  });

  return NextResponse.json({ profile: updatedProfile });
}
