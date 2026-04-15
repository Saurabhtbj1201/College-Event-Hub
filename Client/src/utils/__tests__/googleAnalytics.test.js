import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGoogleAnalyticsConfig,
  initializeGoogleAnalytics,
  trackPageView,
} from "../googleAnalytics";

describe("google analytics helpers", () => {
  beforeEach(() => {
    window.dataLayer = [];
    window.gtag = vi.fn();
    document.head.querySelector("#ga4-script")?.remove();
  });

  it("creates disabled config when measurement id is empty", () => {
    expect(getGoogleAnalyticsConfig("")).toEqual({
      measurementId: "",
      enabled: false,
    });
  });

  it("initializes GA when measurement id exists", () => {
    const initialized = initializeGoogleAnalytics("G-TESTMEASURE");
    expect(initialized).toBe(true);
    expect(document.head.querySelector("#ga4-script")).not.toBeNull();
  });

  it("tracks page views when gtag is available", () => {
    trackPageView("G-TESTMEASURE", "/dashboard");
    expect(window.gtag).toHaveBeenCalledWith("event", "page_view", {
      page_path: "/dashboard",
      send_to: "G-TESTMEASURE",
    });
  });
});
