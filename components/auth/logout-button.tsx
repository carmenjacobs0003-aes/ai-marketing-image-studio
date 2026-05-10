import { signOut } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils/cn";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button className={cn("ghost-button px-4 py-2 text-sm", className)} type="submit">
        Log out
      </button>
    </form>
  );
}
