//server/controllers/userController.js
import mongoose from "mongoose";
import {
  blockUserService,
  getAllUserLocationsService,
  getUserByIdService,
  updateLocationService,
  getAllUsersService,
  convertGuestToUserService,
  followUserService,
  unfollowUserService,
  getUserFollowingService,
  getUserFollowersService,
  updateUserService,
  deleteUserService,
  getUserByKeywordService,
  getUsersByQueryService,
  contactUsService,
  updateUserPushTokenService,
} from "../services/userService.js";

// If you want to block system admin user from being followed or retrieved:
const SYSTEM_ADMIN_ID = new mongoose.Types.ObjectId(process.env.SYSTEM_USER_ID);

/**
 * Get all users' locations (excluding the system admin)
 */
export const getAllUserLocations = async (req, res) => {
  try {
    const users = await getAllUserLocationsService();
    return res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching user locations:", error);
    return res.status(500).json({ error: "Server error while fetching locations." });
  }
};

/**
 * Get the logged-in user's profile
 * (Return 'not found' if the user is the system admin)
 */
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // If this is the system admin, pretend it's not found
    if (userId === SYSTEM_ADMIN_ID.toString()) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = await getUserByIdService(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ message: "Failed to fetch user profile", error });
  }
};

/**
 * Update user's location
 */
export const updateLocation = async (req, res) => {
  try {
    const userId = req.user.id;

    if (userId === SYSTEM_ADMIN_ID.toString()) {
      return res.status(404).json({ error: "User not found" });
    }

    const { address: street, city, postal_code, country } = req.body;

    const result = await updateLocationService({
      userId,
      street,
      city,
      postal_code,
      country,
    });

    if (result.notFound) {
      return res.status(404).json({ error: "User not found" });
    }
    if (result.invalidAddress) {
      return res.status(400).json({ error: "Invalid address or no match found." });
    }

    return res.status(200).json({ message: "Location updated successfully." });
  } catch (error) {
    console.error("Error updating location:", error);
    return res.status(500).json({ error: "Server error while updating location." });
  }
};

/**
 * Get single user by ID (return "not found" if admin)
 */
export const getUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === SYSTEM_ADMIN_ID.toString()) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = await getUserByIdService(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user, isSuccess: true });
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
};

/**
 * Get all users (exclude admin)
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await getAllUsersService();
    return res.status(200).json(users);
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
};

/**
 * Convert a guest user to a full user
 */
export const convertGuestToUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, lastName, firstName, password } = req.body;

    if (id === SYSTEM_ADMIN_ID.toString()) {
      return res.status(404).json({ msg: "User not found", isError: true });
    }

    const result = await convertGuestToUserService({
      id,
      email,
      lastName,
      firstName,
      password,
    });

    if (result.notFound) {
      return res.status(200).json({ msg: "User not found", isError: true });
    }
    if (result.emailInUse) {
      return res.status(200).json({ msg: "Email already in use", isError: true });
    }

    // If successful, result.newUser is the user object (not saved to DB in your example)
    return res.status(201).json({
      msg: "You have successfully registered",
      isSuccess: true,
      user: result.newUser,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/* 
  -------------------------------------------
   FOLLOW / UNFOLLOW (two-array approach)
  -------------------------------------------
*/

/**
 * Follow user
 */
export const followUser = async (req, res) => {
  try {
    const { userId } = req.params; // The user being followed
    const loggedInUserId = req.user.id; // The user doing the follow

    // optional: block if user is system admin
    if (userId === SYSTEM_ADMIN_ID.toString() || loggedInUserId === SYSTEM_ADMIN_ID.toString()) {
      return res.status(404).json({ message: "Cannot follow/unfollow system admin." });
    }

    // Call the service (which also sends real-time events)
    const result = await followUserService(loggedInUserId, userId);
    if (result.notFound) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "Follow successful" });
  } catch (error) {
    console.error("Error in followUser controller:", error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * Unfollow user
 */
export const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params; // The user to be unfollowed
    const loggedInUserId = req.user.id; // The user who clicks "unfollow"

    if (userId === SYSTEM_ADMIN_ID.toString() || loggedInUserId === SYSTEM_ADMIN_ID.toString()) {
      return res.status(404).json({ message: "User not found" });
    }

    const result = await unfollowUserService(loggedInUserId, userId);
    if (result.notFound) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "User unfollowed successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Block user
 * - A user (loggedInUserId) blocks another user (userId).
 * - The blockingUser adds the blockedUser's ID to blockFollowing array.
 * - Also removes any existing follow/follower relationships between them.
 */
export const blockUser = async (req, res) => {
  try {
    const { userId } = req.params; // The user to block
    const loggedInUserId = req.user.id; // The user who is blocking

    // Optional check: do not allow blocking the system admin or by the system admin
    if (
      userId === SYSTEM_ADMIN_ID.toString() || 
      loggedInUserId === SYSTEM_ADMIN_ID.toString()
    ) {
      return res
        .status(404)
        .json({ message: "Cannot block or be blocked by system admin." });
    }

    // Call the service to handle the block logic
    const result = await blockUserService(loggedInUserId, userId);
    if (result.notFound) {
      return res.status(404).json({ message: "User not found." });
    }

    // If successful
    return res.status(200).json({ message: "User blocked successfully." });
  } catch (error) {
    console.error("Error in blockUser controller:", error);
    return res.status(500).json({ message: error.message });
  }
};


/* 
  -------------------------------------------
   GET FOLLOWING / GET FOLLOWERS
  -------------------------------------------
*/

/**
 * Get all the users that :id is following
 */
export const getUserFollowing = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === SYSTEM_ADMIN_ID.toString()) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = await getUserFollowingService(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filter out system admin from the following array if needed
    const filteredFollowing = user.following.filter(
      (f) => f._id.toString() !== SYSTEM_ADMIN_ID.toString()
    );

    return res.status(200).json(filteredFollowing);
  } catch (error) {
    console.error("Error getting user following:", error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get all the users that follow :id
 */
export const getUserFollowers = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === SYSTEM_ADMIN_ID.toString()) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = await getUserFollowersService(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filter out system admin from the followers array if needed
    const filteredFollowers = user.followers.filter(
      (f) => f._id.toString() !== SYSTEM_ADMIN_ID.toString()
    );

    return res.status(200).json(filteredFollowers);
  } catch (error) {
    console.error("Error getting user followers:", error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Update user
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === SYSTEM_ADMIN_ID.toString()) {
      return res.status(404).json({ msg: "User not found" });
    }

    const result = await updateUserService(id, req.body);

    if (result.notFound) {
      return res.status(200).json({ msg: "User not found", isError: true });
    }
    if (result.emailInUse) {
      return res.status(200).json({ msg: "Email already in use", isError: true });
    }
    if (result.invalidAddress) {
      return res
        .status(400)
        .json({ msg: "Invalid address provided or no match found.", isError: true });
    }

    return res.status(200).json({
      updatedUser: result.updatedUser,
      msg: "User updated successfully",
      isSuccess: true,
    });
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
};

/**
 * Delete user
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === SYSTEM_ADMIN_ID.toString()) {
      return res.status(404).json({ msg: "User not found" });
    }

    const deletedUser = await deleteUserService(id);
    if (!deletedUser) {
      return res.status(404).send(`No user with id: ${id}`);
    }

    return res.status(200).json({
      deletedUser,
      msg: "User deleted successfully",
      isSuccess: true,
    });
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
};

/**
 * Get user(s) by keyword (exclude admin)
 */
export const getUserByKeyword = async (req, res) => {
  try {
    const { keyword } = req.params;
    const users = await getUserByKeywordService(keyword);
    return res.status(200).json(users);
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
};

/**
 * Get users by query parameters (exclude admin)
 */
export const getUsersByQuery = async (req, res) => {
  try {
    const users = await getUsersByQueryService(req.query);
    return res.status(200).json(users);
  } catch (err) {
    console.error("Error in getUsersByQuery:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Contact Us (send email)
 */
export const contactUs = async (req, res) => {
  try {
    const { reason, message, name, email } = req.body;

    await contactUsService({ reason, message, name, email });
    return res.status(200).json({ msg: "Email sent successfully", isSuccess: true });
  } catch (err) {
    return res.status(404).json({ message: err.message });
  }
};

/**
 * Update user's Expo push token
 */
export const updateUserPushToken = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (userId === SYSTEM_ADMIN_ID.toString()) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = await updateUserPushTokenService({ userId, token });
    if (result.notFound) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({ message: "Token saved" });
  } catch (error) {
    console.error("Failed to save token", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
