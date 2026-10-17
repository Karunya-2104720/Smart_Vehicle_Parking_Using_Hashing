/**
 * Registration normalization shared by the research hash table and benchmarks.
 */

function normalizePlate(registrationNumber) {
    if (typeof registrationNumber !== 'string') return null;

    const trimmed = registrationNumber.trim().toUpperCase();
    if (!trimmed || !/^[A-Z0-9 -]+$/.test(trimmed)) return null;

    const normalized = trimmed.replace(/[\s-]+/g, '');
    if (!normalized || !/\d/.test(normalized)) return null;

    return normalized;
}

function extractNumericSuffix(normalizedPlate) {
    const groups = normalizedPlate.match(/\d+/g);
    if (!groups || groups.length === 0) return null;

    const suffix = Number(groups[groups.length - 1]);
    return Number.isSafeInteger(suffix) ? suffix : null;
}

function plateHash(normalizedPlate, capacity) {
    if (!Number.isInteger(capacity) || capacity < 1) {
        throw new RangeError('Hash capacity must be a positive integer.');
    }

    let hash = 0;
    for (const character of normalizedPlate) {
        hash = (hash * 31 + character.charCodeAt(0)) % capacity;
    }
    return hash;
}

module.exports = {
    normalizePlate,
    extractNumericSuffix,
    plateHash
};
