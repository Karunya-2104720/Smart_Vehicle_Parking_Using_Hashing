const assert = require('assert');
const ResearchHashTable = require('../algorithms/researchHashTable');
const {
    normalizePlate,
    extractNumericSuffix,
    plateHash
} = require('../models/vehicleRegistration');

function platesWithSameHash(capacity, count) {
    const groups = new Array(capacity);
    for (let index = 0; index < capacity; index++) groups[index] = [];

    for (let serial = 1; serial < 10000; serial++) {
        const plate = `KA03AB${String(serial).padStart(4, '0')}`;
        const index = plateHash(normalizePlate(plate), capacity);
        groups[index].push(plate);
        if (groups[index].length === count) return groups[index];
    }
    throw new Error(`Could not find ${count} colliding plates.`);
}

function runTest(name, callback) {
    callback();
    console.log(`PASS ${name}`);
}

runTest('plate normalization removes permitted separators and ignores case', () => {
    assert.strictEqual(normalizePlate('ka 03 ab 1234'), 'KA03AB1234');
    assert.strictEqual(normalizePlate('KA-03-AB-1234'), 'KA03AB1234');
    assert.strictEqual(normalizePlate('KA03AB1234'), 'KA03AB1234');
});

runTest('invalid registrations and unsafe numeric suffixes are rejected', () => {
    assert.strictEqual(normalizePlate(''), null);
    assert.strictEqual(normalizePlate('NO_NUMBERS_HERE'), null);
    assert.strictEqual(normalizePlate('KA/03/AB/1234'), null);
    assert.strictEqual(extractNumericSuffix('KA03AB1234'), 1234);
    assert.strictEqual(extractNumericSuffix('KA03AB999999999999999999'), null);
});

runTest('plate hash is deterministic, bounded, and uses all normalized characters', () => {
    const capacity = 97;
    const first = normalizePlate('KA03AB1234');
    const second = normalizePlate('MH12CD1234');
    const hash = plateHash(first, capacity);
    assert(Number.isInteger(hash) && hash >= 0 && hash < capacity);
    assert.strictEqual(plateHash(first, capacity), hash);
    assert.notStrictEqual(first, second);
    assert.notStrictEqual(plateHash(first, capacity), plateHash(second, capacity));
});

runTest('same-suffix plates remain separate registrations', () => {
    const table = new ResearchHashTable({ capacity: 31, hashMode: 'plate' });
    assert.strictEqual(table.insert('KA03AB1234').success, true);
    assert.strictEqual(table.insert('MH12CD1234').success, true);
    assert.strictEqual(table.search('KA03AB1234').found, true);
    assert.strictEqual(table.search('MH12CD1234').found, true);
    assert.strictEqual(table.insert('ka 03 ab 1234').duplicate, true);
});

runTest('deletion tombstones preserve a collision chain and are safely reused', () => {
    const table = new ResearchHashTable({ capacity: 17, hashMode: 'plate', method: 'linear' });
    const [first, second, third, replacement] = platesWithSameHash(17, 4);
    const firstResult = table.insert(first);
    const secondResult = table.insert(second);
    const thirdResult = table.insert(third);
    assert.deepStrictEqual([firstResult.index, secondResult.index, thirdResult.index],
        [firstResult.index, firstResult.index + 1, firstResult.index + 2]);

    assert.strictEqual(table.delete(first).success, true);
    assert.strictEqual(table.search(third).found, true);
    const replacementResult = table.insert(replacement);
    assert.strictEqual(replacementResult.success, true);
    assert.strictEqual(replacementResult.index, firstResult.index);
    assert.strictEqual(table.search(second).found, true);
});

runTest('resizing preserves all records and updates each stored slot', () => {
    const table = new ResearchHashTable({
        capacity: 11,
        hashMode: 'plate',
        autoResize: true,
        maxLoadFactor: 0.5
    });
    const registrations = Array.from({ length: 20 }, (_, index) =>
        `TN09AB${String(index + 1000).padStart(4, '0')}`);

    registrations.forEach(registration => assert.strictEqual(table.insert(registration).success, true));
    assert(table.capacity > 11);
    registrations.forEach(registration => assert.strictEqual(table.search(registration).found, true));
    assert.strictEqual(table.activeCount, registrations.length);
    assert.strictEqual(table.getStatistics().rehashCount > 0, true);
    const occupiedSlots = table.slots.filter(slot => slot && slot.status === 'OCCUPIED');
    assert.strictEqual(occupiedSlots.length, registrations.length);
});

runTest('double hashing can reach every slot at composite and prime capacities', () => {
    for (const capacity of [70, 71]) {
        const table = new ResearchHashTable({
            capacity,
            hashMode: 'plate',
            method: 'double'
        });
        for (let index = 0; index < capacity; index++) {
            const result = table.insert(`KA${String(index % 99).padStart(2, '0')}AB${String(index + 1000).padStart(5, '0')}`);
            assert.strictEqual(result.success, true, `Expected insertion at capacity ${capacity}`);
        }
        assert.strictEqual(table.activeCount, capacity);
    }
});

runTest('cleanup clears tombstones without losing active registrations', () => {
    const table = new ResearchHashTable({
        capacity: 31,
        hashMode: 'plate',
        cleanupTombstones: true,
        tombstoneThreshold: 0.03
    });
    const registrations = platesWithSameHash(31, 5);
    registrations.forEach(registration => table.insert(registration));
    table.delete(registrations[0]);

    assert.strictEqual(table.tombstoneCount, 0);
    assert.strictEqual(table.getStatistics().cleanupCount, 1);
    registrations.slice(1).forEach(registration => {
        assert.strictEqual(table.search(registration).found, true);
    });
});

runTest('quadratic-probing cleanup can rehash records in original insertion order', () => {
    const table = new ResearchHashTable({
        capacity: 31,
        hashMode: 'plate',
        method: 'quadratic',
        cleanupTombstones: true,
        tombstoneThreshold: 0.03
    });
    const registrations = platesWithSameHash(31, 6);
    registrations.forEach(registration => assert.strictEqual(table.insert(registration).success, true));
    assert.strictEqual(table.delete(registrations[0]).success, true);
    assert.strictEqual(table.tombstoneCount, 0);
    registrations.slice(1).forEach(registration => assert.strictEqual(table.search(registration).found, true));
});

runTest('repeated deletion does not decrement active count twice', () => {
    const table = new ResearchHashTable({ capacity: 17 });
    table.insert('KA03AB1234');
    assert.strictEqual(table.delete('KA03AB1234').success, true);
    assert.strictEqual(table.delete('KA03AB1234').success, false);
    assert.strictEqual(table.activeCount, 0);
    assert.strictEqual(table.stats.deletions, 1);
});

runTest('randomized operations preserve active records against a reference set', () => {
    const table = new ResearchHashTable({
        capacity: 23,
        hashMode: 'plate',
        method: 'linear',
        autoResize: true,
        cleanupTombstones: true,
        maxLoadFactor: 0.65,
        tombstoneThreshold: 0.15
    });
    const reference = new Set();
    let seed = 73421;

    function randomIndex(maximum) {
        seed = (seed * 48271) % 2147483647;
        return seed % maximum;
    }

    for (let operation = 0; operation < 1500; operation++) {
        const registration = `KA${String(randomIndex(99)).padStart(2, '0')}AB${String(randomIndex(500)).padStart(4, '0')}`;
        const normalized = normalizePlate(registration);
        const action = randomIndex(3);

        if (action === 0) {
            const expectedNew = !reference.has(normalized);
            const result = table.insert(registration);
            assert.strictEqual(result.success, expectedNew);
            if (expectedNew) reference.add(normalized);
        } else if (action === 1) {
            const expectedFound = reference.has(normalized);
            const result = table.delete(registration);
            assert.strictEqual(result.success, expectedFound);
            if (expectedFound) reference.delete(normalized);
        } else {
            assert.strictEqual(table.search(registration).found, reference.has(normalized));
        }

        assert.strictEqual(table.activeCount, reference.size);
        for (const activeRegistration of reference) {
            assert.strictEqual(table.search(activeRegistration).found, true);
        }
    }
});

console.log('All research hash-table tests passed.');
