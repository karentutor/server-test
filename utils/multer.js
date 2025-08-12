//utils/multer.js
import multer from "multer";

export const handleFileSizeLimit = (err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      msg: "File size exceeds the limit. Please upload a smaller file.",
      isError: true,
    });
  } else if (err) {
    // Generic Multer error or custom error
    return res.status(400).json({ error: err.message });
  }
  next();
};
