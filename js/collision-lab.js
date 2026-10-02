/**
 * Smart Parking - Collision Lab Module
 * Provides interactive experiments to visualize and compare how
 * Linear Probing, Quadratic Probing, and Double Hashing resolve collisions.
 */

class CollisionLab {
    constructor() {
        this.container = document.getElementById('collision-lab-view');
        this.currentSet = [
            { reg: 'CAR-15', key: 15, name: 'Car A' },
            { reg: 'CAR-62', key: 62, name: 'Car B' },
            { reg: 'CAR-109', key: 109, name: 'Car C' },
            { reg: 'CAR-156', key: 156, name: 'Car D' }
        ];
    }

    init() {
        this.renderLabUI();
    }

    renderLabUI() {
        const labCard = document.getElementById('collision-lab-content');
        if (!labCard) return;

        const tableSize = window.SmartParkingTable ? window.SmartParkingTable.size : 47;
        const targetSlot = this.currentSet[0].key % tableSize;

        labCard.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">💥 Collision Lab – The Collision Crucible</h3>
                        <p class="card-subtitle">Examine what happens when multiple cars generate the identical hash index: <code>key % ${tableSize} = ${targetSlot}</code></p>
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary btn-sm" onclick="window.CollisionLabInstance.loadPreset(15)">Preset: Modulo 15 (15, 62, 109, 156)</button>
                        <button class="btn btn-secondary btn-sm" onclick="window.CollisionLabInstance.loadPreset(34)">Preset: Modulo 34 (1021, 1068, 1115, 1162)</button>
                        <button class="btn btn-secondary btn-sm" onclick="window.CollisionLabInstance.loadPreset(4)">Preset: Modulo 4 (4, 51, 98, 145)</button>
                    </div>
                </div>

                <!-- Part D Visual Diagram -->
                <div class="collision-diagram-container">
                    <h4 style="font-size: 0.85rem; color: #94a3b8; text-transform: uppercase; margin-bottom: 1rem; letter-spacing: 0.05em;">
                        1. Collision Detection Diagram
                    </h4>

                    <div class="diagram-stage">
                        <!-- Left: Incoming Colliding Cars -->
                        <div class="incoming-cars-column" id="lab-incoming-cars">
                            ${this.renderIncomingCarsHTML()}
                        </div>

                        <!-- Center: Target Slot Collision Box -->
                        <div class="collision-target-box">
                            <div class="collision-pulse-glow"></div>
                            <div style="font-size: 2rem; margin-bottom: 0.25rem;">💥</div>
                            <div class="collision-target-title">PARKING SLOT ${targetSlot}</div>
                            <div class="collision-target-badge">SIMULTANEOUS COLLISION</div>
                            <div style="font-size: 0.72rem; color: #fca5a5; margin-top: 0.5rem; max-width: 180px;">
                                All incoming cars compute hash index = ${targetSlot}
                            </div>
                        </div>

                        <!-- Right: Real-time Probing Comparison Lanes -->
                        <div class="resolution-lanes-column">
                            <div style="font-size: 0.82rem; font-weight: 700; color: #94a3b8; margin-bottom: 0.25rem;">
                                How Different Algorithms Resolve This Clash:
                            </div>
                            
                            <!-- Linear Lane -->
                            <div class="resolution-card linear" id="res-linear">
                                <div class="resolution-header">
                                    <span class="resolution-name">➡️ Linear Probing: <code>(h + i) % ${tableSize}</code></span>
                                    <span class="badge-tag" style="color: #60a5fa; border-color: #3b82f6;">Primary Clustering</span>
                                </div>
                                <div class="resolution-slots-flow" id="flow-linear">
                                    ${this.computeFlowHTML('linear')}
                                </div>
                            </div>

                            <!-- Quadratic Lane -->
                            <div class="resolution-card quadratic" id="res-quadratic">
                                <div class="resolution-header">
                                    <span class="resolution-name">📐 Quadratic Probing: <code>(h + i²) % ${tableSize}</code></span>
                                    <span class="badge-tag" style="color: #c084fc; border-color: #a855f7;">Secondary Clustering</span>
                                </div>
                                <div class="resolution-slots-flow" id="flow-quadratic">
                                    ${this.computeFlowHTML('quadratic')}
                                </div>
                            </div>

                            <!-- Double Hashing Lane -->
                            <div class="resolution-card double" id="res-double">
                                <div class="resolution-header">
                                    <span class="resolution-name">🎯 Double Hashing: <code>(h1 + i × h2) % ${tableSize}</code></span>
                                    <span class="badge-tag" style="color: #f472b6; border-color: #ec4899;">Uniform Distribution</span>
                                </div>
                                <div class="resolution-slots-flow" id="flow-double">
                                    ${this.computeFlowHTML('double')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Side-by-side Educational Analysis -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-top: 1rem;">
                    <div style="background: rgba(15, 23, 42, 0.6); padding: 1rem; border-radius: var(--radius-md); border-left: 3px solid #3b82f6;">
                        <h5 style="color: #93c5fd; font-size: 0.85rem; margin-bottom: 0.35rem;">Linear Probing Behavior</h5>
                        <p style="font-size: 0.78rem; color: #94a3b8; line-height: 1.4;">
                            Causes <strong>Primary Clustering</strong>. When a collision occurs at slot 4, cars sequentially pack into 4, 5, 6, 7. This creates a dense block of occupied slots, causing every future car that hits that block to traverse the entire chain.
                        </p>
                    </div>

                    <div style="background: rgba(15, 23, 42, 0.6); padding: 1rem; border-radius: var(--radius-md); border-left: 3px solid #a855f7;">
                        <h5 style="color: #d8b4fe; font-size: 0.85rem; margin-bottom: 0.35rem;">Quadratic Probing Behavior</h5>
                        <p style="font-size: 0.78rem; color: #94a3b8; line-height: 1.4;">
                            Jumps with quadratic step sizes (1, 4, 9, 16...). Slots assigned jump to <strong>4, 5, 8, 2</strong>, leaping cleanly over contiguous clusters. However, all keys hashing to slot 4 follow the identical sequence (Secondary Clustering).
                        </p>
                    </div>

                    <div style="background: rgba(15, 23, 42, 0.6); padding: 1rem; border-radius: var(--radius-md); border-left: 3px solid #ec4899;">
                        <h5 style="color: #fbcfe8; font-size: 0.85rem; margin-bottom: 0.35rem;">Double Hashing Behavior</h5>
                        <p style="font-size: 0.78rem; color: #94a3b8; line-height: 1.4;">
                            Calculates a personalized step size <code>h2(k) = 7 - (k % 7)</code>. Even though keys 15, 26, 37, 48 all start at slot 4, their probe step sizes are <strong>6, 2, 5, 1</strong> respectively! Each car takes a completely independent trajectory across the parking lot.
                        </p>
                    </div>
                </div>

                <!-- Custom Test Inputs -->
                <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                    <h5 style="font-size: 0.85rem; color: #e2e8f0; margin-bottom: 0.5rem;">Try Your Own Colliding Keys</h5>
                    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                        <input type="text" id="custom-collision-keys" class="text-input" style="max-width: 380px;" value="15, 26, 37, 48" placeholder="Comma-separated keys, e.g. 4, 15, 26, 37">
                        <button class="btn btn-primary btn-sm" onclick="window.CollisionLabInstance.applyCustomKeys()">Simulate Clash</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderIncomingCarsHTML() {
        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
        return this.currentSet.map((item, idx) => `
            <div class="incoming-car-card">
                <div class="car-icon-badge" style="background: ${colors[idx % colors.length]};">🚗</div>
                <div>
                    <div style="font-weight: 700; font-size: 0.82rem; color: #f9fafb;">${item.name}: ${item.reg}</div>
                    <div style="font-size: 0.72rem; color: #93c5fd; font-family: var(--font-mono);">
                        Key: <strong>${item.key}</strong> &rarr; ${item.key} % 11 = <strong>${item.key % 11}</strong>
                    </div>
                </div>
            </div>
        `).join('');
    }

    computeFlowHTML(method) {
        // Simulate step-by-step insertion of this.currentSet into an isolated table
        const { SmartParkingHashTable } = window;
        if (!SmartParkingHashTable) return 'Loading simulation...';

        const tableSize = window.SmartParkingTable ? window.SmartParkingTable.size : 47;
        const testTable = new SmartParkingHashTable(tableSize);
        let html = '';

        this.currentSet.forEach((item, index) => {
            const plan = testTable.planInsertCar(item.reg, method);
            if (plan.success) {
                testTable.commitInsert(plan, item.reg);
                
                const probesDesc = plan.trace.map(t => {
                    if (t.isCollision) {
                        return `<span class="flow-slot clash">Slot ${t.slotIndex} (💥 Occ)</span> &rarr;`;
                    } else {
                        return `<span class="flow-slot placed">Slot ${t.slotIndex} (✅ ${item.name})</span>`;
                    }
                }).join(' ');

                html += `
                    <div style="width: 100%; margin: 0.25rem 0; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                        <strong style="color: #cbd5e1; font-size: 0.75rem; min-width: 50px;">${item.name}:</strong>
                        ${probesDesc}
                    </div>
                `;
            } else {
                html += `
                    <div style="width: 100%; margin: 0.25rem 0; color: #ef4444; font-size: 0.72rem;">
                        <strong>${item.name}:</strong> Rejected (${plan.error})
                    </div>
                `;
            }
        });

        return html;
    }

    loadPreset(mod) {
        if (mod === 15) {
            this.currentSet = [
                { reg: 'CAR-15', key: 15, name: 'Car A' },
                { reg: 'CAR-62', key: 62, name: 'Car B' },
                { reg: 'CAR-109', key: 109, name: 'Car C' },
                { reg: 'CAR-156', key: 156, name: 'Car D' }
            ];
        } else if (mod === 34) {
            this.currentSet = [
                { reg: 'TN 09 AB 1021', key: 1021, name: 'Car A' },
                { reg: 'KA 01 MN 1068', key: 1068, name: 'Car B' },
                { reg: 'MH 12 XY 1115', key: 1115, name: 'Car C' },
                { reg: 'DL 04 ZZ 1162', key: 1162, name: 'Car D' }
            ];
        } else if (mod === 4) {
            this.currentSet = [
                { reg: 'CAR-4', key: 4, name: 'Car A' },
                { reg: 'CAR-51', key: 51, name: 'Car B' },
                { reg: 'CAR-98', key: 98, name: 'Car C' },
                { reg: 'CAR-145', key: 145, name: 'Car D' }
            ];
        }
        this.renderLabUI();
    }

    applyCustomKeys() {
        const input = document.getElementById('custom-collision-keys');
        if (!input) return;
        const val = input.value.trim();
        const parts = val.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length === 0) return;

        const newSet = [];
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

        parts.forEach((p, idx) => {
            const key = parseInt(p.replace(/\D/g, ''), 10);
            if (!isNaN(key)) {
                newSet.push({
                    reg: `CAR-${key}`,
                    key: key,
                    name: `Car ${letters[idx] || (idx + 1)}`
                });
            }
        });

        if (newSet.length > 0) {
            this.currentSet = newSet;
            this.renderLabUI();
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CollisionLab };
}
