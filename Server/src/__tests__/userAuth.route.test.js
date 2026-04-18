const request = require("supertest");

jest.mock("../utils/auditLogger", () => ({
  logPublicAudit: jest.fn().mockResolvedValue(null),
  logAdminAudit: jest.fn().mockResolvedValue(null),
}));

const app = require("../app");

describe("user auth routes", () => {
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;

  afterEach(() => {
    if (typeof originalGoogleClientId === "undefined") {
      delete process.env.GOOGLE_CLIENT_ID;
      return;
    }

    process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
  });

  it("returns 400 when idToken is missing", async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    const response = await request(app).post("/api/user/auth/google").send({}).expect(400);

    expect(response.body.message).toBe("idToken is required");
  });

  it("returns 503 when Google login is not configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    const response = await request(app)
      .post("/api/user/auth/google")
      .send({ idToken: "dummy-token" })
      .expect(503);

    expect(response.body.message).toBe("Google login is not configured on server");
  });
});
