import bcrypt from "bcryptjs";
import User from "../models/User.js";

const seedAdmin = async () => {
  try {
    const existing = await User.findOne({ username: process.env.ADMIN_USERNAME });
    if (existing) {
      console.log("ℹ️  Admin already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

    await User.create({
      username: process.env.ADMIN_USERNAME,
      password: hashedPassword,
      role: "admin",
      company: "KH Tower",
    });

    console.log("✅ Admin user seeded successfully");
  } catch (error) {
    console.error("❌ Admin seeding failed:", error.message);
  }
};

export default seedAdmin;