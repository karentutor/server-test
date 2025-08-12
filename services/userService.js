import bcrypt from "bcrypt";
import mongoose from "mongoose";
import User from "../models/User.js";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import sendEmail from "../utils/sendEmail.js";
import { geocodeAddress } from "../utils/geocode.js";
import { notifyUserFollowed, getSocketIO, users } from "../configurations/socket.js";

/** 
 * SYSTEM_ADMIN_ID: an ObjectId from your .env file or config.
 * Make sure this matches the _id of your "System Admin" user in the DB.
 */
const SYSTEM_ADMIN_ID = new mongoose.Types.ObjectId(process.env.SYSTEM_USER_ID);

/**
 * Utility: generate a unique participantsKey for a 1-on-1 chat
 * by sorting the two user IDs and joining them with "_".
 */
function generateParticipantsKey(id1, id2) {
  const sorted = [id1.toString(), id2.toString()].sort();
  return sorted.join("_");
}

/**
 * Utility: find or create a private (one-on-one) chat between userA and userB.
 */
async function findOrCreatePrivateChat(userAId, userBId) {
  const participantsKey = generateParticipantsKey(userAId, userBId);

  // Attempt to find an existing chat
  let chat = await Chat.findOne({
    participantsKey,
    isGroupChat: false,
  });

  // If none found, create it
  if (!chat) {
    chat = new Chat({
      isGroupChat: false,
      participantsKey,
      participants: [userAId, userBId],
    });
    await chat.save();
  }

  return chat;
}

/**
 * Get all users' locations (excluding the system admin)
 */
export async function getAllUserLocationsService() {
  // Return only users with valid lat/lng (and not the system admin).
  const users = await User.find(
    {
      _id: { $ne: SYSTEM_ADMIN_ID },
      "location.latitude": { $ne: null },
      "location.longitude": { $ne: null },
    },
    { firstName: 1, lastName: 1, location: 1 }
  );
  return users;
}

// helpers such as getUserByIdService()
export async function getUserByIdService(userId) {
  return User.findById(userId).select("-password -__v");
}

/**
 * Update a user's location by geocoding their address
 * Return an object like { success: true } or { invalidAddress: true } or { notFound: true }
 */
export async function updateLocationService({ userId, street, city, postal_code, country }) {
  // 1) Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    return { notFound: true };
  }

  // 2) Geocode
  const geocodeResult = await geocodeAddress({
    address: street,
    city,
    postal_code,
    country,
  });

  if (!geocodeResult || geocodeResult.length === 0) {
    return { invalidAddress: true };
  }

  // 3) Extract coords
  const [lng, lat] = geocodeResult[0].geometry.coordinates;

  // 4) Update user
  user.location = {
    latitude: lat,
    longitude: lng,
    street,
    city,
    postal_code,
    country,
  };
  await user.save();

  return { success: true, updatedUser: user };
}

/**
 * Get all users (excluding system admin)
 */
export async function getAllUsersService() {
  const users = await User.find({ _id: { $ne: SYSTEM_ADMIN_ID } });
  return users;
}

/**
 * Convert a guest user to a full user
 * Return object with keys: { notFound, emailInUse, newUser } or similar
 */
export async function convertGuestToUserService({ id, email, lastName, firstName, password }) {
  // 1) Check if user exists
  const isUserExist = await User.findById(id).lean();
  if (!isUserExist) {
    return { notFound: true };
  }

  // 2) Check if email is already in use by a different user
  const isEmailExist = await User.findOne({ email }).lean();
  if (isEmailExist && isEmailExist._id.toString() !== isUserExist._id.toString()) {
    return { emailInUse: true };
  }

  // 3) Hash the password
  const salt = await bcrypt.genSalt();
  const passwordHash = await bcrypt.hash(password, salt);

  // 4) Construct a "new user" object (not saved in DB if you're only returning)
  const newUser = new User({
    email,
    lastName,
    firstName,
    password: passwordHash,
    elum: true,
  });

  return { newUser };
}

/* 
  -------------------------------------------
   FOLLOW / UNFOLLOW (two-array approach)
   WITH REAL-TIME NOTIFICATIONS
  -------------------------------------------
*/

/**
 * Follow user (two-array approach) + real-time notifications
 * Return { notFound: true } if user doesn't exist, otherwise { success: true }.
 */
export async function followUserService(loggedInUserId, userIdToFollow) {
  // 1) Get both users
  const followerUser = await User.findById(loggedInUserId);
  const followedUser = await User.findById(userIdToFollow);
  if (!followerUser || !followedUser) {
    return { notFound: true };
  }

  // 2) Add userIdToFollow to followerUser.following if not already
  if (!followerUser.following.includes(userIdToFollow)) {
    followerUser.following.push(userIdToFollow);
  }

  // 3) Add loggedInUserId to followedUser.followers if not already
  if (!followedUser.followers.includes(loggedInUserId)) {
    followedUser.followers.push(loggedInUserId);
  }

  await followerUser.save();
  await followedUser.save();

  // 4) Emit "userFollowed" so the followed user sees a toast
  notifyUserFollowed(userIdToFollow, {
    followerId: loggedInUserId,
    followedId: userIdToFollow,
    followerName: followerUser.firstName,
    message: `${followerUser.firstName} just followed you!`,
  });

  // 5) Create or find a 1-on-1 chat with System Admin & the followed user
  const chat = await findOrCreatePrivateChat(SYSTEM_ADMIN_ID, userIdToFollow);

  // 6) Insert a "system" message from Admin
  const systemMessageText = `Hi ${followedUser.firstName}, you were just followed by ${followerUser.firstName} ${followerUser.lastName}!`;

  const newMessage = new Message({
    chatId: chat._id,
    senderId: SYSTEM_ADMIN_ID,
    content: systemMessageText,
    isReadBy: [SYSTEM_ADMIN_ID]
  });
  await newMessage.save();

  // 7) Emit "messageCreated" => new unread chat
  const io = getSocketIO();
  if (io) {
    const userData = users[userIdToFollow];
    if (userData && userData.socketId) {
      console.log("Emitting 'messageCreated' for user:", userIdToFollow);
      io.to(userData.socketId).emit("messageCreated", {
        chatId: chat._id.toString(),
        message: {
          _id: newMessage._id.toString(),
          senderId: newMessage.senderId.toString(),
          content: newMessage.content,
          createdAt: newMessage.createdAt,
        },
      });
    }
  }

  return { success: true };
}

/**
 * Unfollow user (two-array approach)
 * Return object like { notFound: true } if either user doesn't exist, else { success: true }.
 */
export async function unfollowUserService(loggedInUserId, userIdToUnfollow) {
  const followerUser = await User.findById(loggedInUserId);
  const followedUser = await User.findById(userIdToUnfollow);

  if (!followerUser || !followedUser) {
    return { notFound: true };
  }

  // Remove userIdToUnfollow from followerUser.following
  followerUser.following = followerUser.following.filter(
    (id) => id.toString() !== userIdToUnfollow
  );
  // Remove loggedInUserId from followedUser.followers
  followedUser.followers = followedUser.followers.filter(
    (id) => id.toString() !== loggedInUserId
  );

  await followerUser.save();
  await followedUser.save();

  return { success: true };
}

/**
 * Block user
 * - A adds B to A.blockFollowing (if not already)
 * - Remove any mutual following/follower references between them
 *   so they are effectively disconnected.
 */
export async function blockUserService(loggedInUserId, userIdToBlock) {
  // 1) Fetch both users from DB
  const blockingUser = await User.findById(loggedInUserId);
  const blockedUser = await User.findById(userIdToBlock);

  if (!blockingUser || !blockedUser) {
    return { notFound: true };
  }

  // 2) Add userIdToBlock to blockingUser.blockFollowing if not already
  if (!blockingUser.blockFollowing.includes(userIdToBlock)) {
    blockingUser.blockFollowing.push(userIdToBlock);
  }

  // 3) Remove the blocked user from the blocking user's "followers" array, if present
  blockingUser.followers = blockingUser.followers.filter(
    (followerId) => followerId.toString() !== userIdToBlock
  );

  // 4) Remove the blocked user from the blocking user's "following" array, if present
  blockingUser.following = blockingUser.following.filter(
    (followingId) => followingId.toString() !== userIdToBlock
  );

  // 5) Optionally remove the blocking user from the blocked user's "followers",
  //    so they can't appear in blocked user's followers list. 
  //    (Commonly, a "block" means severing both directions, but it's up to your logic)
  blockedUser.followers = blockedUser.followers.filter(
    (followerId) => followerId.toString() !== loggedInUserId
  );

  // 6) Similarly, remove the blocking user from the blocked user's "following", 
  //    if you want them to stop following as well
  blockedUser.following = blockedUser.following.filter(
    (followingId) => followingId.toString() !== loggedInUserId
  );

  // 7) Save both documents
  await blockingUser.save();
  await blockedUser.save();

  return { success: true };
}


/**
 * Get the users that :id is following
 * Return populated array or empty
 */
export async function getUserFollowingService(userId) {
  const user = await User.findById(userId).populate("following");
  return user; // null if not found
}

/**
 * Get the users that follow :id
 * Return populated array or empty
 */
export async function getUserFollowersService(userId) {
  const user = await User.findById(userId).populate("followers");
  return user; // null if not found
}

/* 
  ------------------------------------------------------
   UPDATE USER, DELETE USER, SEARCH, ETC.
  ------------------------------------------------------
*/

/**
 * Update user by ID
 * Return objects like { notFound, emailInUse, invalidAddress, updatedUser } etc.
 */
export async function updateUserService(id, updateBody) {
  // 1) Check if user exists
  const existingUser = await User.findById(id);
  if (!existingUser) {
    return { notFound: true };
  }

  // 2) If email is changed, check if it's taken
  if (updateBody.email && updateBody.email !== existingUser.email) {
    const isEmailExist = await User.findOne({ email: updateBody.email }).lean();
    if (isEmailExist) {
      return { emailInUse: true };
    }
  }

  // 3) If location is present, attempt to geocode
  if (
    updateBody.location &&
    (updateBody.location.street ||
      updateBody.location.city ||
      updateBody.location.country ||
      updateBody.location.postal_code)
  ) {
    const { street, city, postal_code, country } = updateBody.location;
    const geocodeResult = await geocodeAddress({
      address: street,
      city,
      postal_code,
      country,
    });

    if (!geocodeResult || geocodeResult.length === 0) {
      return { invalidAddress: true };
    }

    const [longitude, latitude] = geocodeResult[0].geometry.coordinates;
    updateBody.location.latitude = latitude;
    updateBody.location.longitude = longitude;
  }

  // 4) Merge updates
  Object.keys(updateBody).forEach((key) => {
    // If it's an object (like location), merge deeply, else override
    if (typeof updateBody[key] === "object" && existingUser[key]) {
      existingUser[key] = { ...existingUser[key], ...updateBody[key] };
    } else {
      existingUser[key] = updateBody[key];
    }
  });

  await existingUser.save();
  return { updatedUser: existingUser };
}

/**
 * Delete user by ID
 * Return the deleted user doc or null if not found
 */
export async function deleteUserService(id) {
  const deletedUser = await User.findByIdAndRemove(id);
  return deletedUser; // null if not found
}

/**
 * Get user(s) by keyword (exclude admin)
 */
export async function getUserByKeywordService(keyword) {
  if (keyword === "all" || keyword === "undefined" || keyword === "null") {
    // Return all non-admin users
    const users = await User.find({ _id: { $ne: SYSTEM_ADMIN_ID } });
    return users;
  }

  const users = await User.find({
    _id: { $ne: SYSTEM_ADMIN_ID },
    $or: [
      { email: { $regex: keyword, $options: "i" } },
      { firstName: { $regex: keyword, $options: "i" } },
      { lastName: { $regex: keyword, $options: "i" } },
    ],
  });

  return users;
}


/**
 * Get users by query (excluding system admin).
 */
export async function getUsersByQueryService(query) {
  // 1. Remove empty-string fields from the query
  Object.keys(query).forEach((key) => {
    if (query[key] === "") {
      delete query[key];
    }
  });

  // 2. If 'search=all', return everything except the system admin
  if (query.search && query.search.toLowerCase() === "all") {
    return await User.find({ _id: { $ne: SYSTEM_ADMIN_ID } });
  }

  // 3. Build up text-search conditions (email, firstName, lastName)
  let searchConditions = [];
  if (query.search) {
    const searchRegex = { $regex: query.search, $options: "i" };
    searchConditions = [
      { email: searchRegex },
      { firstName: searchRegex },
      { lastName: searchRegex },
    ];
    delete query.search;
  }

  // 4. Start with a base query excluding system admin
  let dbQuery = { _id: { $ne: SYSTEM_ADMIN_ID } };

  // 5. Convert certain string filters into case-insensitive `$regex`
  if (query.college) {
    dbQuery.college = { $regex: query.college, $options: "i" };
    delete query.college;
  }

  if (query.matriculationYear) {
    dbQuery.matriculationYear = query.matriculationYear;
    delete query.matriculationYear;
  }

  if (query.occupation) {
    dbQuery.occupation = { $regex: query.occupation, $options: "i" };
    delete query.occupation;
  }

  // 6. Location: country & city
  if (query.location) {
    dbQuery["location.country"] = { $regex: query.location, $options: "i" };
    delete query.location;
  }
  if (query.city) {
    dbQuery["location.city"] = { $regex: query.city, $options: "i" };
    delete query.city;
  }

  // NEW 7. Work Status: exact match for an element in the array
  if (query.workStatus) {
    dbQuery.workStatus = query.workStatus; // or { $in: [query.workStatus] } if you prefer
    delete query.workStatus;
  }

  // 8. Merge any leftover query fields as exact matches
  if (Object.keys(query).length > 0) {
    dbQuery = { ...dbQuery, ...query };
  }

  // 9. Combine text-search conditions if present
  if (searchConditions.length > 0) {
    dbQuery = { $and: [dbQuery, { $or: searchConditions }] };
  }

  // 10. Execute the query
  const users = await User.find(dbQuery);
  return users;
}


/**
 * Contact Us (send email to some specific mailbox)
 * Return { success: true } if successful, or throw an error if something goes wrong
 */
export async function contactUsService({ reason, message, name, email }) {
  await sendEmail({
    email: process.env.CONTACT_US_EMAIL,
    subject: `Contact Us - ${reason}`,
    message: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
  });
  return { success: true };
}

/**
 * Update user's Expo push token
 */
export async function updateUserPushTokenService({ userId, token }) {
  const user = await User.findById(userId);
  if (!user) {
    return { notFound: true };
  }

  user.expoPushToken = token;
  await user.save();

  return { success: true };
}
