import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Who a screen says did the work.
 *
 * profiles.full_name starts empty on every account, so without a step in
 * between, every list that names people — the company's reports, and now
 * the monthly hours summary the finance office reads — printed raw e-mail
 * addresses. That is the one thing the naming rules exist to prevent.
 */

const rows: { user_id: string; full_name: string | null; email: string | null }[] = [];
let updated: { userId: string; name: string } | null = null;
let updateError: { message: string } | null = null;

vi.mock("./supabase", () => ({
  supabase: {
    from: () => ({
      select: async () => ({ data: rows, error: null }),
      update: (patch: { full_name: string }) => ({
        eq: async (_col: string, value: string) => {
          updated = { userId: value, name: patch.full_name };
          return { error: updateError };
        },
      }),
    }),
  },
}));

const { remoteListReportAuthors, remoteSetProfileName } = await import("./reports-remote");

beforeEach(() => {
  rows.length = 0;
  updated = null;
  updateError = null;
});

describe("naming the person who did the work", () => {
  it("uses the name they saved for themselves", () => {
    rows.push({ user_id: "u1", full_name: "מריס כהן", email: "info@shemer.co.il" });
    return expect(remoteListReportAuthors()).resolves.toEqual({ u1: "מריס כהן" });
  });

  it("falls back to the name recorded for the account, not the address", async () => {
    // Nobody has typed a name yet — the e-mail must still not reach a screen.
    rows.push({ user_id: "u1", full_name: null, email: "shemerziv@shemer.co.il" });
    rows.push({ user_id: "u2", full_name: "", email: "info@shemer.co.il" });
    await expect(remoteListReportAuthors()).resolves.toEqual({ u1: "זיו", u2: "מריס" });
  });

  it("shows the address only for an account nobody has named", async () => {
    // An unnamed account still has to be told apart from the others, and on
    // an admin screen the address is what does that.
    rows.push({ user_id: "u3", full_name: null, email: "newhire@shemer.co.il" });
    await expect(remoteListReportAuthors()).resolves.toEqual({ u3: "newhire@shemer.co.il" });
  });

  it("leaves out an account with neither a name nor an address", async () => {
    rows.push({ user_id: "u4", full_name: null, email: null });
    await expect(remoteListReportAuthors()).resolves.toEqual({});
  });
});

describe("publishing the name you chose", () => {
  it("writes it against your own user id", async () => {
    await remoteSetProfileName("u1", "מריס כהן");
    expect(updated).toEqual({ userId: "u1", name: "מריס כהן" });
  });

  it("raises when the database refuses", async () => {
    updateError = { message: "not allowed" };
    await expect(remoteSetProfileName("u1", "מריס")).rejects.toBeTruthy();
  });
});
