import { signOut } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils/cn";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button className={cn("rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/60 hover:text-cyan-300", className)} type="submit">
        Log out
      </button>
    </form>
  );
}
