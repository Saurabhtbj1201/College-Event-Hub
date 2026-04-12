const jwt = require("jsonwebtoken");

const generateUserToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      type: "user",
    },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );

module.exports = generateUserToken;
