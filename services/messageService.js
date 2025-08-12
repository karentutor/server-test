// services/messageService.js

import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import { getSocketIO, users } from "../configurations/socket.js";

/**
 * Send a message in a chat
 */
export async function sendMessageService({ chatId, senderId, content }) {
  // 1) Validate and find chat
  const chat = await Chat.findById(chatId);
  if (!chat) {
    throw new Error("Chat not found.");
  }

  // 2) Check if sender is participant
  const isParticipant = chat.participants.some((p) => p.equals(senderId));
  if (!isParticipant) {
    throw new Error("You are not a participant of this chat.");
  }

  // 3) Ensure sender user doc (for optional name/avatar in the socket payload)
  const sender = await User.findById(senderId).select("firstName avatar");
  if (!sender) {
    throw new Error("Sender not found.");
  }

  // 4) Create the message
  const newMessage = new Message({
    chatId,
    senderId,
    content: content.trim(),
    isReadBy: [senderId], // sender auto-reads their own message
  });
  await newMessage.save();

  // 5) Update chat’s updatedAt
  chat.updatedAt = new Date();
  await chat.save();

  // 6) Socket broadcast
  const io = getSocketIO();
  chat.participants.forEach((participantId) => {
    const userSocketData = users[participantId.toString()];
    if (userSocketData?.socketId) {
      io.to(userSocketData.socketId).emit("messageCreated", {
        message: {
          _id: newMessage._id,
          content: newMessage.content,
          chatId: newMessage.chatId.toString(),
          senderId: newMessage.senderId,
          createdAt: newMessage.createdAt,
        },
        fromName: participantId.equals(senderId) ? "You" : sender.firstName,
        fromAvatar: sender.avatar ?? null,
        isSentByCurrentUser: participantId.equals(senderId),
      });
    }
  });

  return newMessage;
}

/**
 * Get all messages in a chat
 */
export async function getChatMessagesService(chatId) {
  // 1) Validate chat
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error("Invalid chatId.");
  }

  // 2) Check if chat exists
  const chat = await Chat.findById(chatId);
  if (!chat) {
    throw new Error("Chat not found.");
  }

  // 3) Find messages
  const messages = await Message.find({ chatId })
    .populate("senderId", "firstName lastName avatar")
    .sort({ createdAt: 1 });

  return messages;
}

/**
 * Delete a message
 */
export async function deleteMessageService({ chatId, messageId, userId }) {
  // 1) Validate IDs
  if (
    !mongoose.Types.ObjectId.isValid(chatId) ||
    !mongoose.Types.ObjectId.isValid(messageId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    throw new Error("Invalid chatId, messageId, or userId.");
  }

  // 2) Load the message
  const message = await Message.findById(messageId);
  if (!message) {
    throw new Error("Message not found.");
  }

  // 3) Check if it belongs to that chat
  if (!message.chatId.equals(chatId)) {
    throw new Error("Message does not belong to this chat.");
  }

  // 4) Only the sender can delete
  if (!message.senderId.equals(userId)) {
    throw new Error("You can only delete your own messages.");
  }

  // 5) Remove from DB
  await Message.findByIdAndDelete(messageId);
  return true;
}

/**
 * Mark messages as read
 */
export async function markMessagesAsReadService(chatId, userId) {
  // 1) Validate chat
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new Error("Invalid chatId.");
  }

  // 2) Check chat existence
  const chat = await Chat.findById(chatId);
  if (!chat) {
    throw new Error("Chat not found.");
  }

  // 3) Ensure user is participant
  const isParticipant = chat.participants.some((pid) => pid.equals(userId));
  if (!isParticipant) {
    throw new Error("You are not a participant of this chat.");
  }

  // 4) Update messages
  const result = await Message.updateMany(
    { chatId, isReadBy: { $ne: userId } },
    { $push: { isReadBy: userId } }
  );

  return { matched: result.matchedCount, modified: result.modifiedCount };
}
