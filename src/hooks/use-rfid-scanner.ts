import { useEffect, useRef } from "react";
import { createHidKeyboardReader, type RfidReader } from "@/lib/rfid-service";

/**
 * Listens for RFID card scans from a USB HID reader while `enabled` is true.
 */
export function useRfidScanner(onScan: (uid: string) => void, enabled = true, reader?: RfidReader) {
  const callbackRef = useRef(onScan);
  callbackRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    const activeReader = reader ?? createHidKeyboardReader();
    return activeReader.start((uid) => callbackRef.current(uid));
  }, [enabled, reader]);
}
