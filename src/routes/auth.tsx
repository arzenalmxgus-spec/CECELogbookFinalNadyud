import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { recordAudit } from "@/lib/audit";
import { isAdminUser } from "@/lib/is-admin";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Administrator Sign In — Office Visitor Logbook" },
      {
        name: "description",
        content: "Secure administrator sign-in for the RFID office visitor logbook management system.",
      },
      { property: "og:title", content: "Administrator Sign In — Office Visitor Logbook" },
      {
        property: "og:description",
        content: "Administrator-only access to the RFID office visitor logbook.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);


  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = credentials.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) throw error;

      const { data: userData } = await supabase.auth.getUser();
      const isAdmin = await isAdminUser(userData.user!.id);

      if (!isAdmin) {
        setPending(true);
        toast.error("Your account is awaiting administrator approval.");
        return;
      }

      await recordAudit("login", "Administrator signed in");
      toast.success("Welcome back");
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="hidden flex-col justify-between bg-sidebar p-12 lg:flex">
        <Link to="/" className="flex items-center gap-3 text-sidebar-foreground">
          <span className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <ScanLine className="size-5" />
          </span>
          <span className="font-semibold">Visitor Logbook</span>
        </Link>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight text-sidebar-foreground">
            Scan a card. The rest of the logbook fills itself in.
          </h2>
          <p className="mt-4 max-w-md text-sm text-sidebar-foreground/70">
            RFID identification, live occupancy tracking, complete visit history, and professional
            Excel, PDF, and CSV reports — all restricted to administrators.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">Administrator access only. No visitor accounts.</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-sm animate-fade">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ScanLine className="size-5" />
            </span>
            <span className="font-semibold">Visitor Logbook</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your administrator account to open the front desk.
          </p>

          {pending ? (
            <div className="mt-6 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
              <p className="font-medium text-foreground">Awaiting approval</p>
              <p className="mt-1 text-muted-foreground">
                Your account exists but has not been granted administrator rights yet. Ask an existing
                administrator to approve it.
              </p>
            </div>
          ) : null}

          <form className="mt-6 space-y-4" method="post" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="signin-email">Work email</Label>
              <Input
                id="signin-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={255}
                placeholder="admin@office.example"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password">Password</Label>
              <Input
                id="signin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                maxLength={72}
                placeholder="••••••••"
                className="h-11"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading || !ready}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Sign in
            </Button>

          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleGoogle}
            disabled={loading}
          >
            Continue with Google
          </Button>

          <p className="mt-6 text-xs text-muted-foreground">
            Accounts are created by an existing administrator. Contact your system administrator if
            you need access.
          </p>
        </div>
      </main>

    </div>
  );
}
