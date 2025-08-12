// services/updateService.js
import Update from "../models/Update.js";
import cloudinary from "../configurations/cloudinary.js";
import { uploadFileToCloudinary } from "../utils/helperFunctions.js";

/**
 * Get all updates
 */
export async function getAllUpdatesService() {
  // Example: populate the poster's basic info
  const updates = await Update.find()
    .populate("poster", "firstName lastName email")
    .sort({ createdAt: -1 }); // newest first
  return updates; // could be empty
}

/**
 * Get a single update by ID
 */
export async function getUpdateByIdService(updateId) {
  const update = await Update.findById(updateId).populate(
    "poster",
    "firstName lastName email"
  );
  return update; // could be null
}

/**
 * Create a new update
 * - Must verify the userId
 * - Optionally upload file to Cloudinary
 */
export async function createUpdateService({
  userId,
  file,
  title,
  content,
}) {
  // 1) Handle optional file upload
  let picturePath = "";
  let cloudinaryPublicId = null;
  if (file) {
    const result = await uploadFileToCloudinary(file, "YOUR_FOLDER/UPDATES");
    picturePath = result.secure_url;
    cloudinaryPublicId = result.public_id;
  }

  // 2) Create new doc
  const newUpdate = new Update({
    title,
    content,
    poster: userId,
    picturePath,
    cloudinaryPublicId,
  });

  // 3) Save
  const saved = await newUpdate.save();
  return saved;
}

/**
 * Update an existing update
 */
export async function updateUpdateService({
  updateId,
  file,
  title,
  content,
}) {
  // 1) Find the existing update
  const existing = await Update.findById(updateId);
  if (!existing) {
    return null; // not found
  }

  // 2) If we have a new file, remove old image & upload new
  let newPicturePath = existing.picturePath;
  let newCloudinaryPublicId = existing.cloudinaryPublicId;
  if (file) {
    // remove old
    if (existing.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(existing.cloudinaryPublicId);
    }
    // upload new
    const result = await uploadFileToCloudinary(file, "YOUR_FOLDER/UPDATES");
    newPicturePath = result.secure_url;
    newCloudinaryPublicId = result.public_id;
  }

  // 3) Build updated fields
  const updatedFields = {
    title: title !== undefined ? title : existing.title,
    content: content !== undefined ? content : existing.content,
    picturePath: newPicturePath,
    cloudinaryPublicId: newCloudinaryPublicId,
  };

  // 4) Update in DB
  const updated = await Update.findByIdAndUpdate(updateId, updatedFields, {
    new: true,
  }).populate("poster", "firstName lastName email");

  return updated;
}

/**
 * Delete an update
 */
export async function deleteUpdateService(updateId) {
  const existing = await Update.findById(updateId);
  if (!existing) {
    return null; // not found
  }

  // Remove file from Cloudinary if any
  if (existing.cloudinaryPublicId) {
    await cloudinary.uploader.destroy(existing.cloudinaryPublicId);
  }

  await Update.findByIdAndDelete(updateId);
  return existing;
}
