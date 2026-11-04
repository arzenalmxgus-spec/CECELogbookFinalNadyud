import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2, RadioTower, RotateCcw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRfidScanner } from "@/hooks/use-rfid-scanner";
import { normalizeUid } from "@/lib/rfid-service";
import { VISIT_PURPOSES, type Visitor } from "@/lib/types";
import {
  checkInVisitor,
  createVisitor,
  findVisitorByRfid,
  queryKeys,
} from "@/lib/visitor-service";

export const Route = createFileRoute("/_authenticated/check-in")({
  head: () => ({
    meta: [
      { title: "Scan & Check In — Office Visitor Logbook" },
      { name: "description", content: "Scan an RFID card to identify a visitor and record their visit." },
      { property: "og:title", content: "Scan & Check In — Office Visitor Logbook" },
      { property: "og:description", content: "RFID check-in desk for office visitors." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckInPage,
});

const visitorSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(120),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  contact_number: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
});

const visitSchema = z.object({
  office_to_visit: z.string().trim().min(2, "Person or office to visit is required").max(120),
  purpose: z.string().trim().min(2, "Purpose of visit is required").max(120),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
});

type Mode = "idle" | "known" | "new";

function CheckInPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("idle");
  const [uid, setUid] = useState("");
  const [manualUid, setManualUid] = useState("");
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [looking, setLooking] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    company: "",
    contact_number: "",
    email: "",
    office_to_visit: "",
    purpose: "",
    remarks: "",
  });


  const reset = () => {
    setMode("idle");
    setUid("");
    setManualUid("");
    setVisitor(null);
    setForm({
      full_name: "",
      company: "",
      contact_number: "",
      email: "",
      office_to_visit: "",
      purpose: "",
      remarks: "",
    });
  };

  async function handleScan(scanned: string) {
    const normalized = normalizeUid(scanned);
    if (!normalized) return;
    setLooking(true);
    try {
      const found = await findVisitorByRfid(normalized);
      setUid(normalized);
      if (found) {
        setVisitor(found);
        setMode("known");
        toast.success(`Welcome back, ${found.full_name}`);
      } else {
        setVisitor(null);
        setMode("new");
        toast.info("Unregistered card — please register this visitor.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lookup failed");
    } finally {
      setLooking(false);
    }
  }

  useRfidScanner(handleScan, mode === "idle" && !looking);

  const checkIn = useMutation({
    mutationFn: async () => {
      const visit = visitSchema.safeParse(form);
      if (!visit.success) throw new Error(visit.error.issues[0].message);

      let target = visitor;
      if (!target) {
        const profile = visitorSchema.safeParse(form);
        if (!profile.success) throw new Error(profile.error.issues[0].message);
        target = await createVisitor({
          rfid_uid: uid || null,
          full_name: profile.data.full_name,
          company: profile.data.company || null,
          contact_number: profile.data.contact_number || null,
          email: profile.data.email || null,
        });
      }

      await checkInVisitor(target.id, {
        office_to_visit: visit.data.office_to_visit,
        purpose: visit.data.purpose,
        remarks: visit.data.remarks || null,
      });
      return target;
    },
    onSuccess: (target) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logs });
      queryClient.invalidateQueries({ queryKey: queryKeys.visitors });
      toast.success(`${target.full_name} checked in`);
      reset();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Check-in failed"),
  });


  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <AppShell
      title="Scan & Check In"
      description="Tap an RFID card on the reader to identify the visitor"
      actions={
        mode !== "idle" ? (
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="size-4" /> New scan
          </Button>
        ) : null
      }
    >
      <div>
        <div className="space-y-6">
          {mode === "idle" ? (
            <section className="surface-panel flex flex-col items-center gap-5 px-6 py-14 text-center">
              <span className="grid size-20 place-items-center rounded-full bg-primary/10 text-primary scan-pulse">
                {looking ? <Loader2 className="size-8 animate-spin" /> : <RadioTower className="size-8" />}
              </span>
              <div>
                <h2 className="text-lg font-semibold">Waiting for an RFID card…</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Tap the visitor's card on the USB reader. Returning visitors are recognised
                  automatically and their details are filled in for you.
                </p>
              </div>
              <form
                className="flex w-full max-w-sm gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (manualUid.trim()) handleScan(manualUid);
                }}
              >
                <Input
                  data-rfid-capture="true"
                  value={manualUid}
                  onChange={(event) => setManualUid(event.target.value)}
                  placeholder="Or type the card UID"
                  maxLength={64}
                />
                <Button type="submit" variant="secondary">
                  Look up
                </Button>
              </form>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUid("");
                  setVisitor(null);
                  setMode("new");
                }}
              >
                <UserPlus className="size-4" /> Register a visitor without a card
              </Button>
            </section>
          ) : (
            <section className="surface-panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {mode === "known" ? "Returning visitor" : "New visitor registration"}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    {mode === "known" ? visitor?.full_name : "Register visitor"}
                  </h2>
                </div>
                {uid ? (
                  <span className="rounded-lg bg-muted px-3 py-1.5 font-mono text-xs">RFID {uid}</span>
                ) : (
                  <span className="rounded-lg bg-muted px-3 py-1.5 text-xs">No card assigned</span>
                )}
              </div>

              {mode === "known" && visitor ? (
                <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                  {[
                    ["Program", visitor.company],
                    ["Contact", visitor.contact_number],
                    ["Email", visitor.email],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="truncate text-sm font-medium">{(value as string) || "—"}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="full_name">Full name *</Label>
                    <Input id="full_name" maxLength={120} required {...field("full_name")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Program</Label>
                    <Input id="company" maxLength={120} {...field("company")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_number">Contact number</Label>
                    <Input id="contact_number" maxLength={40} {...field("contact_number")} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" maxLength={255} {...field("email")} />
                  </div>
                </div>
              )}

              <div className="mt-6 border-t border-border pt-6">
                <h3 className="text-sm font-semibold">Visit details</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="office_to_visit">Person or office to visit *</Label>
                    <Input
                      id="office_to_visit"
                      maxLength={120}
                      placeholder="e.g. Accounting Office"
                      {...field("office_to_visit")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="purpose">Purpose of visit *</Label>
                    <Select
                      value={form.purpose}
                      onValueChange={(value) => setForm((current) => ({ ...current, purpose: value }))}
                    >
                      <SelectTrigger id="purpose">
                        <SelectValue placeholder="Select a purpose" />
                      </SelectTrigger>
                      <SelectContent>
                        {VISIT_PURPOSES.map((purpose) => (
                          <SelectItem key={purpose} value={purpose}>
                            {purpose}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="remarks">Remarks</Label>
                    <Textarea id="remarks" rows={3} maxLength={500} {...field("remarks")} />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button onClick={() => checkIn.mutate()} disabled={checkIn.isPending}>
                  {checkIn.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Check In
                </Button>
                <Button variant="outline" onClick={reset}>
                  Cancel
                </Button>
              </div>
            </section>
          )}
        </div>

      </div>
    </AppShell>
  );
}
