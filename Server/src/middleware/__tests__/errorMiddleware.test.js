const { notFound, errorHandler } = require("../errorMiddleware");

describe("errorMiddleware", () => {
  it("notFound calls next with 404 error", () => {
    const req = { originalUrl: "/api/missing" };
    const res = { status: jest.fn() };
    const next = jest.fn();

    notFound(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe("Not Found - /api/missing");
  });

  it("errorHandler sends error details without stack in production", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const error = new Error("Test error");
    const req = {};
    const res = {
      statusCode: 500,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Test error",
      stack: null,
    });

    process.env.NODE_ENV = prevEnv;
  });

  it("errorHandler includes stack in development", () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const error = new Error("Test dev error");
    const req = {};
    const res = {
      statusCode: 400,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Test dev error",
      stack: expect.any(String),
    });

    process.env.NODE_ENV = prevEnv;
  });

  it("errorHandler converts 200 status to 500", () => {
    const error = new Error("Server fault");
    const req = {};
    const res = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    errorHandler(error, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
