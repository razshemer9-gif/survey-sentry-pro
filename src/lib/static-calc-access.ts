// Who sees the link to our static-calculations app.
//
// It is a separate app of ours, and for now only the two people below work
// with it; everyone else's survey-type list is unchanged. This decides what
// the app DRAWS, not what the other app allows — anyone who knows its address
// can open it directly, so this is a question of who is offered it, not of
// who can reach it.

export const STATIC_CALC_URL = "https://shemer-static-calc.web.app/";

/**
 * Compared in lower case and trimmed: Supabase keeps the address as it was
 * typed at sign-up, so "Ziv@..." and " ziv@... " are the same person.
 */
const ALLOWED = ["razshemer9@gmail.com", "ziv@shemera.co.il"];

export function canUseStaticCalc(email?: string | null): boolean {
  if (!email) return false;
  return ALLOWED.includes(email.trim().toLowerCase());
}
