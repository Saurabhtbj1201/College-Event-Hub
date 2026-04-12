const dotenv = require("dotenv");
const http = require("http");

dotenv.config();

const connectDB = require("./config/db");
const app = require("./app");
const { initializeSocketServer } = require("./realtime/socketServer");

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  const httpServer = http.createServer(app);

  initializeSocketServer(httpServer);

  // ✅ Start server FIRST
  httpServer.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });

  // ✅ Then connect DB
  try {
    await connectDB();
    console.log("✅ Database connected");
  } catch (error) {
    console.error("❌ DB connection failed:", error.message);
  }
};

startServer();