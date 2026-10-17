/**
 * Smart Parking - Method Comparison Engine
 * Executes identical sequences of car insertions and search queries across
 * Linear Probing, Quadratic Probing, and Double Hashing, calculating
 * real empirical metrics directly from the data structure execution.
 */

class MethodComparator {
    constructor() {
        this.containerId = 'comparison-view';
    }

    /**
     * Preset test workloads.
     */
    getWorkloads(tableSize = 70) {
        const highLoadCars = Array.from(
            { length: Math.floor(tableSize * 0.9) },
            (_, index) => `CAR-${1000 + index * Math.floor(tableSize / 2)}`
        );

        return {
            standard: {
                title: 'Standard Shopping Mall Traffic',
                description: '7 cars with typical mixed registration plates and keys.',
                cars: ['TN 09 AB 1021', 'KA 05 MN 2043', 'MH 12 CD 4019', 'DL 01 XY 3105', 'KL 07 GH 5522', 'AP 03 JK 6633', 'TS 09 LM 7744'],
                searchTargets: ['TN 09 AB 1021', 'MH 12 CD 4019', 'KL 07 GH 5522', 'KA 99 ZZ 9999'] // 3 found, 1 not found
            },
            heavyCollision: {
                title: 'Severe Collision Stress Test',
                description: '6 cars all with key % 70 = 15. Tests clustering resilience.',
                cars: ['CAR-15', 'CAR-85', 'CAR-155', 'CAR-225', 'CAR-295', 'CAR-365'],
                searchTargets: ['DL 04 DD 0048', 'AP 06 FF 0070', 'NO 00 CC 0099'] // 2 found, 1 not found
            },
            highLoad: {
                title: 'High Load Factor Test (90.9% Full)',
                description: 'Fills the table to approximately 90% capacity with repeated hashes to demonstrate collision-resolution behavior.',
                cars: highLoadCars,
                searchTargets: ['CAR-1000', highLoadCars[highLoadCars.length - 1], 'NOT_PARKED_9999']
            }
        };
    }

    /**
     * Runs benchmark simulation for a given workload.
     */
    runBenchmark(workloadKey = 'standard') {
        const tableSize = window.SmartParkingTable ? window.SmartParkingTable.size : 70;
        const workloads = this.getWorkloads(tableSize);
        const workload = workloads[workloadKey] || workloads.standard;

        const methods = [
            { id: 'linear', name: 'Linear Probing', formula: `(h + i) % ${tableSize}`, badge: 'Primary Clustering' },
            { id: 'quadratic', name: 'Quadratic Probing', formula: `(h + i²) % ${tableSize}`, badge: 'Secondary Clustering' },
            { id: 'double', name: 'Double Hashing', formula: `(h1 + i × h2) % ${tableSize}`, badge: 'Uniform' }
        ];

        const results = [];

        methods.forEach(m => {
            const table = new window.SmartParkingHashTable(tableSize);
            let totalCollisions = 0;
            let totalInsertProbes = 0;
            let successfulInserts = 0;
            let failedInserts = 0;

            // 1. Insert phase
            workload.cars.forEach(carPlate => {
                const plan = table.planInsertCar(carPlate, m.id);
                if (plan.success) {
                    table.commitInsert(plan, carPlate);
                    totalCollisions += plan.collisionCount;
                    totalInsertProbes += plan.probesNeeded;
                    successfulInserts++;
                } else {
                    failedInserts++;
                }
            });

            // 2. Search phase
            let successfulSearches = 0;
            let failedSearches = 0;
            let totalSearchProbes = 0;

            workload.searchTargets.forEach(target => {
                const res = table.searchCar(target, m.id);
                totalSearchProbes += res.probesRequired;
                if (res.found) {
                    successfulSearches++;
                } else {
                    failedSearches++;
                }
            });

            const avgInsertProbes = successfulInserts > 0 ? (totalInsertProbes / successfulInserts).toFixed(2) : '0';
            const avgSearchProbes = (successfulSearches + failedSearches) > 0 
                ? (totalSearchProbes / (successfulSearches + failedSearches)).toFixed(2) 
                : '0';

            results.push({
                ...m,
                totalCollisions,
                totalInsertProbes,
                avgInsertProbes,
                successfulInserts,
                failedInserts,
                successfulSearches,
                failedSearches,
                totalSearchProbes,
                avgSearchProbes,
                tableSnapshot: table.displayTable()
            });
        });

        this.renderResults(results, workload);
    }

    renderResults(results, workload) {
        const targetDiv = document.getElementById('comparison-results-container');
        if (!targetDiv) return;

        let maxProbes = Math.max(...results.map(r => r.totalInsertProbes), 1);

        let tableRowsHTML = results.map(r => `
            <tr>
                <td>
                    <strong style="color: var(--text-primary); font-size: 0.9rem;">${r.name}</strong>
                    <div style="font-size: 0.7rem; font-family: var(--font-mono); color: var(--text-muted);">${r.formula}</div>
                </td>
                <td>
                    <span style="font-weight: 800; color: ${r.totalCollisions > 4 ? '#ef4444' : '#f59e0b'}; font-family: var(--font-mono); font-size: 1rem;">
                        ${r.totalCollisions}
                    </span>
                </td>
                <td>
                    <span style="font-weight: 800; color: #60a5fa; font-family: var(--font-mono); font-size: 1rem;">
                        ${r.totalInsertProbes}
                    </span>
                    <span style="font-size: 0.72rem; color: var(--text-muted);">(${r.avgInsertProbes} avg)</span>
                </td>
                <td>
                    <span style="font-weight: 700; color: #10b981; font-family: var(--font-mono);">${r.successfulSearches}</span>
                    <span style="font-size: 0.72rem; color: var(--text-muted);">found</span>
                </td>
                <td>
                    <span style="font-weight: 700; color: #ef4444; font-family: var(--font-mono);">${r.failedSearches}</span>
                    <span style="font-size: 0.72rem; color: var(--text-muted);">absent</span>
                </td>
                <td>
                    <span class="badge-tag" style="background: rgba(59, 130, 246, 0.15);">${r.badge}</span>
                </td>
            </tr>
        `).join('');

        let visualBarsHTML = results.map(r => {
            const pct = Math.round((r.totalInsertProbes / maxProbes) * 100);
            return `
                <div style="margin-bottom: 0.85rem;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; margin-bottom: 0.25rem;">
                        <span>${r.name}</span>
                        <span style="font-family: var(--font-mono); color: #93c5fd;">${r.totalInsertProbes} probes | ${r.totalCollisions} collisions</span>
                    </div>
                    <div style="width: 100%; height: 12px; background: rgba(255, 255, 255, 0.08); border-radius: 9999px; overflow: hidden;">
                        <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #3b82f6, #ec4899); border-radius: 9999px; transition: width 0.5s ease;"></div>
                    </div>
                </div>
            `;
        }).join('');

        targetDiv.innerHTML = `
            <div style="margin-bottom: 1.25rem; padding: 0.75rem 1rem; background: rgba(59, 130, 246, 0.08); border-radius: var(--radius-md); border-left: 3px solid #3b82f6;">
                <div style="font-weight: 700; font-size: 0.85rem; color: #93c5fd;">Current Test Scenario: ${workload.title}</div>
                <div style="font-size: 0.75rem; color: #94a3b8;">${workload.description}</div>
                <div style="font-size: 0.72rem; font-family: var(--font-mono); color: #cbd5e1; margin-top: 0.35rem;">
                    Cars Tested (${workload.cars.length}): ${workload.cars.join(' • ')}
                </div>
            </div>

            <div class="table-responsive" style="margin-bottom: 1.5rem;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Method</th>
                            <th>Collisions</th>
                            <th>Total Probes</th>
                            <th>Successful Searches</th>
                            <th>Failed Searches</th>
                            <th>Clustering Nature</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHTML}
                    </tbody>
                </table>
            </div>

            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.15rem;">
                <h5 style="font-size: 0.85rem; font-weight: 700; color: #f9fafb; margin-bottom: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em;">
                    📊 Probe Effort Comparison (Lower is Better)
                </h5>
                ${visualBarsHTML}
            </div>
        `;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MethodComparator };
}
