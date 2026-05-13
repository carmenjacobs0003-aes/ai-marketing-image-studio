import { cn } from "@/lib/utils/cn";

type SyntrixLogoProps = {
  className?: string;
};

export function SyntrixLogo({ className }: SyntrixLogoProps) {
  return (
    <span className={cn("text-xl font-black text-white", className)}>
      SYNTRIX<span className="text-cyan-300">ai</span>
    </span>
  );
}
