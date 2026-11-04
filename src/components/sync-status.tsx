import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { cn } from "@/lib/utils";

/** Compact Online / Offline / Syncing pill for the app header. */
export function SyncStatusIndicator({ className }: { className?: string }) {
  const { state, pending, runSync } = useSyncStatus();

  const config = {
    online: { label: "Online", icon: Wifi, tone: "border-success/40 bg-success/10 text-success" },
    offline: { label: "Offline", icon: CloudOff, tone: "border-warning/40 bg-warning/15 text-warning" },
    syncing: { label: "Syncing", icon: RefreshCw, tone: "border-primary/40 bg-primary/10 text-primary" },
  }[state];

  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={() => void runSync()}
      title={pending > 0 ? `${pending} change(s) waiting to sync` : "Connection status"}
      aria-label={`Connection status: ${config.label}`}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        config.tone,
        className,
      )}
    >
      <Icon className={cn("size-3.5", state === "syncing" && "animate-spin")} />
      <span className="hidden sm:inline">{config.label}</span>
      {pending > 0 ? <span className="tabular-nums">({pending})</span> : null}
    </button>
  );
}
