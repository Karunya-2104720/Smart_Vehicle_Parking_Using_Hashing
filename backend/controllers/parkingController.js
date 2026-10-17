/**
 * Parking Controller
 * Handles HTTP requests, parameter validation, and formatting API responses.
 */

const parkingService = require('../services/parkingService');
const VALID_METHODS = ['basic', 'linear', 'quadratic', 'double'];

class ParkingController {
    /**
     * POST /api/parking/park
     */
    static park(req, res) {
        try {
            const { registrationNumber, method = 'linear', color = '#3b82f6' } = req.body;

            if (!registrationNumber || typeof registrationNumber !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'registrationNumber is required and must be a string (e.g. "TN 09 AB 1021").'
                });
            }

            if (typeof method !== 'string' || !VALID_METHODS.includes(method.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid hashing method: "${method}". Supported methods: ${VALID_METHODS.join(', ')}.`
                });
            }

            const result = parkingService.parkCar(registrationNumber, method.toLowerCase(), color);

            if (!result.success) {
                return res.status(result.statusCode || 409).json(result);
            }

            return res.status(201).json(result);
        } catch (err) {
            console.error('[ParkingController.park] Error:', err);
            return res.status(500).json({
                success: false,
                error: 'Internal server error during parking operation.'
            });
        }
    }

    /**
     * GET /api/parking/search/:registrationNumber
     */
    static search(req, res) {
        try {
            const { registrationNumber } = req.params;
            const { method = 'linear' } = req.query;

            if (!registrationNumber) {
                return res.status(400).json({
                    success: false,
                    error: 'registrationNumber is required in the URL parameters.'
                });
            }

            const result = parkingService.searchCar(registrationNumber, method);

            if (!result.found) {
                return res.status(result.statusCode || 404).json(result);
            }

            return res.status(200).json(result);
        } catch (err) {
            console.error('[ParkingController.search] Error:', err);
            return res.status(500).json({
                success: false,
                error: 'Internal server error during search operation.'
            });
        }
    }

    /**
     * DELETE /api/parking/delete/:registrationNumber
     */
    static delete(req, res) {
        try {
            const { registrationNumber } = req.params;
            const { method = 'linear' } = req.query;

            if (!registrationNumber) {
                return res.status(400).json({
                    success: false,
                    error: 'registrationNumber is required in the URL parameters.'
                });
            }

            const result = parkingService.deleteCar(registrationNumber, method);

            if (!result.success) {
                return res.status(result.statusCode || 404).json(result);
            }

            return res.status(200).json(result);
        } catch (err) {
            console.error('[ParkingController.delete] Error:', err);
            return res.status(500).json({
                success: false,
                error: 'Internal server error during delete operation.'
            });
        }
    }

    /**
     * GET /api/parking
     */
    static getStatus(req, res) {
        try {
            const status = parkingService.getParkingStatus();
            return res.status(200).json(status);
        } catch (err) {
            console.error('[ParkingController.getStatus] Error:', err);
            return res.status(500).json({
                success: false,
                error: 'Internal server error fetching parking status.'
            });
        }
    }

    /**
     * GET /api/parking/statistics
     */
    static getStatistics(req, res) {
        try {
            const stats = parkingService.getStatistics();
            return res.status(200).json(stats);
        } catch (err) {
            console.error('[ParkingController.getStatistics] Error:', err);
            return res.status(500).json({
                success: false,
                error: 'Internal server error fetching parking statistics.'
            });
        }
    }

    /**
     * POST /api/parking/reset
     */
    static reset(req, res) {
        try {
            const result = parkingService.resetParking();
            return res.status(200).json(result);
        } catch (err) {
            console.error('[ParkingController.reset] Error:', err);
            return res.status(500).json({
                success: false,
                error: 'Internal server error resetting parking lot.'
            });
        }
    }

    /**
     * POST /api/parking/simulate
     */
    static simulate(req, res) {
        try {
            const { registrationNumbers, method = 'linear' } = req.body;

            if (!Array.isArray(registrationNumbers) || registrationNumbers.length === 0 ||
                registrationNumbers.some(registrationNumber => typeof registrationNumber !== 'string')) {
                return res.status(400).json({
                    success: false,
                    error: 'registrationNumbers must be a non-empty array of strings.'
                });
            }

            if (typeof method !== 'string' || !VALID_METHODS.includes(method.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid hashing method: "${method}". Supported methods: ${VALID_METHODS.join(', ')}.`
                });
            }

            const result = parkingService.simulate(registrationNumbers, method.toLowerCase());
            return res.status(200).json(result);
        } catch (err) {
            console.error('[ParkingController.simulate] Error:', err);
            return res.status(500).json({
                success: false,
                error: 'Internal server error during simulation.'
            });
        }
    }

    /**
     * POST /api/parking/compare
     */
    static compare(req, res) {
        try {
            const { registrationNumbers } = req.body;

            if (!Array.isArray(registrationNumbers) || registrationNumbers.length === 0 ||
                registrationNumbers.some(registrationNumber => typeof registrationNumber !== 'string')) {
                return res.status(400).json({
                    success: false,
                    error: 'registrationNumbers must be a non-empty array of strings.'
                });
            }

            const result = parkingService.compare(registrationNumbers);
            return res.status(200).json(result);
        } catch (err) {
            console.error('[ParkingController.compare] Error:', err);
            return res.status(500).json({
                success: false,
                error: 'Internal server error during algorithm comparison.'
            });
        }
    }

    /**
     * GET /api/algorithms/:method
     */
    static getAlgorithmExplanation(req, res) {
        try {
            const { method } = req.params;
            const info = parkingService.getAlgorithmInfo(method);

            if (!info) {
                return res.status(404).json({
                    success: false,
                    error: `Algorithm "${method}" not found. Supported: basic, linear, quadratic, double.`
                });
            }

            return res.status(200).json(info);
        } catch (err) {
            console.error('[ParkingController.getAlgorithmExplanation] Error:', err);
            return res.status(500).json({
                success: false,
                error: 'Internal server error fetching algorithm details.'
            });
        }
    }
}

module.exports = ParkingController;
