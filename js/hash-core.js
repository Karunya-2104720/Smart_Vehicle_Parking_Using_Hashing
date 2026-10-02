/**
 * Smart Parking - Core Hashing Engine
 * Implements pure hashing algorithms, collision resolution techniques,
 * and open-addressing tombstone state management for 11 parking slots.
 */

// Slot States
const SLOT_STATE = {
    EMPTY: 'EMPTY',
    OCCUPIED: 'OCCUPIED',
    TOMBSTONE: 'TOMBSTONE' // Represents a deleted car slot
};

// Hashing Methods
const HASH_METHOD = {
    DIRECT: 'direct',
    LINEAR: 'linear',
    QUADRATIC: 'quadratic',
    DOUBLE: 'double'
};

class SmartParkingHashTable {
    constructor(size = 47, secondaryPrime = 43) {
        this.size = size;
        this.secondaryPrime = secondaryPrime || (size === 47 ? 43 : 7);
        this.slots = new Array(size).fill(null).map((_, index) => ({
            slotNumber: index,
            state: SLOT_STATE.EMPTY,
            car: null // { registration, key, hashIndex, probesNeeded, color, carType, parkedAt }
        }));

        this.stats = {
            totalCollisions: 0,
            totalProbes: 0,
            totalSearches: 0,
            successfulSearches: 0,
            failedSearches: 0,
            totalSearchProbes: 0
        };

        this.history = [];
    }

    /**
     * Resets the parking lot to initial empty state.
     */
    reset() {
        for (let i = 0; i < this.size; i++) {
            this.slots[i] = {
                slotNumber: i,
                state: SLOT_STATE.EMPTY,
                car: null
            };
        }
        this.stats = {
            totalCollisions: 0,
            totalProbes: 0,
            totalSearches: 0,
            successfulSearches: 0,
            failedSearches: 0,
            totalSearchProbes: 0
        };
        this.history = [];
    }

    /**
     * Extracts numeric key from car registration plate.
     * E.g. "TN 09 AB 1021" -> 1021
     * E.g. "KA 05 MN 2043" -> 2043
     * E.g. "45" -> 45
     */
    static extractKey(registration) {
        if (typeof registration === 'number') {
            return Math.abs(Math.floor(registration));
        }
        if (!registration || typeof registration !== 'string') {
            return null;
        }

        const trimmed = registration.trim();
        // If entirely digits
        if (/^\d+$/.test(trimmed)) {
            return parseInt(trimmed, 10);
        }

        // Find all contiguous digit sequences
        const digitMatches = trimmed.match(/\d+/g);
        if (!digitMatches || digitMatches.length === 0) {
            return null;
        }

        // Prefer the last group of numbers (standard Indian plate format: TN 09 AB 1021 -> 1021)
        const lastDigits = digitMatches[digitMatches.length - 1];
        return parseInt(lastDigits, 10);
    }

    /**
     * Primary Hash Function: hash(key) = key % size
     * @param {number} key 
     * @returns {number} 0 to (size - 1)
     */
    hashFunction(key) {
        return Math.abs(key) % this.size;
    }

    /**
     * Secondary Hash Function: h2(key) = secondaryPrime - (key % secondaryPrime)
     * For 47 slots, secondaryPrime is 43. Value is strictly in [1, 43], co-prime with 47.
     * @param {number} key 
     * @returns {number}
     */
    secondaryHash(key) {
        const prime = this.secondaryPrime || 43;
        return prime - (Math.abs(key) % prime);
    }

    /**
     * Linear Probing index formula: (h(key) + i) % size
     */
    linearProbing(key, i) {
        const h = this.hashFunction(key);
        return (h + i) % this.size;
    }

    /**
     * Quadratic Probing index formula: (h(key) + i^2) % size
     */
    quadraticProbing(key, i) {
        const h = this.hashFunction(key);
        return (h + (i * i)) % this.size;
    }

    /**
     * Double Hashing index formula: (h1(key) + i * h2(key)) % size
     */
    doubleHashing(key, i) {
        const h1 = this.hashFunction(key);
        const h2 = this.secondaryHash(key);
        return (h1 + (i * h2)) % this.size;
    }

    /**
     * Computes probing slot index based on method and probe step i.
     */
    computeProbeIndex(key, i, method) {
        switch (method) {
            case HASH_METHOD.DIRECT:
                return this.hashFunction(key);
            case HASH_METHOD.LINEAR:
                return this.linearProbing(key, i);
            case HASH_METHOD.QUADRATIC:
                return this.quadraticProbing(key, i);
            case HASH_METHOD.DOUBLE:
                return this.doubleHashing(key, i);
            default:
                return this.linearProbing(key, i);
        }
    }

    /**
     * Calculates current Load Factor: Occupied Slots / Total Slots
     */
    calculateLoadFactor() {
        const occupiedCount = this.getOccupiedSlotsCount();
        return {
            occupiedCount,
            totalSlots: this.size,
            loadFactor: occupiedCount / this.size,
            percentage: ((occupiedCount / this.size) * 100).toFixed(1)
        };
    }

    getOccupiedSlotsCount() {
        return this.slots.filter(s => s.state === SLOT_STATE.OCCUPIED).length;
    }

    getAvailableSlotsCount() {
        return this.slots.filter(s => s.state === SLOT_STATE.EMPTY || s.state === SLOT_STATE.TOMBSTONE).length;
    }

    /**
     * Checks if a car with this registration or key is already parked.
     */
    findExistingSlot(registration, key) {
        const regUpper = registration ? registration.trim().toUpperCase() : null;
        for (let i = 0; i < this.size; i++) {
            const slot = this.slots[i];
            if (slot.state === SLOT_STATE.OCCUPIED && slot.car) {
                if (regUpper && slot.car.registration.toUpperCase() === regUpper) {
                    return { found: true, slotNumber: i, car: slot.car, matchType: 'registration' };
                }
            }
        }
        return { found: false };
    }

    /**
     * Simulates insertion and returns an execution trace (generator/array of steps).
     * Does NOT mutate state until committed, or can mutate with commit=true.
     */
    planInsertCar(registration, method = HASH_METHOD.LINEAR, carVisuals = {}) {
        const key = SmartParkingHashTable.extractKey(registration);
        if (key === null) {
            return {
                success: false,
                error: 'Invalid registration number. Please include numeric digits.',
                trace: []
            };
        }

        const existing = this.findExistingSlot(registration, key);
        if (existing.found) {
            return {
                success: false,
                error: `Car "${registration}" is already parked in Slot ${existing.slotNumber}!`,
                trace: []
            };
        }

        const occupiedCount = this.getOccupiedSlotsCount();
        if (occupiedCount >= this.size) {
            return {
                success: false,
                error: `Parking lot is completely FULL! (${this.size}/${this.size} slots occupied)`,
                trace: []
            };
        }

        const h1 = this.hashFunction(key);
        const h2 = method === HASH_METHOD.DOUBLE ? this.secondaryHash(key) : null;
        const trace = [];
        let assignedSlot = -1;
        let collisionCount = 0;
        let firstTombstoneSlot = -1;
        let firstTombstoneProbe = -1;

        // Trace up to size iterations
        const maxProbes = method === HASH_METHOD.DIRECT ? 1 : this.size;
        const visitedSlots = new Set();

        for (let i = 0; i < maxProbes; i++) {
            const slotIndex = this.computeProbeIndex(key, i, method);
            const slot = this.slots[slotIndex];
            visitedSlots.add(slotIndex);

            let formulaExplanation = '';
            if (method === HASH_METHOD.DIRECT) {
                formulaExplanation = `hash(${key}) = ${key} % ${this.size} = ${slotIndex}`;
            } else if (method === HASH_METHOD.LINEAR) {
                formulaExplanation = i === 0 
                    ? `Initial probe (i=0): hash(${key}) = ${key} % ${this.size} = ${slotIndex}`
                    : `Probe i=${i}: (${h1} + ${i}) % ${this.size} = ${slotIndex}`;
            } else if (method === HASH_METHOD.QUADRATIC) {
                formulaExplanation = i === 0 
                    ? `Initial probe (i=0): hash(${key}) = ${key} % ${this.size} = ${slotIndex}`
                    : `Probe i=${i}: (${h1} + ${i}²) % ${this.size} = (${h1} + ${i * i}) % ${this.size} = ${slotIndex}`;
            } else if (method === HASH_METHOD.DOUBLE) {
                formulaExplanation = i === 0 
                    ? `Initial probe (i=0): h1(${key}) = ${key} % ${this.size} = ${slotIndex} (h2 = ${this.secondaryPrime} - (${key} % ${this.secondaryPrime}) = ${h2})`
                    : `Probe i=${i}: (${h1} + ${i} × ${h2}) % ${this.size} = (${h1} + ${i * h2}) % ${this.size} = ${slotIndex}`;
            }

            if (slot.state === SLOT_STATE.EMPTY) {
                const targetSlot = firstTombstoneSlot !== -1 ? firstTombstoneSlot : slotIndex;

                trace.push({
                    stepNumber: trace.length + 1,
                    probeStep: i,
                    slotIndex,
                    actualPlacedSlot: targetSlot,
                    formulaExplanation,
                    slotStateBefore: slot.state,
                    isCollision: false,
                    collidedWith: null,
                    isAssigned: true,
                    message: firstTombstoneSlot !== -1 
                        ? `Slot ${slotIndex} is EMPTY! Using previously encountered Tombstone at Slot ${firstTombstoneSlot} to optimize slot allocation.`
                        : `Slot ${slotIndex} is AVAILABLE! Car assigned to Slot ${slotIndex}.`
                });

                assignedSlot = targetSlot;
                break;
            } else if (slot.state === SLOT_STATE.TOMBSTONE) {
                if (firstTombstoneSlot === -1) {
                    firstTombstoneSlot = slotIndex;
                    firstTombstoneProbe = i;
                }
                trace.push({
                    stepNumber: trace.length + 1,
                    probeStep: i,
                    slotIndex,
                    formulaExplanation,
                    slotStateBefore: slot.state,
                    isCollision: false,
                    isTombstone: true,
                    collidedWith: null,
                    isAssigned: false,
                    message: `Slot ${slotIndex} has a TOMBSTONE (car departed). Continuing probe sequence.`
                });
            } else if (slot.state === SLOT_STATE.OCCUPIED) {
                collisionCount++;
                trace.push({
                    stepNumber: trace.length + 1,
                    probeStep: i,
                    slotIndex,
                    formulaExplanation,
                    slotStateBefore: slot.state,
                    isCollision: true,
                    isTombstone: false,
                    collidedWith: slot.car,
                    isAssigned: false,
                    message: `Slot ${slotIndex} is OCCUPIED by car "${slot.car.registration}" (Key: ${slot.car.key}). Collision detected!`
                });

                if (method === HASH_METHOD.DIRECT) {
                    return {
                        success: false,
                        error: `Collision at Slot ${slotIndex}! Direct Hashing cannot resolve collisions. Slot is occupied by ${slot.car.registration}.`,
                        trace,
                        key,
                        hashIndex: h1,
                        method
                    };
                }
            }
        }

        if (assignedSlot === -1 && firstTombstoneSlot !== -1) {
            assignedSlot = firstTombstoneSlot;
            trace.push({
                stepNumber: trace.length + 1,
                probeStep: firstTombstoneProbe,
                slotIndex: firstTombstoneSlot,
                actualPlacedSlot: firstTombstoneSlot,
                formulaExplanation: `Placing into tombstone slot ${firstTombstoneSlot}`,
                slotStateBefore: SLOT_STATE.TOMBSTONE,
                isCollision: false,
                collidedWith: null,
                isAssigned: true,
                message: `Reclaiming Tombstone Slot ${firstTombstoneSlot} for new car.`
            });
        }

        if (assignedSlot === -1) {
            return {
                success: false,
                error: `Could not find an available slot after probing! (Probing cycle exhausted).`,
                trace,
                key,
                hashIndex: h1,
                method
            };
        }

        return {
            success: true,
            assignedSlot,
            key,
            hashIndex: h1,
            secondaryHashIndex: h2,
            method,
            probesNeeded: trace.length,
            collisionCount,
            trace,
            carVisuals
        };
    }

    /**
     * Commits a planned insertion to the hash table.
     */
    commitInsert(planResult, registration, carVisuals = {}) {
        if (!planResult.success || planResult.assignedSlot === -1) {
            return false;
        }

        const slotIndex = planResult.assignedSlot;
        const car = {
            registration: registration.trim().toUpperCase(),
            key: planResult.key,
            hashIndex: planResult.hashIndex,
            secondaryHashIndex: planResult.secondaryHashIndex,
            probesNeeded: planResult.probesNeeded,
            color: carVisuals.color || '#3b82f6',
            carType: carVisuals.carType || 'sedan',
            parkedAt: new Date().toLocaleTimeString(),
            methodUsed: planResult.method
        };

        this.slots[slotIndex] = {
            slotNumber: slotIndex,
            state: SLOT_STATE.OCCUPIED,
            car
        };

        this.stats.totalCollisions += planResult.collisionCount;
        this.stats.totalProbes += planResult.probesNeeded;

        this.history.unshift({
            action: 'PARK',
            car,
            slot: slotIndex,
            probes: planResult.probesNeeded,
            collisions: planResult.collisionCount,
            method: planResult.method,
            time: car.parkedAt
        });

        return car;
    }

    /**
     * Executes parking operation (plan + commit).
     */
    insertCar(registration, method = HASH_METHOD.LINEAR, carVisuals = {}) {
        const plan = this.planInsertCar(registration, method, carVisuals);
        if (plan.success) {
            const car = this.commitInsert(plan, registration, carVisuals);
            return { ...plan, car };
        }
        return plan;
    }

    /**
     * Searches for a car by registration number or key.
     */
    searchCar(registration, method = HASH_METHOD.LINEAR) {
        const key = SmartParkingHashTable.extractKey(registration);
        if (key === null) {
            return {
                found: false,
                error: 'Invalid registration number. Please include numeric digits.',
                trace: []
            };
        }

        const regUpper = registration.trim().toUpperCase();
        const h1 = this.hashFunction(key);
        const h2 = method === HASH_METHOD.DOUBLE ? this.secondaryHash(key) : null;
        const trace = [];
        const maxProbes = method === HASH_METHOD.DIRECT ? 1 : this.size;

        this.stats.totalSearches++;

        for (let i = 0; i < maxProbes; i++) {
            const slotIndex = this.computeProbeIndex(key, i, method);
            const slot = this.slots[slotIndex];

            let formula = '';
            if (method === HASH_METHOD.DIRECT) {
                formula = `hash(${key}) = ${key} % ${this.size} = ${slotIndex}`;
            } else if (method === HASH_METHOD.LINEAR) {
                formula = `(${h1} + ${i}) % ${this.size} = ${slotIndex}`;
            } else if (method === HASH_METHOD.QUADRATIC) {
                formula = `(${h1} + ${i}²) % ${this.size} = ${slotIndex}`;
            } else if (method === HASH_METHOD.DOUBLE) {
                formula = `(${h1} + ${i} × ${h2}) % ${this.size} = ${slotIndex}`;
            }

            if (slot.state === SLOT_STATE.EMPTY) {
                trace.push({
                    probeStep: i,
                    slotIndex,
                    formula,
                    slotState: slot.state,
                    found: false,
                    isTerminator: true,
                    message: `Slot ${slotIndex} is EMPTY! Search terminated. Car "${registration}" is NOT in the parking lot.`
                });
                break;
            } else if (slot.state === SLOT_STATE.TOMBSTONE) {
                trace.push({
                    probeStep: i,
                    slotIndex,
                    formula,
                    slotState: slot.state,
                    found: false,
                    isTombstone: true,
                    message: `Slot ${slotIndex} is a TOMBSTONE (car departed). Continuing probe to check further down the chain.`
                });
            } else if (slot.state === SLOT_STATE.OCCUPIED) {
                const match = slot.car.registration.toUpperCase() === regUpper || slot.car.key === key;
                if (match) {
                    trace.push({
                        probeStep: i,
                        slotIndex,
                        formula,
                        slotState: slot.state,
                        found: true,
                        car: slot.car,
                        message: `Car FOUND at Slot ${slotIndex}! Matches "${slot.car.registration}" (Key: ${slot.car.key}).`
                    });

                    this.stats.successfulSearches++;
                    this.stats.totalSearchProbes += (i + 1);

                    return {
                        found: true,
                        slotNumber: slotIndex,
                        car: slot.car,
                        key,
                        hashIndex: h1,
                        secondaryHashIndex: h2,
                        probesRequired: i + 1,
                        searchSequence: trace.map(t => t.slotIndex),
                        trace
                    };
                } else {
                    trace.push({
                        probeStep: i,
                        slotIndex,
                        formula,
                        slotState: slot.state,
                        found: false,
                        car: slot.car,
                        message: `Slot ${slotIndex} has car "${slot.car.registration}" (Key: ${slot.car.key} ≠ ${key}). Continuing search...`
                    });
                }
            }
        }

        this.stats.failedSearches++;
        this.stats.totalSearchProbes += trace.length;

        return {
            found: false,
            error: `Car not found. Searched sequence: [${trace.map(t => t.slotIndex).join(' → ')}]. Probes required: ${trace.length}.`,
            key,
            hashIndex: h1,
            secondaryHashIndex: h2,
            probesRequired: trace.length,
            searchSequence: trace.map(t => t.slotIndex),
            trace
        };
    }

    /**
     * Removes a car from the parking lot and sets TOMBSTONE state.
     */
    deleteCar(registration, method = HASH_METHOD.LINEAR) {
        const searchResult = this.searchCar(registration, method);
        if (!searchResult.found) {
            return {
                success: false,
                error: `Cannot remove car "${registration}": Car was not found in the parking lot.`,
                trace: searchResult.trace
            };
        }

        const slotIndex = searchResult.slotNumber;
        const carRemoved = this.slots[slotIndex].car;

        this.slots[slotIndex] = {
            slotNumber: slotIndex,
            state: SLOT_STATE.TOMBSTONE,
            car: null,
            previousCar: carRemoved
        };

        this.history.unshift({
            action: 'REMOVE',
            car: carRemoved,
            slot: slotIndex,
            probes: searchResult.probesRequired,
            method,
            time: new Date().toLocaleTimeString()
        });

        return {
            success: true,
            slotNumber: slotIndex,
            car: carRemoved,
            probesRequired: searchResult.probesRequired,
            searchSequence: searchResult.searchSequence,
            trace: searchResult.trace,
            message: `Car "${carRemoved.registration}" successfully removed from Slot ${slotIndex}. Slot marked as TOMBSTONE.`
        };
    }

    /**
     * Returns structured parking status table data.
     */
    displayTable() {
        return this.slots.map(slot => {
            if (slot.state === SLOT_STATE.OCCUPIED && slot.car) {
                return {
                    slot: slot.slotNumber,
                    status: 'Occupied',
                    registration: slot.car.registration,
                    key: slot.car.key,
                    hashIndex: slot.car.hashIndex,
                    probesNeeded: slot.car.probesNeeded,
                    color: slot.car.color
                };
            } else if (slot.state === SLOT_STATE.TOMBSTONE) {
                return {
                    slot: slot.slotNumber,
                    status: 'Deleted (Tombstone)',
                    registration: '— (Vacated)',
                    key: '—',
                    hashIndex: '—',
                    probesNeeded: '—',
                    color: null
                };
            } else {
                return {
                    slot: slot.slotNumber,
                    status: 'Empty',
                    registration: '—',
                    key: '—',
                    hashIndex: '—',
                    probesNeeded: '—',
                    color: null
                };
            }
        });
    }

    /**
     * Returns live statistics snapshot.
     */
    updateStatistics() {
        const lf = this.calculateLoadFactor();
        return {
            totalSlots: this.size,
            occupiedSlots: lf.occupiedCount,
            availableSlots: this.getAvailableSlotsCount(),
            loadFactor: lf.loadFactor,
            loadFactorPercent: lf.percentage,
            totalCollisions: this.stats.totalCollisions,
            totalProbes: this.stats.totalProbes,
            totalSearches: this.stats.totalSearches,
            successfulSearches: this.stats.successfulSearches,
            failedSearches: this.stats.failedSearches,
            avgSearchProbes: this.stats.totalSearches > 0 
                ? (this.stats.totalSearchProbes / this.stats.totalSearches).toFixed(2) 
                : '0.00'
        };
    }
}

if (typeof window !== 'undefined') {
    window.SmartParkingHashTable = SmartParkingHashTable;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SLOT_STATE,
        HASH_METHOD,
        SmartParkingHashTable
    };
}
