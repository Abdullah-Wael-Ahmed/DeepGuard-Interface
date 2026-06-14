const jwt = require("jsonwebtoken");

const verifyJWT = (req, res, next) => {
    // Exempt logging and network monitoring ingestion endpoints (from external containers)
    if (
        req.path?.startsWith('/filebeat') ||
        req.originalUrl?.startsWith('/logs/filebeat') ||
        req.path?.includes('/ingest') ||
        req.originalUrl?.includes('/ingest')
    ) {
        return next();
    }

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
            // Attach the user ID and role to the request so downstream routes can use them
            req.userId = decoded.id;
            req.userRole = decoded.role;
            next(); // Move on to the actual route
        }
    );
};

module.exports = verifyJWT;