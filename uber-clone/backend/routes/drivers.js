const express = require('express');
const { pool } = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Register as driver
router.post('/register', auth, async (req, res) => {
    try {
        const {
            licenseNumber,
            licenseExpiry,
            vehicleMake,
            vehicleModel,
            vehicleYear,
            vehicleColor,
            licensePlate,
            vehicleType = 'economy'
        } = req.body;

        // Validation
        if (!licenseNumber || !licenseExpiry || !vehicleMake || !vehicleModel || 
            !vehicleYear || !vehicleColor || !licensePlate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required driver and vehicle details'
            });
        }

        // Check if user is already a driver
        const [existingDrivers] = await pool.execute(
            'SELECT id FROM drivers WHERE user_id = ?',
            [req.user.id]
        );

        if (existingDrivers.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User is already registered as a driver'
            });
        }

        // Check license number uniqueness
        const [existingLicense] = await pool.execute(
            'SELECT id FROM drivers WHERE license_number = ?',
            [licenseNumber]
        );

        if (existingLicense.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'License number already registered'
            });
        }

        // Check license plate uniqueness
        const [existingPlate] = await pool.execute(
            'SELECT id FROM drivers WHERE license_plate = ?',
            [licensePlate]
        );

        if (existingPlate.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'License plate already registered'
            });
        }

        // Insert driver details
        await pool.execute(
            `INSERT INTO drivers (user_id, license_number, license_expiry, vehicle_make, 
             vehicle_model, vehicle_year, vehicle_color, license_plate, vehicle_type) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, licenseNumber, licenseExpiry, vehicleMake, vehicleModel, 
             vehicleYear, vehicleColor, licensePlate, vehicleType]
        );

        // Update user type
        await pool.execute(
            'UPDATE users SET user_type = CASE WHEN user_type = "rider" THEN "both" ELSE user_type END WHERE id = ?',
            [req.user.id]
        );

        res.status(201).json({
            success: true,
            message: 'Driver registration successful'
        });

    } catch (error) {
        console.error('Driver registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during driver registration'
        });
    }
});

// Update driver availability
router.put('/availability', auth, requireRole(['driver']), async (req, res) => {
    try {
        const { isAvailable, currentLat, currentLng } = req.body;

        if (typeof isAvailable !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Availability status is required'
            });
        }

        const updateFields = ['is_available = ?'];
        const updateValues = [isAvailable];

        if (isAvailable && (currentLat !== undefined && currentLng !== undefined)) {
            updateFields.push('current_lat = ?', 'current_lng = ?');
            updateValues.push(currentLat, currentLng);
        }

        updateValues.push(req.user.id);

        await pool.execute(
            `UPDATE drivers SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
            updateValues
        );

        res.json({
            success: true,
            message: `Driver is now ${isAvailable ? 'available' : 'unavailable'}`
        });

    } catch (error) {
        console.error('Update availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating availability'
        });
    }
});

// Update driver location
router.put('/location', auth, requireRole(['driver']), async (req, res) => {
    try {
        const { lat, lng } = req.body;

        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        await pool.execute(
            'UPDATE drivers SET current_lat = ?, current_lng = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
            [lat, lng, req.user.id]
        );

        // Broadcast location update via Socket.IO
        req.io.emit('driver_location_update', {
            driverId: req.user.id,
            lat,
            lng
        });

        res.json({
            success: true,
            message: 'Location updated successfully'
        });

    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating location'
        });
    }
});

// Get nearby drivers
router.get('/nearby', auth, async (req, res) => {
    try {
        const { lat, lng, radius = 10, rideType } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        let query = `
            SELECT d.*, u.first_name, u.last_name,
            (6371 * ACOS(COS(RADIANS(?)) * COS(RADIANS(d.current_lat)) *
            COS(RADIANS(d.current_lng) - RADIANS(?)) +
            SIN(RADIANS(?)) * SIN(RADIANS(d.current_lat)))) AS distance
            FROM drivers d
            JOIN users u ON d.user_id = u.id
            WHERE d.is_available = TRUE 
            AND d.current_lat IS NOT NULL 
            AND d.current_lng IS NOT NULL
        `;

        const queryParams = [lat, lng, lat];

        if (rideType) {
            query += ' AND d.vehicle_type = ?';
            queryParams.push(rideType);
        }

        query += ` 
            HAVING distance <= ?
            ORDER BY distance
            LIMIT 20
        `;
        queryParams.push(radius);

        const [drivers] = await pool.execute(query, queryParams);

        res.json({
            success: true,
            data: { drivers }
        });

    } catch (error) {
        console.error('Get nearby drivers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching nearby drivers'
        });
    }
});

// Get driver profile
router.get('/profile', auth, requireRole(['driver']), async (req, res) => {
    try {
        const [drivers] = await pool.execute(
            `SELECT d.*, u.first_name, u.last_name, u.email, u.phone
             FROM drivers d
             JOIN users u ON d.user_id = u.id
             WHERE d.user_id = ?`,
            [req.user.id]
        );

        if (drivers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Driver profile not found'
            });
        }

        const driver = drivers[0];

        // Get recent rides
        const [recentRides] = await pool.execute(
            `SELECT r.*, u.first_name as rider_name
             FROM rides r
             JOIN users u ON r.rider_id = u.id
             WHERE r.driver_id = ?
             ORDER BY r.created_at DESC
             LIMIT 5`,
            [req.user.id]
        );

        // Get earnings this month
        const [earnings] = await pool.execute(
            `SELECT 
                COUNT(*) as total_rides,
                SUM(fare_amount) as total_earnings,
                AVG(fare_amount) as avg_fare
             FROM rides 
             WHERE driver_id = ? 
             AND status = 'completed' 
             AND MONTH(completed_at) = MONTH(CURRENT_DATE())
             AND YEAR(completed_at) = YEAR(CURRENT_DATE())`,
            [req.user.id]
        );

        res.json({
            success: true,
            data: {
                driver,
                recentRides,
                monthlyStats: earnings[0]
            }
        });

    } catch (error) {
        console.error('Get driver profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching driver profile'
        });
    }
});

// Update driver profile
router.put('/profile', auth, requireRole(['driver']), async (req, res) => {
    try {
        const {
            vehicleMake,
            vehicleModel,
            vehicleYear,
            vehicleColor,
            licensePlate,
            vehicleType
        } = req.body;

        const updateFields = [];
        const updateValues = [];

        if (vehicleMake) {
            updateFields.push('vehicle_make = ?');
            updateValues.push(vehicleMake);
        }
        if (vehicleModel) {
            updateFields.push('vehicle_model = ?');
            updateValues.push(vehicleModel);
        }
        if (vehicleYear) {
            updateFields.push('vehicle_year = ?');
            updateValues.push(vehicleYear);
        }
        if (vehicleColor) {
            updateFields.push('vehicle_color = ?');
            updateValues.push(vehicleColor);
        }
        if (licensePlate) {
            updateFields.push('license_plate = ?');
            updateValues.push(licensePlate);
        }
        if (vehicleType) {
            updateFields.push('vehicle_type = ?');
            updateValues.push(vehicleType);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updateValues.push(req.user.id);

        await pool.execute(
            `UPDATE drivers SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
            updateValues
        );

        res.json({
            success: true,
            message: 'Driver profile updated successfully'
        });

    } catch (error) {
        console.error('Update driver profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating driver profile'
        });
    }
});

// Get driver statistics
router.get('/stats', auth, requireRole(['driver']), async (req, res) => {
    try {
        // Overall stats
        const [overallStats] = await pool.execute(
            `SELECT 
                COUNT(*) as total_rides,
                SUM(fare_amount) as total_earnings,
                AVG(fare_amount) as avg_fare,
                AVG(rating) as avg_rating
             FROM rides 
             WHERE driver_id = ? AND status = 'completed'`,
            [req.user.id]
        );

        // Weekly stats
        const [weeklyStats] = await pool.execute(
            `SELECT 
                COUNT(*) as weekly_rides,
                SUM(fare_amount) as weekly_earnings
             FROM rides 
             WHERE driver_id = ? 
             AND status = 'completed'
             AND completed_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)`,
            [req.user.id]
        );

        // Monthly stats
        const [monthlyStats] = await pool.execute(
            `SELECT 
                COUNT(*) as monthly_rides,
                SUM(fare_amount) as monthly_earnings
             FROM rides 
             WHERE driver_id = ? 
             AND status = 'completed'
             AND MONTH(completed_at) = MONTH(CURRENT_DATE())
             AND YEAR(completed_at) = YEAR(CURRENT_DATE())`,
            [req.user.id]
        );

        res.json({
            success: true,
            data: {
                overall: overallStats[0],
                weekly: weeklyStats[0],
                monthly: monthlyStats[0]
            }
        });

    } catch (error) {
        console.error('Get driver stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching driver statistics'
        });
    }
});

module.exports = router;