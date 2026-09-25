import express from "express";
import {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getSummary,
  bulkDeleteTransactions
} from "../controllers/transactionController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// All transaction routes require admin auth
router.use(protect, adminOnly);

router.route("/").post(createTransaction).get(getTransactions);

// Bulk delete — must be BEFORE /:id
router.post("/bulk-delete", bulkDeleteTransactions); 

// Stats summary — must be BEFORE /:id
router.get("/stats/summary", getSummary);

router
  .route("/:id")
  .get(getTransactionById)
  .put(updateTransaction)
  .delete(deleteTransaction);

export default router;