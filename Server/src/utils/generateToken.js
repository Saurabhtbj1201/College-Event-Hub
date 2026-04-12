const jwt = require("jsonwebtoken");

const generateToken = (admin) => {
  return jwt.sign(
    {
      id: admin._id,
      role: admin.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
};

module.exports = generateToken;
