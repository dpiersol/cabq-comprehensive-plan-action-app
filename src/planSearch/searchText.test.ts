import { describe, expect, it } from "vitest";
import { blobPart, mergeSearchParts } from "./searchText";

describe("searchText", () => {
  it("blobPart handles null and undefined", () => {
    expect(blobPart(null)).toBe("");
    expect(blobPart(undefined)).toBe("");
  });

  it("blobPart trims strings", () => {
    expect(blobPart("  hi  ")).toBe("hi");
  });

  it("blobPart stringifies numbers", () => {
    expect(blobPart(4.1)).toBe("4.1");
  });

  it("mergeSearchParts joins and lowercases", () => {
    expect(mergeSearchParts("Hello", "World")).toBe("hello world");
  });

  it("mergeSearchParts drops empty parts", () => {
    expect(mergeSearchParts("A", null, "B", undefined, "")).toBe("a b");
  });
});
