import mongoose from "mongoose";

const groupSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    events: [{ type: mongoose.Schema.ObjectId, ref: "Event" }],
    isGlobal: {
      type: Boolean,
      default: false,
    },
    groupMembers: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    ],
    adminMembers: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    ],
    invitedMembers: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    ],
    requestJoinMembers: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    ],
    declinedMembers: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    ],
    ignoredMembers: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    ],
    groupCoverImage: {
      type: String,
    },
    cloudinaryPublicId: {
      type: String,
      default: null,
    },
    groupCreator: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
    createdAt: {
      type: Date,
      default: new Date(),
    },
  },
  {
    timestamps: true,
    strict: true,
    versionKey: false,
  }
);

const Group = mongoose.model("Group", groupSchema);

export default Group;
