import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, FileSpreadsheet, ScanLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Office Visitor Logbook — RFID Visitor Management" },
      {
        name: "description",
        content:
          "An RFID-powered office visitor logbook: scan a card, identify returning visitors instantly, track who is inside, and export professional reports.",
      },
      { property: "og:title", content: "Office Visitor Logbook — RFID Visitor Management" },
      {
        property: "og:description",
        content:
          "Administrator-only visitor logbook with RFID check-in, live occupancy, audit trail, and Excel, PDF, and CSV reports.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: ScanLine,
    title: "RFID recognition",
    body: "Tap a card on a USB HID reader and returning visitors are identified and pre-filled instantly.",
  },
  {
    icon: ClipboardList,
    title: "Live logbook",
    body: "Every visit records time in, time out, duration, and status so you always know who is inside.",
  },
  {
    icon: FileSpreadsheet,
    title: "Professional reports",
    body: "Filter any period and export styled Excel, PDF, or CSV reports with summary statistics.",
  },
  {
    icon: ShieldCheck,
    title: "Administrator only",
    body: "No public sign-up. Protected routes, row-level security, and a full audit trail of every action.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ScanLine className="size-5" />
          </span>
          <span className="font-semibold">Visitor Logbook</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Administrator sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-10 pb-16 sm:pt-20">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-accent scan-pulse" />
          RFID front-desk system
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] sm:text-6xl">
          The office visitor logbook that remembers everyone who walks in.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Replace the paper sheet at reception. Scan an RFID card, confirm the purpose of the visit,
          and the system handles identification, check-out timing, history, and reporting.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Open the front desk</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Administrator sign-in required — accounts are issued internally.
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="surface-panel p-6">
              <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 text-base font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
          Office Visitor Logbook Management System — administrator access only.
        </div>
      </footer>
    </div>
  );
}
