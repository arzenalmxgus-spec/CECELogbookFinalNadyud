import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Shows a calm, persistent notice while the device has no network connection. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 border-t border-warning/40 bg-warning/15 px-4 py-2 text-xs font-medium text-foreground backdrop-blur-md"
    >
      <WifiOff className="size-4" />
      You're offline — the app stays open, but new check-ins will sync once you reconnect.
    </div>
  );
}
