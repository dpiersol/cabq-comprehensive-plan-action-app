import { describe, expect, it } from "vitest";
import { splitLabel } from "./splitLabel.js";

describe("splitLabel", () => {
  it("splits em-dash combined labels", () => {
    expect(splitLabel("1 — Chapter title")).toEqual({ head: "1", tail: "Chapter title" });
  });
  it("returns full string in head when no separator", () => {
    expect(splitLabel("only")).toEqual({ head: "only", tail: "" });
  });
});
