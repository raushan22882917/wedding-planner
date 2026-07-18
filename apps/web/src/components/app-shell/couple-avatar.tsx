import { Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type CoupleAvatarSize = "sm" | "md" | "lg" | "xl";

type CoupleAvatarProps = {
  partnerOneName?: string | null;
  partnerTwoName?: string | null;
  partnerOnePhotoUrl?: string | null;
  partnerTwoPhotoUrl?: string | null;
  size?: CoupleAvatarSize;
  className?: string;
  showHeart?: boolean;
};

const sizes: Record<
  CoupleAvatarSize,
  { container: string; avatar: string; second: string; heart: string }
> = {
  sm: {
    container: "h-9 w-[53px]",
    avatar: "h-8 w-8 text-[10px]",
    second: "left-5 top-1",
    heart: "hidden",
  },
  md: {
    container: "h-11 w-[65px]",
    avatar: "h-10 w-10 text-xs",
    second: "left-6 top-1",
    heart: "grid h-4 w-4 -translate-x-1/2 -translate-y-1/2",
  },
  lg: {
    container: "h-14 w-[82px]",
    avatar: "h-13 w-13 text-sm",
    second: "left-8 top-1",
    heart: "grid h-5 w-5 -translate-x-1/2 -translate-y-1/2",
  },
  xl: {
    container: "h-20 w-[116px]",
    avatar: "h-[72px] w-[72px] text-lg",
    second: "left-11 top-2",
    heart: "grid h-6 w-6 -translate-x-1/2 -translate-y-1/2",
  },
};

function initial(name?: string | null) {
  return name?.trim().charAt(0).toUpperCase() || "?";
}

/** A compact, overlapping portrait pair used anywhere a wedding workspace is identified. */
export function CoupleAvatar({
  partnerOneName,
  partnerTwoName,
  partnerOnePhotoUrl,
  partnerTwoPhotoUrl,
  size = "md",
  className,
  showHeart = true,
}: CoupleAvatarProps) {
  const styles = sizes[size];
  const coupleName =
    [partnerOneName, partnerTwoName].filter(Boolean).join(" and ") || "Wedding couple";

  return (
    <div
      className={cn("relative isolate shrink-0", styles.container, className)}
      role="img"
      aria-label={coupleName}
    >
      <Avatar
        className={cn("absolute left-0 top-0 z-10 border-2 border-card shadow-sm", styles.avatar)}
      >
        {partnerOnePhotoUrl && (
          <AvatarImage
            src={partnerOnePhotoUrl}
            alt={`${partnerOneName || "Partner one"} profile photo`}
          />
        )}
        <AvatarFallback className="bg-gradient-to-br from-rose-brand to-primary text-primary-foreground font-semibold">
          {initial(partnerOneName)}
        </AvatarFallback>
      </Avatar>

      <Avatar
        className={cn("absolute z-20 border-2 border-card shadow-sm", styles.avatar, styles.second)}
      >
        {partnerTwoPhotoUrl && (
          <AvatarImage
            src={partnerTwoPhotoUrl}
            alt={`${partnerTwoName || "Partner two"} profile photo`}
          />
        )}
        <AvatarFallback className="bg-gradient-to-br from-purple-brand to-primary text-primary-foreground font-semibold">
          {initial(partnerTwoName)}
        </AvatarFallback>
      </Avatar>

      {showHeart && (
        <span
          className={cn(
            "absolute left-1/2 top-1/2 z-30 place-items-center rounded-full border border-card bg-primary text-primary-foreground shadow-sm",
            styles.heart,
          )}
          aria-hidden="true"
        >
          <Heart className="h-2.5 w-2.5" fill="currentColor" />
        </span>
      )}
    </div>
  );
}
