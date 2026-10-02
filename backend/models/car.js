/**
 * Car Model & Registration Key Extraction
 */

class Car {
    constructor(registrationNumber, key, hashIndex, methodUsed = 'linear', color = '#3b82f6', probesNeeded = 1) {
        this.registrationNumber = registrationNumber.trim().toUpperCase();
        this.key = key;
        this.hashIndex = hashIndex;
        this.status = 'OCCUPIED';
        this.methodUsed = methodUsed;
        this.color = color;
        this.probesNeeded = probesNeeded;
        this.parkedAt = new Date().toISOString();
    }

    /**
     * Extracts numeric key from car registration string.
     * E.g.:
     *   "TN 09 AB 1021" -> 1021
     *   "TN09AB1021"    -> 1021
     *   "KA 01 MN 4567" -> 4567
     *   "MH 12 XY 9821" -> 9821
     *   "45"            -> 45
     * 
     * @param {string|number} registrationNumber 
     * @returns {number|null} Extracted positive integer or null if invalid
     */
    static extractKey(registrationNumber) {
        if (typeof registrationNumber === 'number') {
            const num = Math.floor(Math.abs(registrationNumber));
            return isNaN(num) ? null : num;
        }

        if (!registrationNumber || typeof registrationNumber !== 'string') {
            return null;
        }

        const trimmed = registrationNumber.trim();
        if (!trimmed) return null;

        // If pure digits
        if (/^\d+$/.test(trimmed)) {
            return parseInt(trimmed, 10);
        }

        // Find all contiguous numeric digit groups
        const matches = trimmed.match(/\d+/g);
        if (!matches || matches.length === 0) {
            return null;
        }

        // Return the last group of numbers (standard Indian plate format: State District Series Number)
        const lastGroup = matches[matches.length - 1];
        const parsed = parseInt(lastGroup, 10);
        return isNaN(parsed) ? null : parsed;
    }
}

module.exports = Car;
