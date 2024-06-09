import { User } from "../models/User.model.js";
import { asyncHandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/Apierror.js";
import { uploadonclodinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/Apiresponse.js";
import jwt from "jsonwebtoken";


const generateAccessAndRefreshTokens = async(userId) =>{
  try {
    const user = await User.findOne(userId)
    const accesstoken = user.generateAccessToken()
    const refreshtoken = user.generateRefreshToken()

   user.refreshtoken = refreshtoken
   await user.save({validateBeforeSave : false}) 

   return {accesstoken, refreshtoken}

  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating refresh ans access token")
  }
}

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

const loginUser = asyncHandler(async (req, res) =>{
  //req body -> data
  // username or email
  // find the user
  // password check
  //access and refresh token
  // send cookies

  const {email, username, password} = req.body

  if(!username && !email){
    throw new ApiError(400, "username or password is required")
  }

  const user = await User.findOne({
    $or: [{username}, {email}]
  })

  if(!user){
    throw new ApiError(404, "User does not exist")
  }

  const isPasswordvalid =  await user.isPasswordCorrect(password)

  if(!isPasswordvalid){
    throw new ApiError(404, "Invalid user credentials")
  }

  const {accesstoken, refreshtoken} = await generateAccessAndRefreshTokens(user._id)

  const loggedInUser = await User.findById(user._id).select("-password -refreshtoken")

  const option = {
    httpOnly: true,
    secure: true
  }

  return res
  .status(200)
  .cookie("accesstoken", accesstoken, option)
  .cookie("refreshtoken", refreshtoken, option)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedInUser, accesstoken, refreshtoken
      },
      "User logged in Successfully"
    )
  )

})

const logoutUser = asyncHandler(async (req, res)=>{
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshtoken: undefined
      }
    },
    {
      new: true
    }
  )
  const option = {
    httpOnly: true,
    secure: true
  }

  return res
  .status(200)
  .clearCookie("accesstoken", option)
  .clearCookie("refreshtoken", option)
  .json(new ApiResponse(200, {}, "User logged Out"))



})

const refreshAccesstoken = asyncHandler(async (req, res)=>{

  const incomingrefreshtoken = req.cookie.refreshtoken || req.body.refreshtoken

  if(!incomingrefreshtoken){
    throw new ApiError(401, "unauthorized token")
  }

  try {
    const decodedtoken = jwt.verify(incomingrefreshtoken, process.env.REFRESH_TOKEN_SECRET)
  
    const user = await User.findById(decodedtoken?._id)
  
    if(!user){
      throw new ApiError(401, "Invalid refresh token")
    }
  
    if(incomingrefreshtoken !== user?.refreshtoken){
      throw new ApiError(401, "Refresh token is expired or used")
    }
  
    const options = {
      httpOnly: true,
      secure: true
    }
  
    const {accesstoken, newrefreshtoken} = await generateAccessAndRefreshTokens(user._id)
  
    return res
    .status(200)
    .cookie("accessToken", accesstoken, options)
    .cookie("refreshToken", newrefreshtoken, options)
    .json(
      new ApiResponse(
        200,
        {accesstoken, refreshtoken: newrefreshtoken},
        "Access token refreshed"
      )
    )
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
  }

})

export { registerUser, loginUser, logoutUser, refreshAccesstoken };
