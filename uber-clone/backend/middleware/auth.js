const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Access denied. No token provided.' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const [users] = await pool.execute(
            'SELECT id, email, first_name, last_name, user_type, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token. User not found.' 
            });
        }

        const user = users[0];
        
        if (!user.is_active) {
            return res.status(401).json({ 
                success: false, 
                message: 'Account is deactivated.' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token.' 
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Token expired.' 
            });
        }
        res.status(500).json({ 
            success: false, 
            message: 'Server error during authentication.' 
        });
    }
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required.' 
            });
        }

        const userRoles = req.user.user_type === 'both' ? ['rider', 'driver'] : [req.user.user_type];
        const hasRole = roles.some(role => userRoles.includes(role));

        if (!hasRole) {
            return res.status(403).json({ 
                success: false, 
                message: 'Insufficient permissions.' 
            });
        }

        next();
    };
};

module.exports = { auth, requireRole };