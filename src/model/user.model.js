// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },

    password: {
        type: String,
        required: true,
        select: false
    },

    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },

    isVerified: {
        type: Boolean,
        default: false
    },

    referralCode: {
        type: String,
        unique: true
    },
    googleId: {
        type: String
    },
    provider: {
        type: String,
        enum: ["local", "google"],
        default: "local"
    }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
