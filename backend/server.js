/**
 * Smart Parking Slot Management System - Express Backend Server
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const os = require('os');
const path = require('path');
const parkingRoutes = require('./routes/parkingRoutes');
const ParkingController = require('./controllers/parkingController');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FRONTEND_ROOT = path.resolve(__dirname, '..');

function isAllowedFrontendOrigin(origin) {
    if (!origin || origin === FRONTEND_URL || origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000') {
        return true;
    }

    let parsedOrigin;
    try {
        parsedOrigin = new URL(origin);
    } catch {
        return false;
    }

    if (parsedOrigin.protocol !== 'http:' || parsedOrigin.port !== '3000') {
        return false;
    }

    for (const networkInterfaces of Object.values(os.networkInterfaces())) {
        for (const networkInterface of networkInterfaces || []) {
            if (networkInterface.family === 'IPv4' && !networkInterface.internal &&
                networkInterface.address === parsedOrigin.hostname) {
                return true;
            }
        }
    }

    return false;
}

// Middleware
app.use(cors({
    origin: (origin, callback) => callback(null, isAllowedFrontendOrigin(origin)),
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Request logging in development
if (process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
        next();
    });
}

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        service: 'Smart Parking Hashing Backend',
        tableSize: parseInt(process.env.TABLE_SIZE, 10) || 47,
        secondaryPrime: parseInt(process.env.SECONDARY_PRIME, 10) || 43,
        timestamp: new Date().toISOString()
    });
});

// Mount Routes
app.use('/api/parking', parkingRoutes);
app.get('/api/algorithms/:method', ParkingController.getAlgorithmExplanation);

// Serve the frontend from this service in production so the site and API share one origin.
app.get('/', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
});
app.use('/css', express.static(path.join(FRONTEND_ROOT, 'css')));
app.use('/js', express.static(path.join(FRONTEND_ROOT, 'js')));

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: `Endpoint not found: ${req.method} ${req.originalUrl}`
    });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
    console.error('[Unhandled Server Error]:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error occurred.'
    });
});

// Start Server if not imported by test runner
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, HOST, () => {
        console.log(`\n========================================================`);
        console.log(`🅿️  Smart Parking Backend running at http://localhost:${PORT}`);
        console.log(`📦 Table Size: ${process.env.TABLE_SIZE || 47} Slots (Prime Modulus)`);
        console.log(`🌐 Allowed Origin: ${FRONTEND_URL}`);
        console.log(`========================================================\n`);
    });
}

module.exports = app;
