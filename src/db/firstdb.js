import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`\n MongoDB connection || DB host: ${connectionInstance.connection.host}`);
  } catch (error) {
    console.log("Mongoose error", error);
    process.exit(1);
  }
};

export default connectDB;
