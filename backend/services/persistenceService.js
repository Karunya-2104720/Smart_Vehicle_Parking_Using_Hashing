/**
 * Persistence Service
 * Reads and writes parking state and statistics to JSON storage.
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE_PATH = path.join(__dirname, '..', 'data', 'parkingData.json');

class PersistenceService {
    static ensureDataDirectory() {
        const dir = path.dirname(DATA_FILE_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Saves hash table array state and statistics to disk.
     */
    static save(hashTableInstance) {
        try {
            this.ensureDataDirectory();
            const data = {
                tableSize: hashTableInstance.tableSize,
                secondaryPrime: hashTableInstance.secondaryPrime,
                slots: hashTableInstance.table,
                stats: hashTableInstance.stats,
                savedAt: new Date().toISOString()
            };
            fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (err) {
            console.error('[PersistenceService] Error saving parking data:', err.message);
            return false;
        }
    }

    /**
     * Loads hash table array state and statistics from disk.
     */
    static load(hashTableInstance) {
        try {
            this.ensureDataDirectory();
            if (!fs.existsSync(DATA_FILE_PATH)) {
                return false;
            }

            const raw = fs.readFileSync(DATA_FILE_PATH, 'utf8');
            const parsed = JSON.parse(raw);

            const savedTableSize = parsed && parsed.tableSize;
            const tableSizeChanged = Number.isInteger(savedTableSize) &&
                savedTableSize !== hashTableInstance.tableSize;

            if (tableSizeChanged && Array.isArray(parsed.slots)) {
                const savedStats = parsed.stats;
                parsed.slots.forEach(slot => {
                    if (!slot || slot.status !== 'OCCUPIED' || !slot.registrationNumber) return;

                    const method = ['basic', 'linear', 'quadratic', 'double'].includes(slot.methodUsed)
                        ? slot.methodUsed
                        : 'linear';
                    const result = hashTableInstance.parkCar(slot.registrationNumber, method, slot.color);
                    if (!result.success) {
                        throw new Error(`Could not restore ${slot.registrationNumber} after changing table size.`);
                    }
                });

                if (savedStats) {
                    hashTableInstance.stats = { ...hashTableInstance.stats, ...savedStats };
                }
                if (!this.save(hashTableInstance)) {
                    throw new Error('Could not persist migrated parking state.');
                }
                console.log(`[PersistenceService] Migrated saved parking state from ${savedTableSize} to ${hashTableInstance.tableSize} slots.`);
                return true;
            }

            if (parsed && Array.isArray(parsed.slots)) {
                // Restore slots array
                for (let i = 0; i < hashTableInstance.tableSize; i++) {
                    hashTableInstance.table[i] = parsed.slots[i] !== undefined ? parsed.slots[i] : null;
                }
            }

            if (parsed && parsed.stats) {
                hashTableInstance.stats = { ...hashTableInstance.stats, ...parsed.stats };
            }

            return true;
        } catch (err) {
            console.error('[PersistenceService] Error loading parking data:', err.message);
            return false;
        }
    }

    /**
     * Resets file storage to empty state.
     */
    static reset(tableSize = 70) {
        try {
            this.ensureDataDirectory();
            const emptyData = {
                tableSize,
                slots: new Array(tableSize).fill(null),
                stats: {
                    totalCollisions: 0,
                    totalProbes: 0,
                    totalSearches: 0,
                    successfulSearches: 0,
                    failedSearches: 0,
                    totalSearchProbes: 0
                },
                savedAt: new Date().toISOString()
            };
            fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(emptyData, null, 2), 'utf8');
            return true;
        } catch (err) {
            console.error('[PersistenceService] Error resetting parking data file:', err.message);
            return false;
        }
    }
}

module.exports = PersistenceService;
