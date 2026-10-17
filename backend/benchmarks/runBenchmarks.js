#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const ResearchHashTable = require('../algorithms/researchHashTable');

const QUICK = process.argv.includes('--quick');
const OUTPUT_DIRECTORY = path.join(__dirname, 'results');
const CONFIG = QUICK ? {
    capacities: [101, 257],
    loadFactors: [0.25, 0.55, 0.8],
    workloads: ['random', 'shared-suffix', 'burst-arrivals'],
    hashModes: ['division', 'plate'],
    methods: ['linear', 'double'],
    policies: [
        { name: 'fixed-no-cleanup', autoResize: false, cleanupTombstones: false },
        { name: 'fixed-cleanup', autoResize: false, cleanupTombstones: true },
        { name: 'adaptive-no-cleanup', autoResize: true, cleanupTombstones: false },
        { name: 'adaptive-cleanup', autoResize: true, cleanupTombstones: true }
    ],
    trials: 1,
    seed: 20261015
} : {
    capacities: [1024, 10000, 100000],
    loadFactors: [0.25, 0.5, 0.7, 0.8, 0.9],
    workloads: ['random', 'shared-district', 'shared-suffix', 'burst-arrivals'],
    hashModes: ['division', 'plate'],
    methods: ['linear', 'double'],
    policies: [
        { name: 'fixed-no-cleanup', autoResize: false, cleanupTombstones: false },
        { name: 'adaptive-cleanup', autoResize: true, cleanupTombstones: true }
    ],
    trials: 2,
    seed: 20261015
};

function makeRandom(seed) {
    let state = seed % 2147483647;
    return () => {
        state = (state * 48271) % 2147483647;
        return state / 2147483647;
    };
}

function toLetters(value) {
    let remaining = value;
    let result = '';
    do {
        result = String.fromCharCode(65 + (remaining % 26)) + result;
        remaining = Math.floor(remaining / 26) - 1;
    } while (remaining >= 0);
    return result;
}

function createWorkload(workload, count, seed) {
    const random = makeRandom(seed);
    const registrations = new Array(count);

    for (let index = 0; index < count; index++) {
        if (workload === 'shared-district') {
            registrations[index] = `KA03AB${String(index).padStart(6, '0')}`;
        } else if (workload === 'shared-suffix') {
            const district = String(index % 99).padStart(2, '0');
            const series = toLetters(Math.floor(index / 99));
            registrations[index] = `KA${district}${series}1234`;
        } else if (workload === 'burst-arrivals') {
            const burst = Math.floor(index / 100);
            const district = String(burst % 99).padStart(2, '0');
            registrations[index] = `KA${district}${toLetters(burst)}${String(index % 100).padStart(4, '0')}`;
        } else {
            const district = String(Math.floor(random() * 99)).padStart(2, '0');
            const series = toLetters(index);
            const serial = String(Math.floor(random() * 10000)).padStart(4, '0');
            registrations[index] = `TN${district}${series}${serial}`;
        }
    }

    const shuffleRanges = workload === 'burst-arrivals'
        ? Array.from({ length: Math.ceil(registrations.length / 100) }, (_, index) => [
            index * 100,
            Math.min((index + 1) * 100, registrations.length)
        ])
        : [[0, registrations.length]];
    for (const [start, end] of shuffleRanges) {
        for (let index = end - 1; index > start; index--) {
            const otherIndex = start + Math.floor(random() * (index - start + 1));
            [registrations[index], registrations[otherIndex]] =
                [registrations[otherIndex], registrations[index]];
        }
    }
    return registrations;
}

function csvEscape(value) {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function runTrial({ capacity, loadFactor, workload, hashMode, method, policy, trial }) {
    const requestedCount = Math.floor(capacity * loadFactor);
    const seed = CONFIG.seed + capacity + Math.round(loadFactor * 1000) + trial;
    const registrations = createWorkload(workload, requestedCount, seed);
    const table = new ResearchHashTable({
        capacity,
        hashMode,
        method,
        autoResize: policy.autoResize,
        cleanupTombstones: policy.cleanupTombstones,
        maxLoadFactor: 0.7,
        tombstoneThreshold: 0.2
    });
    let inserted = 0;
    let failedInserts = 0;
    let insertionProbeTotal = 0;
    let maximumProbeLength = 0;
    let collisions = 0;

    const insertionStarted = performance.now();
    for (const registration of registrations) {
        const result = table.insert(registration);
        if (!result.success) {
            failedInserts++;
            continue;
        }
        inserted++;
        insertionProbeTotal += result.probes;
        maximumProbeLength = Math.max(maximumProbeLength, result.probes);
        collisions += result.collisions;
    }
    const insertionDurationMs = performance.now() - insertionStarted;

    const successfulSampleSize = Math.min(inserted, 1000);
    const successfulStride = Math.max(1, Math.floor(inserted / Math.max(successfulSampleSize, 1)));
    const successfulStarted = performance.now();
    let successfulProbeTotal = 0;
    for (let index = 0, sample = 0; index < inserted && sample < successfulSampleSize; index += successfulStride, sample++) {
        const result = table.search(registrations[index]);
        successfulProbeTotal += result.probes;
    }
    const successfulSearchDurationMs = performance.now() - successfulStarted;

    const unsuccessfulSampleSize = 200;
    const unsuccessfulStarted = performance.now();
    let unsuccessfulProbeTotal = 0;
    for (let index = 0; index < unsuccessfulSampleSize; index++) {
        const result = table.search(`ZZ${String(index + 900000).padStart(6, '0')}`);
        unsuccessfulProbeTotal += result.probes;
    }
    const unsuccessfulSearchDurationMs = performance.now() - unsuccessfulStarted;

    const beforeDeleteStats = table.getStatistics();
    const deleteSampleSize = Math.min(inserted, 200);
    const deleteStarted = performance.now();
    let deleteProbeTotal = 0;
    for (let index = 0; index < deleteSampleSize; index++) {
        const result = table.delete(registrations[index]);
        deleteProbeTotal += result.probes;
    }
    const deleteDurationMs = performance.now() - deleteStarted;
    const stats = table.getStatistics();

    const mixedOperationCount = Math.min(300, Math.max(90, Math.ceil(requestedCount * 0.5)));
    const mixedRegistrations = createWorkload(workload, requestedCount + mixedOperationCount, seed + 99);
    const mixedTable = new ResearchHashTable({
        capacity,
        hashMode,
        method,
        autoResize: policy.autoResize,
        cleanupTombstones: policy.cleanupTombstones,
        maxLoadFactor: 0.7,
        tombstoneThreshold: 0.2
    });
    const mixedActive = [];
    const mixedBaseCount = Math.min(Math.floor(requestedCount * 0.3), mixedRegistrations.length);
    for (let index = 0; index < mixedBaseCount; index++) {
        const result = mixedTable.insert(mixedRegistrations[index]);
        if (result.success) mixedActive.push(mixedRegistrations[index]);
    }
    let mixedProbeTotal = 0;
    let mixedFailedInserts = 0;
    let mixedInsertionCount = 0;
    let mixedSearchCount = 0;
    let mixedDeleteCount = 0;
    let nextMixedInsert = mixedBaseCount;
    const mixedStarted = performance.now();
    for (let operation = 0; operation < mixedOperationCount; operation++) {
        const action = operation % 3;
        if (action === 0 && nextMixedInsert < mixedRegistrations.length) {
            const result = mixedTable.insert(mixedRegistrations[nextMixedInsert++]);
            mixedProbeTotal += result.probes;
            mixedInsertionCount++;
            if (result.success) mixedActive.push(mixedRegistrations[nextMixedInsert - 1]);
            else mixedFailedInserts++;
        } else if (action === 1 && mixedActive.length > 0) {
            const target = mixedActive[operation % mixedActive.length];
            mixedProbeTotal += mixedTable.search(target).probes;
            mixedSearchCount++;
        } else if (mixedActive.length > 0) {
            const target = mixedActive.shift();
            mixedProbeTotal += mixedTable.delete(target).probes;
            mixedDeleteCount++;
        }
    }
    const mixedDurationMs = performance.now() - mixedStarted;

    return {
        workload,
        hashMode,
        method,
        policy: policy.name,
        initialCapacity: capacity,
        requestedLoadFactor: loadFactor,
        requestedCount,
        inserted,
        failedInsertCount: failedInserts,
        finalCapacity: beforeDeleteStats.capacity,
        loadFactorAfterInserts: beforeDeleteStats.loadFactor,
        postDeleteActiveCount: stats.activeCount,
        postDeleteTombstoneCount: stats.tombstoneCount,
        mixedOperationCount: mixedInsertionCount + mixedSearchCount + mixedDeleteCount,
        mixedAverageProbes: (mixedInsertionCount + mixedSearchCount + mixedDeleteCount)
            ? mixedProbeTotal / (mixedInsertionCount + mixedSearchCount + mixedDeleteCount)
            : 0,
        mixedFailedInsertCount: mixedFailedInserts,
        mixedDurationMs,
        trial,
        seed,
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        averageInsertProbes: inserted ? insertionProbeTotal / inserted : 0,
        averageSuccessfulSearchProbes: successfulSampleSize ? successfulProbeTotal / successfulSampleSize : 0,
        averageUnsuccessfulSearchProbes: unsuccessfulProbeTotal / unsuccessfulSampleSize,
        averageDeleteProbes: deleteSampleSize ? deleteProbeTotal / deleteSampleSize : 0,
        collisionCount: collisions,
        maximumProbeLength,
        rehashCount: stats.rehashCount,
        rehashDurationMs: stats.rehashDurationMs,
        cleanupCount: stats.cleanupCount,
        insertionMsPerOperation: inserted ? insertionDurationMs / inserted : 0,
        successfulSearchMsPerOperation: successfulSampleSize ? successfulSearchDurationMs / successfulSampleSize : 0,
        unsuccessfulSearchMsPerOperation: unsuccessfulSearchDurationMs / unsuccessfulSampleSize,
        deleteMsPerOperation: deleteSampleSize ? deleteDurationMs / deleteSampleSize : 0
    };
}

function summarizeForChart(rows) {
    const groups = new Map();
    for (const row of rows) {
        const key = `${row.hashMode}|${row.method}|${row.policy}|${row.requestedLoadFactor}`;
        const group = groups.get(key) || { sum: 0, count: 0 };
        group.sum += row.averageUnsuccessfulSearchProbes;
        group.count++;
        groups.set(key, group);
    }

    const series = new Map();
    for (const [key, value] of groups) {
        const [hashMode, method, policy, loadFactor] = key.split('|');
        const name = `${hashMode}/${method}/${policy}`;
        if (!series.has(name)) series.set(name, []);
        series.get(name).push({
            x: Number(loadFactor),
            y: value.sum / value.count
        });
    }
    return [...series.entries()].map(([name, points]) => ({
        name,
        points: points.sort((left, right) => left.x - right.x)
    }));
}

function createSlotDistributionRows() {
    const distributionRows = [];
    const trials = QUICK ? 1 : CONFIG.trials;

    for (const capacity of CONFIG.capacities) {
        for (const loadFactor of CONFIG.loadFactors) {
            const requestedCount = Math.floor(capacity * loadFactor);
            for (const workload of CONFIG.workloads) {
                for (const hashMode of CONFIG.hashModes) {
                    for (let trial = 1; trial <= trials; trial++) {
                        const histogram = new Array(requestedCount + 1).fill(0);
                        const seed = CONFIG.seed + capacity + Math.round(loadFactor * 1000) + trial;
                        const registrations = createWorkload(workload, requestedCount, seed);
                        const bucketCounts = new Array(capacity).fill(0);

                        for (const registration of registrations) {
                            const normalizedPlate = ResearchHashTable.normalizePlate(registration);
                            const key = ResearchHashTable.plateHash(normalizedPlate, capacity);
                            const groups = normalizedPlate.match(/\d+/g);
                            const numericSuffix = Number(groups[groups.length - 1]);
                            const bucket = hashMode === 'plate' ? key : numericSuffix % capacity;
                            bucketCounts[bucket]++;
                        }

                        for (const bucketCount of bucketCounts) histogram[bucketCount]++;
                        let collisionBuckets = 0;
                        let collidingEntries = 0;
                        let occupiedSlots = 0;
                        let maximumBucketOccupancy = 0;
                        for (const bucketCount of bucketCounts) {
                            if (bucketCount > 0) occupiedSlots++;
                            if (bucketCount > 1) {
                                collisionBuckets++;
                                collidingEntries += bucketCount - 1;
                            }
                            maximumBucketOccupancy = Math.max(maximumBucketOccupancy, bucketCount);
                        }
                        const mean = requestedCount / capacity;
                        const occupancyVariance = bucketCounts.reduce((sum, bucketCount) =>
                            sum + (bucketCount - mean) ** 2, 0) / capacity;

                        distributionRows.push({
                            hashMode,
                            workload,
                            capacity,
                            requestedLoadFactor: loadFactor,
                            requestedCount,
                            trial,
                            seed,
                            emptySlots: capacity - occupiedSlots,
                            collisionBuckets,
                            collidingEntries,
                            maximumBucketOccupancy,
                            occupancyVariance,
                            occupancyHistogram: JSON.stringify(histogram
                                .map((slotCount, buckets) => ({ vehiclesPerSlot: buckets, slotCount }))
                                .filter(entry => entry.slotCount > 0))
                        });
                    }
                }
            }
        }
    }
    return distributionRows;
}

function createSvgChart(rows) {
    const width = 960;
    const height = 560;
    const margin = { top: 50, right: 300, bottom: 65, left: 75 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const series = summarizeForChart(rows);
    const maximumY = Math.max(1, ...series.flatMap(line => line.points.map(point => point.y)));
    const colors = ['#2563eb', '#dc2626', '#059669', '#9333ea', '#d97706', '#0891b2', '#4f46e5', '#be123c'];
    const x = value => margin.left + value * plotWidth;
    const y = value => margin.top + plotHeight - (value / maximumY) * plotHeight;
    const elements = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        '<text x="480" y="28" text-anchor="middle" font-family="Arial" font-size="18" font-weight="bold">Unsuccessful Search Probes by Requested Load</text>'
    ];

    for (let tick = 0; tick <= 5; tick++) {
        const value = maximumY * tick / 5;
        const tickY = y(value);
        elements.push(`<line x1="${margin.left}" y1="${tickY}" x2="${margin.left + plotWidth}" y2="${tickY}" stroke="#e5e7eb"/>`);
        elements.push(`<text x="${margin.left - 10}" y="${tickY + 4}" text-anchor="end" font-family="Arial" font-size="11" fill="#374151">${value.toFixed(1)}</text>`);
    }

    for (let tick = 0; tick <= 10; tick += 2) {
        const load = tick / 10;
        const tickX = x(load);
        elements.push(`<line x1="${tickX}" y1="${margin.top}" x2="${tickX}" y2="${margin.top + plotHeight}" stroke="#f3f4f6"/>`);
        elements.push(`<text x="${tickX}" y="${margin.top + plotHeight + 22}" text-anchor="middle" font-family="Arial" font-size="11" fill="#374151">${Math.round(load * 100)}%</text>`);
    }

    elements.push(`<line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}" stroke="#111827"/>`);
    elements.push(`<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#111827"/>`);
    elements.push(`<text x="${margin.left + plotWidth / 2}" y="${height - 15}" text-anchor="middle" font-family="Arial" font-size="13">Requested load relative to initial capacity</text>`);
    elements.push(`<text x="18" y="${margin.top + plotHeight / 2}" transform="rotate(-90 18 ${margin.top + plotHeight / 2})" text-anchor="middle" font-family="Arial" font-size="13">Average unsuccessful-search probes</text>`);

    series.forEach((line, index) => {
        const color = colors[index % colors.length];
        const points = line.points.map(point => `${x(point.x)},${y(point.y)}`).join(' ');
        elements.push(`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>`);
        line.points.forEach(point => elements.push(`<circle cx="${x(point.x)}" cy="${y(point.y)}" r="3" fill="${color}"/>`));
        const legendY = margin.top + 15 + index * 18;
        elements.push(`<line x1="${margin.left + plotWidth + 12}" y1="${legendY}" x2="${margin.left + plotWidth + 30}" y2="${legendY}" stroke="${color}" stroke-width="3"/>`);
        elements.push(`<text x="${margin.left + plotWidth + 36}" y="${legendY + 4}" font-family="Arial" font-size="10" fill="#111827">${line.name}</text>`);
    });

    elements.push('<text x="480" y="545" text-anchor="middle" font-family="Arial" font-size="10" fill="#6b7280">Rows average available capacities, workloads, and trials; see CSV for full measurements.</text>');
    elements.push('</svg>');
    return elements.join('\n');
}

function main() {
    fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
    const rows = [];
    const scenarioCount = CONFIG.capacities.length * CONFIG.loadFactors.length *
        CONFIG.workloads.length * CONFIG.hashModes.length * CONFIG.methods.length *
        CONFIG.policies.length * CONFIG.trials;
    let completed = 0;

    for (const capacity of CONFIG.capacities) {
        for (const loadFactor of CONFIG.loadFactors) {
            for (const workload of CONFIG.workloads) {
                for (const hashMode of CONFIG.hashModes) {
                    for (const method of CONFIG.methods) {
                        for (const policy of CONFIG.policies) {
                            for (let trial = 1; trial <= CONFIG.trials; trial++) {
                                rows.push(runTrial({
                                    capacity,
                                    loadFactor,
                                    workload,
                                    hashMode,
                                    method,
                                    policy,
                                    trial
                                }));
                                completed++;
                            }
                        }
                    }
                }
            }
        }
    }

    const headers = Object.keys(rows[0]);
    const csv = [
        headers.join(','),
        ...rows.map(row => headers.map(header => csvEscape(row[header])).join(','))
    ].join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const suffix = QUICK ? 'quick' : 'full';
    const csvPath = path.join(OUTPUT_DIRECTORY, `benchmark-${suffix}.csv`);
    const svgPath = path.join(OUTPUT_DIRECTORY, `search-probes-${suffix}.svg`);
    const distributionPath = path.join(OUTPUT_DIRECTORY, `slot-distribution-${suffix}.csv`);
    fs.writeFileSync(csvPath, `${csv}\n`, 'utf8');
    fs.writeFileSync(svgPath, createSvgChart(rows), 'utf8');
    const distributionRows = createSlotDistributionRows();
    const distributionHeaders = Object.keys(distributionRows[0]);
    const distributionCsv = [
        distributionHeaders.join(','),
        ...distributionRows.map(row => distributionHeaders.map(header => csvEscape(row[header])).join(','))
    ].join('\n');
    fs.writeFileSync(distributionPath, `${distributionCsv}\n`, 'utf8');

    console.log(`Completed ${completed}/${scenarioCount} benchmark scenarios.`);
    console.log(`Node.js: ${process.version}`);
    console.log(`CSV: ${csvPath}`);
    console.log(`Graph: ${svgPath}`);
    console.log(`Slot distribution: ${distributionPath}`);
    console.log(`Seed: ${CONFIG.seed}; trials per scenario: ${CONFIG.trials}; generated: ${timestamp}`);
}

main();
