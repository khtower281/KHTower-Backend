import express from "express";
import {
  createContact,
  getContacts,
  getContactById,
  updateContact,
  deleteContact,
  bulkDeleteContacts,
} from "../controllers/contactController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);

router.route("/").post(createContact).get(getContacts);

// Bulk delete — must be BEFORE /:id
router.post("/bulk-delete", bulkDeleteContacts);

router
  .route("/:id")
  .get(getContactById)
  .put(updateContact)
  .delete(deleteContact);

export default router;