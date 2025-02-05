const jwt = require('jsonwebtoken');
const User = require('../models/user'); // Assuming you have a User model
const secretKey = process.env.JWT_SECRET || 'your_secret_key'; // Use env variable

const authenticateOptional = async (req, res, next) => {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token provided, proceed without attaching user
        return next();
    }

    const token = authHeader.split(' ')[1]; // Extract token after "Bearer"

    try {

        const decoded = jwt.verify(token, secretKey);
        req.user = decoded.payload;
    } catch (error) {
        // If token is invalid, ignore it and proceed without user
        console.log("Invalid or expired token, proceeding without authentication");
    }

    next(); // Proceed to the next middleware/route
};

module.exports = authenticateOptional;
