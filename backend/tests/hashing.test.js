/**
 * Automated Unit Test Suite for Hashing Algorithms
 * Tests pure data structures, collision resolution, tombstones, and capacity limits.
 */

const assert = require('assert');
const HashTable = require('../algorithms/hashTable');
const Car = require('../models/car');
const { linearProbe, getLinearProbeIndex } = require('../algorithms/linearProbing');
const { quadraticProbe, getQuadraticProbeIndex } = require('../algorithms/quadraticProbing');
const { doubleHashProbe, getDoubleHashProbeIndex, primaryHash, secondaryHash } = require('../algorithms/doubleHashing');

console.log("=================================================");
console.log("🧪 RUNNING SMART PARKING HASHING ALGORITHM TESTS");
console.log("=================================================\n");

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
    totalCount++;
    try {
        fn();
        console.log(`✅ [PASS] ${name}`);
        passedCount++;
    } catch (err) {
        console.error(`❌ [FAIL] ${name}`);
        console.error(`   Error: ${err.message}`);
    }
}

// 1. Key Extraction Test
runTest("Key Extraction: Extracts numeric portion from various license plates", () => {
    assert.strictEqual(Car.extractKey("TN 09 AB 1021"), 1021);
    assert.strictEqual(Car.extractKey("TN09AB1021"), 1021);
    assert.strictEqual(Car.extractKey("KA 01 MN 4567"), 4567);
    assert.strictEqual(Car.extractKey("MH 12 XY 9821"), 9821);
    assert.strictEqual(Car.extractKey("99"), 99);
    assert.strictEqual(Car.extractKey(1021), 1021);
    assert.strictEqual(Car.extractKey("NO_NUMBERS_HERE"), null);
});

// 2. Hash Function Test
runTest("Hash Function: key % tableSize", () => {
    const table47 = new HashTable(47, 43);
    const h47 = table47.hash(1021);
    assert.strictEqual(h47.hashIndex, 1021 % 47); // 34

    const table11 = new HashTable(11, 7);
    const h11 = table11.hash(1021);
    assert.strictEqual(h11.hashIndex, 1021 % 11); // 9
});

// 3. Collision Detection Test
runTest("Collision Detection: Detects when multiple keys map to same slot", () => {
    const table = new HashTable(47, 43);
    // Keys with identical % 47: 15 and (15 + 47) = 62
    const res1 = table.parkCar("CAR-15", "linear");
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.finalSlot, 15);
    assert.strictEqual(res1.collision, false);

    const res2 = table.parkCar("CAR-62", "linear");
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.collision, true);
    assert.strictEqual(res2.finalSlot, 16); // Placed at next slot
});

// 4. Linear Probing Sequence Test
runTest("Linear Probing: index = (hash(key) + i) % tableSize", () => {
    const table = new HashTable(47, 43);
    // Park in slot 46 (last slot)
    const p1 = table.parkCar("CAR-46", "linear"); // 46 % 47 = 46
    assert.strictEqual(p1.finalSlot, 46);

    // Collision at 46, should wrap around to index 0!
    const p2 = table.parkCar("CAR-93", "linear"); // 93 % 47 = 46
    assert.strictEqual(p2.finalSlot, 0); // Wrapped around to 0
    assert.strictEqual(p2.probes, 2);

    // Another collision at 46, should probe 46 -> 0 (occ) -> 1
    const p3 = table.parkCar("CAR-140", "linear"); // 140 % 47 = 46
    assert.strictEqual(p3.finalSlot, 1);
    assert.strictEqual(p3.probes, 3);
});

// 5. Quadratic Probing Sequence Test
runTest("Quadratic Probing: index = (hash(key) + i²) % tableSize", () => {
    const table = new HashTable(47, 43);
    // Park at slot 5
    table.parkCar("CAR-5", "quadratic"); // slot 5

    // Collision at slot 5:
    // i=0: 5 (occupied)
    // i=1: (5 + 1) % 47 = 6
    const p2 = table.parkCar("CAR-52", "quadratic"); // 52 % 47 = 5
    assert.strictEqual(p2.finalSlot, 6);

    // Another collision at slot 5:
    // i=0: 5 (occ)
    // i=1: (5 + 1) = 6 (occ)
    // i=2: (5 + 4) = 9
    const p3 = table.parkCar("CAR-99", "quadratic"); // 99 % 47 = 5
    assert.strictEqual(p3.finalSlot, 9);
    assert.strictEqual(p3.probes, 3);
});

// 6. Double Hashing Test
runTest("Double Hashing: h1 = key % 47, h2 = 43 - (key % 43), index = (h1 + i * h2) % 47", () => {
    const table = new HashTable(47, 43);
    const key1 = 5;  // 5 % 47 = 5, h2 = 43 - (5 % 43) = 38
    const key2 = 52; // 52 % 47 = 5, h2 = 43 - (52 % 43) = 43 - 9 = 34

    table.parkCar("CAR-5", "double"); // parks at 5

    const p2 = table.parkCar("CAR-52", "double");
    // i=0: 5 (occ)
    // i=1: (5 + 1 * 34) % 47 = 39 % 47 = 39
    assert.strictEqual(p2.finalSlot, 39);
    assert.strictEqual(p2.probes, 2);
});

// 7. Search Operation Test
runTest("Search Operation: Finds parked car and reports probe sequence", () => {
    const table = new HashTable(47, 43);
    table.parkCar("TN 09 AB 1021", "linear");
    table.parkCar("KA 01 MN 4567", "linear");

    const s1 = table.searchCar("TN 09 AB 1021", "linear");
    assert.strictEqual(s1.found, true);
    assert.strictEqual(s1.registrationNumber, "TN 09 AB 1021");

    const s2 = table.searchCar("NOT_PARKED_9999", "linear");
    assert.strictEqual(s2.found, false);
});

// 8. Search Uses the Car's Insertion Method and Exact Registration
runTest("Search: Finds mixed-method cars and distinguishes registrations with the same key", () => {
    const mixedMethods = new HashTable(47, 43);
    mixedMethods.parkCar("CAR-5", "linear");
    mixedMethods.parkCar("CAR-52", "linear");
    mixedMethods.parkCar("CAR-99", "linear");

    const mixedSearch = mixedMethods.searchCar("CAR-99", "quadratic");
    assert.strictEqual(mixedSearch.found, true);
    assert.strictEqual(mixedSearch.foundAt, 7);
    assert.strictEqual(mixedSearch.method, "linear");

    const sameKey = new HashTable(11, 7);
    sameKey.parkCar("CAR-5", "linear");
    sameKey.parkCar("TN 09 AB 5", "linear");

    const exactSearch = sameKey.searchCar("TN 09 AB 5", "linear");
    assert.strictEqual(exactSearch.found, true);
    assert.strictEqual(exactSearch.registrationNumber, "TN 09 AB 5");
    assert.strictEqual(exactSearch.foundAt, 6);

    const invalidSearch = sameKey.searchCar("TN 09 AB 5", "unsupported");
    assert.strictEqual(invalidSearch.found, false);
    assert.strictEqual(invalidSearch.statusCode, 400);

    const invalidDelete = sameKey.deleteCar("TN 09 AB 5", "unsupported");
    assert.strictEqual(invalidDelete.success, false);
    assert.strictEqual(invalidDelete.statusCode, 400);
});

// 9. Delete Operation & Tombstone Search Continuity
runTest("Delete & Tombstone: Deleting does not break subsequent search chains", () => {
    const table = new HashTable(47, 43);
    // Key 10 maps to slot 10
    // Key 57 maps to slot 10 -> placed in slot 11
    // Key 104 maps to slot 10 -> placed in slot 12
    table.parkCar("CAR-10", "linear");
    table.parkCar("CAR-57", "linear");
    table.parkCar("CAR-104", "linear");

    // Remove middle car CAR-57 from slot 11
    const delRes = table.deleteCar("CAR-57", "linear");
    assert.strictEqual(delRes.success, true);
    assert.strictEqual(delRes.deletedSlot, 11);
    assert.strictEqual(table.table[11].status, 'TOMBSTONE');

    // Search for CAR-104 (in slot 12): Must skip past slot 11 (tombstone) and find CAR-104!
    const searchAfterDelete = table.searchCar("CAR-104", "linear");
    assert.strictEqual(searchAfterDelete.found, true);
    assert.strictEqual(searchAfterDelete.foundAt, 12);
});

// 10. Full Table Overflow Prevention
runTest("Full Table: Rejects insertions when 100% capacity is reached", () => {
    const smallTable = new HashTable(5, 3);
    smallTable.parkCar("CAR-1", "linear");
    smallTable.parkCar("CAR-2", "linear");
    smallTable.parkCar("CAR-3", "linear");
    smallTable.parkCar("CAR-4", "linear");
    smallTable.parkCar("CAR-5", "linear");

    // 6th car should fail
    const overflow = smallTable.parkCar("CAR-6", "linear");
    assert.strictEqual(overflow.success, false);
    assert.strictEqual(overflow.statusCode, 409);
});

// 11. Duplicate Registration Prevention
runTest("Duplicate Registration: Prevents same car from being parked twice", () => {
    const table = new HashTable(47, 43);
    const p1 = table.parkCar("TN 09 AB 1021", "linear");
    assert.strictEqual(p1.success, true);

    const p2 = table.parkCar("TN 09 AB 1021", "linear");
    assert.strictEqual(p2.success, false);
    assert.strictEqual(p2.statusCode, 409);
});

console.log("\n=================================================");
console.log(`📊 TEST SUMMARY: ${passedCount} / ${totalCount} PASSED`);
console.log("=================================================");

if (passedCount !== totalCount) {
    process.exit(1);
}
