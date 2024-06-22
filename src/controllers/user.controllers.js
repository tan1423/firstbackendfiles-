import { User } from "../models/User.model.js";
import { asyncHandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/Apierror.js";
import { uploadonclodinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/Apiresponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findOne(userId);
    const accesstoken = user.generateAccessToken();
    const refreshtoken = user.generateRefreshToken();

    user.refreshtoken = refreshtoken;
    await user.save({ validateBeforeSave: false });

    return { accesstoken, refreshtoken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh ans access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, fullname, password } = req.body;

  //console.log(req.body);

  // Check for required fields excluding avatar initially
  if (
    [username, email, password, fullname].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverimageLocalPath = req.files?.coverimage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadonclodinary(avatarLocalPath);
  const coverimage = coverimageLocalPath
    ? await uploadonclodinary(coverimageLocalPath)
    : null;

  if (!avatar) {
    throw new ApiError(400, "Failed to upload avatar");
  }

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverimage: coverimage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));

  //   if (!username || !email || !fullname || !avatar || !password) {
  //     return res.status(400).json({ message: "All fields are required" });
  //   }
  //   const userExists = await User.findOne({ email });

  //   if (userExists) {
  //     return res.status(400).json({ message: "User already exists" });
  //   }

  //   const user = new User({
  //     username,
  //     email,
  //     fullname,
  //     avatar,
  //     coverimage,
  //     password,
  //   });

  //   try {
  //     const savedUser = await user.save();

  //     const accessToken = savedUser.generateAccessToken();
  //     const refreshToken = savedUser.generateRefreshToken();

  //     savedUser.refreshtoken = refreshToken;
  //     await savedUser.save();

  //     res.status(201).json({
  //       message: "User registered successfully",
  //       user: {
  //         _id: savedUser._id,
  //         username: savedUser.username,
  //         email: savedUser.email,
  //         fullname: savedUser.fullname,
  //         avatar: savedUser.avatar,
  //         coverimage: savedUser.coverimage,
  //       },
  //       accessToken,
  //       refreshToken,
  //     });
  //   } catch (error) {
  //     res.status(500).json({ message: "Error saving user", error });
  //   }
});

const loginUser = asyncHandler(async (req, res) => {
  //req body -> data
  // username or email
  // find the user
  // password check
  //access and refresh token
  // send cookies

  const { email, username, password } = req.body;

  if (!username && !email) {
    throw new ApiError(400, "username or password is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordvalid = await user.isPasswordCorrect(password);

  if (!isPasswordvalid) {
    throw new ApiError(404, "Invalid user credentials");
  }

  const { accesstoken, refreshtoken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshtoken"
  );

  const option = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accesstoken", accesstoken, option)
    .cookie("refreshtoken", refreshtoken, option)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accesstoken,
          refreshtoken,
        },
        "User logged in Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshtoken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const option = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accesstoken", option)
    .clearCookie("refreshtoken", option)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccesstoken = asyncHandler(async (req, res) => {
  const incomingrefreshtoken = req.cookie.refreshtoken || req.body.refreshtoken;

  if (!incomingrefreshtoken) {
    throw new ApiError(401, "unauthorized token");
  }

  try {
    const decodedtoken = jwt.verify(
      incomingrefreshtoken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedtoken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingrefreshtoken !== user?.refreshtoken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accesstoken, newrefreshtoken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accesstoken, options)
      .cookie("refreshToken", newrefreshtoken, options)
      .json(
        new ApiResponse(
          200,
          { accesstoken, refreshtoken: newrefreshtoken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldpassword, newpassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldpassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newpassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password change successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(200, req.user, "current user fetched successfully");
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.boby;

  if (!fullname || !email) {
    throw new ApiError(400, "All fileds are required");
  }

  const user = User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname: fullname,
        email: email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details update successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const { avatarlocalpath } = req.file?.path;

  if (!avatarlocalpath) {
    throw new ApiError(400, "Avater file is missing");
  }

  const avatar = await uploadonclodinary(avatarlocalpath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploding on avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const { coverimagelocalpath } = req.file?.path;

  if (!coverimagelocalpath) {
    throw new ApiError(400, "cover image file is missing");
  }

  const coverimage = await uploadonclodinary(coverimagelocalpath);

  if (!coverimage.url) {
    throw new ApiError(400, "Error while uploding on cover image");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverimage: coverimage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "update cover image successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscriberscount: {
          $size: "$subscribers",
        },
        channelSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        subscriberscount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
        email: 1,
        avatar: 1,
        coverimage: 1,
      },
    },
  ]);

  if(!channel?.length){
    throw new ApiError(404, "channel does not exists")
  }

  return res
  .status(200)
  .json(
    new ApiResponse(200, channel[0], "user channel fetched successfully")
  )
});



export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccesstoken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
};
