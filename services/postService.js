// services/postService.js

import Post from "../models/Post.js";
import Group from "../models/Group.js";
import User from "../models/User.js";
import cloudinary from "../configurations/cloudinary.js";
import { uploadFileToCloudinary } from "../utils/helperFunctions.js";

/**
 * Create a new post
 */
export async function createPostService({ userId, file, description, groupId }) {
  // 1) Upload file to Cloudinary if needed
  let newPath = "";
  let newCloudinaryPublicId = null;
  if (file) {
    const result = await uploadFileToCloudinary(file, "oxsaid/posts");
    newPath = result.secure_url;
    newCloudinaryPublicId = result.public_id;
  }

  // 2) Find the user
  const user = await User.findById(userId);
  if (!user) {
    // We'll let the controller handle the error
    throw new Error("User not found");
  }

  // 3) Create the Post doc
  const newPost = new Post({
    userId,
    firstName: user.firstName,
    lastName: user.lastName,
    location: user.location, // or skip if not needed
    description,
    groupId: groupId || null,
    userPicturePath: user.picturePath,
    picturePath: newPath,
    cloudinaryPublicId: newCloudinaryPublicId,
    likes: {},
    comments: [],
  });
  await newPost.save();

  // 4) Return the updated list of posts for that group (or null group)
  const posts = await Post.find({ groupId: groupId || null }).sort({
    createdAt: -1,
  });
  return { posts, newPost };
}

/**
 * Update a post
 */
export async function updatePostService({ postId, userId, description, file }) {
  // 1) Find existing post
  const post = await Post.findById(postId);
  if (!post) {
    throw new Error("Post not found");
  }

  // 2) Ensure user is owner
  if (post.userId.toString() !== userId) {
    throw new Error("Not authorized to edit this post");
  }

  // 3) If new file, remove old from Cloudinary + upload new
  let newPath = null;
  let newCloudinaryPublicId = null;
  if (file) {
    if (post.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(post.cloudinaryPublicId);
      } catch (error) {
        console.error("Cloudinary delete failed", error);
        // not fatal
      }
    }
    const result = await uploadFileToCloudinary(file, "oxsaid/posts");
    newPath = result.secure_url;
    newCloudinaryPublicId = result.public_id;
  }

  // 4) Update fields
  if (description !== undefined) {
    post.description = description;
  }
  if (newPath !== null) {
    post.picturePath = newPath;
    post.cloudinaryPublicId = newCloudinaryPublicId;
  }

  await post.save();
  return post;
}

/**
 * Delete a post
 */
export async function deletePostService({ postId, userId }) {
  // 1) Find
  const post = await Post.findById(postId);
  if (!post) {
    throw new Error("Post not found");
  }

  // 2) Ensure user is owner
  if (post.userId.toString() !== userId) {
    throw new Error("Not authorized to delete this post");
  }

  // 3) Remove from Cloudinary if needed
  if (post.cloudinaryPublicId) {
    try {
      await cloudinary.uploader.destroy(post.cloudinaryPublicId);
    } catch (error) {
      console.error("Cloudinary delete failed", error);
      // not fatal
    }
  }

  // 4) Remove from DB
  await Post.findByIdAndRemove(postId);
  return true;
}

/**
 * Get posts for the logged-in user
 */
export async function getOwnPostsService(userId) {
  const posts = await Post.find({ userId }).populate("comments.user").sort({
    createdAt: -1,
  });
  return posts;
}

/**
 * Get posts for a specific user
 */
export async function getUserPostsService(userId) {
  const posts = await Post.find({ userId }).populate("comments.user").sort({
    createdAt: -1,
  });
  return posts;
}

/**
 * Like a post
 */
export async function likePostService({ postId, userId }) {
  const post = await Post.findById(postId);
  if (!post) {
    throw new Error("Post not found");
  }

  const isLiked = post.likes.get(userId);
  if (isLiked) {
    post.likes.delete(userId);
  } else {
    post.likes.set(userId, true);
  }

  const updatedPost = await Post.findByIdAndUpdate(
    postId,
    { likes: post.likes },
    { new: true }
  ).populate("comments.user");
  return updatedPost;
}

/**
 * Comment on a post
 */
export async function commentPostService({ postId, userId, text }) {
  // push comment doc into post
  const updatedPost = await Post.findByIdAndUpdate(
    postId,
    {
      $push: {
        comments: {
          user: userId,
          text,
        },
      },
    },
    { new: true }
  ).populate("comments.user");

  if (!updatedPost) {
    throw new Error("Post not found");
  }
  return updatedPost;
}

/**
 * Get posts from friends/followed users
 */
export async function getFollowedPostsService(loggedInUserId) {
  const loggedInUser = await User.findById(loggedInUserId).populate("friends");
  if (!loggedInUser) {
    throw new Error("Logged-in user not found");
  }

  // posts from userIds in friends
  const posts = await Post.find({
    userId: { $in: loggedInUser.friends },
  })
    .populate("comments.user")
    .sort({ createdAt: -1 });

  return posts;
}

/**
 * Get posts from groups the user is a member or admin
 */
export async function getGroupPostsService(userId) {
  // 1) Find groups
  const groups = await Group.find({
    $or: [{ groupMembers: userId }, { adminMembers: userId }],
  });
  const groupIds = groups.map((g) => g._id);

  if (groupIds.length === 0) {
    return [];
  }

  // 2) Find posts from those groupIds
  const groupPosts = await Post.find({ groupId: { $in: groupIds } })
    .populate("userId", "firstName lastName")
    .populate("groupId", "name")
    .sort({ createdAt: -1 });

  return groupPosts;
}
