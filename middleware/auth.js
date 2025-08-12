import jwt from "jsonwebtoken";
import User from "../models/User.js"; // Import the User model

export const verifyToken = async (req, res, next) => {
  try {
    let token;

    // 1. Check for "Authorization" header with Bearer token
    const authHeader = req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }

    // 2. If no Bearer token found, check cookies
    if (!token) {
      token = req.cookies?.access_token;
    }

    // 3. If still no token, return 403
    if (!token) {
      return res.status(403).send("Access Denied");
    }

    // 4. Verify JWT
    const verified = jwt.verify(token, process.env.JWT_SECRET);

    // 5. Fetch user details from DB, including 'role'
    const user = await User.findById(verified.id).select(
      "firstName lastName picturePath role" // <--- Add 'role' here
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 6. Attach user details (including role) to req.user
    req.user = {
      id: verified.id,
      firstName: user.firstName,
      lastName: user.lastName,
      picturePath: user.picturePath,
      role: user.role, // <--- Include role
    };

    next();
  } catch (err) {
    console.error("Token verification error:", err);
    res.status(500).json({ error: err.message });
  }
};
