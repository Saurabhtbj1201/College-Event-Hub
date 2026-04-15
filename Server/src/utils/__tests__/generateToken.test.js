const generateToken = require("../generateToken");
const generateUserToken = require("../generateUserToken");

describe("jwt generators", () => {
  const prevSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-key-for-jwt";
  });

  afterEach(() => {
    process.env.JWT_SECRET = prevSecret;
  });

  it("generates admin token with defined schema", () => {
    const adminId = "mock-admin-id";
    const token = generateToken(adminId);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
  });

  it("generates user token with defined schema", () => {
    const user = { _id: "mock-user-id" };
    const token = generateUserToken(user);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
  });
});
