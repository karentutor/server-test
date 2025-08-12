// server/middleware/verifyAdmin.js
export const verifyAdmin = (req, res, next) => {
    try {
      // verifyToken should have already run, so req.user should exist
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
  
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admins only." });
      }
  
      next();
    } catch (err) {
      console.error("Admin verification error:", err);
      res.status(500).json({ error: err.message });
    }
  };
  