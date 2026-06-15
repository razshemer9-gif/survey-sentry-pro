import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://dkbujtvotivpqyomyhnf.supabase.co";

// The new sb_publishable_ key format has connectivity issues — fall back to legacy JWT key
const SUPABASE_ANON_KEY =
  !import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY.startsWith("sb_")
    ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrYnVqdHZvdGl2cHF5b215aG5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Mjk0NzgsImV4cCI6MjA5NDAwNTQ3OH0.IxLBjBgycaauc2a7QyyBh0WKisDsfoGz8jbl-_AafIc"
    : import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
