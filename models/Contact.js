import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
  },
  { timestamps: true }
);

// Text index for fast search
contactSchema.index({ name: "text", phone: "text", description: "text" });

const Contact = mongoose.model("Contact", contactSchema);
export default Contact;