import { describe, it, expect } from "vitest";

describe("test setup", () => {
  it("should run vitest with jsdom environment", () => {
    expect(true).toBe(true);
  });

  it("should have jsdom DOM APIs available", () => {
    const div = document.createElement("div");
    div.textContent = "hello";
    expect(div.textContent).toBe("hello");
  });
});
