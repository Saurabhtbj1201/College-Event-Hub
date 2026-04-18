const { logPublicAudit } = require("../auditLogger");
const AuditLog = require("../../models/AuditLog");

jest.mock("../../models/AuditLog");

describe("auditLogger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("logPublicAudit", () => {
    it("creates an audit log entry using request info", async () => {
      const mockReq = {
        headers: {
          "user-agent": "user-agent-string",
        },
        ip: "127.0.0.1",
      };

      const params = {
        req: mockReq,
        actorId: "actor-1",
        action: "public.register",
        resourceType: "registration",
        resourceId: "reg-1",
        status: "success",
        details: { code: 123 },
      };

      await logPublicAudit(params);

      expect(AuditLog.create).toHaveBeenCalledTimes(1);
      const callData = AuditLog.create.mock.calls[0][0];

      expect(callData).toMatchObject({
        actorType: "public",
        actorId: "actor-1",
        action: "public.register",
        resourceType: "registration",
        resourceId: "reg-1",
        status: "success",
        ipAddress: "127.0.0.1",
        userAgent: "user-agent-string",
      });
      expect(callData.details.code).toBe(123);
    });

    it("suppresses errors when creation fails", async () => {
      const mockReq = {
        headers: {
          "user-agent": "user-agent-string",
        },
        ip: "127.0.0.1",
      };
      
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      AuditLog.create.mockRejectedValue(new Error("DB Connection Lost"));

      await expect(
        logPublicAudit({
          req: mockReq,
          action: "public.register",
          resourceType: "registration",
          status: "success",
        })
      ).resolves.toBeNull();

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
