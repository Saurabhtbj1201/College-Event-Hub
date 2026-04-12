const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const User = require("../models/User");
const { ADMIN_PERMISSIONS, hasPermission } = require("../config/permissions");
const { isFeatureEnabled } = require("../config/featureFlags");

let ioInstance = null;
let userNamespaceInstance = null;

const parseToken = (socket) => {
  const authToken = socket.handshake.auth?.token || "";
  const headerToken = socket.handshake.headers?.authorization || "";
  const tokenCandidate = authToken || headerToken;

  if (!tokenCandidate) {
    return "";
  }

  return tokenCandidate.startsWith("Bearer ")
    ? tokenCandidate.split(" ")[1]
    : tokenCandidate;
};

const initializeSocketServer = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
    },
  });

  ioInstance.use(async (socket, next) => {
    try {
      const token = parseToken(socket);

      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const admin = await Admin.findById(decoded.id)
        .select("name role approved permissions")
        .lean();

      if (!admin || !admin.approved) {
        return next(new Error("Unauthorized"));
      }

      if (!hasPermission(admin, ADMIN_PERMISSIONS.COMMAND_VIEW)) {
        return next(new Error("Unauthorized"));
      }

      socket.admin = {
        id: decoded.id,
        name: admin.name,
        role: admin.role,
        permissions: admin.permissions || [],
      };

      return next();
    } catch (error) {
      return next(new Error("Unauthorized"));
    }
  });

  ioInstance.on("connection", (socket) => {
    socket.join("admin:global");

    socket.emit("socket:connected", {
      adminId: socket.admin.id,
      role: socket.admin.role,
      connectedAt: new Date().toISOString(),
    });

    socket.on("command:join-event", (eventId) => {
      const normalizedEventId = String(eventId || "").trim();
      if (mongoose.Types.ObjectId.isValid(normalizedEventId)) {
        socket.join(`event:${normalizedEventId}`);
      }
    });

    socket.on("command:leave-event", (eventId) => {
      const normalizedEventId = String(eventId || "").trim();
      if (mongoose.Types.ObjectId.isValid(normalizedEventId)) {
        socket.leave(`event:${normalizedEventId}`);
      }
    });
  });

  if (isFeatureEnabled("phase2UserAuth")) {
    userNamespaceInstance = ioInstance.of("/user");

    userNamespaceInstance.use(async (socket, next) => {
      try {
        const token = parseToken(socket);

        if (!token) {
          return next(new Error("Unauthorized"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.type !== "user") {
          return next(new Error("Unauthorized"));
        }

        const user = await User.findById(decoded.id)
          .select("name email isActive")
          .lean();

        if (!user || !user.isActive) {
          return next(new Error("Unauthorized"));
        }

        socket.user = {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        };

        return next();
      } catch (error) {
        return next(new Error("Unauthorized"));
      }
    });

    userNamespaceInstance.on("connection", (socket) => {
      socket.join(`user:${socket.user.id}`);

      socket.emit("socket:user-connected", {
        userId: socket.user.id,
        connectedAt: new Date().toISOString(),
      });

      socket.on("user:subscribe-events", (eventIds) => {
        const values = Array.isArray(eventIds) ? eventIds : [];

        const sanitizedEventIds = values
          .map((value) => String(value || "").trim())
          .filter((value, index, items) => items.indexOf(value) === index)
          .filter((value) => mongoose.Types.ObjectId.isValid(value));

        sanitizedEventIds.forEach((eventId) => {
          socket.join(`user-event:${eventId}`);
        });

        socket.emit("user:events-subscribed", {
          eventIds: sanitizedEventIds,
        });
      });

      socket.on("user:unsubscribe-events", (eventIds) => {
        const values = Array.isArray(eventIds) ? eventIds : [];

        values
          .map((value) => String(value || "").trim())
          .filter((value, index, items) => items.indexOf(value) === index)
          .filter((value) => mongoose.Types.ObjectId.isValid(value))
          .forEach((eventId) => {
            socket.leave(`user-event:${eventId}`);
          });
      });
    });
  } else {
    userNamespaceInstance = null;
  }

  return ioInstance;
};

const getIO = () => ioInstance;

const emitToAdmins = (eventName, payload) => {
  if (!ioInstance) {
    return;
  }
  ioInstance.to("admin:global").emit(eventName, payload);
};

const emitToEventRoom = (eventId, eventName, payload) => {
  if (!ioInstance || !eventId) {
    return;
  }
  ioInstance.to(`event:${eventId}`).emit(eventName, payload);
};

const emitToUser = (userId, eventName, payload) => {
  if (!userNamespaceInstance || !userId) {
    return;
  }

  userNamespaceInstance.to(`user:${userId}`).emit(eventName, payload);
};

const emitToUserEventRoom = (eventId, eventName, payload) => {
  if (!userNamespaceInstance || !eventId) {
    return;
  }

  userNamespaceInstance.to(`user-event:${eventId}`).emit(eventName, payload);
};

module.exports = {
  initializeSocketServer,
  getIO,
  emitToAdmins,
  emitToEventRoom,
  emitToUser,
  emitToUserEventRoom,
};
