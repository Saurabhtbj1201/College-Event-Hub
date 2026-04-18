const { protectAdmin, requireSuperAdmin, requirePermission } = require("../authMiddleware");
const Admin = require("../../models/Admin");
const jwt = require("jsonwebtoken");

jest.mock("../../models/Admin");
jest.mock("jsonwebtoken");

describe("authMiddleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      statusCode: 200,
      status: jest.fn(function status(code) {
        this.statusCode = code;
        return this;
      }),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe("protectAdmin", () => {
    it("fails if no auth header", async () => {
      await protectAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe("Not authorized. Token missing");
    });

    it("fails if not bearer token", async () => {
      req.headers.authorization = "Basic token123";
      await protectAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe("Not authorized. Token missing");
    });

    it("fails if token validation throws", async () => {
      req.headers.authorization = "Bearer invalidtoken";
      jwt.verify.mockImplementation(() => {
        throw new Error("jwt malformed");
      });
      await protectAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe("jwt malformed");
    });

    it("succeeds and attaches admin object to req", async () => {
      req.headers.authorization = "Bearer validtoken";
      jwt.verify.mockReturnValue({ id: "admin-id" });
      Admin.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: "admin-id", role: "admin", approved: true }),
      });

      await protectAdmin(req, res, next);
      expect(req.admin).toBeDefined();
      expect(req.admin._id).toBe("admin-id");
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("requireSuperAdmin", () => {
    it("fails if not super-admin", () => {
      req.admin = { role: "admin" };
      expect(() => requireSuperAdmin(req, res, next)).toThrow(
        "Only super-admin can perform this action"
      );
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("succeeds if super-admin", () => {
      req.admin = { role: "super-admin" };
      requireSuperAdmin(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("requirePermission", () => {
    it("fails if admin lacks required permission and is not super admin", () => {
      req.admin = { role: "admin", permissions: ["view_events"] };
      const middleware = requirePermission("create_events");
      expect(() => middleware(req, res, next)).toThrow(
        "Insufficient permissions for this action"
      );
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("succeeds if admin has required permission", () => {
      req.admin = { role: "admin", permissions: ["create_events"] };
      const middleware = requirePermission("create_events");
      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("succeeds if super admin even missing permission explicit string", () => {
      req.admin = { role: "super-admin", permissions: [] };
      const middleware = requirePermission("create_events");
      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
