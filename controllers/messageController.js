import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import { getSocketIO, users } from "../configurations/socket.js";
import { sendEmailService } from "../services/emailService.js";

/**
 * POST /chats/:chatId/messages
 * Send a new message and broadcast it in real time.
 */
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const senderId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chat ID." });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Content is required." });
    }

    // 1) Get the chat and confirm membership
    const chat = await Chat.findById(chatId).populate(
      "participants",
      "email firstName lastName"
    );
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }
    const isParticipant = chat.participants.some(
      (p) => p._id.toString() === senderId
    );
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not in this chat." });
    }

    // 2) Create and save the message
    const newMessage = new Message({
      chatId,
      senderId,
      content: content.trim(),
      isReadBy: [senderId],
    });
    await newMessage.save();

    // 3) Real‑time broadcast (event name **messageCreated**)
    const io = getSocketIO();
    console.log(
      "📤 broadcasting to",
      chat.participants.map((p) => p._id.toString())
    );

    chat.participants.forEach((p) => {
      const pid = p._id.toString();
      const entry = users[pid];
      const online = entry?.socketIds?.size > 0;
      console.log("  ↳", pid, online ? "✅ online" : "❌ offline");

      entry?.socketIds?.forEach((sid) =>
        io.to(sid).emit("messageCreated", {
          chatId,
          message: newMessage,
        })
      );
    });

    // 4) (Optional) e‑mail offline users …  [unchanged code]
    for (const participant of chat.participants) {
      const pid = participant._id.toString();
      if (pid === senderId) continue;

      const online = !!users[pid]?.socketId;
      const alreadyNotified = chat.notifiedUsers.some(
        (u) => u.toString() === pid
      );

      if (!online && !alreadyNotified) {
        const subject = `New message from ${req.user.firstName || "someone"}`;
        const msgBody = `
          Hi ${participant.firstName || ""},<br/><br/>
          You have a new message in the Oxsaid App. Log in to read and reply!<br/><br/>
          – The Oxsaid App
        `;
        //un comment for production
        // await sendEmailService({
        //   email: participant.email,
        //   subject,
        //   message: msgBody,
        //   senderEmail: req.user.email,
        //   senderFirstName: req.user.firstName,
        //   senderLastName: req.user.lastName,
        // });
        chat.notifiedUsers.push(participant._id);
      }
    }
    await chat.save();

    return res.status(201).json({ message: "Message sent.", newMessage });
  } catch (error) {
    console.error("Error sending message:", error);
    return res
      .status(500)
      .json({ message: error.message || "Server error." });
  }
};



/**
 * GET /chats/:chatId/messages
 * Return all messages in a chat.  Front‑end expects
 *   { messages: [...] }   (not a bare array)
 */
export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chat ID." });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === userId
    );
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not in this chat." });
    }

    const messages = await Message.find({ chatId })
      .populate("senderId", "firstName lastName avatar")
      .sort({ createdAt: 1 });

    // ⬇︎  Wrap in an object so front end can do res.data.messages
    return res.status(200).json({ messages });
  } catch (error) {
    console.error("Error getting chat messages:", error);
    return res
      .status(500)
      .json({ message: error.message || "Server error." });
  }
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chat ID." });
    }

    // 1) Update all messages to show that this user has read them
    await Message.updateMany(
      {
        chatId: chatId,
        isReadBy: { $ne: userId },
      },
      { $push: { isReadBy: userId } }
    );

    // 2) Remove this user from notifiedUsers (so they can be emailed again later if they go offline)
    await Chat.findByIdAndUpdate(chatId, {
      $pull: { notifiedUsers: userId },
    });

    return res.status(200).json({ message: "Messages marked as read." });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return res.status(500).json({ message: error.message || "Server error." });
  }
};

/**
 * Delete a single message
 */
export const deleteMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid ID(s)." });
    }

    // Optionally validate user is in the chat
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found." });
    }
    const isParticipant = chat.participants.some((p) => p.toString() === userId);
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not in this chat." });
    }

    // Actually delete the message
    const deleted = await Message.findOneAndDelete({
      _id: messageId,
      chatId: chatId,
    });
    if (!deleted) {
      return res.status(404).json({ message: "Message not found or already deleted." });
    }

    return res.status(200).json({ message: "Message deleted.", deletedMessage: deleted });
  } catch (error) {
    console.error("Error deleting message:", error);
    return res.status(500).json({ message: error.message || "Server error." });
  }
};
