import { describe, expect, it } from "vitest";
import { formatDateTime } from "../date";

describe("formatDateTime", () => {
  it("returns Invalid date for bad values", () => {
    expect(formatDateTime("not-a-date")).toBe("Invalid date");
  });

  it("formats valid datetime values", () => {
    const formatted = formatDateTime("2026-04-15T10:30:00.000Z");
    expect(formatted).not.toBe("Invalid date");
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
  });
});
