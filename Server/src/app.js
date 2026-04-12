const express = require("express");
const cors = require("cors");
const { corsOriginHandler } = require("./config/cors");

const publicRoutes = require("./routes/publicRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: corsOriginHandler,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ message: "API is running" });
});

app.use("/api/public", publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
