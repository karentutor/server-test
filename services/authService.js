/* ──────────────────────────────────────────────────────────── */
/*  services/authService.js                                     */
/* ──────────────────────────────────────────────────────────── */

import bcrypt       from "bcrypt";
import jwt          from "jsonwebtoken";
import User         from "../models/User.js";
import cloudinary   from "../configurations/cloudinary.js";
import { uploadFileToCloudinary } from "../utils/helperFunctions.js";
import sendEmail    from "../utils/sendEmail.js";
import { geocodeAddress } from "../utils/geocode.js";
import LoginEvent   from "../models/LoginEvent.js";
import { AuthError } from "../utils/errorClasses.js";

const JWT_SECRET = process.env.JWT_SECRET;   // convenience

/* ──────────────────────────────────────────────────────────── */
/* REGISTER ‑ Guest                                             */
/* ──────────────────────────────────────────────────────────── */
export async function registerGuestService({ email, lastName, firstName }) {
  const isExist = await User.findOne({ email }).lean();
  if (isExist) throw new Error("User already exists.");

  const newUser = new User({
    email,
    lastName,
    firstName,
    elum: false,       // guest flag
  });

  const savedUser = await newUser.save();
  const token     = jwt.sign({ id: savedUser._id }, JWT_SECRET);

  return { user: savedUser, token };
}

/* ────────────────────────────────────────────────────────── */
/* REGISTER USER SERVICE                                      */
/* ────────────────────────────────────────────────────────── */
export async function registerUserService(payload) {
  const {
    firstName,
    lastName,
    email,
    password,
    street,
    city,
    postal_code,
    country,
    file,
    occupation,
    subOccupation,
    college,
    degrees,
    professionalProfileUrl,
  } = payload;

  try {
    const normalizedEmail = email.toLowerCase().trim();

    if (await User.findOne({ email: normalizedEmail })) {
      return { success: false, message: "Email is already registered." };
    }

    /* ---------- picture upload ---------- */
    let picturePath = "";
    let cloudinaryPublicId = null;
    if (file) {
      const up = await uploadFileToCloudinary(file, "oxsaid/user");
      picturePath = up.secure_url;
      cloudinaryPublicId = up.public_id;
    }

    /* ---------- hash password ---------- */
    const hashedPassword = await bcrypt.hash(password, 10);

    /* ---------- geocode (optional) ---------- */
    let latitude = null;
    let longitude = null;
    if (city || country) {
      const geo = await geocodeAddress({ address: street, city, postal_code, country });
      if (geo?.length) {
        const [lng, lat] = geo[0].geometry.coordinates;
        latitude = lat;
        longitude = lng;
      }
    }

    /* ---------- create user ---------- */
    const newUser = new User({
      firstName,
      lastName,
      email: normalizedEmail,
      password: hashedPassword,
      picturePath,
      cloudinaryPublicId,
      location: {
        latitude,
        longitude,
        street: street || "",
        city: city || "",
        postal_code: postal_code || "",
        country: country || "",
      },
      occupation: occupation || "",
      subOccupation: subOccupation || "",
      college: college || "",
      degrees: Array.isArray(degrees) ? degrees.slice(0, 5) : [],
      professionalProfileUrl: professionalProfileUrl || "",
      isVerified: true,
      elum: true,
      referralDepth: 0,
    });

    const savedUser = await newUser.save();
    return { success: true, user: savedUser };
  } catch (err) {
    if (err.code === 11000) {
      return { success: false, message: "Email is already registered." };
    }
    return { success: false, message: "Registration failed. Please try again." };
  }
}

/* ────────────────────────────────────────────────────────── */
/* UPDATE PROFILE SERVICE                                     */
/* ────────────────────────────────────────────────────────── */
export async function updateProfileService({ userId, body, file }) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found.");

  /* ---------- optional picture ---------- */
  if (file) {
    if (user.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(user.cloudinaryPublicId);
    }
    const up = await uploadFileToCloudinary(file, "oxsaid/user");
    user.picturePath = up.secure_url;
    user.cloudinaryPublicId = up.public_id;
  }

  /* ---------- scalar fields ---------- */
  [
    "firstName",
    "lastName",
    "email",
    "occupation",
    "subOccupation",
    "college",
    "professionalProfileUrl",
  ].forEach((f) => {
    if (body[f] !== undefined) user[f] = body[f];
  });

  /* ---------- credentials ---------- */
  if (body.degrees !== undefined) {
    let degrees = [];
    try {
      degrees = JSON.parse(body.degrees);
    } catch {
      throw new Error("Invalid degrees format (must be JSON).");
    }
    if (degrees.length > 5) {
      throw new Error("Maximum of 5 degrees/certificates allowed.");
    }
    user.degrees = degrees;
  }

  /* ---------- location ---------- */
  if (!user.location) user.location = {};
  if (body["location[country]"] !== undefined)
    user.location.country = body["location[country]"];
  if (body["location[city]"] !== undefined)
    user.location.city = body["location[city]"];

  /* ---------- password ---------- */
  if (body.password) {
    user.password = await bcrypt.hash(body.password, 10);
  }

  return user.save();
}
/* ──────────────────────────────────────────────────────────── */
/* EMAIL VALIDATION                                             */
/* ──────────────────────────────────────────────────────────── */
export async function validateEmailService(token) {
  if (!token) throw new Error("No token, authorization denied.");
  const decoded = jwt.verify(token, JWT_SECRET);
  if (!decoded) throw new Error("Invalid token.");

  const user = await User.findOne({ email: decoded.email });
  if (!user) throw new Error("User does not exist.");

  user.isVerified = true;
  await user.save();
  return true;
}

/* ──────────────────────────────────────────────────────────── */
/* LOGIN SERVICES                                               */
/* ──────────────────────────────────────────────────────────── */
export async function guestLoginService(email) {
  const user = await User.findOne({ email });
  if (!user) throw new Error("User does not exist.");
  if (user.elum) throw new Error("User is not a guest user, password is required.");

  const token = jwt.sign({ id: user._id }, JWT_SECRET);
  return { user, token };
}

export async function loginService(email, password, req) {
  console.log("EMAIL:", email);
  console.log("PASSWORD ATTEMPT:", password);

  const normalisedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalisedEmail }).select("+password");
  if (!user) throw new AuthError("User does not exist.");

  if (!user.elum) throw new AuthError("User is not verified, please sign in as guest.");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new AuthError("Invalid credentials.");

  if (!user.isVerified) {
    throw new AuthError("Your email has not been verified. Please check your inbox.");
  }

  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });

  await LoginEvent.create({
    userId    : user._id,
    timestamp : new Date(),
    ip        : req.ip ||
                req.headers["x-forwarded-for"] ||
                req.connection.remoteAddress,
  });

  const safeUser = user.toObject();
  delete safeUser.password;

  return { user: safeUser, token };
}

/* ──────────────────────────────────────────────────────────── */
/* PASSWORD‑RESET SERVICES                                      */
/* ──────────────────────────────────────────────────────────── */

/**
 * Send a password‑reset link.
 */
export async function requestPasswordResetService(email) {
  const normalisedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalisedEmail });
  if (!user) {
    // Do not reveal account existence
    return;
  }

  const token = jwt.sign(
    { id: user._id, purpose: "passwordReset" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  /* --- use DOMAIN env var, default to localhost --- */
  const domain   = process.env.DOMAIN || "http://localhost:3000";
  const resetUrl = `${domain}/reset-password/${token}`;

  const html = `
    <p>Hello ${user.firstName || ""},</p>
    <p>You recently requested to reset your password. Click the link below to proceed.
       This link is valid for 1&nbsp;hour.</p>
    <p><a href="${resetUrl}">Reset my password</a></p>
    <p>If you did not request this, please ignore this e‑mail.</p>
  `;

  await sendEmail({
    email: user.email,
    subject: "Reset your password",
    message: html,
  });

  /* --- log link in dev for convenience --- */
  if (process.env.NODE_ENV !== "production") {
    console.log(`[dev] Password‑reset link for ${user.email}: ${resetUrl}`);
  }
}

/**
 * Reset password given a valid token.
 */
export async function resetPasswordService(token, newPassword) {
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new AuthError("Reset link is invalid or has expired.");
  }

  if (decoded.purpose !== "passwordReset") {
    throw new AuthError("Invalid reset token.");
  }

  const user = await User.findById(decoded.id);
  if (!user) throw new AuthError("User does not exist.");

  const salt = await bcrypt.genSalt();
  user.password = await bcrypt.hash(newPassword, salt);
  await user.save();

  return true;
}

/* ──────────────────────────────────────────────────────────── */
/* OTHER UTILITIES                                              */
/* ──────────────────────────────────────────────────────────── */
export async function inviteFriendService({ email, userId, domainName }) {
  const isExists = await User.findOne({ email }).lean();
  if (isExists) {
    throw new Error("User already exists. Please ask your friend to login instead.");
  }

  const user = await User.findById(userId).lean();
  if (!user) throw new Error("Inviter user does not exist.");

  if (user.email !== process.env.ADMIN_EMAIL) {
    const has2Invites = await User.findOne({
      _id: userId,
      invites: { $size: 2 },
    }).lean();
    if (has2Invites) throw new Error("You have already invited 2 friends.");
  }

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "30d" });
  const url   = `${domainName || process.env.DOMAIN}/join?token=${token}`;

  const message = `
    Please click the following link, or paste this into your browser to complete the process:
    <a href="${url}">${url}</a>
  `;

  await sendEmail({
    email,
    subject : `Join ${process.env.REACT_APP_ORGANIZATION_NAME} Network`,
    message,
  });

  await User.findByIdAndUpdate(userId, {
    $push: { invites: { email, token } },
  });

  return true;
}

export async function getCurrentUserService(userId) {
  const user = await User.findById(userId, { password: 0 }).lean();
  if (!user) throw new Error("User not found.");
  return user;
}

export async function loadUserService(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (!decoded) throw new Error("Invalid token.");

  const user = await User.findById(decoded.id, { password: 0 }).lean();
  if (!user) throw new Error("User does not exist.");

  const newToken = jwt.sign({ id: user._id }, JWT_SECRET);
  return { user, token: newToken };
}

export async function decodeTokenService(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  const isExists = await User.findOne({ email: decoded.email }).lean();
  if (isExists) throw new Error("User already exists. Please login instead.");
  return decoded.email;
}

export async function changePasswordService({ email, password, newPassword }) {
  const user = await User.findOne({ email });
  if (!user) throw new Error("User does not exist.");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error("Invalid credentials.");

  const salt = await bcrypt.genSalt();
  user.password = await bcrypt.hash(newPassword, salt);
  await user.save();

  return true;
}
