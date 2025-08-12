// services/chatService.js

import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { getSocketIO, users } from "../configurations/socket.js";

/**
 * Create a new chat (private or group)
 */
export async function createChatService({ fromId, toIds, groupName }) {
  if (!fromId || !toIds || !Array.isArray(toIds) || toIds.length < 1) {
    throw new Error("fromId and toIds are required.");
  }
  if (toIds.includes(fromId)) {
    throw new Error("Cannot chat with yourself.");
  }

  // Combine participants
  const participants = [fromId, ...toIds];
  const uniqueParticipants = [...new Set(participants.map(String))];

  // Validate user docs
  const userDocs = await User.find({ _id: { $in: uniqueParticipants } });
  if (userDocs.length !== uniqueParticipants.length) {
    throw new Error("One or more users not found.");
  }

  let isGroupChat = false;
  let participantsKey = null;
  let finalGroupName = null;

  if (uniqueParticipants.length === 2) {
    // private (1-on-1) chat
    isGroupChat = false;
    const sortedIds = uniqueParticipants.sort();
    participantsKey = sortedIds.join("_");

    // Check if already exists
    const existingChat = await Chat.findOne({
      isGroupChat: false,
      participantsKey,
    });
    if (existingChat) {
      return existingChat; // return existing
    }
  } else {
    // group chat
    isGroupChat = true;
    if (!groupName || !groupName.trim()) {
      throw new Error("Group name is required for group chats.");
    }
    finalGroupName = groupName.trim();
  }

  const newChat = new Chat({
    groupName: finalGroupName,
    isGroupChat,
    groupId: null, // only if you need it
    participants: uniqueParticipants,
    participantsKey,
  });
  await newChat.save();

  // Broadcast via Socket.IO
  const io = getSocketIO();
  newChat.participants.forEach((participantId) => {
    const user = users[participantId];
    if (user?.socketId) {
      io.to(user.socketId).emit("chatCreated", {
        chat: newChat,
      });
    }
  });

  return newChat;
}

/**
 * Retrieve all chats for a user, plus unread counts
 */
export async function getUserChatsService(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID.");
  }

  const userObjectId = mongoose.Types.ObjectId(userId);

  const chats = await Chat.find({ participants: userObjectId })
    .populate("participants", "firstName lastName avatar")
    .sort({ updatedAt: -1 })
    .lean();

  // For each chat, load latestMessage + unreadCount
  const chatsWithExtras = await Promise.all(
    chats.map(async (chat) => {
      const latestMessage = await Message.findOne({ chatId: chat._id })
        .sort({ createdAt: -1 })
        .populate("senderId", "firstName lastName avatar")
        .lean();

      const unreadCount = await Message.countDocuments({
        chatId: chat._id,
        isReadBy: { $ne: userObjectId },
        senderId: { $ne: userObjectId },
      });

      return { ...chat, latestMessage, unreadCount };
    })
  );

  return chatsWithExtras;
}

/**
 * Get total unread count across all chats for a user
 */
export async function getUnreadCountService(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID.");
  }

  const chats = await Chat.find({ participants: userId }).select("_id");
  const chatIds = chats.map((c) => c._id);

  const totalUnreadCount = await Message.countDocuments({
    chatId: { $in: chatIds },
    isReadBy: { $ne: mongoose.Types.ObjectId(userId) },
    senderId: { $ne: mongoose.Types.ObjectId(userId) },
  });

  return totalUnreadCount;
}

/**
 * Delete a chat (and its messages)
 */
export async function deleteChatService(chatId, userId) {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error("Invalid chatId.");
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    throw new Error("Chat not found.");
  }

  // ensure user is participant
  if (!chat.participants.some((p) => p.equals(userId))) {
    throw new Error("You are not a participant of this chat.");
  }

  // delete all messages
  await Message.deleteMany({ chatId });
  // delete the chat
  await Chat.findByIdAndDelete(chatId);
  return true;
}

/**
 * Create a group chat specifically (if separate from createChat)
 */
export async function createGroupChatService(userId, toIds, groupName) {
  if (!Array.isArray(toIds) || toIds.length < 2) {
    throw new Error("At least two participants are required.");
  }

  // Add the creator
  const participants = Array.from(new Set([...toIds, userId]));
  const chat = new Chat({
    groupName: groupName || "Unnamed Group",
    isGroupChat: true,
    participants,
    participantsKey: null,
  });
  await chat.save();

  // broadcast
  const io = getSocketIO();
  participants.forEach((pid) => {
    const u = users[pid];
    if (u?.socketId) {
      io.to(u.socketId).emit("chatCreated", { chat });
    }
  });
  return chat;
}

/**
 * Get a chat by ID
 */
export async function getChatByIdService(chatId, userId) {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error("Invalid chat ID.");
  }

  const chat = await Chat.findById(chatId)
    .populate("participants", "firstName lastName avatar")
    .lean();

  if (!chat) {
    throw new Error("Chat not found.");
  }

  // optional: ensure user is participant
  const isParticipant = chat.participants.some((p) => p._id.toString() === userId);
  if (!isParticipant) {
    throw new Error("You are not a participant of this chat.");
  }

  return chat;
}
