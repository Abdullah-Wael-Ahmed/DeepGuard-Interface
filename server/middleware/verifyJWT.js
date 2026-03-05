const jwt = require("jsonwebtoken");

const verifyJWT = (req, res, next) => {
    // Check for the Authorization header (can be lowercase or uppercase 'A')
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    // If no header or it doesn't start with 'Bearer ', reject it
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized: Missing token" });
    }

    // Extract the token (Format is "Bearer <token>")
    const token = authHeader.split(" ")[1];

    // Verify the token
    jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
        (err, decoded) => {
            if (err) return res.status(403).json({ message: "Forbidden: Invalid or expired token" });
            // Attach the user ID to the request so the next route can use it
            req.userId = decoded.id;
            next(); // Move on to the actual route
        }
    );
};

module.exports = verifyJWT;