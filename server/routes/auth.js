const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();
const verifyJWT = require("../middleware/verifyJWT");
const { requireAdmin, requireAdminOrOperator } = require("../middleware/authorize");

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
        { expiresIn: "30m" }
    );
};
const nodemailer = require("nodemailer");

router.get("/smtp-test", async (req, res) => {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    
    const testTransporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: user || "DeepGuard.sec@gmail.com",
            pass: pass || "DeepGuard@2026",
        },
    });

    try {
        await testTransporter.verify();
        res.json({
            status: "success",
            message: "SMTP authentication succeeded!",
            loaded_email_user: user ? `${user.substring(0, 4)}...${user.substring(user.indexOf('@'))}` : "not configured",
            loaded_email_pass_length: pass ? pass.length : 0,
            loaded_email_pass_masked: pass ? `${pass.substring(0, 3)}...` : "not configured"
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: "SMTP authentication failed!",
            error: error.message,
            loaded_email_user: user ? `${user.substring(0, 4)}...${user.substring(user.indexOf('@'))}` : "not configured",
            loaded_email_pass_length: pass ? pass.length : 0,
            loaded_email_pass_masked: pass ? `${pass.substring(0, 3)}...` : "not configured"
        });
    }
});


router.get("/users", verifyJWT, requireAdminOrOperator, async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ["password"] },
            order: [['createdAt', 'DESC']]
        });
        res.json(users);
    } catch (error) {
        console.log(error);
        res.status(500).json("Server Error");
    }
});

router.post("/register", verifyJWT, requireAdmin, async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
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
            role,
            status: "active"
        });
        res.status(201).json("Operator registered successfully");
    } catch (error) {
        console.log(error);
        res.status(500).json("Server Error");
    }
});

router.post("/login", async (req, res) => {
    console.log('login try')
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
            maxAge: 30 * 60 * 1000, // 30 mins
            path: "/"
        });
        // send access token to frontend
        res.json({
            accessToken,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
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
        
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        } catch (err) {
            return res.status(403).json("Forbidden");
        }

        const user = await User.findByPk(decoded.id);
        if (!user) return res.status(401).json("Unauthorized");
        
        const accessToken = generateAccessToken(user);
        res.json({ 
            accessToken,
            user: { 
                id: user.id,
                name: user.name, 
                email: user.email, 
                role: user.role 
            }
        });
    } catch (error) {
        console.error("Refresh token error:", error);
        res.status(500).json("Server Error");
    }
});

router.delete("/users/:id", verifyJWT, requireAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        // Prevent deleting the Super Admin or yourself if needed
        const userToDelete = await User.findByPk(id);
        if (userToDelete.email === 'admin@deepguard.sec') {
            return res.status(403).json("Cannot delete Super Admin");
        }
        await User.destroy({ where: { id } });
        res.json("User deleted successfully");
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