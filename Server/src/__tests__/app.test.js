const request = require("supertest");
const app = require("../app");

describe("app", () => {
  it("returns health status", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body).toEqual({ message: "API is running" });
  });

  it("returns not found payload for unknown routes", async () => {
    const response = await request(app).get("/api/unknown").expect(404);
    expect(response.body.message).toContain("Not Found - /api/unknown");
  });
});
