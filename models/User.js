import mongoose from "mongoose";

const DegreeSchema = new mongoose.Schema(
  {
    degreeLevel:   { type: String, trim: true },
    programmeName: { type: String, trim: true },
    year:          { type: String, trim: true },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    /* ───────── BASIC INFO ───────── */
    firstName: { type: String, required: true, minlength: 2, maxlength: 50 },
    lastName:  { type: String, required: true, minlength: 2, maxlength: 50 },
    email: {
      type: String,
      required: true,
      maxlength: 100,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    password:            { type: String, minlength: 5 },
    elum:                { type: Boolean, default: true, required: true },
    picturePath:         { type: String, default: "" },
    cloudinaryPublicId:  { type: String, default: null },

    /* ───────── SOCIAL CONNECTIONS ───────── */
    following:      [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    followers:      [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockFollowing: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    invites:        { type: Array, default: [] },
    isOnline:       { type: Boolean, default: false },

    /* ───────── OXFORD‑SPECIFIC FIELDS ───── */
    college: { type: String, trim: true },
    degrees: {
      type: [DegreeSchema],
      validate: [(arr) => arr.length <= 5, "Maximum 5 credentials allowed"],
      default: [],
    },

    /* ───────── OTHER DETAILS ────────────── */
    occupation:    { type: String, trim: true },
    subOccupation: { type: String, trim: true },
    isVerified:    { type: Boolean, default: false },
    location: {
      latitude:    Number,
      longitude:   Number,
      street:      String,
      city:        String,
      postal_code: String,
      country:     String,
    },

    viewedProfile: Number,
    impressions:   Number,

    contactPreferences: {
      type: [String],
      enum: [
        "social - in person",
        "social - virtual",
        "charity or project help",
        "business opportunities",
        "jobs",
        "general networking",
      ],
      default: [],
    },

    expoPushToken: { type: String, default: null },
    travelPlans:   [{ type: mongoose.Schema.Types.ObjectId, ref: "TravelPlan" }],

    role:          { type: String, enum: ["admin", "system", "user", "moderator"], default: "user" },
    referralDepth: { type: Number, default: 0 },

    workStatus: {
      type: [String],
      enum: [
        "available full-time",
        "available part-time",
        "available contract",
        "not available",
      ],
      default: [],
    },

    professionalProfileUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

UserSchema.pre("save", function (next) {
  if (this.elum && !this.password) {
    next(new Error("Password is required for 'elum' users."));
  } else {
    next();
  }
});

const User = mongoose.model("User", UserSchema);
export default User;
