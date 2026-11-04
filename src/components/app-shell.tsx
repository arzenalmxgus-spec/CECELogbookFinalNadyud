import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ScanLine,
  GraduationCap,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SyncStatusIndicator } from "@/components/sync-status";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { recordAudit } from "@/lib/audit";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Front desk",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/check-in", label: "Scan & Check In", icon: ScanLine },
    ],
  },
  {
    label: "Records",
    items: [
      { to: "/logbook", label: "Logbook", icon: ClipboardList },
      { to: "/visitors", label: "Visitors", icon: Users },
      { to: "/students", label: "Students", icon: GraduationCap },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/reports", label: "Reports", icon: FileBarChart },
      { to: "/audit", label: "Audit Trail", icon: ShieldCheck },
    ],
  },
] as const;

const linkClass =
  "group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-all duration-200 hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mt-2 first:mt-0">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
            {group.label}
          </p>
          {group.items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              className={linkClass}
              activeProps={{
                className:
                  "group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-sm font-semibold bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_var(--sidebar-primary)]",
              }}
            >
              <Icon className="size-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              {label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-3 py-1">
      <div className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_0_0_0_var(--sidebar-primary)] transition-shadow duration-300 hover:shadow-[0_0_24px_-4px_var(--sidebar-primary)]">
        <ScanLine className="size-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-sidebar-foreground">Visitor Logbook</p>
        <p className="text-xs text-sidebar-foreground/60">RFID Front Desk</p>
      </div>
    </div>
  );
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useRealtimeSync();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await recordAudit("logout", "Administrator signed out");
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <Brand />
        <NavLinks />
        <div className="mt-auto rounded-xl bg-sidebar-accent/60 p-3">
          <p className="truncate text-xs font-medium text-sidebar-foreground">{email ?? "Administrator"}</p>
          <p className="text-[11px] text-sidebar-foreground/60">Administrator access</p>
          <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={handleSignOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-4">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-full flex-col gap-6">
                <Brand />
                <NavLinks onNavigate={() => setMobileOpen(false)} />
                <Button variant="secondary" size="sm" className="mt-auto" onClick={handleSignOut}>
                  <LogOut className="size-4" /> Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
            {description ? (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">{description}</p>
            ) : null}
          </div>

          <div className={cn("flex items-center gap-2")}>
            <SyncStatusIndicator />
            {actions}

            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle dark mode">
              {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
          </div>
        </header>

        <main key={pathname} className="animate-fade flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
