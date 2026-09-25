// app.js — Express application (no listen, no DB connect)
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import exportRoutes from "./routes/exportRoutes.js";

const app = express();

// ---------- CORS ----------
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://khtowerfrontend.vercel.app",
  process.env.FRONTEND_URL, // set on Vercel e.g. https://kh-tower.vercel.app
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow cURL/Postman
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`⚠️  CORS blocked: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---------- Health ----------
app.get("/", (req, res) => {
  res.json({ message: "🏢 KH Tower Finance API is running" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------- Routes ----------
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/export", exportRoutes);

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong" });
});

export default app;