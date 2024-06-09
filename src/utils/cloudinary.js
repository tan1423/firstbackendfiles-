import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View Credentials' below to copy your API secret
});

const uploadonclodinary = async (localpathFile) => {
  try {
    if (!localpathFile) return null;

    const response = await cloudinary.uploader.upload(localpathFile, {
      resource_type: "auto",
    });
    console.log("file is uploding for cloudinaey", response.url);

    return response;
  } catch (error) {
    fs.unlinkSync(localpathFile);
    return null;
  }
};

export { uploadonclodinary };
