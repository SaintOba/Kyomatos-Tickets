const User = require("../models/User");

exports.registerUser = async (req, res) => {
    const { username, email, password } = req.body;

    const user = await User.create({ username, email, password });

    res.json({
        success: true,
        message: "User registered",
        user
    });
};

exports.loginUser = async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({ username, password });

    if (!user) return res.json({ success: false, message: "Invalid details" });

    res.json({
        success: true,
        message: "Login successful",
        user
    });
};
