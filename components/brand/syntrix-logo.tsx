import Image from "next/image";
import { BRAND_LOGO_SRC, BRAND_NAME } from "@/lib/branding";
import { cn } from "@/lib/utils/cn";

type SyntrixLogoProps = {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

export function SyntrixLogo({
  className,
  imageClassName,
  priority = false
}: SyntrixLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300",
        className
      )}
    >
      <Image
        alt={`${BRAND_NAME} logo`}
        className={cn(
          "h-10 w-auto max-w-full object-contain drop-shadow-[0_0_20px_rgba(34,211,238,0.34)]",
          imageClassName
        )}
        height={96}
        priority={priority}
        src={BRAND_LOGO_SRC}
        width={360}
      />
    </span>
  );
}
