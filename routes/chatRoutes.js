import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  createChat,
  createGroupChat,
  getChatById,
  getUserChats,
  getUnreadCount,
  deleteChat,
} from "../controllers/chatController.js";
import {
  sendMessage,
  getChatMessages,
  markMessagesAsRead,
  deleteMessage,
} from "../controllers/messageController.js";

const router = express.Router();

// Order of routes matters:

// 1. Chat creation and global unread count
router.post("/", verifyToken, createChat);
router.get("/unread-count/:userId", verifyToken, getUnreadCount);

// 2. User's chats route: /chats/user/:userId
//   Placing this before message routes ensures no conflict
router.get("/user/:userId", verifyToken, getUserChats);

// 2. GET a chat by ID
router.get("/:chatId", verifyToken, getChatById);


// 3. Delete entire chat
router.delete("/:chatId", verifyToken, deleteChat);

// 4. Message deletion route (more specific)
//   /chats/:chatId/messages/:messageId must come before /:chatId/messages
router.delete("/:chatId/messages/:messageId", verifyToken, deleteMessage);

// 5. Get messages in a chat
router.get("/:chatId/messages", verifyToken, getChatMessages);

// 6. Send a new message
router.post("/:chatId/messages", verifyToken, sendMessage);

// 7. Mark messages as read
router.patch("/:chatId/messages/read", verifyToken, markMessagesAsRead);

// **New Route for Group Chat Creation**
router.post("/group-chat", verifyToken, createGroupChat);

export default router;
