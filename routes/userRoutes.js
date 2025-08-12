// routes/userRoutes.js

import express from "express";
import {
  contactUs,
  blockUser,
  convertGuestToUser,
  deleteUser,
  followUser,
  getAllUserLocations,
  getAllUsers,
  getUser,
  getUserByKeyword,
  getUserFollowers,
  getUserFollowing, 
  getUserProfile,
  getUsersByQuery,
  unfollowUser,
  updateLocation,
} from "../controllers/userController.js";
import { verifyToken } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

/* READ: top-level routes first */
router.get("/locations", verifyToken, getAllUserLocations);
router.get("/me", verifyToken, getUserProfile);
router.get("/", verifyToken, getAllUsers);
router.get("/query", verifyToken, getUsersByQuery);
router.get("/search/:keyword", verifyToken, getUserByKeyword);

/* 
  READ: specific "following" / "followers" must come 
  BEFORE the generic "/:id" route
*/
router.get("/:id/following", verifyToken, getUserFollowing);
router.get("/:id/followers", verifyToken, getUserFollowers);

/* 
  READ: generic user route at the bottom, so it doesn't 
  accidentally catch the '/following' or '/followers' requests
*/
router.get("/:id", verifyToken, getUser);

/* POST */
router.post("/contact", verifyToken, contactUs);

// Save expo push token
router.post("/push-token", verifyToken, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;
    await User.findByIdAndUpdate(userId, { expoPushToken: token });
    res.status(200).json({ message: "Token saved" });
  } catch (error) {
    console.error("Failed to save token", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* 
  FOLLOW / UNFOLLOW / BLOCK
  (one-directional or two-way, depending on your controllers)
*/
router.post("/follow/:userId", verifyToken, followUser);
router.post("/unfollow/:userId", verifyToken, unfollowUser);
router.post("/block/:userId", verifyToken, blockUser);

// Update user's location
router.post("/update-location", verifyToken, updateLocation);

/* UPDATE (PUT) */
router.put("/:id/convertGuest", verifyToken, convertGuestToUser);
// router.put("/:id", verifyToken, updateUser); // uncomment if needed

/* DELETE */
router.delete("/:id", verifyToken, deleteUser);

export default router;

