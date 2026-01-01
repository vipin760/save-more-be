require("dotenv").config()
const mongoose = require("mongoose")

exports.connectDB = async()=>{
    try {
        mongoose.connect(process.env.DB_URL)
    } catch (error) {
        console.log("<><>database error",error.message)
    }
}
