import express from "express";
import { exportTransactionsPDF } from "../controllers/exportController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);

router.get("/pdf", exportTransactionsPDF);

export default router;