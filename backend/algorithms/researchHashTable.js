/**
 * Configurable open-addressing table for repeatable hashing experiments.
 * The production simulator keeps its fixed-size table; this class is used by
 * benchmark runs that compare hash functions, resizing, and tombstone cleanup.
 */

const {
    normalizePlate,
    extractNumericSuffix,
    plateHash
} = require('../models/vehicleRegistration');

const SLOT_EMPTY = null;
const SLOT_TOMBSTONE = Object.freeze({ status: 'TOMBSTONE' });
const HASH_MODES = ['division', 'plate'];
const PROBE_METHODS = ['linear', 'quadratic', 'double'];

function greatestCommonDivisor(a, b) {
    while (b !== 0) [a, b] = [b, a % b];
    return a;
}

class ResearchHashTable {
    constructor({
        capacity = 70,
        hashMode = 'plate',
        method = 'linear',
        autoResize = false,
        cleanupTombstones = false,
        maxLoadFactor = 0.7,
        tombstoneThreshold = 0.2
    } = {}) {
        if (!Number.isInteger(capacity) || capacity < 2) {
            throw new RangeError('Table capacity must be an integer greater than one.');
        }
        if (!HASH_MODES.includes(hashMode)) {
            throw new TypeError(`Unsupported hash mode "${hashMode}".`);
        }
        if (!PROBE_METHODS.includes(method)) {
            throw new TypeError(`Unsupported probe method "${method}".`);
        }
        if (!(maxLoadFactor > 0 && maxLoadFactor < 1)) {
            throw new RangeError('maxLoadFactor must be greater than zero and less than one.');
        }
        if (!(tombstoneThreshold > 0 && tombstoneThreshold <= 1)) {
            throw new RangeError('tombstoneThreshold must be greater than zero and at most one.');
        }

        this.initialCapacity = capacity;
        this.capacity = capacity;
        this.hashMode = hashMode;
        this.method = method;
        this.autoResize = autoResize;
        this.cleanupTombstones = cleanupTombstones;
        this.maxLoadFactor = maxLoadFactor;
        this.tombstoneThreshold = tombstoneThreshold;
        this.slots = new Array(capacity).fill(SLOT_EMPTY);
        this.activeCount = 0;
        this.tombstoneCount = 0;
        this.nextInsertionOrder = 0;
        this.stats = this.createStats();
    }

    createStats() {
        return {
            insertionCount: 0,
            insertionProbes: 0,
            collisionCount: 0,
            successfulSearches: 0,
            successfulSearchProbes: 0,
            unsuccessfulSearches: 0,
            unsuccessfulSearchProbes: 0,
            deletions: 0,
            deletionProbes: 0,
            rehashCount: 0,
            rehashDurationMs: 0,
            cleanupCount: 0
        };
    }

    getHash(normalizedPlate, capacity = this.capacity) {
        if (this.hashMode === 'plate') return plateHash(normalizedPlate, capacity);
        const key = extractNumericSuffix(normalizedPlate);
        return key % capacity;
    }

    getSecondaryStep(normalizedPlate, capacity) {
        let hash = 0;
        for (let index = normalizedPlate.length - 1; index >= 0; index--) {
            hash = (hash * 33 + normalizedPlate.charCodeAt(index)) % capacity;
        }

        let step = (hash % (capacity - 1)) + 1;
        while (greatestCommonDivisor(step, capacity) !== 1) {
            step = step === capacity - 1 ? 1 : step + 1;
        }
        return step;
    }

    getProbeIndex(hashIndex, normalizedPlate, attempt, capacity = this.capacity) {
        if (this.method === 'linear') return (hashIndex + attempt) % capacity;
        if (this.method === 'quadratic') return (hashIndex + attempt * attempt) % capacity;

        const step = this.getSecondaryStep(normalizedPlate, capacity);
        return (hashIndex + attempt * step) % capacity;
    }

    find(normalizedPlate, recordStats = false) {
        const hashIndex = this.getHash(normalizedPlate);
        let probes = 0;

        for (let attempt = 0; attempt < this.capacity; attempt++) {
            const index = this.getProbeIndex(hashIndex, normalizedPlate, attempt);
            const slot = this.slots[index];
            probes++;

            if (slot === SLOT_EMPTY) {
                if (recordStats) {
                    this.stats.unsuccessfulSearches++;
                    this.stats.unsuccessfulSearchProbes += probes;
                }
                return { found: false, index: -1, hashIndex, probes };
            }
            if (slot !== SLOT_TOMBSTONE && slot.normalizedPlate === normalizedPlate) {
                if (recordStats) {
                    this.stats.successfulSearches++;
                    this.stats.successfulSearchProbes += probes;
                }
                return { found: true, index, hashIndex, probes, record: slot };
            }
        }

        if (recordStats) {
            this.stats.unsuccessfulSearches++;
            this.stats.unsuccessfulSearchProbes += probes;
        }
        return { found: false, index: -1, hashIndex, probes };
    }

    search(registrationNumber) {
        const normalizedPlate = normalizePlate(registrationNumber);
        if (!normalizedPlate || extractNumericSuffix(normalizedPlate) === null) {
            return { found: false, error: 'Invalid registration number.', probes: 0 };
        }
        const result = this.find(normalizedPlate, true);
        return {
            ...result,
            registrationNumber: result.record ? result.record.registrationNumber : normalizedPlate
        };
    }

    insert(registrationNumber) {
        const normalizedPlate = normalizePlate(registrationNumber);
        const key = normalizedPlate && extractNumericSuffix(normalizedPlate);
        if (!normalizedPlate || key === null) {
            return { success: false, error: 'Invalid registration number.', probes: 0 };
        }

        let location = this.locateForInsert(normalizedPlate);
        if (location.duplicate) {
            return { success: false, duplicate: true, index: location.index, probes: location.probes };
        }

        if (this.autoResize && (this.activeCount + 1) / this.capacity > this.maxLoadFactor) {
            this.rehash(this.capacity * 2, false);
            location = this.locateForInsert(normalizedPlate);
        } else if (this.cleanupTombstones && this.shouldCleanTombstones()) {
            this.rehash(this.capacity, true);
            location = this.locateForInsert(normalizedPlate);
        }

        while (!location.success && this.autoResize) {
            this.rehash(this.capacity * 2, false);
            location = this.locateForInsert(normalizedPlate);
        }

        if (!location.success) {
            return {
                success: false,
                error: 'No reachable slot is available.',
                hashIndex: location.hashIndex,
                probes: location.probes
            };
        }

        const result = this.insertRecord(registrationNumber, normalizedPlate, key, location);
        if (result.success) {
            this.stats.insertionCount++;
            this.stats.insertionProbes += result.probes;
            this.stats.collisionCount += result.collisions;
        }
        return result;
    }

    locateForInsert(normalizedPlate) {
        const hashIndex = this.getHash(normalizedPlate);
        let firstTombstone = -1;
        let collisions = 0;

        for (let attempt = 0; attempt < this.capacity; attempt++) {
            const index = this.getProbeIndex(hashIndex, normalizedPlate, attempt);
            const slot = this.slots[index];

            if (slot === SLOT_TOMBSTONE) {
                if (firstTombstone === -1) firstTombstone = index;
                continue;
            }
            if (slot === SLOT_EMPTY) {
                const targetIndex = firstTombstone === -1 ? index : firstTombstone;
                return {
                    success: true,
                    index: targetIndex,
                    hashIndex,
                    probes: attempt + 1,
                    collisions,
                    reusedTombstone: firstTombstone !== -1
                };
            }
            if (slot.normalizedPlate === normalizedPlate) {
                return { duplicate: true, index, hashIndex, probes: attempt + 1 };
            }
            collisions++;
        }

        if (firstTombstone !== -1) {
            return {
                success: true,
                index: firstTombstone,
                hashIndex,
                probes: this.capacity,
                collisions,
                reusedTombstone: true
            };
        }

        return { success: false, error: 'No reachable slot is available.', hashIndex, probes: this.capacity, collisions };
    }

    insertRecord(registrationNumber, normalizedPlate, key, location) {
        this.slots[location.index] = {
            status: 'OCCUPIED',
            registrationNumber: registrationNumber.trim().toUpperCase(),
            normalizedPlate,
            key,
            hashIndex: location.hashIndex,
            method: this.method,
            insertionOrder: this.nextInsertionOrder++
        };
        this.activeCount++;
        if (location.reusedTombstone) this.tombstoneCount--;
        return {
            success: true,
            index: location.index,
            hashIndex: location.hashIndex,
            probes: location.probes,
            collisions: location.collisions
        };
    }
    delete(registrationNumber) {
        const normalizedPlate = normalizePlate(registrationNumber);
        if (!normalizedPlate || extractNumericSuffix(normalizedPlate) === null) {
            return { success: false, error: 'Invalid registration number.', probes: 0 };
        }

        const result = this.find(normalizedPlate);
        this.stats.deletionProbes += result.probes;
        if (!result.found) return { success: false, probes: result.probes };

        this.slots[result.index] = SLOT_TOMBSTONE;
        this.activeCount--;
        this.tombstoneCount++;
        this.stats.deletions++;

        let cleanup = null;
        if (this.cleanupTombstones && this.shouldCleanTombstones()) {
            cleanup = this.rehash(this.capacity, true);
        }

        return { success: true, index: result.index, probes: result.probes, cleanup };
    }

    shouldCleanTombstones() {
        return this.tombstoneCount > 0 &&
            this.tombstoneCount / this.capacity >= this.tombstoneThreshold;
    }

    rehash(newCapacity, cleanup) {
        const startedAt = process.hrtime.bigint();
        const records = this.slots
            .filter(slot => slot && slot !== SLOT_TOMBSTONE)
            .sort((left, right) => left.insertionOrder - right.insertionOrder);
        let candidateCapacity = newCapacity;
        let rebuilt;

        while (true) {
            rebuilt = new Array(candidateCapacity).fill(SLOT_EMPTY);
            let allInserted = true;

            for (const record of records) {
                const hashIndex = this.getHash(record.normalizedPlate, candidateCapacity);
                let inserted = false;
                for (let attempt = 0; attempt < candidateCapacity; attempt++) {
                    const index = this.getProbeIndex(hashIndex, record.normalizedPlate, attempt, candidateCapacity);
                    if (rebuilt[index] === SLOT_EMPTY) {
                        rebuilt[index] = { ...record, hashIndex };
                        inserted = true;
                        break;
                    }
                }
                if (!inserted) {
                    allInserted = false;
                    break;
                }
            }

            if (allInserted) break;
            if (!this.autoResize || candidateCapacity === newCapacity && cleanup) {
                throw new Error(`Rehash could not place every active vehicle at capacity ${candidateCapacity}.`);
            }
            candidateCapacity *= 2;
        }

        this.slots = rebuilt;
        this.capacity = candidateCapacity;
        this.tombstoneCount = 0;
        const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        this.stats.rehashCount++;
        this.stats.rehashDurationMs += elapsedMs;
        if (cleanup) this.stats.cleanupCount++;

        return { capacity: this.capacity, durationMs: elapsedMs };
    }

    getStatistics() {
        return {
            initialCapacity: this.initialCapacity,
            capacity: this.capacity,
            activeCount: this.activeCount,
            tombstoneCount: this.tombstoneCount,
            loadFactor: this.activeCount / this.capacity,
            hashMode: this.hashMode,
            method: this.method,
            ...this.stats
        };
    }
}

ResearchHashTable.normalizePlate = normalizePlate;
ResearchHashTable.plateHash = plateHash;
ResearchHashTable.HASH_MODES = HASH_MODES;
ResearchHashTable.PROBE_METHODS = PROBE_METHODS;

module.exports = ResearchHashTable;
