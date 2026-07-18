import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CalendarHeart, ChevronDown, MapPin, Search, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoupleAvatar } from "@/components/app-shell/couple-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMyProfile } from "@/lib/profile.functions";

export function AppTopbar() {
  const profileFn = useServerFn(getMyProfile);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const partnerOne = profile.data?.partner_one?.trim();
  const partnerTwo = profile.data?.partner_two?.trim();
  const coupleName = [partnerOne, partnerTwo].filter(Boolean).join(" & ") || "Your wedding";
  const weddingDate = profile.data?.wedding_date
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(`${profile.data.wedding_date}T12:00:00`),
      )
    : "Add your wedding date";

  return (
    <header className="sticky top-0 z-40 grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/85 px-3 backdrop-blur-xl sm:px-4 lg:px-6">
      <div className="min-w-0 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search vendors, tasks, guests, or ask AI…"
            aria-label="Search your wedding workspace"
            className="h-10 w-full rounded-xl border border-transparent bg-secondary pl-9 pr-3 text-[13px] outline-hidden transition-colors placeholder:text-muted-foreground/80 focus:border-primary/30 focus:bg-card focus:ring-2 focus:ring-primary/10 sm:pr-16"
          />
          <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground sm:block">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="ml-auto flex items-center justify-end gap-1.5 sm:gap-2">
        <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/8 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 md:flex">
          <Sparkles className="h-3.5 w-3.5" />
          AI online
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-xl"
          aria-label="Open notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex h-11 items-center gap-1 rounded-full border border-border bg-card py-1 pl-1 pr-1.5 shadow-sm transition-[border-color,box-shadow,background-color] duration-200 hover:border-primary/30 hover:bg-secondary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-1.5 sm:pr-2"
              aria-label={`Open profile menu for ${coupleName}`}
            >
              <CoupleAvatar
                size="sm"
                partnerOneName={partnerOne}
                partnerTwoName={partnerTwo}
                partnerOnePhotoUrl={profile.data?.partner_one_photo_url}
                partnerTwoPhotoUrl={profile.data?.partner_two_photo_url}
              />
              <div className="hidden min-w-0 text-left xl:block">
                <p className="max-w-28 truncate text-xs font-semibold text-foreground">
                  {coupleName}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                  Wedding space
                </p>
              </div>
              <ChevronDown className="mr-0.5 hidden h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={10}
            collisionPadding={12}
            className="w-80 rounded-2xl p-2 shadow-xl"
          >
            <DropdownMenuLabel className="p-3 font-normal">
              <div className="flex items-center gap-3">
                <CoupleAvatar
                  size="lg"
                  partnerOneName={partnerOne}
                  partnerTwoName={partnerTwo}
                  partnerOnePhotoUrl={profile.data?.partner_one_photo_url}
                  partnerTwoPhotoUrl={profile.data?.partner_two_photo_url}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{coupleName}</p>
                  <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                    Your shared planning space
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 rounded-xl border border-border bg-muted/35 p-3 text-xs font-normal text-muted-foreground">
                <span className="flex items-center gap-2">
                  <CalendarHeart className="h-3.5 w-3.5 text-primary" /> {weddingDate}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-primary" />{" "}
                  {profile.data?.city || "Add wedding city"}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="min-h-11 rounded-xl px-3">
              <Link to="/settings" className="cursor-pointer">
                <Settings className="h-4 w-4 text-primary" />
                Profile & settings
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
