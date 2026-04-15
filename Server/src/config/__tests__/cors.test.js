const {
  getAllowedOrigins,
  isOriginAllowed,
  corsOriginHandler,
} = require("../cors");

describe("cors config", () => {
  const previousClientUrl = process.env.CLIENT_URL;
  const previousAllowed = process.env.CORS_ALLOWED_ORIGINS;

  afterEach(() => {
    process.env.CLIENT_URL = previousClientUrl;
    process.env.CORS_ALLOWED_ORIGINS = previousAllowed;
  });

  it("includes local defaults", () => {
    delete process.env.CLIENT_URL;
    delete process.env.CORS_ALLOWED_ORIGINS;

    const origins = getAllowedOrigins();
    expect(origins).toContain("http://localhost:5173");
    expect(origins).toContain("http://127.0.0.1:5173");
  });

  it("allows configured origins and blocks unknown origin", () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://app.college.edu";
    expect(isOriginAllowed("https://app.college.edu")).toBe(true);
    expect(isOriginAllowed("https://evil.example")).toBe(false);
  });

  it("returns callback error for blocked origin", () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://app.college.edu";

    const callback = jest.fn();
    corsOriginHandler("https://evil.example", callback);

    expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(callback.mock.calls[0][1]).toBeUndefined();
  });
});
