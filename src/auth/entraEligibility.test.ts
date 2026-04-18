import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEmailFromClaims,
  isAllowedEmailDomain,
  rolesFromIdTokenClaims,
} from "./entraEligibility";

describe("entraEligibility", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("extracts email from preferred_username", () => {
    expect(getEmailFromClaims({ preferred_username: "Jane@Cabq.gov" })).toBe("jane@cabq.gov");
    expect(isAllowedEmailDomain("someone@cabq.gov")).toBe(true);
    expect(isAllowedEmailDomain("other@gmail.com")).toBe(false);
  });

  it("parses roles from claims", () => {
    expect(rolesFromIdTokenClaims({ roles: ["Application.Admin", "Foo"] })).toEqual([
      "Application.Admin",
      "Foo",
    ]);
    expect(rolesFromIdTokenClaims({ roles: "Single" })).toEqual(["Single"]);
  });
});
