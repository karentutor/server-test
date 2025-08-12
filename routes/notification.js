import express from "express";
import {
  createNotification,
  getNotifications,
  getSingleNotification,
  markAsRead,
} from "../controllers/notification.js";

const router = express.Router();

// CREATE
router.post("/", createNotification);
// READ
router.get("/", getNotifications);
// UPDATE
router.put("/:id", markAsRead);
// GET Single
router.get("/:id", getSingleNotification);

export default router;
