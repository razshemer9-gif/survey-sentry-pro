/**
 * Where this app's Supabase project lives.
 *
 * Its own module so that reading the stored session does not have to import
 * the client — and so a test that mocks the client does not have to know
 * about the session reader at all.
 */

/**
 * Read through import.meta.env without assuming it is there.
 *
 * Vite provides it; a plain bundler does not, and reaching into it blindly
 * throws before a single line of the app has run — a blank screen, from a
 * module whose whole job is to hold one string. The fallback below is the
 * project either way, so there is nothing to lose by asking carefully.
 */
function configuredUrl(): string | undefined {
  try {
    return (import.meta as unknown as { env?: { VITE_SUPABASE_URL?: string } })
      .env?.VITE_SUPABASE_URL;
  } catch {
    return undefined;
  }
}

export const SUPABASE_URL = configuredUrl() ?? "https://dkbujtvotivpqyomyhnf.supabase.co";
