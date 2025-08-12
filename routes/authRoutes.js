//server/routes/authRoutes.js
import express from "express";
import {
  login,
  getCurrentUser,
  guestLogin,
  decodeToken,
  inviteFriend,
  registerGuest,
  validateEmail,
  loadUser,
  changePassword,
  registerUser,
  updateProfile,
  requestPasswordReset,
  resetPassword,
} from "../controllers/authController.js";
import { verifyToken } from "../middleware/auth.js";
import upload from "../middleware/upload.js";
import { handleFileSizeLimit } from "../utils/multer.js";

const router = express.Router();

/* ---------- registration & profile ---------- */
router.post("/", upload.single("picture"), handleFileSizeLimit, registerUser);
router.put(
  "/update",
  verifyToken,
  upload.single("picture"),
  handleFileSizeLimit,
  updateProfile
);

/* ---------- auth ---------- */
router.post("/login", login);
router.post("/guestLogin", guestLogin);

/* ---------- forgot / reset password ---------- */
router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);

/* ---------- ancillary ---------- */
router.post("/registerGuest", registerGuest);
router.post("/verify-email", validateEmail);
router.post("/invite-friend", inviteFriend);
router.post("/decode-token", decodeToken);
router.post("/load-user", loadUser);
router.post("/change-password", changePassword);

router.get("/me", verifyToken, getCurrentUser);

export default router;
