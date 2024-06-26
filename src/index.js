import connectDB from "./db/firstdb.js";
import dotenv from "dotenv";
import { app } from "./app.js"

dotenv.config({
    path: './env'
})


connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`Server is running at port : ${process.env.PORT || 8000}`);
    })
})
.catch((err)=>{
    console.log("Mongo db connection is failed !!!", err);
})



/*
import express from "express";
const app = express()
( async () =>{
    try {
        await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
        app.on("error", (error)=>{
            console.log("error", error);
            throw error
        })

        app.listen(process.env.PORT, ()=>{
            console.log(`App is listening on port ${process.env.PORT}`);
        })
        
    } catch (error) {
        console.log("error: ", error)
        throw error
    }
})()

*/