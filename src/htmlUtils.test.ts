import { describe, expect, it } from "vitest";
import { plainTextFromHtml } from "./htmlUtils";

describe("plainTextFromHtml", () => {
  it("strips tags", () => {
    expect(plainTextFromHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("treats empty editor HTML as empty", () => {
    expect(plainTextFromHtml("<p><br></p>")).toBe("");
    expect(plainTextFromHtml("<p></p>")).toBe("");
  });
});
