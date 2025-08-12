// controllers/chatController.js

import {
  createChatService,
  getUserChatsService,
  getUnreadCountService,
  deleteChatService,
  createGroupChatService,
  getChatByIdService,
} from "../services/chatService.js";

/**
 * Create a new chat (1-on-1 or group)
 */
export const createChat = async (req, res) => {
  try {
    const { fromId, toIds, groupName } = req.body;

    const newChat = await createChatService({ fromId, toIds, groupName });
    return res.status(201).json(newChat);
  } catch (error) {
    console.error("Error creating chat:", error);
    return res.status(500).json({ message: error.message || "Server error." });
  }
};

/**
 * Get all chats for a user (plus unread count)
 */
export const getUserChats = async (req, res) => {
  try {
    const { userId } = req.params;
    const chats = await getUserChatsService(userId);
    return res.status(200).json({ chats });
  } catch (error) {
    console.error("Error fetching user chats:", error);
    return res.status(500).json({ message: error.message || "Server error." });
  }
};

/**
 * Get total unread count for a user
 */
export const getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.params;
    const unreadCount = await getUnreadCountService(userId);
    return res.status(200).json({ unreadCount });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return res.status(500).json({ message: error.message || "Server error." });
  }
};

/**
 * Delete a chat
 */
export const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id; // from verifyToken (JWT)

    await deleteChatService(chatId, userId);
    return res.status(200).json({ message: "Chat deleted successfully." });
  } catch (error) {
    console.error("Error deleting chat:", error);
    return res.status(500).json({ message: error.message || "Server error." });
  }
};

/**
 * Create a group chat
 */
export const createGroupChat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { toIds, groupName } = req.body;

    const chat = await createGroupChatService(userId, toIds, groupName);
    return res.status(201).json(chat);
  } catch (error) {
    console.error("Error creating group chat:", error);
    return res.status(500).json({ message: error.message || "Server error." });
  }
};

/**
 * Get a chat by ID
 */
export const getChatById = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await getChatByIdService(chatId, userId);
    return res.status(200).json(chat);
  } catch (error) {
    console.error("Error retrieving chat by ID:", error);
    return res.status(500).json({ message: error.message || "Server error." });
  }
};
