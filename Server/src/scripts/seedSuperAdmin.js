const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const connectDB = require("../config/db");
const Admin = require("../models/Admin");

const seedSuperAdmin = async () => {
  const name = process.env.SUPER_ADMIN_NAME;
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env"
    );
  }

  const normalizedEmail = email.toLowerCase();

  const existingAdmin = await Admin.findOne({ email: normalizedEmail });

  if (existingAdmin) {
    existingAdmin.name = name;
    existingAdmin.role = "super-admin";
    existingAdmin.permissions = ["*"];
    existingAdmin.approved = true;

    if (password) {
      existingAdmin.password = password;
    }

    await existingAdmin.save();

    console.log("Existing admin updated as super-admin:", normalizedEmail);
    return;
  }

  await Admin.create({
    name,
    email: normalizedEmail,
    password,
    role: "super-admin",
    permissions: ["*"],
    approved: true,
  });

  console.log("Super-admin created:", normalizedEmail);
};

const run = async () => {
  try {
    await connectDB();
    await seedSuperAdmin();
  } catch (error) {
    console.error("Failed to seed super-admin:", error.message);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
};

run();
