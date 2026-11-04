/**
 * Modular RFID service.
 *
 * The default implementation targets USB HID readers that emulate a keyboard:
 * they "type" the card UID very quickly and finish with Enter. Swapping in
 * WebSerial / WebUSB / network readers later only requires another
 * `RfidReader` implementation — the UI depends on this interface only.
 */
export interface RfidReader {
  readonly id: string;
  start(onScan: (uid: string) => void): () => void;
}

export function normalizeUid(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

interface HidOptions {
  /** Max ms allowed between characters for input to count as a scan, not typing. */
  maxKeyIntervalMs?: number;
  /** Minimum UID length to accept. */
  minLength?: number;
}

export function createHidKeyboardReader(options: HidOptions = {}): RfidReader {
  const maxKeyIntervalMs = options.maxKeyIntervalMs ?? 90;
  const minLength = options.minLength ?? 4;

  return {
    id: "usb-hid-keyboard",
    start(onScan) {
      let buffer = "";
      let lastKeyAt = 0;

      const handler = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        const isFreeTextField =
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLInputElement && target.dataset.rfidCapture !== "true");

        const now = Date.now();
        if (now - lastKeyAt > maxKeyIntervalMs) buffer = "";
        lastKeyAt = now;

        if (event.key === "Enter") {
          const uid = normalizeUid(buffer);
          buffer = "";
          if (uid.length >= minLength) {
            event.preventDefault();
            onScan(uid);
          }
          return;
        }

        if (event.key.length === 1 && /[a-zA-Z0-9:_-]/.test(event.key)) {
          buffer += event.key;
          // Prevent stray characters leaking into unrelated fields mid-scan.
          if (isFreeTextField && buffer.length > 3) return;
        } else {
          buffer = "";
        }
      };

      window.addEventListener("keydown", handler, true);
      return () => window.removeEventListener("keydown", handler, true);
    },
  };
}
