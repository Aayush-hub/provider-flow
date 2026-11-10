import { describe, expect, it } from "vitest";
import { isValidNpi } from "../lib/npi";

describe("NPI validation", () => {
  it("accepts valid CMS NPIs", () => {
    expect(isValidNpi("1003000126")).toBe(true);
    expect(isValidNpi("1235194721")).toBe(true);
  });
  it("rejects bad format and checksum", () => {
    expect(isValidNpi("123")).toBe(false);
    expect(isValidNpi("1003000127")).toBe(false);
    expect(isValidNpi("abcdefghij")).toBe(false);
  });
});
