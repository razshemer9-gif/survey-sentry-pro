import { describe, expect, it } from "vitest";
import { canUseStaticCalc } from "./static-calc-access";

describe("canUseStaticCalc", () => {
  it("offers it to the two people who use it", () => {
    expect(canUseStaticCalc("razshemer9@gmail.com")).toBe(true);
    expect(canUseStaticCalc("ziv@shemera.co.il")).toBe(true);
  });

  it("does not offer it to anyone else", () => {
    expect(canUseStaticCalc("someone@shemera.co.il")).toBe(false);
    expect(canUseStaticCalc("razshemer9@gmail.com.attacker.test")).toBe(false);
    expect(canUseStaticCalc("ziv@shemera.co.il ok")).toBe(false);
  });

  // Supabase stores the address as it was typed at sign-up.
  it("reads an address however it was typed", () => {
    expect(canUseStaticCalc("Ziv@Shemera.co.il")).toBe(true);
    expect(canUseStaticCalc("  RazShemer9@Gmail.com  ")).toBe(true);
  });

  it("shows nothing before the account is known", () => {
    expect(canUseStaticCalc(undefined)).toBe(false);
    expect(canUseStaticCalc(null)).toBe(false);
    expect(canUseStaticCalc("")).toBe(false);
  });
});
