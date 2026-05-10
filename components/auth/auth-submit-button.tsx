"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils/cn";

type AuthSubmitButtonProps = {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
};

export function AuthSubmitButton({
  children,
  pendingText,
  className
}: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-disabled={pending}
      className={cn("neon-button flex w-full gap-2", className)}
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
