//server/controllers/authController.js
import {
  registerGuestService,
  updateProfileService,
  registerUserService,
  validateEmailService,
  guestLoginService,
  loginService,
  inviteFriendService,
  getCurrentUserService,
  loadUserService,
  decodeTokenService,
  changePasswordService,
  requestPasswordResetService,
  resetPasswordService,
} from "../services/authService.js";


/* ────────────────────────────────────────────────────────── */
/* REGISTER USER                                              */
/* Expects multipart/form‑data with a “degrees” JSON string   */
/* ────────────────────────────────────────────────────────── */
export const registerUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      street,
      city,
      postal_code,
      country,
      occupation,
      subOccupation,
      college,
      professionalProfileUrl,
    } = req.body;

    /* ---------- credentials (array) ---------- */
    let degrees = [];
    if (req.body.degrees) {
      try {
        degrees = JSON.parse(req.body.degrees);
      } catch {
        return res
          .status(400)
          .json({ message: "Invalid degrees format (must be JSON)." });
      }
    }
    if (degrees.length > 5) {
      return res
        .status(400)
        .json({ message: "Maximum of 5 degrees/certificates allowed." });
    }

    const file = req.file || null;

    const result = await registerUserService({
      firstName,
      lastName,
      email,
      password,
      street,
      city,
      postal_code,
      country,
      occupation,
      subOccupation,
      college,
      degrees, // ← NEW ARRAY
      professionalProfileUrl,
      file,
    });

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    const u = result.user;
    return res.status(201).json({
      message: "User registered successfully",
      user: {
        _id: u._id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        picturePath: u.picturePath,
        cloudinaryPublicId: u.cloudinaryPublicId,
        location: u.location,
        occupation: u.occupation,
        subOccupation: u.subOccupation,
        college: u.college,
        degrees: u.degrees, // ← ARRAY
        referralDepth: u.referralDepth,
        professionalProfileUrl: u.professionalProfileUrl,
      },
    });
  } catch (err) {
    if (err.message.includes("already exists")) {
      return res.status(400).json({ message: err.message });
    }
    // eslint-disable-next-line no-console
    console.error("Error in registerUser:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Validate email
 */
export const validateEmail = async (req, res) => {
  try {
    const { token } = req.body;
    await validateEmailService(token);
    return res
      .status(200)
      .json({ msg: "Your email has been verified.", isSuccess: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export const login = async (req, res) => {
  try {
    const email    = req.body.email?.trim().toLowerCase() || "";
    const password = req.body.password?.trim() || "";

    // Delegate to the service layer
    const { user, token } = await loginService(email, password, req);

    // Success ────────────────────────────────────────────────────────────────
    return res.status(200).json({
      isSuccess : true,
      msg       : "You have successfully logged in.",
      token,
      user      // already stripped of password by the service
    });
  } catch (err) {
    console.error("Login failed:", err);

    // Map error → HTTP status
    const status =
      err.name === "ValidationError" ? 400 :   // malformed input
      err.name === "AuthError"       ? 401 :   // bad credentials / not verified
      500;                                   // anything else

    return res.status(status).json({
      isSuccess : false,
      msg       : err.message
    });
  }
};


/* ────────────────────────────────────────────────────────── */
/* UPDATE PROFILE                                             */
/* “degrees” field handled identically (JSON string).         */
/* Nothing else changes in the routing layer.                */
/* ────────────────────────────────────────────────────────── */
export const updateProfile = async (req, res) => {
  try {
    const updatedUser = await updateProfileService({
      userId: req.user.id,
      body: req.body,
      file: req.file || null,
    });
    return res.status(200).json({
      msg: "Profile updated successfully",
      isSuccess: true,
      user: updatedUser,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error updating profile:", err);
    res.status(500).json({ error: err.message });
  }
};



/**
 * Guest login
 */
export const guestLogin = async (req, res) => {
  try {
    const { email } = req.body;
    const { user, token } = await guestLoginService(email);

    res.status(200).json({
      token,
      user,
      isSuccess: true,
      msg: "You have successfully logged in.",
    });
  } catch (err) {
    if (err.message.includes("not a guest user")) {
      return res.status(200).json({ msg: err.message, isError: true });
    }
    if (err.message.includes("does not exist")) {
      return res.status(200).json({ msg: err.message, isError: true });
    }
    res.status(500).json({ error: err.message });
  }
};


/**
 * Invite friend
 */
export const inviteFriend = async (req, res) => {
  try {
    const email = req.body.email?.trim() || "";
    const userId = req.body.userId?.trim() || "";
    const domainName = req.body.domainName?.trim() || "";

    await inviteFriendService({ email, userId, domainName });
    return res.status(200).json({
      msg: "You have successfully invited your friend. Check your email for the verification link.",
      isSuccess: true,
    });
  } catch (err) {
    return res.status(200).json({ msg: err.message, isError: true });
  }
};

/**
 * Get current user from JWT req.user
 */
export const getCurrentUser = async (req, res) => {
  try {
    const user = await getCurrentUserService(req.user.id);
    res.json(user);
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Load user from a token (provided in req.body)
 */
export const loadUser = async (req, res) => {
  try {
    const { token } = req.body;
    const { user, token: newToken } = await loadUserService(token);
    return res.status(200).json({ user, isSuccess: true, token: newToken });
  } catch (err) {
    return res.status(200).json({ msg: err.message, isError: true });
  }
};

/**
 * Decode a token => get email
 */
export const decodeToken = async (req, res) => {
  try {
    const { token } = req.body;
    const email = await decodeTokenService(token);
    // If we get here, no user with that email
    return res.status(200).json({ email, isSuccess: true });
  } catch (err) {
    // Possibly "User already exists"
    return res.status(200).json({ msg: err.message, isError: true });
  }
};

/**
 * Change password
 */
export const changePassword = async (req, res) => {
  try {
    const email = req.body.email?.trim();
    const password = req.body.password?.trim();
    const newPassword = req.body.newPassword?.trim();

    await changePasswordService({ email, password, newPassword });
    return res.status(200).json({
      msg: "Password changed successfully",
      isSuccess: true,
    });
  } catch (err) {
    // If user does not exist or invalid credentials
    return res.status(200).json({ msg: err.message, isError: true });
  }
};

/**
 * REGISTER -> Guest User
 */
export const registerGuest = async (req, res) => {
  try {
    const email = req.body.email?.trim() || "";
    const lastName = req.body.lastName?.trim() || "";
    const firstName = req.body.firstName?.trim() || "";

    const { user, token } = await registerGuestService({
      email,
      lastName,
      firstName,
    });

    res.status(201).json({
      msg: "You have successfully registered",
      isSuccess: true,
      user,
      token,
    });
  } catch (err) {
    if (err.message.includes("User already exists")) {
      return res.status(200).json({ msg: err.message, isError: true });
    }
    res.status(500).json({ error: err.message });
  }
};

/* ──────────────────────────────────────────────────────────── */
/* FORGOT / RESET PASSWORD CONTROLLERS                         */
/* ──────────────────────────────────────────────────────────── */

/**
 * POST /api/auth/request-password-reset
 * Body: { email }
 */
export const requestPasswordReset = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase() || "";
    if (!email) throw new Error("E‑mail is required.");
    await requestPasswordResetService(email);
    return res.status(200).json({
      isSuccess: true,
      msg: "If that account exists, a reset link has been sent.",
    });
  } catch (err) {
    return res.status(400).json({ isSuccess: false, msg: err.message });
  }
};

/**
 * POST /api/auth/reset-password
 * Body: { token, newPassword }
 */
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) throw new Error("Token and password required.");
    await resetPasswordService(token, newPassword);
    return res
      .status(200)
      .json({ isSuccess: true, msg: "Password reset successful." });
  } catch (err) {
    const status = err.name === "AuthError" ? 401 : 400;
    return res.status(status).json({ isSuccess: false, msg: err.message });
  }
};
