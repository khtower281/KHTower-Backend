import express from "express";
import { login, getMe, logout } from "../controllers/authController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", protect, adminOnly, getMe);
router.post("/logout", protect, logout);

export default router;