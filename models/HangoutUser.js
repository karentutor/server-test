// server/models/HangoutUser.js
import mongoose from "mongoose";

const hangoutUserSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  x: { type: Number, default: 100 },
  y: { type: Number, default: 100 },
  tableId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("HangoutUser", hangoutUserSchema);
