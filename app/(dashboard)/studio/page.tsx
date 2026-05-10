import { requireUser } from "@/lib/auth/session";
import { getUsageSummary } from "@/lib/usage/limits";
import { StudioCanvas } from "@/components/studio/studio-canvas";

export default async function StudioPage() {
  const user = await requireUser();
  const usage = await getUsageSummary(user.id);

  return <StudioCanvas usage={usage} />;
}
