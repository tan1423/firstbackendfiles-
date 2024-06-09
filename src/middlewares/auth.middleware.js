import { ApiError } from "../utils/Apierror.js";
import { asyncHandler } from "../utils/asynchandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/User.model.js";

export  const verifyJWT = asyncHandler(async (req, res, next)=>{
    try {
        const token = req.cookies?.accesstoken || req.header("Authorization")?.replace("Bearer ", "")
    
        if(!token){
            throw new ApiError(401, "Unathorized request")
        }
    
        const decodeedtoken =  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodeedtoken?._id).select("-password -refreshtoken")
    
        if(!user){
            throw new ApiError(401, "Invalid Access Token")
        }
    
        req.user = user
        next()
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Access token")
    }


})