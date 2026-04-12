const dotenv = require("dotenv");
const http = require("http");

dotenv.config();

const connectDB = require("./config/db");
const app = require("./app");
const { initializeSocketServer } = require("./realtime/socketServer");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const httpServer = http.createServer(app);
  initializeSocketServer(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
};

startServer();
