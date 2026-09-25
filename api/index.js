// api/index.js — Vercel serverless entry point
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import seedAdmin from "../utils/seedAdmin.js";
import app from "../app.js";

dotenv.config();

let isConnected = false;
let isSeeded = false;

export default async function handler(req, res) {
  try {
    if (!isConnected) {
      await connectDB();
      isConnected = true;
    }
    if (!isSeeded) {
      await seedAdmin();
      isSeeded = true;
    }
    return app(req, res);
  } catch (err) {
    console.error("Serverless bootstrap error:", err);
    res.status(500).json({
      message: "Server initialization failed",
      error: err.message,
    });
  }
}