/**
 * Double Hashing Algorithm
 * Primary Hash: h1(key) = key % tableSize
 * Secondary Hash: a key-dependent step co-prime with tableSize
 * Final Index: (h1(key) + i * h2(key)) % tableSize
 * where i = 0, 1, 2, ...
 */

/**
 * Primary hash function.
 */
function primaryHash(key, tableSize) {
    return Math.abs(key) % tableSize;
}

/**
 * Secondary hash function.
 * Ensures non-zero step size co-prime to tableSize.
 * @param {number} key 
 * @param {number} secondaryPrime - Seed used to derive a step co-prime with tableSize
 * @returns {number} Non-zero step multiplier
 */
function secondaryHash(key, secondaryPrime = 67, tableSize = 70) {
    let step = secondaryPrime - (Math.abs(key) % secondaryPrime);
    while (greatestCommonDivisor(step, tableSize) !== 1) {
        step = step === 1 ? secondaryPrime : step - 1;
    }
    return step;
}

function greatestCommonDivisor(a, b) {
    while (b !== 0) {
        [a, b] = [b, a % b];
    }
    return a;
}

/**
 * Computes slot index for double hash probe attempt i.
 */
function getDoubleHashProbeIndex(key, i, tableSize, secondaryPrime = 67) {
    const h1 = primaryHash(key, tableSize);
    const h2 = secondaryHash(key, secondaryPrime, tableSize);
    return (h1 + (i * h2)) % tableSize;
}

/**
 * Simulates double hashing probing for an insertion slot.
 * 
 * @param {Array} parkingTable - Array representing hash table slots
 * @param {number} key - Numeric key
 * @param {number} tableSize - Table size (default 70)
 * @param {number} secPrime - Secondary prime seed (default 67)
 * @returns {Object} Probing execution result with step-by-step audit
 */
function doubleHashProbe(parkingTable, key, tableSize, secPrime = 67) {
    const h1 = primaryHash(key, tableSize);
    const h2 = secondaryHash(key, secPrime, tableSize);
    const steps = [];
    let finalIndex = -1;
    let collision = false;
    let firstTombstoneIndex = -1;

    for (let i = 0; i < tableSize; i++) {
        const index = (h1 + (i * h2)) % tableSize;
        const slot = parkingTable[index];

        if (slot === null) {
            const targetIndex = firstTombstoneIndex !== -1 ? firstTombstoneIndex : index;
            steps.push({
                attempt: i + 1,
                probeStep: i,
                index,
                formula: `(${h1} + ${i} × ${h2}) % ${tableSize} = (${h1} + ${i * h2}) % ${tableSize} = ${index}`,
                status: 'AVAILABLE'
            });
            finalIndex = targetIndex;
            break;
        } else if (slot.status === 'TOMBSTONE') {
            if (firstTombstoneIndex === -1) {
                firstTombstoneIndex = index;
            }
            steps.push({
                attempt: i + 1,
                probeStep: i,
                index,
                formula: `(${h1} + ${i} × ${h2}) % ${tableSize} = (${h1} + ${i * h2}) % ${tableSize} = ${index}`,
                status: 'TOMBSTONE'
            });
        } else if (slot.status === 'OCCUPIED') {
            collision = true;
            steps.push({
                attempt: i + 1,
                probeStep: i,
                index,
                formula: `(${h1} + ${i} × ${h2}) % ${tableSize} = (${h1} + ${i * h2}) % ${tableSize} = ${index}`,
                status: 'OCCUPIED',
                occupiedBy: slot.registrationNumber,
                occupiedKey: slot.key
            });
        }
    }

    if (finalIndex === -1 && firstTombstoneIndex !== -1) {
        finalIndex = firstTombstoneIndex;
    }

    return {
        success: finalIndex !== -1,
        finalIndex,
        key,
        primaryHash: h1,
        secondaryHash: h2,
        probes: steps.length,
        collision,
        steps
    };
}

module.exports = {
    primaryHash,
    secondaryHash,
    getDoubleHashProbeIndex,
    doubleHashProbe
};
