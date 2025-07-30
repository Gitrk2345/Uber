const express = require('express');
const { pool } = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Calculate fare based on distance and ride type
const calculateFare = (distanceKm, rideType) => {
    const baseFares = {
        economy: 2.50,
        comfort: 3.50,
        premium: 4.50,
        suv: 5.00
    };
    
    const perKmRates = {
        economy: 1.20,
        comfort: 1.80,
        premium: 2.50,
        suv: 2.80
    };

    const baseFare = baseFares[rideType] || baseFares.economy;
    const perKmRate = perKmRates[rideType] || perKmRates.economy;
    
    return Math.round((baseFare + (distanceKm * perKmRate)) * 100) / 100;
};

// Calculate distance between two coordinates (simplified)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

// Request a ride
router.post('/request', auth, requireRole(['rider']), async (req, res) => {
    try {
        const {
            pickupAddress,
            pickupLat,
            pickupLng,
            destinationAddress,
            destinationLat,
            destinationLng,
            rideType = 'economy'
        } = req.body;

        // Validation
        if (!pickupAddress || !pickupLat || !pickupLng || !destinationAddress || !destinationLat || !destinationLng) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required location details'
            });
        }

        // Calculate distance and fare
        const distance = calculateDistance(pickupLat, pickupLng, destinationLat, destinationLng);
        const fare = calculateFare(distance, rideType);

        // Create ride request
        const [result] = await pool.execute(
            `INSERT INTO rides (rider_id, pickup_address, pickup_lat, pickup_lng, 
             destination_address, destination_lat, destination_lng, ride_type, 
             fare_amount, distance_km, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested')`,
            [req.user.id, pickupAddress, pickupLat, pickupLng, 
             destinationAddress, destinationLat, destinationLng, rideType, fare, distance]
        );

        const rideId = result.insertId;

        // Get the created ride
        const [rides] = await pool.execute(
            `SELECT r.*, u.first_name, u.last_name, u.phone as rider_phone 
             FROM rides r 
             JOIN users u ON r.rider_id = u.id 
             WHERE r.id = ?`,
            [rideId]
        );

        const ride = rides[0];

        // Notify available drivers in the area via Socket.IO
        req.io.emit('new_ride_request', {
            rideId: ride.id,
            pickupLat: ride.pickup_lat,
            pickupLng: ride.pickup_lng,
            rideType: ride.ride_type,
            fare: ride.fare_amount,
            distance: ride.distance_km,
            riderName: `${ride.first_name} ${ride.last_name}`
        });

        res.status(201).json({
            success: true,
            message: 'Ride requested successfully',
            data: { ride }
        });

    } catch (error) {
        console.error('Ride request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error requesting ride'
        });
    }
});

// Accept a ride (driver)
router.post('/:rideId/accept', auth, requireRole(['driver']), async (req, res) => {
    try {
        const { rideId } = req.params;

        // Check if ride exists and is available
        const [rides] = await pool.execute(
            'SELECT * FROM rides WHERE id = ? AND status = "requested"',
            [rideId]
        );

        if (rides.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found or already accepted'
            });
        }

        // Check if driver is available
        const [drivers] = await pool.execute(
            'SELECT * FROM drivers WHERE user_id = ? AND is_available = TRUE',
            [req.user.id]
        );

        if (drivers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Driver not available'
            });
        }

        // Accept the ride
        await pool.execute(
            'UPDATE rides SET driver_id = ?, status = "accepted", accepted_at = CURRENT_TIMESTAMP WHERE id = ?',
            [req.user.id, rideId]
        );

        // Update driver availability
        await pool.execute(
            'UPDATE drivers SET is_available = FALSE WHERE user_id = ?',
            [req.user.id]
        );

        // Get updated ride with driver and rider details
        const [updatedRides] = await pool.execute(
            `SELECT r.*, 
             u1.first_name as rider_first_name, u1.last_name as rider_last_name, u1.phone as rider_phone,
             u2.first_name as driver_first_name, u2.last_name as driver_last_name, u2.phone as driver_phone,
             d.vehicle_make, d.vehicle_model, d.vehicle_color, d.license_plate, d.rating as driver_rating
             FROM rides r 
             JOIN users u1 ON r.rider_id = u1.id 
             JOIN users u2 ON r.driver_id = u2.id
             JOIN drivers d ON r.driver_id = d.user_id
             WHERE r.id = ?`,
            [rideId]
        );

        const ride = updatedRides[0];

        // Notify rider via Socket.IO
        req.io.to(`user_${ride.rider_id}`).emit('ride_accepted', {
            rideId: ride.id,
            driver: {
                name: `${ride.driver_first_name} ${ride.driver_last_name}`,
                phone: ride.driver_phone,
                vehicle: `${ride.vehicle_color} ${ride.vehicle_make} ${ride.vehicle_model}`,
                licensePlate: ride.license_plate,
                rating: ride.driver_rating
            }
        });

        res.json({
            success: true,
            message: 'Ride accepted successfully',
            data: { ride }
        });

    } catch (error) {
        console.error('Ride accept error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error accepting ride'
        });
    }
});

// Start ride (driver)
router.post('/:rideId/start', auth, requireRole(['driver']), async (req, res) => {
    try {
        const { rideId } = req.params;

        // Verify ride belongs to driver and is accepted
        const [rides] = await pool.execute(
            'SELECT * FROM rides WHERE id = ? AND driver_id = ? AND status = "accepted"',
            [rideId, req.user.id]
        );

        if (rides.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found or cannot be started'
            });
        }

        // Start the ride
        await pool.execute(
            'UPDATE rides SET status = "in_progress", started_at = CURRENT_TIMESTAMP WHERE id = ?',
            [rideId]
        );

        // Notify rider
        req.io.to(`user_${rides[0].rider_id}`).emit('ride_started', {
            rideId: rideId,
            message: 'Your ride has started'
        });

        res.json({
            success: true,
            message: 'Ride started successfully'
        });

    } catch (error) {
        console.error('Ride start error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error starting ride'
        });
    }
});

// Complete ride (driver)
router.post('/:rideId/complete', auth, requireRole(['driver']), async (req, res) => {
    try {
        const { rideId } = req.params;

        // Verify ride belongs to driver and is in progress
        const [rides] = await pool.execute(
            'SELECT * FROM rides WHERE id = ? AND driver_id = ? AND status = "in_progress"',
            [rideId, req.user.id]
        );

        if (rides.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found or cannot be completed'
            });
        }

        const ride = rides[0];

        // Complete the ride
        await pool.execute(
            'UPDATE rides SET status = "completed", completed_at = CURRENT_TIMESTAMP WHERE id = ?',
            [rideId]
        );

        // Update driver availability
        await pool.execute(
            'UPDATE drivers SET is_available = TRUE, total_rides = total_rides + 1 WHERE user_id = ?',
            [req.user.id]
        );

        // Create payment record
        await pool.execute(
            'INSERT INTO payments (ride_id, amount, payment_method) VALUES (?, ?, "card")',
            [rideId, ride.fare_amount]
        );

        // Notify rider
        req.io.to(`user_${ride.rider_id}`).emit('ride_completed', {
            rideId: rideId,
            fare: ride.fare_amount,
            message: 'Your ride has been completed'
        });

        res.json({
            success: true,
            message: 'Ride completed successfully',
            data: {
                rideId: rideId,
                fare: ride.fare_amount
            }
        });

    } catch (error) {
        console.error('Ride complete error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error completing ride'
        });
    }
});

// Cancel ride
router.post('/:rideId/cancel', auth, async (req, res) => {
    try {
        const { rideId } = req.params;
        const { reason } = req.body;

        // Get ride details
        const [rides] = await pool.execute(
            'SELECT * FROM rides WHERE id = ? AND status IN ("requested", "accepted")',
            [rideId]
        );

        if (rides.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found or cannot be cancelled'
            });
        }

        const ride = rides[0];

        // Check permissions
        if (ride.rider_id !== req.user.id && ride.driver_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to cancel this ride'
            });
        }

        // Cancel the ride
        await pool.execute(
            'UPDATE rides SET status = "cancelled" WHERE id = ?',
            [rideId]
        );

        // If driver was assigned, make them available again
        if (ride.driver_id) {
            await pool.execute(
                'UPDATE drivers SET is_available = TRUE WHERE user_id = ?',
                [ride.driver_id]
            );

            // Notify the other party
            const notifyUserId = req.user.id === ride.rider_id ? ride.driver_id : ride.rider_id;
            req.io.to(`user_${notifyUserId}`).emit('ride_cancelled', {
                rideId: rideId,
                reason: reason || 'No reason provided',
                cancelledBy: req.user.id === ride.rider_id ? 'rider' : 'driver'
            });
        }

        res.json({
            success: true,
            message: 'Ride cancelled successfully'
        });

    } catch (error) {
        console.error('Ride cancel error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error cancelling ride'
        });
    }
});

// Get user's rides
router.get('/my-rides', auth, async (req, res) => {
    try {
        const { status, limit = 10, offset = 0 } = req.query;
        
        let query = `
            SELECT r.*, 
            u1.first_name as rider_first_name, u1.last_name as rider_last_name,
            u2.first_name as driver_first_name, u2.last_name as driver_last_name,
            d.vehicle_make, d.vehicle_model, d.vehicle_color, d.license_plate, d.rating as driver_rating
            FROM rides r 
            JOIN users u1 ON r.rider_id = u1.id 
            LEFT JOIN users u2 ON r.driver_id = u2.id
            LEFT JOIN drivers d ON r.driver_id = d.user_id
            WHERE (r.rider_id = ? OR r.driver_id = ?)
        `;
        
        const params = [req.user.id, req.user.id];

        if (status) {
            query += ' AND r.status = ?';
            params.push(status);
        }

        query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rides] = await pool.execute(query, params);

        res.json({
            success: true,
            data: { rides }
        });

    } catch (error) {
        console.error('Get rides error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching rides'
        });
    }
});

// Get ride details
router.get('/:rideId', auth, async (req, res) => {
    try {
        const { rideId } = req.params;

        const [rides] = await pool.execute(
            `SELECT r.*, 
             u1.first_name as rider_first_name, u1.last_name as rider_last_name, u1.phone as rider_phone,
             u2.first_name as driver_first_name, u2.last_name as driver_last_name, u2.phone as driver_phone,
             d.vehicle_make, d.vehicle_model, d.vehicle_color, d.license_plate, d.rating as driver_rating
             FROM rides r 
             JOIN users u1 ON r.rider_id = u1.id 
             LEFT JOIN users u2 ON r.driver_id = u2.id
             LEFT JOIN drivers d ON r.driver_id = d.user_id
             WHERE r.id = ? AND (r.rider_id = ? OR r.driver_id = ?)`,
            [rideId, req.user.id, req.user.id]
        );

        if (rides.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        res.json({
            success: true,
            data: { ride: rides[0] }
        });

    } catch (error) {
        console.error('Get ride error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching ride'
        });
    }
});

// Rate ride
router.post('/:rideId/rate', auth, async (req, res) => {
    try {
        const { rideId } = req.params;
        const { rating, review } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Get ride details
        const [rides] = await pool.execute(
            'SELECT * FROM rides WHERE id = ? AND status = "completed"',
            [rideId]
        );

        if (rides.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found or not completed'
            });
        }

        const ride = rides[0];

        // Check if user is part of this ride
        if (ride.rider_id !== req.user.id && ride.driver_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to rate this ride'
            });
        }

        // Determine who is being rated
        const ratedId = req.user.id === ride.rider_id ? ride.driver_id : ride.rider_id;

        // Check if already rated
        const [existingRatings] = await pool.execute(
            'SELECT id FROM ratings WHERE ride_id = ? AND rater_id = ?',
            [rideId, req.user.id]
        );

        if (existingRatings.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'You have already rated this ride'
            });
        }

        // Insert rating
        await pool.execute(
            'INSERT INTO ratings (ride_id, rater_id, rated_id, rating, review) VALUES (?, ?, ?, ?, ?)',
            [rideId, req.user.id, ratedId, rating, review]
        );

        // Update ride rating
        await pool.execute(
            'UPDATE rides SET rating = ? WHERE id = ?',
            [rating, rideId]
        );

        // Update driver average rating if driver was rated
        if (req.user.id === ride.rider_id && ride.driver_id) {
            const [avgRating] = await pool.execute(
                'SELECT AVG(rating) as avg_rating FROM ratings WHERE rated_id = ?',
                [ride.driver_id]
            );
            
            await pool.execute(
                'UPDATE drivers SET rating = ? WHERE user_id = ?',
                [Math.round(avgRating[0].avg_rating * 100) / 100, ride.driver_id]
            );
        }

        res.json({
            success: true,
            message: 'Ride rated successfully'
        });

    } catch (error) {
        console.error('Rate ride error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error rating ride'
        });
    }
});

module.exports = router;