const { protectUser } = require("../userAuthMiddleware");
const User = require("../../models/User");
const jwt = require("jsonwebtoken");

jest.mock("../../models/User");
jest.mock("jsonwebtoken");

describe("userAuthMiddleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("protectUser", () => {
    it("fails with 401 if token is missing", async () => {
      await protectUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Not authorized, no user token" });
    });

    it("fails with 401 if invalid format", async () => {
      req.headers.authorization = "Basic token";
      await protectUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Not authorized, no user token" });
    });

    it("fails with 401 if token fails verification", async () => {
      req.headers.authorization = "Bearer bad-token";
      jwt.verify.mockImplementation(() => {
        throw new Error("Invalid format");
      });
      await protectUser(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Not authorized, user token failed" });
    });

    it("succeeds and attaches user to request", async () => {
      req.headers.authorization = "Bearer valid-token";
      jwt.verify.mockReturnValue({ id: "user-id" });
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: "user-id", email: "test@example.com" }),
      });

      await protectUser(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith("valid-token", process.env.JWT_SECRET);
      expect(User.findById).toHaveBeenCalledWith("user-id");
      expect(req.user).toBeDefined();
      expect(req.user.email).toBe("test@example.com");
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
