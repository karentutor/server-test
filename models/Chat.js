import mongoose from "mongoose";

const ChatSchema = new mongoose.Schema(
  {
    groupName: { type: String, trim: true },
    isGroupChat: { type: Boolean, default: false },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    participantsKey: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },
    /**
     * NEW FIELD:
     * Array of user IDs who've already been emailed about unread
     * messages in this chat. Once the user reads the messages,
     * we remove them here so they'll be notified again next time.
     */
    notifiedUsers: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }
    ],
  },
  { timestamps: true }
);

/**
 * Indexes for 1-on-1 chats and group chats
 */
ChatSchema.index(
  { participantsKey: 1 },
  { unique: true, partialFilterExpression: { isGroupChat: false } }
);
ChatSchema.index(
  { groupId: 1 },
  { unique: true, partialFilterExpression: { isGroupChat: true } }
);

const Chat = mongoose.model("Chat", ChatSchema);
export default Chat;
