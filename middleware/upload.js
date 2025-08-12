//middleware/upload.js
import multer from "multer";

/**
 * 1) Create a Multer instance with memoryStorage
 *    so files go into req.file.buffer instead of the filesystem.
 */
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Optional: filter out non-image/PDF files
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "application/pdf"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, and PDF files are allowed!"), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // e.g. 20 MB
  },
  fileFilter,
});

export default upload;
