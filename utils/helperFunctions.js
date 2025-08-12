// utils/helperFunctions.js
import cloudinary from "../configurations/cloudinary.js";
import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
const ObjectId = mongoose.Types.ObjectId;
const adminUserId = process.env.ADMINUSERID; // if you need it

import { getSocketIO, users } from "../configurations/socket.js"; // If you use sendChatMessage

/**
 * Check if a value is empty.
 */
export const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === "object" && Object.keys(value).length === 0) ||
  (typeof value === "string" && value.trim().length === 0);

/**
 * Uploads a file (image or PDF) to Cloudinary using memory-based streaming.
 * - `file` is the object from Multer (req.file).
 * - `file.buffer` contains the raw data, `file.mimetype` or `file.originalname` helps us detect type.
 * - Optionally pass a `customFolder` for storing in Cloudinary.
 */
export const uploadFileToCloudinary = async (file, customFolder) => {
  // 1) Determine if file is a PDF or image (by MIME type or by filename).
  const isPdf =
    file.mimetype === "application/pdf" ||
    file.originalname?.toLowerCase().endsWith(".pdf");

  // 2) Decide resource type
  const resourceType = isPdf ? "raw" : "image";

  // 3) Folder logic
  let folder = isPdf ? "oxsaid/resources" : "oxsaid/posts";
  if (customFolder) {
    folder = customFolder;
  }

  try {
    // 4) Use upload_stream
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: resourceType,
            folder,
            // For PDF, Cloudinary can automatically detect format,
            // but you could specify { format: "pdf" } if you want.
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary file upload failed:", error);
              return reject(error);
            }
            resolve(result);
          }
        )
        .end(file.buffer);
    });

    // 5) Return the Cloudinary result (secure_url, public_id, etc.)
    return result;
  } catch (error) {
    console.error("Error uploading file to Cloudinary:", error);
    throw new Error("File upload failed");
  }
};

export const uploadBufferToCloudinary = async (
  fileBuffer,
  originalName,
  folderName
) => {
  let resourceType = "image";
  if (originalName?.toLowerCase().endsWith(".pdf")) {
    resourceType = "raw"; // or 'auto'
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folderName, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * Example chat message utility — not related to file uploads,
 * but presumably still needed in your code.
 */
export const sendChatMessage = async (fromId, toId, message, context = {}) => {
  try {
    const fromObjectId = new ObjectId(fromId);
    const toObjectId = new ObjectId(toId);

    // Check if there's already a private chat
    const participantIds = [fromObjectId, toObjectId].map((id) =>
      id.toString()
    );
    participantIds.sort();
    const participantsKey = participantIds.join("_");

    let chat = await Chat.findOne({
      isGroupChat: false,
      participantsKey: participantsKey,
    });

    if (!chat) {
      // Create a new private chat if not found
      chat = await Chat.create({
        isGroupChat: false,
        participants: [fromObjectId, toObjectId],
        participantsKey,
        name: "Private Chat",
      });
    }

    // Create a new message
    const newMessage = new Message({
      chatId: chat._id,
      senderId: fromObjectId,
      content: message,
      isReadBy: [fromObjectId],
    });

    await newMessage.save();

    // Emit "newMessage" to currently connected participants
    const io = getSocketIO();

    for (const participantId of chat.participants) {
      const participantIdStr = participantId.toString();
      const participantData = users[participantIdStr];

      if (participantData && participantData.socketId) {
        io.to(participantData.socketId).emit("newMessage", {
          chatId: chat._id.toString(),
          message: {
            _id: newMessage._id.toString(),
            chatId: newMessage.chatId.toString(),
            senderId: newMessage.senderId.toString(),
            content: newMessage.content,
            createdAt: newMessage.createdAt,
            updatedAt: newMessage.updatedAt,
          },
        });
      }
    }

    return newMessage;
  } catch (error) {
    console.error("Error sending chat message:", error);
    throw error; // Propagate the error
  }
};
