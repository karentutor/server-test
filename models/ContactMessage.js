// server/models/ContactMessage.js
import mongoose from "mongoose";

const ContactMessageSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  message: { type: String, required: true },
  senderEmail: { type: String, required: true },
  senderFirstName: { type: String, required: true },
  senderLastName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },

  // NEW FIELD: isComplete
  isComplete: { type: Boolean, default: false },
});

export default mongoose.model("ContactMessage", ContactMessageSchema);
