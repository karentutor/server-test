import mongoose from "mongoose";

const LoginEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  timestamp: { type: Date, default: Date.now },
  ip: { type: String },
});

const LoginEvent = mongoose.model("LoginEvent", LoginEventSchema);
export default LoginEvent;
