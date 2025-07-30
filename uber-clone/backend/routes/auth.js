const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
};

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { 
            email, 
            password, 
            firstName, 
            lastName, 
            phone, 
            userType = 'rider' 
        } = req.body;

        // Validation
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if user already exists
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert user
        const [result] = await pool.execute(
            'INSERT INTO users (email, password_hash, first_name, last_name, phone, user_type) VALUES (?, ?, ?, ?, ?, ?)',
            [email.toLowerCase(), hashedPassword, firstName, lastName, phone, userType]
        );

        const userId = result.insertId;

        // Generate token
        const token = generateToken(userId);

        // Get user data
        const [users] = await pool.execute(
            'SELECT id, email, first_name, last_name, phone, user_type, created_at FROM users WHERE id = ?',
            [userId]
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: users[0],
                token
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Find user
        const [users] = await pool.execute(
            'SELECT id, email, password_hash, first_name, last_name, phone, user_type, is_active FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate token
        const token = generateToken(user.id);

        // Remove password from response
        delete user.password_hash;

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user,
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, email, first_name, last_name, phone, profile_image, user_type, email_verified, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // If user is a driver, get driver details
        let driverDetails = null;
        if (req.user.user_type === 'driver' || req.user.user_type === 'both') {
            const [drivers] = await pool.execute(
                'SELECT * FROM drivers WHERE user_id = ?',
                [req.user.id]
            );
            driverDetails = drivers[0] || null;
        }

        res.json({
            success: true,
            data: {
                user: users[0],
                driverDetails
            }
        });

    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching profile'
        });
    }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { firstName, lastName, phone, profileImage } = req.body;
        
        const updateFields = [];
        const updateValues = [];

        if (firstName) {
            updateFields.push('first_name = ?');
            updateValues.push(firstName);
        }
        if (lastName) {
            updateFields.push('last_name = ?');
            updateValues.push(lastName);
        }
        if (phone) {
            updateFields.push('phone = ?');
            updateValues.push(phone);
        }
        if (profileImage) {
            updateFields.push('profile_image = ?');
            updateValues.push(profileImage);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updateValues.push(req.user.id);

        await pool.execute(
            `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            updateValues
        );

        // Get updated user data
        const [users] = await pool.execute(
            'SELECT id, email, first_name, last_name, phone, profile_image, user_type, email_verified, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: users[0]
            }
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating profile'
        });
    }
});

// Change password
router.put('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide current and new password'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        // Get current password hash
        const [users] = await pool.execute(
            'SELECT password_hash FROM users WHERE id = ?',
            [req.user.id]
        );

        const user = users[0];

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const saltRounds = 12;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await pool.execute(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedNewPassword, req.user.id]
        );

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error changing password'
        });
    }
});

module.exports = router;