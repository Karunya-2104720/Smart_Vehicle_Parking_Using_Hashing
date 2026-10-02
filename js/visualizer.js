/**
 * Smart Parking - Visualizer & Animation Engine
 * Handles rendering of 11 parking bays, top-down SVG car graphics,
 * step-by-step probing animations, sound cues, and narration logs.
 */

// Sound Synthesizer using Web Audio API
class AudioFeedback {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
    }

    playTone(freq, type = 'sine', duration = 0.12, volume = 0.08) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(volume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Audio error suppression
        }
    }

    playProbe() {
        this.playTone(520, 'sine', 0.09, 0.06);
    }

    playCollision() {
        this.playTone(280, 'triangle', 0.18, 0.12);
        setTimeout(() => this.playTone(220, 'sawtooth', 0.22, 0.1), 90);
    }

    playSuccess() {
        this.playTone(440, 'sine', 0.1, 0.08);
        setTimeout(() => this.playTone(554.37, 'sine', 0.1, 0.08), 90);
        setTimeout(() => this.playTone(659.25, 'sine', 0.22, 0.1), 180);
    }

    playTombstone() {
        this.playTone(380, 'sine', 0.14, 0.07);
    }

    playRemove() {
        this.playTone(350, 'sine', 0.12, 0.08);
        setTimeout(() => this.playTone(280, 'sine', 0.18, 0.07), 100);
    }
}

// Visualizer Controller
class ParkingVisualizer {
    constructor(slotsContainerId, tableContainerId, narrationContainerId) {
        this.slotsContainer = document.getElementById(slotsContainerId);
        this.tableContainer = document.getElementById(tableContainerId);
        this.narrationContainer = document.getElementById(narrationContainerId);
        this.audio = new AudioFeedback();

        this.animationSpeed = 650; // ms per step
        this.isPlaying = false;
        this.currentQueue = [];
        this.queueIndex = 0;
        this.stepByStepMode = false;
        this.onStepComplete = null;
        this.onAnimationFinished = null;

        // Distinct Car Colors palette
        this.carColors = [
            '#3b82f6', // Sapphire Blue
            '#ef4444', // Crimson Red
            '#10b981', // Emerald Green
            '#8b5cf6', // Electric Purple
            '#f59e0b', // Amber Orange
            '#06b6d4', // Cyan
            '#ec4899', // Pink
            '#14b8a6', // Teal
            '#6366f1', // Indigo
            '#84cc16'  // Lime
        ];
    }

    setSpeed(speedMs) {
        this.animationSpeed = speedMs;
    }

    getRandomCarColor() {
        return this.carColors[Math.floor(Math.random() * this.carColors.length)];
    }

    /**
     * Generates a sleek top-down SVG car illustration.
     */
    generateCarSVG(color = '#3b82f6') {
        return `
        <svg class="car-svg-graphic" viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Shadow -->
            <rect x="12" y="10" width="76" height="120" rx="20" fill="black" fill-opacity="0.35"/>
            <!-- Wheels -->
            <rect x="6" y="24" width="8" height="22" rx="4" fill="#1e293b"/>
            <rect x="86" y="24" width="8" height="22" rx="4" fill="#1e293b"/>
            <rect x="6" y="94" width="8" height="22" rx="4" fill="#1e293b"/>
            <rect x="86" y="94" width="8" height="22" rx="4" fill="#1e293b"/>
            <!-- Car Body -->
            <rect x="12" y="8" width="76" height="124" rx="22" fill="${color}"/>
            <rect x="14" y="10" width="72" height="120" rx="20" stroke="white" stroke-opacity="0.25" stroke-width="2"/>
            <!-- Front Headlights -->
            <path d="M18 12 Q 22 22 30 18" stroke="#fef08a" stroke-width="4" stroke-linecap="round"/>
            <path d="M82 12 Q 78 22 70 18" stroke="#fef08a" stroke-width="4" stroke-linecap="round"/>
            <!-- Front Windshield -->
            <path d="M22 42 L30 26 L70 26 L78 42 Z" fill="#0f172a" fill-opacity="0.85" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
            <!-- Roof / Cabin -->
            <rect x="25" y="44" width="50" height="42" rx="6" fill="#0f172a" fill-opacity="0.35"/>
            <!-- Rear Windshield -->
            <path d="M24 90 L30 102 L70 102 L76 90 Z" fill="#0f172a" fill-opacity="0.85" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
            <!-- Rear Tail Lights -->
            <rect x="18" y="126" width="14" height="4" rx="2" fill="#ef4444"/>
            <rect x="68" y="126" width="14" height="4" rx="2" fill="#ef4444"/>
            <!-- Center Line Accent -->
            <line x1="50" y1="14" x2="50" y2="24" stroke="white" stroke-opacity="0.4" stroke-width="2" stroke-linecap="round"/>
        </svg>
        `;
    }

    /**
     * Initial layout render of all parking bays (0 to totalSlots - 1).
     * Automatically lays out decks and driveway lanes.
     */
    initSlots(totalSlots = 47) {
        if (!this.slotsContainer) return;
        this.slotsContainer.innerHTML = '';

        const isLarge = totalSlots > 20;
        const rowBreak = isLarge ? 12 : Math.ceil(totalSlots / 2);

        for (let i = 0; i < totalSlots; i++) {
            // Insert driveway dividers
            if (i > 0 && i % rowBreak === 0) {
                const deckPrev = isLarge ? String.fromCharCode(65 + Math.floor((i - 1) / rowBreak)) : 'TOP';
                const deckNext = isLarge ? String.fromCharCode(65 + Math.floor(i / rowBreak)) : 'BOTTOM';
                const rangePrev = `${i - rowBreak} - ${i - 1}`;
                const rangeNext = `${i} - ${Math.min(i + rowBreak - 1, totalSlots - 1)}`;

                const driveway = document.createElement('div');
                driveway.className = 'driveway-lane';
                driveway.innerHTML = `
                    <div class="driveway-text">▲ DECK ${deckPrev} (SLOTS ${rangePrev})</div>
                    <div class="driveway-text">🚗 ➔ DRIVEWAY ➔ 5 MPH ➔ 🅿️</div>
                    <div class="driveway-text">▼ DECK ${deckNext} (SLOTS ${rangeNext})</div>
                `;
                this.slotsContainer.appendChild(driveway);
            }

            const bay = document.createElement('div');
            bay.className = 'parking-slot-card state-empty';
            bay.id = `parking-slot-${i}`;
            bay.dataset.slotNumber = i;

            bay.innerHTML = `
                <div class="slot-number-stencil">${i}</div>
                <div class="slot-status-pill">VACANT</div>
                <div class="empty-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
                        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.2 1 12 1 13v3c0 .6.4 1 1 1h2"/>
                        <circle cx="7" cy="17" r="2"/>
                        <circle cx="17" cy="17" r="2"/>
                    </svg>
                    <span>BAY ${i}</span>
                </div>
                <div class="slot-curb"></div>
            `;

            this.slotsContainer.appendChild(bay);
        }
    }

    /**
     * Re-renders full state of all 11 slots from hash table data.
     */
    renderAllSlots(slots) {
        slots.forEach(slot => {
            this.updateSlotDOM(slot);
        });
    }

    /**
     * Updates an individual slot DOM element.
     */
    updateSlotDOM(slot) {
        const bay = document.getElementById(`parking-slot-${slot.slotNumber}`);
        if (!bay) return;

        // Reset classes
        bay.className = 'parking-slot-card';
        bay.innerHTML = `<div class="slot-number-stencil">${slot.slotNumber}</div>`;

        if (slot.state === 'OCCUPIED' && slot.car) {
            bay.classList.add('state-occupied');
            bay.innerHTML += `
                <div class="slot-status-pill">OCCUPIED</div>
                <div class="parked-car-box">
                    ${this.generateCarSVG(slot.car.color || '#3b82f6')}
                    <div class="car-meta-plate">${slot.car.registration}</div>
                    <div class="car-tags-row">
                        <span class="tag-badge tag-key">Key: ${slot.car.key}</span>
                        <span class="tag-badge tag-hash">h(k)=${slot.car.hashIndex}</span>
                        <span class="tag-badge tag-probes">${slot.car.probesNeeded}p</span>
                    </div>
                </div>
                <div class="slot-curb"></div>
            `;
        } else if (slot.state === 'TOMBSTONE') {
            bay.classList.add('state-tombstone');
            bay.innerHTML += `
                <div class="slot-status-pill">TOMBSTONE</div>
                <div class="tombstone-indicator">
                    <div class="tombstone-icon">🪦</div>
                    <div class="tombstone-title">DELETED</div>
                    <div class="tombstone-desc">Chain active for searches</div>
                </div>
                <div class="slot-curb"></div>
            `;
        } else {
            bay.classList.add('state-empty');
            bay.innerHTML += `
                <div class="slot-status-pill">VACANT</div>
                <div class="empty-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
                        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.2 1 12 1 13v3c0 .6.4 1 1 1h2"/>
                        <circle cx="7" cy="17" r="2"/>
                        <circle cx="17" cy="17" r="2"/>
                    </svg>
                    <span>BAY ${slot.slotNumber}</span>
                </div>
                <div class="slot-curb"></div>
            `;
        }
    }

    /**
     * Clears all temporary animation highlighting from all slots.
     */
    clearSlotHighlights() {
        const bays = document.querySelectorAll('.parking-slot-card');
        bays.forEach(bay => {
            bay.classList.remove('is-probing', 'is-collision', 'is-assigned', 'is-tombstone-skipped');
            const banner = bay.querySelector('.collision-banner-badge');
            if (banner) banner.remove();
        });
    }

    /**
     * Clears and adds a message to the real-time narration box.
     */
    addNarration(message, type = 'step-probe') {
        if (!this.narrationContainer) return;
        const entry = document.createElement('div');
        entry.className = `narration-entry ${type}`;
        entry.innerHTML = message;
        this.narrationContainer.appendChild(entry);
        this.narrationContainer.scrollTop = this.narrationContainer.scrollHeight;
    }

    clearNarration() {
        if (this.narrationContainer) {
            this.narrationContainer.innerHTML = '';
        }
    }

    /**
     * Updates top execution pipeline indicator.
     */
    updatePipeline(stepIndex) {
        const steps = document.querySelectorAll('.pipeline-step');
        steps.forEach((s, idx) => {
            s.classList.remove('active', 'completed');
            if (idx < stepIndex) s.classList.add('completed');
            if (idx === stepIndex) s.classList.add('active');
        });
    }

    /**
     * Executes step-by-step parking animation.
     */
    animateInsertion(planResult, tableInstance, onComplete) {
        this.clearSlotHighlights();
        this.clearNarration();
        this.currentQueue = planResult.trace;
        this.queueIndex = 0;
        this.isPlaying = true;
        this.onAnimationFinished = onComplete;

        this.addNarration(`<strong>🏎️ Car Arrival:</strong> Plate: <code>${planResult.key}</code> (${planResult.method.toUpperCase()} PROBING)`, 'step-probe');
        this.addNarration(`<strong>Key Extracted:</strong> <code>${planResult.key}</code> | <strong>Hash Calculation:</strong> <code>${planResult.key} % 11 = ${planResult.hashIndex}</code>`, 'step-probe');

        this.updatePipeline(2); // At Hash Step

        const runNext = () => {
            if (!this.isPlaying) return;

            if (this.queueIndex >= this.currentQueue.length) {
                // Done!
                this.isPlaying = false;
                this.clearSlotHighlights();

                if (planResult.success) {
                    this.updatePipeline(5); // Completed
                    this.audio.playSuccess();
                    this.addNarration(`<strong>✅ SUCCESS:</strong> Car successfully parked at <strong>Slot ${planResult.assignedSlot}</strong> in ${planResult.probesNeeded} probe(s)!`, 'step-success');
                    
                    // Final highlight assigned slot
                    const assignedBay = document.getElementById(`parking-slot-${planResult.assignedSlot}`);
                    if (assignedBay) assignedBay.classList.add('is-assigned');

                    if (this.onAnimationFinished) this.onAnimationFinished(true);
                } else {
                    this.audio.playCollision();
                    this.addNarration(`<strong>❌ FAILED:</strong> ${planResult.error}`, 'step-collision');
                    if (this.onAnimationFinished) this.onAnimationFinished(false);
                }
                return;
            }

            const step = this.currentQueue[this.queueIndex];
            this.clearSlotHighlights();

            const bay = document.getElementById(`parking-slot-${step.slotIndex}`);
            if (bay) {
                bay.classList.add('is-probing');
            }

            if (step.isCollision) {
                this.updatePipeline(4); // Collision check
                this.audio.playCollision();
                if (bay) {
                    bay.classList.add('is-collision');
                    const banner = document.createElement('div');
                    banner.className = 'collision-banner-badge';
                    banner.innerHTML = `💥 Collision!`;
                    bay.appendChild(banner);
                }
                this.addNarration(`Probe #${step.probeStep + 1}: <code>${step.formulaExplanation}</code> ➔ <strong>Slot ${step.slotIndex} OCCUPIED!</strong> Collision detected with ${step.collidedWith.registration}.`, 'step-collision');
            } else if (step.isTombstone) {
                this.audio.playTombstone();
                if (bay) bay.classList.add('is-tombstone-skipped');
                this.addNarration(`Probe #${step.probeStep + 1}: <code>${step.formulaExplanation}</code> ➔ <strong>Slot ${step.slotIndex} has a TOMBSTONE</strong> (car departed). Advancing probe.`, 'step-tombstone');
            } else if (step.isAssigned) {
                this.updatePipeline(5);
                this.audio.playProbe();
                this.addNarration(`Probe #${step.probeStep + 1}: <code>${step.formulaExplanation}</code> ➔ <strong>Slot ${step.slotIndex} is AVAILABLE!</strong>`, 'step-success');
            }

            this.queueIndex++;

            if (!this.stepByStepMode) {
                setTimeout(runNext, this.animationSpeed);
            }
        };

        if (this.animationSpeed === 0) {
            // Instant mode
            this.clearSlotHighlights();
            this.isPlaying = false;
            if (planResult.success) {
                this.audio.playSuccess();
                this.addNarration(`<strong>✅ Quick Park:</strong> Car placed at Slot ${planResult.assignedSlot} (${planResult.probesNeeded} probes).`, 'step-success');
                if (onComplete) onComplete(true);
            } else {
                this.audio.playCollision();
                this.addNarration(`<strong>❌ Quick Park Failed:</strong> ${planResult.error}`, 'step-collision');
                if (onComplete) onComplete(false);
            }
        } else {
            runNext();
        }
    }

    /**
     * Executes step-by-step search animation.
     */
    animateSearch(searchResult, onComplete) {
        this.clearSlotHighlights();
        this.clearNarration();
        this.currentQueue = searchResult.trace;
        this.queueIndex = 0;
        this.isPlaying = true;

        this.addNarration(`<strong>🔍 Initiating Search:</strong> Target Key: <code>${searchResult.key}</code> (Hash: <code>${searchResult.hashIndex}</code>)`, 'step-probe');

        const runNext = () => {
            if (!this.isPlaying) return;

            if (this.queueIndex >= this.currentQueue.length) {
                this.isPlaying = false;
                this.clearSlotHighlights();

                if (searchResult.found) {
                    this.audio.playSuccess();
                    const foundBay = document.getElementById(`parking-slot-${searchResult.slotNumber}`);
                    if (foundBay) foundBay.classList.add('is-assigned');
                    this.addNarration(`<strong>🎯 CAR FOUND!</strong> Parked at <strong>Slot ${searchResult.slotNumber}</strong> (Required ${searchResult.probesRequired} probes).`, 'step-success');
                    if (onComplete) onComplete(true);
                } else {
                    this.audio.playCollision();
                    this.addNarration(`<strong>🚫 SEARCH ENDED:</strong> Car not found in parking lot after exploring sequence [${searchResult.searchSequence.join(' → ')}].`, 'step-collision');
                    if (onComplete) onComplete(false);
                }
                return;
            }

            const step = this.currentQueue[this.queueIndex];
            this.clearSlotHighlights();

            const bay = document.getElementById(`parking-slot-${step.slotIndex}`);
            if (bay) {
                bay.classList.add('is-probing');
            }

            if (step.found) {
                this.audio.playSuccess();
                if (bay) bay.classList.add('is-assigned');
                this.addNarration(`Probe #${step.probeStep + 1} at Slot ${step.slotIndex}: <code>${step.formula}</code> ➔ <strong>FOUND MATCH!</strong> Plate: ${step.car.registration}`, 'step-success');
            } else if (step.isTerminator) {
                this.audio.playCollision();
                if (bay) bay.classList.add('is-collision');
                this.addNarration(`Probe #${step.probeStep + 1} at Slot ${step.slotIndex}: <code>${step.formula}</code> ➔ <strong>EMPTY SLOT!</strong> In open addressing, search terminates here because target car cannot exist past an empty slot.`, 'step-collision');
            } else if (step.isTombstone) {
                this.audio.playTombstone();
                if (bay) bay.classList.add('is-tombstone-skipped');
                this.addNarration(`Probe #${step.probeStep + 1} at Slot ${step.slotIndex}: <strong>TOMBSTONE</strong>. Search continues past this deleted slot.`, 'step-tombstone');
            } else {
                this.audio.playProbe();
                this.addNarration(`Probe #${step.probeStep + 1} at Slot ${step.slotIndex}: <code>${step.formula}</code> ➔ Occupied by ${step.car.registration}. Mismatch. Probing next...`, 'step-probe');
            }

            this.queueIndex++;

            if (!this.stepByStepMode) {
                setTimeout(runNext, this.animationSpeed);
            }
        };

        if (this.animationSpeed === 0) {
            this.clearSlotHighlights();
            this.isPlaying = false;
            if (searchResult.found) {
                this.audio.playSuccess();
                this.addNarration(`<strong>🎯 Car Found:</strong> Slot ${searchResult.slotNumber} (${searchResult.probesRequired} probes).`, 'step-success');
                if (onComplete) onComplete(true);
            } else {
                this.audio.playCollision();
                this.addNarration(`<strong>🚫 Car Not Found:</strong> Sequence [${searchResult.searchSequence.join(' → ')}].`, 'step-collision');
                if (onComplete) onComplete(false);
            }
        } else {
            runNext();
        }
    }

    /**
     * Advances one step in manual Step-by-Step mode.
     */
    advanceNextStep() {
        if (!this.isPlaying || this.queueIndex >= this.currentQueue.length) {
            return;
        }
        // Will be triggered by the manual next button
    }

    /**
     * Renders parking status table (Part C).
     */
    renderTable(slots, onRemoveClick) {
        if (!this.tableContainer) return;

        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Slot</th>
                        <th>Status</th>
                        <th>Registration</th>
                        <th>Extracted Key</th>
                        <th>Hash Index (key % 11)</th>
                        <th>Probes</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        slots.forEach(slot => {
            let statusBadge = '<span class="badge-status empty">Empty</span>';
            let regText = '—';
            let keyText = '—';
            let hashText = '—';
            let probesText = '—';
            let actionBtn = '—';

            if (slot.state === 'OCCUPIED' && slot.car) {
                statusBadge = '<span class="badge-status occupied">Occupied</span>';
                regText = `<strong style="color: ${slot.car.color}; font-family: var(--font-mono);">${slot.car.registration}</strong>`;
                keyText = `<code>${slot.car.key}</code>`;
                hashText = `<code>${slot.car.hashIndex}</code>`;
                probesText = `<code>${slot.car.probesNeeded}</code>`;
                actionBtn = `<button class="btn btn-danger btn-sm" onclick="window.SmartParkingApp.quickRemove('${slot.car.registration}')">Remove</button>`;
            } else if (slot.state === 'TOMBSTONE') {
                statusBadge = '<span class="badge-status tombstone">Tombstone 🪦</span>';
                regText = '<span style="color: #d97706; font-style: italic;">Departed Car</span>';
            }

            html += `
                <tr>
                    <td><strong>Bay ${slot.slotNumber}</strong></td>
                    <td>${statusBadge}</td>
                    <td>${regText}</td>
                    <td>${keyText}</td>
                    <td>${hashText}</td>
                    <td>${probesText}</td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        this.tableContainer.innerHTML = html;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ParkingVisualizer,
        AudioFeedback
    };
}
