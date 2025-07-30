const express = require('express');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Process payment for a ride
router.post('/process', auth, async (req, res) => {
    try {
        const { rideId, paymentMethod = 'card', promoCode } = req.body;

        if (!rideId) {
            return res.status(400).json({
                success: false,
                message: 'Ride ID is required'
            });
        }

        // Get ride details
        const [rides] = await pool.execute(
            'SELECT * FROM rides WHERE id = ? AND rider_id = ? AND status = "completed"',
            [rideId, req.user.id]
        );

        if (rides.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found or not completed'
            });
        }

        const ride = rides[0];

        // Check if payment already exists
        const [existingPayments] = await pool.execute(
            'SELECT * FROM payments WHERE ride_id = ?',
            [rideId]
        );

        if (existingPayments.length > 0 && existingPayments[0].payment_status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Payment already processed for this ride'
            });
        }

        let finalAmount = ride.fare_amount;
        let discountApplied = 0;
        let promoCodeUsed = null;

        // Apply promo code if provided
        if (promoCode) {
            const [promoCodes] = await pool.execute(
                `SELECT * FROM promo_codes 
                 WHERE code = ? AND is_active = TRUE 
                 AND valid_from <= NOW() AND valid_until >= NOW()
                 AND used_count < usage_limit`,
                [promoCode]
            );

            if (promoCodes.length > 0) {
                const promo = promoCodes[0];

                // Check if user has already used this promo
                const [userPromoUsage] = await pool.execute(
                    'SELECT id FROM user_promo_usage WHERE user_id = ? AND promo_code_id = ?',
                    [req.user.id, promo.id]
                );

                if (userPromoUsage.length === 0 && ride.fare_amount >= promo.min_ride_amount) {
                    // Calculate discount
                    if (promo.discount_type === 'percentage') {
                        discountApplied = Math.min(
                            (ride.fare_amount * promo.discount_value) / 100,
                            promo.max_discount || ride.fare_amount
                        );
                    } else {
                        discountApplied = Math.min(promo.discount_value, ride.fare_amount);
                    }

                    finalAmount = Math.max(0, ride.fare_amount - discountApplied);
                    promoCodeUsed = promo;

                    // Record promo usage
                    await pool.execute(
                        'INSERT INTO user_promo_usage (user_id, promo_code_id, ride_id, discount_applied) VALUES (?, ?, ?, ?)',
                        [req.user.id, promo.id, rideId, discountApplied]
                    );

                    // Update promo code usage count
                    await pool.execute(
                        'UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?',
                        [promo.id]
                    );
                }
            }
        }

        // Simulate payment processing (in real app, integrate with payment gateway)
        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Update or insert payment record
        if (existingPayments.length > 0) {
            await pool.execute(
                `UPDATE payments SET 
                 amount = ?, payment_method = ?, payment_status = 'completed', 
                 transaction_id = ?, processed_at = CURRENT_TIMESTAMP 
                 WHERE ride_id = ?`,
                [finalAmount, paymentMethod, transactionId, rideId]
            );
        } else {
            await pool.execute(
                `INSERT INTO payments (ride_id, amount, payment_method, payment_status, transaction_id, processed_at) 
                 VALUES (?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP)`,
                [rideId, finalAmount, paymentMethod, transactionId]
            );
        }

        // Update ride payment status
        await pool.execute(
            'UPDATE rides SET payment_status = "completed" WHERE id = ?',
            [rideId]
        );

        res.json({
            success: true,
            message: 'Payment processed successfully',
            data: {
                transactionId,
                originalAmount: ride.fare_amount,
                discountApplied,
                finalAmount,
                paymentMethod,
                promoCodeUsed: promoCodeUsed ? promoCodeUsed.code : null
            }
        });

    } catch (error) {
        console.error('Payment processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error processing payment'
        });
    }
});

// Get payment history
router.get('/history', auth, async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;

        const [payments] = await pool.execute(
            `SELECT p.*, r.pickup_address, r.destination_address, r.completed_at,
             CASE 
                WHEN r.rider_id = ? THEN 'paid'
                WHEN r.driver_id = ? THEN 'received'
             END as payment_type
             FROM payments p
             JOIN rides r ON p.ride_id = r.id
             WHERE (r.rider_id = ? OR r.driver_id = ?)
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [req.user.id, req.user.id, req.user.id, req.user.id, parseInt(limit), parseInt(offset)]
        );

        res.json({
            success: true,
            data: { payments }
        });

    } catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching payment history'
        });
    }
});

// Get payment details
router.get('/:paymentId', auth, async (req, res) => {
    try {
        const { paymentId } = req.params;

        const [payments] = await pool.execute(
            `SELECT p.*, r.*, 
             u1.first_name as rider_first_name, u1.last_name as rider_last_name,
             u2.first_name as driver_first_name, u2.last_name as driver_last_name
             FROM payments p
             JOIN rides r ON p.ride_id = r.id
             JOIN users u1 ON r.rider_id = u1.id
             LEFT JOIN users u2 ON r.driver_id = u2.id
             WHERE p.id = ? AND (r.rider_id = ? OR r.driver_id = ?)`,
            [paymentId, req.user.id, req.user.id]
        );

        if (payments.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        const payment = payments[0];

        // Get promo code usage if any
        const [promoUsage] = await pool.execute(
            `SELECT up.*, pc.code, pc.description, pc.discount_type
             FROM user_promo_usage up
             JOIN promo_codes pc ON up.promo_code_id = pc.id
             WHERE up.ride_id = ?`,
            [payment.ride_id]
        );

        res.json({
            success: true,
            data: {
                payment,
                promoUsage: promoUsage[0] || null
            }
        });

    } catch (error) {
        console.error('Get payment details error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching payment details'
        });
    }
});

// Get available promo codes
router.get('/promo-codes/available', auth, async (req, res) => {
    try {
        const [promoCodes] = await pool.execute(
            `SELECT pc.*, 
             CASE WHEN up.id IS NOT NULL THEN TRUE ELSE FALSE END as used_by_user
             FROM promo_codes pc
             LEFT JOIN user_promo_usage up ON pc.id = up.promo_code_id AND up.user_id = ?
             WHERE pc.is_active = TRUE 
             AND pc.valid_from <= NOW() 
             AND pc.valid_until >= NOW()
             AND pc.used_count < pc.usage_limit
             ORDER BY pc.discount_value DESC`,
            [req.user.id]
        );

        res.json({
            success: true,
            data: { promoCodes }
        });

    } catch (error) {
        console.error('Get promo codes error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching promo codes'
        });
    }
});

// Validate promo code
router.post('/promo-codes/validate', auth, async (req, res) => {
    try {
        const { code, rideAmount } = req.body;

        if (!code || !rideAmount) {
            return res.status(400).json({
                success: false,
                message: 'Promo code and ride amount are required'
            });
        }

        const [promoCodes] = await pool.execute(
            `SELECT * FROM promo_codes 
             WHERE code = ? AND is_active = TRUE 
             AND valid_from <= NOW() AND valid_until >= NOW()
             AND used_count < usage_limit`,
            [code]
        );

        if (promoCodes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired promo code'
            });
        }

        const promo = promoCodes[0];

        // Check if user has already used this promo
        const [userPromoUsage] = await pool.execute(
            'SELECT id FROM user_promo_usage WHERE user_id = ? AND promo_code_id = ?',
            [req.user.id, promo.id]
        );

        if (userPromoUsage.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'You have already used this promo code'
            });
        }

        // Check minimum ride amount
        if (rideAmount < promo.min_ride_amount) {
            return res.status(400).json({
                success: false,
                message: `Minimum ride amount is $${promo.min_ride_amount} to use this promo code`
            });
        }

        // Calculate discount
        let discountAmount;
        if (promo.discount_type === 'percentage') {
            discountAmount = Math.min(
                (rideAmount * promo.discount_value) / 100,
                promo.max_discount || rideAmount
            );
        } else {
            discountAmount = Math.min(promo.discount_value, rideAmount);
        }

        const finalAmount = Math.max(0, rideAmount - discountAmount);

        res.json({
            success: true,
            message: 'Promo code is valid',
            data: {
                promoCode: promo,
                originalAmount: rideAmount,
                discountAmount,
                finalAmount
            }
        });

    } catch (error) {
        console.error('Validate promo code error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error validating promo code'
        });
    }
});

// Get payment summary/stats
router.get('/stats/summary', auth, async (req, res) => {
    try {
        // Total spent as rider
        const [riderStats] = await pool.execute(
            `SELECT 
                COUNT(*) as total_rides,
                SUM(amount) as total_spent
             FROM payments p
             JOIN rides r ON p.ride_id = r.id
             WHERE r.rider_id = ? AND p.payment_status = 'completed'`,
            [req.user.id]
        );

        // Total earned as driver
        let driverStats = null;
        if (req.user.user_type === 'driver' || req.user.user_type === 'both') {
            const [dStats] = await pool.execute(
                `SELECT 
                    COUNT(*) as total_rides,
                    SUM(amount) as total_earned
                 FROM payments p
                 JOIN rides r ON p.ride_id = r.id
                 WHERE r.driver_id = ? AND p.payment_status = 'completed'`,
                [req.user.id]
            );
            driverStats = dStats[0];
        }

        // Monthly spending/earning
        const [monthlyRider] = await pool.execute(
            `SELECT SUM(amount) as monthly_spent
             FROM payments p
             JOIN rides r ON p.ride_id = r.id
             WHERE r.rider_id = ? 
             AND p.payment_status = 'completed'
             AND MONTH(p.processed_at) = MONTH(CURRENT_DATE())
             AND YEAR(p.processed_at) = YEAR(CURRENT_DATE())`,
            [req.user.id]
        );

        let monthlyDriver = null;
        if (req.user.user_type === 'driver' || req.user.user_type === 'both') {
            const [mDriver] = await pool.execute(
                `SELECT SUM(amount) as monthly_earned
                 FROM payments p
                 JOIN rides r ON p.ride_id = r.id
                 WHERE r.driver_id = ? 
                 AND p.payment_status = 'completed'
                 AND MONTH(p.processed_at) = MONTH(CURRENT_DATE())
                 AND YEAR(p.processed_at) = YEAR(CURRENT_DATE())`,
                [req.user.id]
            );
            monthlyDriver = mDriver[0];
        }

        res.json({
            success: true,
            data: {
                rider: {
                    ...riderStats[0],
                    monthlySpent: monthlyRider[0].monthly_spent || 0
                },
                driver: driverStats ? {
                    ...driverStats,
                    monthlyEarned: monthlyDriver ? monthlyDriver.monthly_earned || 0 : 0
                } : null
            }
        });

    } catch (error) {
        console.error('Get payment summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching payment summary'
        });
    }
});

module.exports = router;