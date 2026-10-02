/**
 * Linear Probing Algorithm
 * Formula: index = (hash(key) + i) % tableSize
 * where i = 0, 1, 2, ...
 */

/**
 * Computes slot index for linear probe attempt i.
 * @param {number} key
 * @param {number} i 
 * @param {number} tableSize 
 * @returns {number}
 */
function getLinearProbeIndex(key, i, tableSize) {
    const hash = Math.abs(key) % tableSize;
    return (hash + i) % tableSize;
}

/**
 * Simulates probing for an insertion slot on the table array.
 * 
 * @param {Array} parkingTable - Array representing hash table slots
 * @param {number} key - Numeric key
 * @param {number} tableSize - Table size (default 47)
 * @returns {Object} Probing execution result with step-by-step audit
 */
function linearProbe(parkingTable, key, tableSize) {
    const hashIndex = Math.abs(key) % tableSize;
    const steps = [];
    let finalIndex = -1;
    let collision = false;
    let firstTombstoneIndex = -1;

    for (let i = 0; i < tableSize; i++) {
        const index = getLinearProbeIndex(key, i, tableSize);
        const slot = parkingTable[index];

        if (slot === null) {
            // Found empty slot
            const targetIndex = firstTombstoneIndex !== -1 ? firstTombstoneIndex : index;
            steps.push({
                attempt: i + 1,
                probeStep: i,
                index,
                formula: `(${hashIndex} + ${i}) % ${tableSize} = ${index}`,
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
                formula: `(${hashIndex} + ${i}) % ${tableSize} = ${index}`,
                status: 'TOMBSTONE'
            });
        } else if (slot.status === 'OCCUPIED') {
            collision = true;
            steps.push({
                attempt: i + 1,
                probeStep: i,
                index,
                formula: `(${hashIndex} + ${i}) % ${tableSize} = ${index}`,
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
        hashIndex,
        probes: steps.length,
        collision,
        steps
    };
}

module.exports = {
    getLinearProbeIndex,
    linearProbe
};
