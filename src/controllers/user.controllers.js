import { User } from "../models/User.model.js";
import { asyncHandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/Apierror.js";
import { uploadonclodinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/Apiresponse.js";

const registerUser = asyncHandler(async (req, res) => {
    const { username, email, fullname, password } = req.body;
  
    //console.log(req.body);
  
    // Check for required fields excluding avatar initially
    if ([username, email, password, fullname].some((field) => field?.trim() === "")) {
      throw new ApiError(400, "All fields are required");
    }
  
    const existedUser = await User.findOne({
      $or: [{ username }, { email }]
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
    const coverimage = coverimageLocalPath ? await uploadonclodinary(coverimageLocalPath) : null;
  
    if (!avatar) {
      throw new ApiError(400, "Failed to upload avatar");
    }
  
    const user = await User.create({
      fullname,
      avatar: avatar.url,
      coverimage: coverimage?.url || "",
      email,
      password,
      username: username.toLowerCase()
    });
  
    const createdUser = await User.findById(user._id).select("-password -refreshToken");
  
    if (!createdUser) {
      throw new ApiError(500, "Something went wrong while registering the user");
    }
  
    return res.status(201).json(
      new ApiResponse(200, createdUser, "User registered successfully")
    );


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

export { registerUser };
