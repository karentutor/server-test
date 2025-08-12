// server/middleware/validation.js
import { validationResult } from "express-validator";

export const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Extract each validation error into an object keyed by field.
    // For instance: { "senderEmail": "Invalid email", "subject": "Subject is required" }
    const formattedErrors = errors.array().reduce((acc, err) => {
      acc[err.param] = err.msg;
      return acc;
    }, {});

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: formattedErrors,
    });
  }
  next();
};
