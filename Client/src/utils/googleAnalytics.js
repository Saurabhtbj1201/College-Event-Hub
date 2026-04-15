let scriptInjected = false;

export const getGoogleAnalyticsConfig = (measurementId) => {
  const id = String(measurementId || "").trim();
  return {
    measurementId: id,
    enabled: Boolean(id),
  };
};

export const initializeGoogleAnalytics = (measurementId) => {
  if (typeof window === "undefined") {
    return false;
  }

  const config = getGoogleAnalyticsConfig(measurementId);
  if (!config.enabled) {
    return false;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };

  if (!scriptInjected && !document.getElementById("ga4-script")) {
    const script = document.createElement("script");
    script.id = "ga4-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
      config.measurementId
    )}`;
    document.head.appendChild(script);
    scriptInjected = true;
  }

  window.gtag("js", new Date());
  window.gtag("config", config.measurementId, { send_page_view: false });
  return true;
};

export const trackPageView = (measurementId, pagePath) => {
  const config = getGoogleAnalyticsConfig(measurementId);

  if (!config.enabled || typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", "page_view", {
    page_path: pagePath,
    send_to: config.measurementId,
  });
};
