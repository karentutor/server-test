// configurations/corsConfig.js
import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env

let allowedOrigins = [];

// Check if ALLOWED_ORIGINS is set
if (process.env.ALLOWED_ORIGINS) {
  // Convert "https://oxsaid.net,https://www.oxsaid.net" into an array
  allowedOrigins = process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim());
} else {
  // Optionally log a warning or fall back to an empty array or some safe default
  console.warn("Warning: ALLOWED_ORIGINS not set in .env! Defaulting to empty list.");
}

export default allowedOrigins;
