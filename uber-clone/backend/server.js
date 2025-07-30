const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const { testConnection } = require('./config/database');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Make io accessible to routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users').router);
app.use('/api/rides', require('./routes/rides'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/payments', require('./routes/payments'));

// Health check route
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Uber Clone API is running!',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'API endpoint not found' 
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join user to their room for personal notifications
    socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined their room`);
    });

    // Driver location updates
    socket.on('driver_location', (data) => {
        socket.broadcast.emit('driver_location_update', data);
    });

    // Ride status updates
    socket.on('ride_status', (data) => {
        io.to(`user_${data.riderId}`).emit('ride_status_update', data);
        if (data.driverId) {
            io.to(`user_${data.driverId}`).emit('ride_status_update', data);
        }
    });

    // Real-time notifications
    socket.on('notification', (data) => {
        io.to(`user_${data.userId}`).emit('notification', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // Test database connection
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.error('Failed to connect to database. Server not started.');
            process.exit(1);
        }

        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
            console.log(`🔗 API available at: http://localhost:${PORT}/api`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = app;