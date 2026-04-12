const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const generateUserToken = require("../utils/generateUserToken");
const { logPublicAudit } = require("../utils/auditLogger");

let oauthClient = null;

const getOauthClient = () => {
  if (!oauthClient) {
    oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return oauthClient;
};

const sanitizeUser = (user) => ({
  id: user._id,
  googleId: user.googleId,
  email: user.email,
  name: user.name,
  picture: user.picture,
  lastLoginAt: user.lastLoginAt,
});

const loginWithGoogle = async (req, res, next) => {
  const { idToken } = req.body;

  try {
    if (!idToken) {
      await logPublicAudit({
        req,
        action: "auth.user.google",
        resourceType: "user",
        status: "blocked",
        details: { reason: "missing-id-token" },
      });

      res.status(400);
      throw new Error("idToken is required");
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      res.status(503);
      throw new Error("Google login is not configured on server");
    }

    const ticket = await getOauthClient().verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload?.email) {
      await logPublicAudit({
        req,
        action: "auth.user.google",
        resourceType: "user",
        status: "blocked",
        details: { reason: "missing-google-payload" },
      });

      res.status(401);
      throw new Error("Invalid Google identity token");
    }

    if (payload.email_verified === false) {
      await logPublicAudit({
        req,
        actorId: payload.email,
        action: "auth.user.google",
        resourceType: "user",
        status: "blocked",
        details: { reason: "email-not-verified" },
      });

      res.status(403);
      throw new Error("Google account email is not verified");
    }

    const normalizedEmail = String(payload.email).trim().toLowerCase();

    let user = await User.findOne({
      $or: [{ googleId: payload.sub }, { email: normalizedEmail }],
    });

    if (!user) {
      user = await User.create({
        googleId: payload.sub,
        email: normalizedEmail,
        name: String(payload.name || normalizedEmail.split("@")[0]).trim(),
        picture: String(payload.picture || "").trim(),
        lastLoginAt: new Date(),
      });
    } else {
      user.googleId = payload.sub;
      user.email = normalizedEmail;
      user.name = String(payload.name || user.name).trim();
      user.picture = String(payload.picture || user.picture || "").trim();
      user.lastLoginAt = new Date();
      user.isActive = true;
      await user.save();
    }

    await logPublicAudit({
      req,
      actorId: user._id,
      action: "auth.user.google",
      resourceType: "user",
      resourceId: user._id,
      status: "success",
      details: { email: user.email },
    });

    res.json({
      message: "Google login successful",
      token: generateUserToken(user),
      user: sanitizeUser(user),
    });
  } catch (error) {
    if (error.message === "Google login is not configured on server") {
      return next(error);
    }

    if (error.message === "idToken is required") {
      return next(error);
    }

    if (error.message === "Google account email is not verified") {
      return next(error);
    }

    if (error.message === "Invalid Google identity token") {
      return next(error);
    }

    if (res.statusCode === 200) {
      res.status(401);
    }

    return next(new Error("Unable to verify Google identity token"));
  }
};

module.exports = {
  loginWithGoogle,
  sanitizeUser,
};
