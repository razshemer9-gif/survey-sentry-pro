import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./supabase-url";

/**
 * Read through import.meta.env without assuming it is there.
 *
 * Vite provides it; a plain bundler does not, and reaching into it blindly
 * throws before a line of the app has run — a blank screen from the module
 * that holds the connection details. The fallback below is this project
 * either way, so there is nothing lost by asking carefully.
 */
function configuredKey(): string | undefined {
  try {
    return (import.meta as unknown as { env?: { VITE_SUPABASE_ANON_KEY?: string } })
      .env?.VITE_SUPABASE_ANON_KEY;
  } catch {
    return undefined;
  }
}

// The new sb_publishable_ key format has connectivity issues — fall back to legacy JWT key
const SUPABASE_ANON_KEY =
  !configuredKey() || configuredKey()!.startsWith("sb_")
    ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYnVqdHZvdGl2cHF5b215aG5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Mjk0NzgsImV4cCI6MjA5NDAwNTQ3OH0.IxLBjBgycaauc2a7QyyBh0WKisDsfoGz8jbl-_AafIc"
    : configuredKey()!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
