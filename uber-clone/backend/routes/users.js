const express = require('express');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get user notifications
router.get('/notifications', auth, async (req, res) => {
    try {
        const { limit = 20, offset = 0, unreadOnly = false } = req.query;

        let query = 'SELECT * FROM notifications WHERE user_id = ?';
        const params = [req.user.id];

        if (unreadOnly === 'true') {
            query += ' AND is_read = FALSE';
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [notifications] = await pool.execute(query, params);

        // Get unread count
        const [unreadCount] = await pool.execute(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [req.user.id]
        );

        res.json({
            success: true,
            data: {
                notifications,
                unreadCount: unreadCount[0].count
            }
        });

    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching notifications'
        });
    }
});

// Mark notification as read
router.put('/notifications/:notificationId/read', auth, async (req, res) => {
    try {
        const { notificationId } = req.params;

        // Verify notification belongs to user
        const [notifications] = await pool.execute(
            'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
            [notificationId, req.user.id]
        );

        if (notifications.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        await pool.execute(
            'UPDATE notifications SET is_read = TRUE WHERE id = ?',
            [notificationId]
        );

        res.json({
            success: true,
            message: 'Notification marked as read'
        });

    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error marking notification as read'
        });
    }
});

// Mark all notifications as read
router.put('/notifications/read-all', auth, async (req, res) => {
    try {
        await pool.execute(
            'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [req.user.id]
        );

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });

    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error marking all notifications as read'
        });
    }
});

// Get user statistics
router.get('/stats', auth, async (req, res) => {
    try {
        // Rider stats
        const [riderStats] = await pool.execute(
            `SELECT 
                COUNT(*) as total_rides,
                SUM(fare_amount) as total_spent,
                AVG(fare_amount) as avg_fare
             FROM rides 
             WHERE rider_id = ? AND status = 'completed'`,
            [req.user.id]
        );

        // Driver stats (if applicable)
        let driverStats = null;
        if (req.user.user_type === 'driver' || req.user.user_type === 'both') {
            const [dStats] = await pool.execute(
                `SELECT 
                    COUNT(*) as total_drives,
                    SUM(fare_amount) as total_earned,
                    AVG(fare_amount) as avg_fare,
                    AVG(rating) as avg_rating
                 FROM rides 
                 WHERE driver_id = ? AND status = 'completed'`,
                [req.user.id]
            );
            driverStats = dStats[0];
        }

        res.json({
            success: true,
            data: {
                rider: riderStats[0],
                driver: driverStats
            }
        });

    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user statistics'
        });
    }
});

// Search users (for admin purposes - simplified)
router.get('/search', auth, async (req, res) => {
    try {
        const { query, type, limit = 10 } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        let sqlQuery = `
            SELECT id, email, first_name, last_name, phone, user_type, created_at
            FROM users 
            WHERE (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)
            AND is_active = TRUE
        `;
        
        const params = [`%${query}%`, `%${query}%`, `%${query}%`];

        if (type && ['rider', 'driver', 'both'].includes(type)) {
            sqlQuery += ' AND user_type = ?';
            params.push(type);
        }

        sqlQuery += ' ORDER BY first_name, last_name LIMIT ?';
        params.push(parseInt(limit));

        const [users] = await pool.execute(sqlQuery, params);

        res.json({
            success: true,
            data: { users }
        });

    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error searching users'
        });
    }
});

// Get user ratings
router.get('/ratings', auth, async (req, res) => {
    try {
        const { as = 'both', limit = 10, offset = 0 } = req.query;

        let ratings = [];

        if (as === 'rider' || as === 'both') {
            // Ratings given by user as a rider (rating drivers)
            const [riderRatings] = await pool.execute(
                `SELECT r.*, rt.rating, rt.review, rt.created_at as rating_date,
                 u.first_name as driver_name, d.vehicle_make, d.vehicle_model
                 FROM ratings rt
                 JOIN rides r ON rt.ride_id = r.id
                 JOIN users u ON rt.rated_id = u.id
                 LEFT JOIN drivers d ON rt.rated_id = d.user_id
                 WHERE rt.rater_id = ? AND r.rider_id = ?
                 ORDER BY rt.created_at DESC LIMIT ? OFFSET ?`,
                [req.user.id, req.user.id, parseInt(limit), parseInt(offset)]
            );
            ratings = [...ratings, ...riderRatings.map(r => ({ ...r, type: 'given_as_rider' }))];
        }

        if (as === 'driver' || as === 'both') {
            // Ratings received by user as a driver
            const [driverRatings] = await pool.execute(
                `SELECT r.*, rt.rating, rt.review, rt.created_at as rating_date,
                 u.first_name as rider_name
                 FROM ratings rt
                 JOIN rides r ON rt.ride_id = r.id
                 JOIN users u ON rt.rater_id = u.id
                 WHERE rt.rated_id = ? AND r.driver_id = ?
                 ORDER BY rt.created_at DESC LIMIT ? OFFSET ?`,
                [req.user.id, req.user.id, parseInt(limit), parseInt(offset)]
            );
            ratings = [...ratings, ...driverRatings.map(r => ({ ...r, type: 'received_as_driver' }))];
        }

        // Sort by date
        ratings.sort((a, b) => new Date(b.rating_date) - new Date(a.rating_date));

        res.json({
            success: true,
            data: { ratings }
        });

    } catch (error) {
        console.error('Get user ratings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user ratings'
        });
    }
});

// Create notification (internal use)
const createNotification = async (userId, title, message, type = 'general', relatedRideId = null) => {
    try {
        await pool.execute(
            'INSERT INTO notifications (user_id, title, message, type, related_ride_id) VALUES (?, ?, ?, ?, ?)',
            [userId, title, message, type, relatedRideId]
        );
    } catch (error) {
        console.error('Create notification error:', error);
    }
};

// Get user summary
router.get('/summary', auth, async (req, res) => {
    try {
        // Get user basic info
        const [users] = await pool.execute(
            'SELECT id, email, first_name, last_name, phone, user_type, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        const user = users[0];

        // Get active rides
        const [activeRides] = await pool.execute(
            'SELECT * FROM rides WHERE (rider_id = ? OR driver_id = ?) AND status IN ("requested", "accepted", "in_progress") ORDER BY created_at DESC',
            [req.user.id, req.user.id]
        );

        // Get recent completed rides
        const [recentRides] = await pool.execute(
            'SELECT * FROM rides WHERE (rider_id = ? OR driver_id = ?) AND status = "completed" ORDER BY completed_at DESC LIMIT 5',
            [req.user.id, req.user.id]
        );

        // Get unread notifications count
        const [unreadCount] = await pool.execute(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [req.user.id]
        );

        // Driver-specific info
        let driverInfo = null;
        if (user.user_type === 'driver' || user.user_type === 'both') {
            const [driverDetails] = await pool.execute(
                'SELECT * FROM drivers WHERE user_id = ?',
                [req.user.id]
            );
            driverInfo = driverDetails[0] || null;
        }

        res.json({
            success: true,
            data: {
                user,
                activeRides,
                recentRides,
                unreadNotifications: unreadCount[0].count,
                driverInfo
            }
        });

    } catch (error) {
        console.error('Get user summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user summary'
        });
    }
});

module.exports = { router, createNotification };