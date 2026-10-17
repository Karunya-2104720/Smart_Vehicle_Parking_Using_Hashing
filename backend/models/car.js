/**
 * Car Model & Registration Key Extraction
 */

class Car {
    constructor(registrationNumber, key, hashIndex, methodUsed = 'linear', color = '#3b82f6', probesNeeded = 1, metadata = {}) {
        this.registrationNumber = registrationNumber.trim().toUpperCase();
        this.key = key;
        this.hashIndex = hashIndex;
        this.status = 'OCCUPIED';
        this.methodUsed = methodUsed;
        this.color = color;
        this.probesNeeded = probesNeeded;
        this.boardType = metadata.boardType || Car.detectBoardTypeFromRegistration(this.registrationNumber);
        this.vehicleType = metadata.vehicleType || 'Car';
        this.ownerName = metadata.ownerName || null;
        this.parkedAt = new Date().toISOString();
    }

    /**
     * Normalizes a vehicle registration number to a plate-like key.
     * Removes spaces and dashes, uppercases it, and rejects empty or malformed values.
     *
     * @param {string} registrationNumber
     * @returns {string|null}
     */
    static normalizePlate(registrationNumber) {
        if (typeof registrationNumber !== 'string') {
            return null;
        }

        const trimmed = registrationNumber.trim();
        if (!trimmed) {
            return null;
        }

        const normalized = trimmed.toUpperCase().replace(/[\s-]+/g, '');
        if (!normalized || !/[A-Z0-9]/.test(normalized) || !/\d/.test(normalized)) {
            return null;
        }

        return normalized;
    }

    /**
     * Calculates a plate-aware polynomial hash in the range [0, capacity - 1].
     * Uses the whole normalized plate, not just the final numeric suffix.
     *
     * @param {string} registrationNumber
     * @param {number} capacity
     * @returns {number}
     */
    static plateHash(registrationNumber, capacity) {
        const normalized = Car.normalizePlate(registrationNumber);
        if (!normalized || !Number.isInteger(capacity) || capacity <= 0) {
            return 0;
        }

        let hash = 0;
        for (const character of normalized) {
            hash = (hash * 31 + character.charCodeAt(0)) % capacity;
        }

        return Math.abs(hash);
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

    /**
     * Determines vehicle plate board type from registration text patterns.
     * Supports Private (White), Commercial (Yellow), EV (Green), Rental (Black),
     * Diplomatic (Blue), Government (Red), Military (Arrow), and Bharat Series (BH).
     *
     * @param {string} registrationNumber
     * @returns {object} Board classification metadata
     */
    static detectBoardTypeFromRegistration(registrationNumber) {
        if (!registrationNumber || typeof registrationNumber !== 'string') {
            return {
                code: 'WHITE_PRIVATE',
                name: 'Private Vehicle',
                boardColor: 'White',
                textColor: 'Black',
                hex: '#ffffff',
                badge: '⚪ White Board (Private)',
                category: 'Private Vehicle',
                suggestedDeck: 'General Decks (Decks 2–5)'
            };
        }

        const trimmed = registrationNumber.trim().toUpperCase();

        if (trimmed.includes('↑') || /^\d{2}[A-Z]\s*\d{5,7}[A-Z]?$/i.test(trimmed)) {
            return {
                code: 'DEFENSE_MILITARY',
                name: 'Military & Armed Forces',
                boardColor: 'Olive/Dark',
                textColor: 'White',
                hex: '#4b5563',
                badge: '🛡️ Arrow Board (Military / Defence)',
                category: 'Armed Forces / Ministry of Defence',
                suggestedDeck: 'Restricted Defense Zone'
            };
        }

        if (/^\d{2}\s*BH\s*\d{4}\s*[A-Z]{1,2}$/i.test(trimmed)) {
            return {
                code: 'BH_SERIES',
                name: 'Bharat Series (BH)',
                boardColor: 'White',
                textColor: 'Black',
                hex: '#f8fafc',
                badge: '🇮🇳 BH Series (Pan-India)',
                category: 'Bharat Series (Pan-India Portability)',
                suggestedDeck: 'General Decks (Decks 2–5)'
            };
        }

        if (/\b(CD|UN|CC)\b/i.test(trimmed) || /^\d{1,3}\s*(CD|UN|CC)\s*\d{1,3}$/i.test(trimmed)) {
            return {
                code: 'BLUE_DIPLOMATIC',
                name: 'Diplomatic & Embassy',
                boardColor: 'Blue',
                textColor: 'White',
                hex: '#38bdf8',
                badge: '🔵 Blue Board (Diplomatic)',
                category: 'Diplomatic / Consular Corps',
                suggestedDeck: 'Reserved Diplomatic Bay (Deck 1 VIP)'
            };
        }

        if (/\bEV\b/i.test(trimmed) || /^[A-Z]{2}\s*\d{1,2}\s*EV\s*\d{1,4}$/i.test(trimmed)) {
            return {
                code: 'GREEN_EV',
                name: 'Electric Vehicle (EV)',
                boardColor: 'Green',
                textColor: 'White',
                hex: '#10b981',
                badge: '🟢 Green Board (Electric Vehicle)',
                category: 'Clean Energy / Zero-Emission',
                suggestedDeck: 'EV Priority Deck (Deck 1 Charging Bay)'
            };
        }

        if (/\b(GOV|STATE|POLICE|JUDGE)\b/i.test(trimmed)) {
            return {
                code: 'RED_GOVERNMENT',
                name: 'Government Official',
                boardColor: 'Red',
                textColor: 'Gold/White',
                hex: '#ef4444',
                badge: '🔴 Red Board (State / Governor / VIP)',
                category: 'State Govt / High Official',
                suggestedDeck: 'VIP Reserved Bay (Deck 1 VIP)'
            };
        }

        if (/\b(TAXI|CAB)\b/i.test(trimmed) || /^[A-Z]{2}\s*\d{1,2}\s*[TY]\s*\d{1,4}$/i.test(trimmed)) {
            return {
                code: 'YELLOW_COMMERCIAL',
                name: 'Commercial Vehicle',
                boardColor: 'Yellow',
                textColor: 'Black',
                hex: '#fbbf24',
                badge: '🟡 Yellow Board (Commercial)',
                category: 'Commercial Transport (Taxi / Cab / Goods)',
                suggestedDeck: 'Commercial Deck (Deck 7)'
            };
        }

        if (/\b(RENTAL|ZOOM)\b/i.test(trimmed)) {
            return {
                code: 'BLACK_RENTAL',
                name: 'Self-Drive Rental Fleet',
                boardColor: 'Black',
                textColor: 'Yellow',
                hex: '#1e293b',
                badge: '⚫ Black Board (Self-Drive)',
                category: 'Self-Drive Rental Vehicle',
                suggestedDeck: 'Fleet & Rental Deck (Deck 6)'
            };
        }

        return {
            code: 'WHITE_PRIVATE',
            name: 'Private Vehicle',
            boardColor: 'White',
            textColor: 'Black',
            hex: '#ffffff',
            badge: '⚪ White Board (Private)',
            category: 'Private / Non-Commercial',
            suggestedDeck: 'General Decks (Decks 2–5)'
        };
    }
}

module.exports = Car;
