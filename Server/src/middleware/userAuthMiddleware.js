const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protectUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401);
      throw new Error("User authorization token missing");
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "user") {
      res.status(401);
      throw new Error("Invalid user session token");
    }

    const user = await User.findById(decoded.id).select("-__v");

    if (!user || !user.isActive) {
      res.status(401);
      throw new Error("User account unavailable");
    }

    req.user = user;
    next();
  } catch (error) {
    if (res.statusCode === 200) {
      res.status(401);
    }

    next(error);
  }
};

module.exports = {
  protectUser,
};
