/**
 * Parking API Routes
 */

const express = require('express');
const router = express.Router();
const ParkingController = require('../controllers/parkingController');

// 1. Core Parking Operations
router.post('/park', ParkingController.park);
router.get('/search/:registrationNumber', ParkingController.search);
router.delete('/delete/:registrationNumber', ParkingController.delete);

// 2. Parking Lot State & Statistics
router.get('/', ParkingController.getStatus);
router.get('/statistics', ParkingController.getStatistics);
router.post('/reset', ParkingController.reset);

// 3. Collision Lab & Multi-Method Comparison
router.post('/simulate', ParkingController.simulate);
router.post('/compare', ParkingController.compare);

module.exports = router;
