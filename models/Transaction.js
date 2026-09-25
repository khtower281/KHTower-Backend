import mongoose from "mongoose";
import Counter from "./Counter.js";

const transactionSchema = new mongoose.Schema(
  {
    serialNo: {
      type: Number,
      unique: true,
      sparse: true,   // ✅ allows documents without serialNo temporarily
    },
    date: {
      type: Date,
      required: [true, "Transaction date is required"],
      default: Date.now,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    checkNo: { type: String, trim: true, default: "" },
    receiptUrl: { type: String, default: "", trim: true },
    receiptType: {
      type: String,
      enum: ["image", "pdf", ""],
      default: "",
    },
    paymentMethod: {
      type: String,
      enum: ["Card", "Cash", "Check"],
      required: [true, "Payment method is required"],
    },
    amountPKR: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    status: {
      type: String,
      enum: ["Pending", "Completed"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

// ✅ Assign serial number AFTER the transaction is successfully saved
transactionSchema.post("save", async function (doc) {
  if (!doc.serialNo) {
    const counter = await Counter.findByIdAndUpdate(
      { _id: "transactionSerial" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    // Update directly (bypasses save hook to avoid recursion)
    await doc.constructor.updateOne(
      { _id: doc._id },
      { $set: { serialNo: counter.seq } }
    );
    doc.serialNo = counter.seq;
  }
});

// Indexes
transactionSchema.index({ date: -1 });
transactionSchema.index({ amountPKR: -1 });
transactionSchema.index({ category: 1 });
transactionSchema.index({ status: 1 });

const Transaction = mongoose.model("Transaction", transactionSchema);
export default Transaction;