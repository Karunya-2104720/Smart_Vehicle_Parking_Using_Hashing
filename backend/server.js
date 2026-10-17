/**
 * Smart Parking Slot Management System - Express Backend Server
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const parkingRoutes = require('./routes/parkingRoutes');
const ParkingController = require('./controllers/parkingController');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const VISION_DIR = path.join(__dirname, 'vision');
const VISION_MODEL_PATH = process.env.VISION_MODEL_PATH ||
    path.join(VISION_DIR, 'models', 'license-plate-yolo11n.pt');
const VISION_SERVICE_URL = process.env.VISION_SERVICE_URL || 'http://127.0.0.1:8001';
const VISION_PORT = Number.parseInt(process.env.VISION_PORT, 10) || 8001;

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
        tableSize: parseInt(process.env.TABLE_SIZE, 10) || 70,
        secondaryPrime: parseInt(process.env.SECONDARY_PRIME, 10) || 67,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/vision/health', async (req, res) => {
    try {
        const visionResponse = await fetch(`${VISION_SERVICE_URL}/health`, {
            signal: AbortSignal.timeout(3000)
        });
        const visionHealth = await visionResponse.json();
        res.status(visionHealth.ready ? 200 : 503).json(visionHealth);
    } catch (error) {
        res.status(503).json({
            ready: false,
            error: 'YOLO inference service is not running. Start the backend after training the plate detector.',
            detail: error.message
        });
    }
});

app.post(
    '/api/vision/detect',
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' }),
    async (req, res) => {
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Send a captured image with an image/jpeg, image/png, or image/webp content type.'
            });
        }

        try {
            const visionResponse = await fetch(`${VISION_SERVICE_URL}/detect`, {
                method: 'POST',
                headers: { 'Content-Type': req.get('Content-Type') },
                body: req.body,
                signal: AbortSignal.timeout(30000)
            });
            const result = await visionResponse.json();
            return res.status(visionResponse.status).json(result);
        } catch (error) {
            console.error('[YOLO inference request failed]:', error);
            return res.status(503).json({
                success: false,
                error: 'YOLO inference service is unavailable. Ensure the trained model and Python vision service are installed.',
                detail: error.message
            });
        }
    }
);

// Mount Routes
app.use('/api/parking', parkingRoutes);
app.get('/api/algorithms/:method', ParkingController.getAlgorithmExplanation);

// Serve the frontend from this service in production so the site and API share one origin.
app.get('/', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
});
app.get('/learn.html', (req, res) => {
    res.sendFile(path.join(FRONTEND_ROOT, 'learn.html'));
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
    if (fs.existsSync(VISION_MODEL_PATH)) {
        const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python';
        const visionProcess = spawn(
            pythonExecutable,
            ['-m', 'uvicorn', 'detect_server:app', '--host', '127.0.0.1', '--port', String(VISION_PORT)],
            {
                cwd: VISION_DIR,
                env: {
                    ...process.env,
                    VISION_MODEL_PATH,
                    VISION_PORT: String(VISION_PORT)
                },
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true
            }
        );
        visionProcess.stdout.on('data', data => process.stdout.write(`[YOLO] ${data}`));
        visionProcess.stderr.on('data', data => process.stderr.write(`[YOLO] ${data}`));
        visionProcess.on('error', error => {
            console.error(`[YOLO] Could not start Python vision service using "${pythonExecutable}":`, error);
        });
        visionProcess.on('close', code => {
            if (code !== 0) console.error(`[YOLO] Vision service exited with code ${code}.`);
        });
        process.on('exit', () => {
            if (!visionProcess.killed) visionProcess.kill();
        });
    } else {
        console.warn(`[YOLO] Trained weights not found at ${VISION_MODEL_PATH}. Camera detection will be unavailable.`);
    }

    app.listen(PORT, HOST, () => {
        console.log(`\n========================================================`);
        console.log(`🅿️  Smart Parking Backend running at http://localhost:${PORT}`);
        console.log(`📦 Table Size: ${process.env.TABLE_SIZE || 70} Slots (7 decks × 10 slots)`);
        console.log(`🌐 Allowed Origin: ${FRONTEND_URL}`);
        console.log(`========================================================\n`);
    });
}

module.exports = app;
