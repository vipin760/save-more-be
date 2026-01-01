const catchAsync = require("../middleware/catchAsyncErrors");
const mongoose = require("mongoose")
const userModel = require("../model/user.model");
const walletModel = require("../model/wallet.model");
const ErrorHandler = require("../utils/errorHandler");
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

exports.RegisterUser = catchAsync(async (req, res, next) => {
    const { name, email, password } = req.body;
    if (!name) return res.status(400).json({ message: "name fields are required" });
    if (!email) return res.status(400).json({ message: "email fields are required" });
    if (!password) return res.status(400).json({ message: "password fields are required" });

    const userExist = await userModel.findOne({ email })
    if (userExist) return res.status(400).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 12);
    const referralCode = `REF${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const user = await userModel.create({ name, email, password: hashedPassword, referralCode, provider: "local" });
    await walletModel.create({ userId: user._id, balance: 0, lockedAmount: 0 });
    //   const token = jwt.sign({ userId: user._id },process.env.JWT_SECRET,{ expiresIn: "7d" });
    res.status(201).json({
        success: true,
        message: "Account created successfully",
        user: {
            id: user._id,
            email: user.email
        }
    });
    //    res.status(201).json({ message: "Account created successfully", user: { id: user._id, name: user.name, email: user.email, referralCode: user.referralCode } });
})

exports.loginUser = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email) {
        return res.status(400).json({
            success: false,
            message: "Email is required"
        });
    }

    if (!password) {
        return res.status(400).json({
            success: false,
            message: "Password is required"
        });
    }

    // 2️⃣ Find user
    const user = await userModel.findOne({ email }).select("+password");

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Invalid email or password"
        });
    }

    // 3️⃣ If Google account, block password login
    if (user.provider === "google") {
        return res.status(400).json({
            success: false,
            message: "Please login using Google"
        });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json({
            success: false,
            message: "Invalid email or password"
        });
    }

    // 5️⃣ Generate JWT
    const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
    // 6️⃣ Response (never send password)
    res.status(200).json({
        success: true,
        message: "Login successful",
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
});

exports.getMe = catchAsync(async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Not authenticated" });

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await userModel.findById(decoded.userId);

  res.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

exports.logoutUser = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};