const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();

const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user.id, role: user.role },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "15m" }
    );
};

const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user.id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: "7d" }
    );
};

router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        // Check if exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(409).json("Email already in use");
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        await User.create({
            name,
            email,
            password: hashedPassword,
            role: "operator",
            status: "active"
        });
        res.status(201).json("Operator registered successfully");
    } catch (error) {
        console.log(error);
        res.status(500).json("Server Error");
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json("Invalid credentials");
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json("Invalid credentials");
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        res.cookie("jwt", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Strict",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: "/"
        });
        // send access token to frontend
        res.json({
            accessToken,
            user: { name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json("Server Error");
    }
});

// refresh route (used on page load)
router.get("/refresh", async (req, res) => {
    try {
        const cookies = req.cookies;
        if (!cookies?.jwt) return res.status(401).json("Unauthorized");
        const refreshToken = cookies.jwt;
        jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET,
            async (err, decoded) => {
                if (err) return res.status(403).json("Forbidden");
                const user = await User.findByPk(decoded.id);
                if (!user) return res.status(401).json("Unauthorized");
                const accessToken = generateAccessToken(user);
                res.json({ accessToken });
            }
        );
    } catch (error) {
        console.log(error);
        res.status(500).json("Server Error");
    }
});

router.post("/logout", (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(204);

    res.clearCookie("jwt", {
        httpOnly: true,
        sameSite: "Strict",
        secure: process.env.NODE_ENV === "production",
        path: "/"
    });
    
    res.json({ message: "Cookie cleared" });
});

module.exports = router;