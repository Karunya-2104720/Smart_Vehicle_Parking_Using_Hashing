/**
 * Manual Array-Based Parking Hash Table
 * 
 * STRICT REQUIREMENT: Does NOT use built-in Map, Set, or Object dictionaries
 * for hash table storage. The table is an array of fixed size N (e.g. 47 slots).
 */

const Car = require('../models/car');
const { linearProbe, getLinearProbeIndex } = require('./linearProbing');
const { quadraticProbe, getQuadraticProbeIndex } = require('./quadraticProbing');
const { doubleHashProbe, getDoubleHashProbeIndex, primaryHash, secondaryHash } = require('./doubleHashing');

class HashTable {
    constructor(tableSize = 47, secondaryPrime = 43) {
        this.tableSize = tableSize;
        this.secondaryPrime = secondaryPrime;

        // Raw Array-based hash table
        this.table = new Array(this.tableSize).fill(null);

        this.stats = {
            totalCollisions: 0,
            totalProbes: 0,
            totalSearches: 0,
            successfulSearches: 0,
            failedSearches: 0,
            totalSearchProbes: 0
        };
    }

    /**
     * Resets all slots and statistics.
     */
    reset() {
        for (let i = 0; i < this.tableSize; i++) {
            this.table[i] = null;
        }
        this.stats = {
            totalCollisions: 0,
            totalProbes: 0,
            totalSearches: 0,
            successfulSearches: 0,
            failedSearches: 0,
            totalSearchProbes: 0
        };
    }

    /**
     * Primary hash calculation.
     */
    hash(key) {
        const hashIndex = Math.abs(key) % this.tableSize;
        return {
            key,
            hashIndex
        };
    }

    getOccupiedCount() {
        let count = 0;
        for (let i = 0; i < this.tableSize; i++) {
            if (this.table[i] && this.table[i].status === 'OCCUPIED') {
                count++;
            }
        }
        return count;
    }

    getAvailableCount() {
        let count = 0;
        for (let i = 0; i < this.tableSize; i++) {
            if (this.table[i] === null || this.table[i].status === 'TOMBSTONE') {
                count++;
            }
        }
        return count;
    }

    calculateLoadFactor() {
        const occupied = this.getOccupiedCount();
        const loadFactor = occupied / this.tableSize;
        return {
            occupiedSlots: occupied,
            totalSlots: this.tableSize,
            availableSlots: this.getAvailableCount(),
            loadFactor: parseFloat(loadFactor.toFixed(4)),
            loadFactorPercentage: parseFloat((loadFactor * 100).toFixed(2))
        };
    }

    /**
     * Checks if car with registration is already parked.
     */
    findExistingSlot(registrationNumber) {
        const regUpper = registrationNumber.trim().toUpperCase();
        for (let i = 0; i < this.tableSize; i++) {
            const slot = this.table[i];
            if (slot && slot.status === 'OCCUPIED' && slot.registrationNumber === regUpper) {
                return { found: true, index: i, car: slot };
            }
        }
        return { found: false };
    }

    /**
     * Parks a car into the hash table.
     */
    parkCar(registrationNumber, method = 'linear', color = '#3b82f6') {
        const key = Car.extractKey(registrationNumber);
        if (key === null) {
            return {
                success: false,
                statusCode: 400,
                error: 'Invalid registration number. Could not extract numeric key.'
            };
        }

        const existing = this.findExistingSlot(registrationNumber);
        if (existing.found) {
            return {
                success: false,
                statusCode: 409,
                error: `Car "${registrationNumber}" is already parked in Slot ${existing.index}.`
            };
        }

        if (this.getOccupiedCount() >= this.tableSize) {
            return {
                success: false,
                statusCode: 409,
                error: `Parking area full! (${this.tableSize}/${this.tableSize} slots occupied).`
            };
        }

        const hashIndex = Math.abs(key) % this.tableSize;
        let probeResult;

        if (method === 'basic') {
            // Direct Hashing: check single slot
            const slot = this.table[hashIndex];
            const collision = slot !== null && slot.status === 'OCCUPIED';
            const steps = [{
                attempt: 1,
                probeStep: 0,
                index: hashIndex,
                formula: `hash(${key}) = ${key} % ${this.tableSize} = ${hashIndex}`,
                status: collision ? 'OCCUPIED' : (slot && slot.status === 'TOMBSTONE' ? 'TOMBSTONE' : 'AVAILABLE')
            }];

            if (collision) {
                this.stats.totalCollisions++;
                this.stats.totalProbes++;
                return {
                    success: false,
                    statusCode: 409,
                    error: `Collision at Slot ${hashIndex}! Direct hashing has no collision resolution. Slot occupied by ${slot.registrationNumber}.`,
                    car: { registrationNumber: registrationNumber.trim().toUpperCase(), key },
                    hashIndex,
                    method,
                    collision: true,
                    collisionCount: 1,
                    probes: 1,
                    steps
                };
            }

            probeResult = {
                success: true,
                finalIndex: hashIndex,
                hashIndex,
                probes: 1,
                collision: false,
                steps
            };
        } else if (method === 'linear') {
            probeResult = linearProbe(this.table, key, this.tableSize);
        } else if (method === 'quadratic') {
            probeResult = quadraticProbe(this.table, key, this.tableSize);
        } else if (method === 'double') {
            probeResult = doubleHashProbe(this.table, key, this.tableSize, this.secondaryPrime);
        } else {
            return {
                success: false,
                statusCode: 400,
                error: `Invalid hashing method: "${method}". Supported: basic, linear, quadratic, double.`
            };
        }

        if (!probeResult.success || probeResult.finalIndex === -1) {
            return {
                success: false,
                statusCode: 409,
                error: `Could not assign a slot. Probing cycle completed without finding empty space.`,
                steps: probeResult.steps
            };
        }

        // Commit Car into array slot
        const car = new Car(
            registrationNumber,
            key,
            hashIndex,
            method,
            color,
            probeResult.probes
        );

        this.table[probeResult.finalIndex] = car;

        if (probeResult.collision) {
            this.stats.totalCollisions++;
        }
        this.stats.totalProbes += probeResult.probes;

        return {
            success: true,
            statusCode: 201,
            message: 'Car parked successfully',
            car: {
                registrationNumber: car.registrationNumber,
                key: car.key,
                color: car.color
            },
            hashIndex,
            finalSlot: probeResult.finalIndex,
            method,
            collision: probeResult.collision,
            collisionCount: probeResult.collision ? 1 : 0,
            probes: probeResult.probes,
            steps: probeResult.steps
        };
    }

    /**
     * Searches for a car by registration number.
     * Accurately probes array following open-addressing rules.
     */
    searchCar(registrationNumber, method = 'linear') {
        const key = Car.extractKey(registrationNumber);
        if (key === null) {
            return {
                found: false,
                statusCode: 400,
                error: 'Invalid registration number.'
            };
        }

        const regUpper = registrationNumber.trim().toUpperCase();
        const hashIndex = Math.abs(key) % this.tableSize;
        const steps = [];
        const supportedMethods = ['basic', 'linear', 'quadratic', 'double'];
        const requestedMethod = typeof method === 'string' ? method.toLowerCase() : '';
        if (!supportedMethods.includes(requestedMethod)) {
            return {
                found: false,
                statusCode: 400,
                error: `Invalid hashing method: "${method}". Supported: ${supportedMethods.join(', ')}.`
            };
        }

        this.stats.totalSearches++;

        const searchMethods = [requestedMethod];
        for (const candidateMethod of supportedMethods) {
            if (candidateMethod !== requestedMethod) {
                searchMethods.push(candidateMethod);
            }
        }

        for (const searchMethod of searchMethods) {
            const maxAttempts = searchMethod === 'basic' ? 1 : this.tableSize;

            for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex++) {
                let index;
                let formula = '';

                if (searchMethod === 'basic') {
                    index = hashIndex;
                    formula = `hash(${key}) = ${key} % ${this.tableSize} = ${index}`;
                } else if (searchMethod === 'linear') {
                    index = getLinearProbeIndex(key, attemptIndex, this.tableSize);
                    formula = `(${hashIndex} + ${attemptIndex}) % ${this.tableSize} = ${index}`;
                } else if (searchMethod === 'quadratic') {
                    index = getQuadraticProbeIndex(key, attemptIndex, this.tableSize);
                    formula = `(${hashIndex} + ${attemptIndex}²) % ${this.tableSize} = ${index}`;
                } else if (searchMethod === 'double') {
                    index = getDoubleHashProbeIndex(key, attemptIndex, this.tableSize, this.secondaryPrime);
                    formula = `(${hashIndex} + ${attemptIndex} × ${secondaryHash(key, this.secondaryPrime)}) % ${this.tableSize} = ${index}`;
                }

                const slot = this.table[index];

                if (slot === null) {
                    steps.push({
                        attempt: attemptIndex + 1,
                        method: searchMethod,
                        index,
                        formula,
                        status: 'EMPTY',
                        match: false
                    });
                    break;
                } else if (slot.status === 'TOMBSTONE') {
                    steps.push({
                        attempt: attemptIndex + 1,
                        method: searchMethod,
                        index,
                        formula,
                        status: 'TOMBSTONE',
                        match: false
                    });
                } else if (slot.status === 'OCCUPIED') {
                    const match = slot.registrationNumber === regUpper;
                    steps.push({
                        attempt: attemptIndex + 1,
                        method: searchMethod,
                        index,
                        formula,
                        status: 'OCCUPIED',
                        match,
                        carRegistration: slot.registrationNumber,
                        carKey: slot.key
                    });

                    if (match) {
                        this.stats.successfulSearches++;
                        this.stats.totalSearchProbes += steps.length;

                        return {
                            found: true,
                            statusCode: 200,
                            registrationNumber: slot.registrationNumber,
                            key: slot.key,
                            hashIndex,
                            method: searchMethod,
                            foundAt: index,
                            probes: steps.length,
                            steps
                        };
                    }
                }
            }
        }

        this.stats.failedSearches++;
        this.stats.totalSearchProbes += steps.length;

        return {
            found: false,
            statusCode: 404,
            error: 'Car not found.',
            registrationNumber: regUpper,
            key,
            hashIndex,
            method: requestedMethod,
            probes: steps.length,
            steps
        };
    }

    /**
     * Deletes a car and places a TOMBSTONE marker to preserve search continuity.
     */
    deleteCar(registrationNumber, method = 'linear') {
        const searchResult = this.searchCar(registrationNumber, method);
        if (!searchResult.found) {
            return {
                success: false,
                statusCode: searchResult.statusCode || 404,
                error: searchResult.statusCode === 400
                    ? searchResult.error
                    : `Car "${registrationNumber}" not found in parking lot.`
            };
        }

        const slotIndex = searchResult.foundAt;
        const carRemoved = this.table[slotIndex];

        // Mark as TOMBSTONE (crucial for open addressing correctness)
        this.table[slotIndex] = {
            status: 'TOMBSTONE',
            previousRegistration: carRemoved.registrationNumber,
            previousKey: carRemoved.key,
            deletedAt: new Date().toISOString()
        };

        return {
            success: true,
            statusCode: 200,
            message: 'Car removed successfully',
            registrationNumber: carRemoved.registrationNumber,
            deletedSlot: slotIndex,
            probes: searchResult.probes,
            steps: searchResult.steps
        };
    }

    /**
     * Returns full snapshot of all parking slots.
     */
    getParkingStatus() {
        const slots = [];
        for (let i = 0; i < this.tableSize; i++) {
            const slot = this.table[i];
            if (slot && slot.status === 'OCCUPIED') {
                slots.push({
                    index: i,
                    status: 'OCCUPIED',
                    car: {
                        registrationNumber: slot.registrationNumber,
                        key: slot.key,
                        hashIndex: slot.hashIndex,
                        color: slot.color,
                        probesNeeded: slot.probesNeeded,
                        methodUsed: slot.methodUsed,
                        parkedAt: slot.parkedAt
                    }
                });
            } else if (slot && slot.status === 'TOMBSTONE') {
                slots.push({
                    index: i,
                    status: 'TOMBSTONE',
                    car: null,
                    tombstoneInfo: {
                        previousRegistration: slot.previousRegistration,
                        previousKey: slot.previousKey
                    }
                });
            } else {
                slots.push({
                    index: i,
                    status: 'EMPTY',
                    car: null
                });
            }
        }

        return {
            tableSize: this.tableSize,
            slots
        };
    }

    /**
     * Returns live operational statistics.
     */
    getStatistics() {
        const lf = this.calculateLoadFactor();
        return {
            totalSlots: this.tableSize,
            occupiedSlots: lf.occupiedSlots,
            availableSlots: lf.availableSlots,
            loadFactor: lf.loadFactor,
            loadFactorPercentage: lf.loadFactorPercentage,
            totalCollisions: this.stats.totalCollisions,
            totalProbes: this.stats.totalProbes,
            totalSearches: this.stats.totalSearches,
            successfulSearches: this.stats.successfulSearches,
            failedSearches: this.stats.failedSearches
        };
    }

    /**
     * Simulates insertion batch on an ISOLATED table instance (Part D & 16).
     */
    simulate(registrationNumbers, method = 'linear') {
        const tempTable = new HashTable(this.tableSize, this.secondaryPrime);
        const results = [];
        let collisions = 0;
        let probes = 0;

        registrationNumbers.forEach(reg => {
            const key = Car.extractKey(reg);
            if (key === null) {
                results.push({
                    registrationNumber: reg,
                    error: 'Invalid registration number'
                });
                return;
            }

            const parkRes = tempTable.parkCar(reg, method);
            if (parkRes.success) {
                if (parkRes.collision) collisions++;
                probes += parkRes.probes;

                results.push({
                    registrationNumber: reg.trim().toUpperCase(),
                    key,
                    hashIndex: parkRes.hashIndex,
                    finalIndex: parkRes.finalSlot,
                    collision: parkRes.collision,
                    steps: parkRes.steps
                });
            } else {
                results.push({
                    registrationNumber: reg.trim().toUpperCase(),
                    key,
                    hashIndex: parkRes.hashIndex,
                    collision: true,
                    error: parkRes.error,
                    steps: parkRes.steps || []
                });
            }
        });

        return {
            method,
            tableSize: this.tableSize,
            results,
            statistics: {
                collisions,
                probes
            }
        };
    }

    /**
     * Compares all 4 hashing methods on identical input batch (Part E & 17).
     */
    compareAll(registrationNumbers) {
        const methods = ['basic', 'linear', 'quadratic', 'double'];
        const comparison = {};

        methods.forEach(m => {
            const sim = this.simulate(registrationNumbers, m);
            comparison[m] = {
                collisions: sim.statistics.collisions,
                probes: sim.statistics.probes,
                results: sim.results
            };
        });

        return {
            tableSize: this.tableSize,
            comparison
        };
    }
}

module.exports = HashTable;
