/**
 * Parking Business Service
 * Integrates HashTable data structure with persistence and algorithmic explanations.
 */

const HashTable = require('../algorithms/hashTable');
const PersistenceService = require('./persistenceService');

const DEFAULT_TABLE_SIZE = parseInt(process.env.TABLE_SIZE, 10) || 47;
const DEFAULT_SECONDARY_PRIME = parseInt(process.env.SECONDARY_PRIME, 10) || 43;

class ParkingService {
    constructor() {
        this.hashTable = new HashTable(DEFAULT_TABLE_SIZE, DEFAULT_SECONDARY_PRIME);
        this.initialized = false;
        this.init();
    }

    init() {
        if (!this.initialized) {
            const loaded = PersistenceService.load(this.hashTable);
            if (loaded) {
                console.log(`[ParkingService] Restored parking lot state (${this.hashTable.getOccupiedCount()}/${this.hashTable.tableSize} occupied).`);
            } else {
                console.log(`[ParkingService] Initialized new parking lot with ${this.hashTable.tableSize} slots.`);
                PersistenceService.save(this.hashTable);
            }
            this.initialized = true;
        }
    }

    parkCar(registrationNumber, method = 'linear', color = '#3b82f6') {
        const result = this.hashTable.parkCar(registrationNumber, method, color);
        if (result.success) {
            PersistenceService.save(this.hashTable);
        }
        return result;
    }

    searchCar(registrationNumber, method = 'linear') {
        return this.hashTable.searchCar(registrationNumber, method);
    }

    deleteCar(registrationNumber, method = 'linear') {
        const result = this.hashTable.deleteCar(registrationNumber, method);
        if (result.success) {
            PersistenceService.save(this.hashTable);
        }
        return result;
    }

    getParkingStatus() {
        return this.hashTable.getParkingStatus();
    }

    getStatistics() {
        return this.hashTable.getStatistics();
    }

    resetParking() {
        this.hashTable.reset();
        PersistenceService.reset(this.hashTable.tableSize);
        return {
            success: true,
            message: 'Parking lot successfully reset to empty state.',
            table: this.hashTable.getParkingStatus()
        };
    }

    simulate(registrationNumbers, method = 'linear') {
        return this.hashTable.simulate(registrationNumbers, method);
    }

    compare(registrationNumbers) {
        return this.hashTable.compareAll(registrationNumbers);
    }

    getAlgorithmInfo(method) {
        const info = {
            basic: {
                name: 'Direct Hashing (Basic Hash Table)',
                formula: `index = key % ${this.hashTable.tableSize}`,
                description: 'Inserts directly into the calculated slot. When two keys produce identical remainder, a collision occurs with no resolution.',
                clustering: 'None (Rejects or overwrites on collision)',
                complexity: {
                    averageSearch: 'O(1)',
                    worstCaseSearch: 'O(1) (when uncollided)'
                }
            },
            linear: {
                name: 'Linear Probing',
                formula: `index = (hash(key) + i) % ${this.hashTable.tableSize}`,
                description: 'When a collision occurs, sequentially searches the next slot (i = 0, 1, 2, ...).',
                clustering: 'Primary Clustering (Consecutive occupied blocks tend to merge and grow larger)',
                complexity: {
                    averageSearch: 'O(1)',
                    worstCaseSearch: 'O(n)'
                }
            },
            quadratic: {
                name: 'Quadratic Probing',
                formula: `index = (hash(key) + i²) % ${this.hashTable.tableSize}`,
                description: 'Searches using quadratic increments (1, 4, 9, 16...) to jump over contiguous blocks.',
                clustering: 'Secondary Clustering (Keys with identical initial hash follow identical probe sequences)',
                complexity: {
                    averageSearch: 'O(1)',
                    worstCaseSearch: 'O(n)'
                }
            },
            double: {
                name: 'Double Hashing',
                formula: `index = (h1(key) + i × h2(key)) % ${this.hashTable.tableSize}`,
                primaryFormula: `h1(key) = key % ${this.hashTable.tableSize}`,
                secondaryFormula: `h2(key) = ${this.hashTable.secondaryPrime} - (key % ${this.hashTable.secondaryPrime})`,
                description: 'Applies a secondary hash function to calculate a distinct step multiplier for each key, achieving uniform distribution.',
                clustering: 'Minimal / Uniform Hashing (Eliminates both primary and secondary clustering)',
                complexity: {
                    averageSearch: 'O(1)',
                    worstCaseSearch: 'O(n)'
                }
            }
        };

        return info[method.toLowerCase()] || null;
    }
}

// Singleton export
module.exports = new ParkingService();
