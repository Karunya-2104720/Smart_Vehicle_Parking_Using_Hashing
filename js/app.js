/**
 * Smart Parking - Main Application Controller
 * Coordinates UI events, data structures, visualizer animations,
 * collision lab, benchmarks, and live REST API communication with the Node.js backend.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Core Models & Systems (47 Slots by default, prime modulus)
    const DEFAULT_SLOTS = 47;
    const DEFAULT_SEC_PRIME = 43;
    const table = new SmartParkingHashTable(DEFAULT_SLOTS, DEFAULT_SEC_PRIME);
    const visualizer = new ParkingVisualizer('parking-bays-container', 'parking-status-table-container', 'narration-log-box');
    const collisionLab = new CollisionLab();
    const comparator = new MethodComparator();

    // API Configuration
    const isLocalDevelopment = window.location.protocol === 'file:' ||
        window.location.port === '3000' ||
        ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const API_BASE = isLocalDevelopment
        ? `http://${window.location.hostname || 'localhost'}:5000/api`
        : `${window.location.origin}/api`;
    let isBackendConnected = false;

    // Expose global references for onclick handlers
    window.SmartParkingTable = table;
    window.SmartParkingVisualizer = visualizer;
    window.CollisionLabInstance = collisionLab;
    window.ComparatorInstance = comparator;

    let currentMethod = HASH_METHOD.LINEAR;
    let isProcessing = false;

    // DOM Elements
    const regInput = document.getElementById('car-reg-input');
    const keyPreview = document.getElementById('extracted-key-display');
    const btnPark = document.getElementById('btn-park');
    const btnFind = document.getElementById('btn-find');
    const btnRemove = document.getElementById('btn-remove');
    const btnRandom = document.getElementById('btn-random');
    const btnReset = document.getElementById('btn-reset');
    const searchTrailContainer = document.getElementById('search-trail-container');
    const searchTrailNodes = document.getElementById('search-trail-nodes');
    const backendStatusBadge = document.getElementById('backend-status-badge');

    // KPI Elements
    const kpiTotal = document.getElementById('kpi-total');
    const kpiOccupied = document.getElementById('kpi-occupied');
    const kpiAvailable = document.getElementById('kpi-available');
    const kpiLoadFactor = document.getElementById('kpi-load-factor');
    const kpiLfFill = document.getElementById('kpi-lf-fill');
    const kpiCollisions = document.getElementById('kpi-collisions');
    const kpiSearches = document.getElementById('kpi-searches');
    const kpiSearchesSub = document.getElementById('kpi-searches-sub');
    const kpiMethod = document.getElementById('kpi-current-method');

    // 2. Initialize Visual Slots (47 Slots: 0 to 46)
    if (kpiTotal) kpiTotal.textContent = `${table.size} Slots`;
    visualizer.initSlots(table.size);
    visualizer.renderTable(table.slots);
    updateKPIs();
    collisionLab.init();
    comparator.runBenchmark('standard');

    // Check Backend Connectivity
    checkBackendHealth();

    async function checkBackendHealth() {
        try {
            const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
            if (res.ok) {
                const data = await res.json();
                isBackendConnected = true;
                if (backendStatusBadge) {
                    backendStatusBadge.className = 'badge-tag';
                    backendStatusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
                    backendStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                    backendStatusBadge.style.color = '#34d399';
                    backendStatusBadge.innerHTML = `🟢 Backend Live (${data.tableSize} Slots)`;
                }
                // Sync persistent state from backend
                syncStateFromBackend();
            } else {
                setBackendOfflineBadge();
            }
        } catch (e) {
            setBackendOfflineBadge();
        }
    }

    function setBackendOfflineBadge() {
        isBackendConnected = false;
        if (backendStatusBadge) {
            backendStatusBadge.className = 'badge-tag';
            backendStatusBadge.style.background = 'rgba(245, 158, 11, 0.15)';
            backendStatusBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
            backendStatusBadge.style.color = '#fbbf24';
            backendStatusBadge.innerHTML = `🟠 Local Engine (${table.size} Slots)`;
        }
    }

    async function syncStateFromBackend() {
        try {
            const res = await fetch(`${API_BASE}/parking`);
            if (res.ok) {
                const data = await res.json();
                if (data.slots && Array.isArray(data.slots)) {
                    data.slots.forEach(s => {
                        if (s.status === 'OCCUPIED' && s.car) {
                            table.slots[s.index] = {
                                slotNumber: s.index,
                                state: 'OCCUPIED',
                                car: {
                                    registration: s.car.registrationNumber,
                                    key: s.car.key,
                                    hashIndex: s.car.hashIndex,
                                    color: s.car.color || '#3b82f6',
                                    probesNeeded: s.car.probesNeeded || 1,
                                    methodUsed: s.car.methodUsed || 'linear'
                                }
                            };
                        } else if (s.status === 'TOMBSTONE') {
                            table.slots[s.index] = {
                                slotNumber: s.index,
                                state: 'TOMBSTONE',
                                car: null
                            };
                        } else {
                            table.slots[s.index] = {
                                slotNumber: s.index,
                                state: 'EMPTY',
                                car: null
                            };
                        }
                    });
                    visualizer.renderAllSlots(table.slots);
                    visualizer.renderTable(table.slots);
                    updateKPIs();
                }
            }
        } catch (e) {
            console.warn('Could not sync state from backend:', e.message);
        }
    }

    // 3. License Plate Input Listener (Real-time Key Extraction Preview)
    if (regInput) {
        regInput.addEventListener('input', () => {
            const val = regInput.value.trim();
            const extracted = SmartParkingHashTable.extractKey(val);
            if (extracted !== null) {
                const h1 = table.hashFunction(extracted);
                const h2 = table.secondaryHash(extracted);
                keyPreview.innerHTML = `Extracted Key: <strong>${extracted}</strong> | Initial Hash: <code>${extracted} % ${table.size} = ${h1}</code> ${currentMethod === HASH_METHOD.DOUBLE ? `| h2 = ${h2}` : ''}`;
            } else {
                keyPreview.innerHTML = `Extracted Key: <span style="color: #94a3b8;">Type registration or number</span>`;
            }
        });

        regInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleParkCar();
            }
        });
    }

    // 4. Hashing Method Selector Buttons
    const methodButtons = document.querySelectorAll('.method-btn');
    methodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isProcessing) return;
            methodButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMethod = btn.dataset.method;
            if (kpiMethod) {
                kpiMethod.textContent = btn.querySelector('.method-name').textContent;
            }
            visualizer.addNarration(`<strong>🔄 Switched Collision Resolution:</strong> <code>${btn.querySelector('.method-name').textContent}</code> (${btn.querySelector('.method-formula').textContent})`, 'step-probe');
            
            if (regInput) regInput.dispatchEvent(new Event('input'));
        });
    });

    // 5. Speed Selector Buttons
    const speedButtons = document.querySelectorAll('.speed-btn');
    speedButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            speedButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const speed = parseInt(btn.dataset.speed, 10);
            visualizer.setSpeed(speed);
        });
    });

    // 6. Sound Toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
        soundToggle.addEventListener('click', () => {
            visualizer.audio.enabled = !visualizer.audio.enabled;
            soundToggle.classList.toggle('active', visualizer.audio.enabled);
            soundToggle.textContent = visualizer.audio.enabled ? '🔊' : '🔇';
            soundToggle.title = visualizer.audio.enabled ? 'Sound Enabled' : 'Sound Muted';
        });
    }

    // 7. Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            themeToggle.textContent = newTheme === 'light' ? '🌙' : '☀️';
        });
    }

    // 8. Navigation Tab Switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    const viewSections = document.querySelectorAll('.view-section');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.dataset.target;
            tabButtons.forEach(b => b.classList.remove('active'));
            viewSections.forEach(v => v.classList.remove('active'));

            btn.classList.add('active');
            const section = document.getElementById(targetView);
            if (section) section.classList.add('active');

            if (targetView === 'collision-lab-view') {
                collisionLab.renderLabUI();
            } else if (targetView === 'comparison-view') {
                comparator.runBenchmark('standard');
            } else if (targetView === 'calculator-view') {
                runCalculator();
            }
        });
    });

    // 9. Operations: PARK A CAR (Connects to REST API if live)
    async function handleParkCar() {
        if (isProcessing) return;
        const regValue = regInput ? regInput.value.trim() : '';
        if (!regValue) {
            alert('Please enter a car registration plate (e.g. TN 09 AB 1021) or key!');
            return;
        }

        const key = SmartParkingHashTable.extractKey(regValue);
        if (key === null) {
            alert('Could not find numeric digits in registration plate. Please include numbers.');
            return;
        }

        const carColor = visualizer.getRandomCarColor();
        isProcessing = true;
        setControlsDisabled(true);

        if (isBackendConnected) {
            try {
                const response = await fetch(`${API_BASE}/parking/park`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        registrationNumber: regValue,
                        method: currentMethod,
                        color: carColor
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    alert(data.error || 'Failed to park car.');
                    isProcessing = false;
                    setControlsDisabled(false);
                    return;
                }

                // Format steps into visualizer trace format
                const planResult = {
                    success: true,
                    key: data.car.key,
                    hashIndex: data.hashIndex,
                    method: data.method,
                    assignedSlot: data.finalSlot,
                    probesNeeded: data.probes,
                    collisionCount: data.collisionCount || 0,
                    trace: data.steps.map((st, idx) => ({
                        stepNumber: idx + 1,
                        probeStep: st.probeStep !== undefined ? st.probeStep : idx,
                        slotIndex: st.index,
                        formulaExplanation: st.formula || `Probe at slot ${st.index}`,
                        isCollision: st.status === 'OCCUPIED',
                        isTombstone: st.status === 'TOMBSTONE',
                        isAssigned: st.status === 'AVAILABLE',
                        collidedWith: { registration: st.occupiedBy || 'Other Car' }
                    }))
                };

                visualizer.animateInsertion(planResult, table, (success) => {
                    if (success) {
                        table.slots[data.finalSlot] = {
                            slotNumber: data.finalSlot,
                            state: 'OCCUPIED',
                            car: {
                                registration: data.car.registrationNumber,
                                key: data.car.key,
                                hashIndex: data.hashIndex,
                                color: carColor,
                                probesNeeded: data.probes,
                                methodUsed: data.method
                            }
                        };
                        table.stats.totalCollisions += planResult.collisionCount;
                        table.stats.totalProbes += planResult.probesNeeded;

                        visualizer.renderAllSlots(table.slots);
                        visualizer.renderTable(table.slots);
                        updateKPIs();
                    }
                    isProcessing = false;
                    setControlsDisabled(false);
                });
                return;
            } catch (err) {
                console.warn('API error, falling back to client-side engine:', err);
                setBackendOfflineBadge();
            }
        }

        // Client-side fallback execution
        const plan = table.planInsertCar(regValue, currentMethod, { color: carColor });

        visualizer.animateInsertion(plan, table, (success) => {
            if (success) {
                table.commitInsert(plan, regValue, { color: carColor });
                visualizer.renderAllSlots(table.slots);
                visualizer.renderTable(table.slots);
                updateKPIs();
            }
            isProcessing = false;
            setControlsDisabled(false);
        });
    }

    if (btnPark) btnPark.addEventListener('click', handleParkCar);

    // 10. Operations: FIND A CAR (Connects to REST API if live)
    async function handleFindCar() {
        if (isProcessing) return;
        const regValue = regInput ? regInput.value.trim() : '';
        if (!regValue) {
            alert('Please enter a car registration number or key to find.');
            return;
        }

        isProcessing = true;
        setControlsDisabled(true);

        if (isBackendConnected) {
            try {
                const response = await fetch(`${API_BASE}/parking/search/${encodeURIComponent(regValue)}?method=${currentMethod}`);
                const data = await response.json();

                const searchResult = {
                    found: data.found,
                    key: data.key,
                    hashIndex: data.hashIndex,
                    slotNumber: data.foundAt,
                    probesRequired: data.probes,
                    searchSequence: data.steps ? data.steps.map(s => s.index) : [],
                    trace: data.steps ? data.steps.map((st, idx) => ({
                        probeStep: idx,
                        slotIndex: st.index,
                        formula: st.formula || `Slot ${st.index}`,
                        found: st.match,
                        isTerminator: st.status === 'EMPTY',
                        isTombstone: st.status === 'TOMBSTONE',
                        car: { registration: st.carRegistration || regValue }
                    })) : []
                };

                // Render search trajectory chip trail
                if (searchTrailContainer && searchTrailNodes) {
                    searchTrailContainer.style.display = 'flex';
                    searchTrailNodes.innerHTML = searchResult.searchSequence.map((slotNum, idx) => {
                        const isLast = idx === searchResult.searchSequence.length - 1;
                        const nodeClass = (isLast && searchResult.found) 
                            ? 'trail-node found' 
                            : (isLast && !searchResult.found ? 'trail-node empty-term' : 'trail-node');
                        return `<span class="${nodeClass}">[Slot ${slotNum}]</span>${isLast ? '' : ' &rarr; '}`;
                    }).join('');
                }

                visualizer.animateSearch(searchResult, () => {
                    isProcessing = false;
                    setControlsDisabled(false);
                });
                return;
            } catch (err) {
                console.warn('API error during search, falling back:', err);
                setBackendOfflineBadge();
            }
        }

        // Client-side fallback search
        const searchResult = table.searchCar(regValue, currentMethod);

        if (searchTrailContainer && searchTrailNodes) {
            searchTrailContainer.style.display = 'flex';
            searchTrailNodes.innerHTML = searchResult.searchSequence.map((slotNum, idx) => {
                const isLast = idx === searchResult.searchSequence.length - 1;
                const nodeClass = (isLast && searchResult.found) 
                    ? 'trail-node found' 
                    : (isLast && !searchResult.found ? 'trail-node empty-term' : 'trail-node');
                return `<span class="${nodeClass}">[Slot ${slotNum}]</span>${isLast ? '' : ' &rarr; '}`;
            }).join('');
        }

        visualizer.animateSearch(searchResult, () => {
            isProcessing = false;
            setControlsDisabled(false);
        });
    }

    if (btnFind) btnFind.addEventListener('click', handleFindCar);

    // 11. Operations: REMOVE A CAR (Connects to REST API if live)
    async function handleRemoveCar(regValue) {
        if (isProcessing) return;
        const targetReg = regValue || (regInput ? regInput.value.trim() : '');
        if (!targetReg) {
            alert('Please enter a car registration number to remove.');
            return;
        }

        if (isBackendConnected) {
            try {
                const response = await fetch(`${API_BASE}/parking/delete/${encodeURIComponent(targetReg)}?method=${currentMethod}`, {
                    method: 'DELETE'
                });
                const data = await response.json();

                if (!response.ok) {
                    alert(data.error || 'Failed to remove car.');
                    return;
                }

                visualizer.audio.playRemove();
                visualizer.clearSlotHighlights();
                visualizer.addNarration(`<strong>⛔ CAR REMOVED (API):</strong> ${data.message}`, 'step-tombstone');
                visualizer.addNarration(`Target Slot ${data.deletedSlot} marked as 🪦 <strong>TOMBSTONE</strong> on server.`, 'step-tombstone');

                table.slots[data.deletedSlot] = {
                    slotNumber: data.deletedSlot,
                    state: 'TOMBSTONE',
                    car: null
                };

                visualizer.renderAllSlots(table.slots);
                visualizer.renderTable(table.slots);
                updateKPIs();
                return;
            } catch (err) {
                console.warn('API delete error, falling back:', err);
                setBackendOfflineBadge();
            }
        }

        // Client-side fallback delete
        const delResult = table.deleteCar(targetReg, currentMethod);
        if (!delResult.success) {
            visualizer.audio.playCollision();
            visualizer.addNarration(`<strong>❌ Removal Failed:</strong> ${delResult.error}`, 'step-collision');
            alert(delResult.error);
            return;
        }

        visualizer.audio.playRemove();
        visualizer.clearSlotHighlights();
        visualizer.addNarration(`<strong>⛔ CAR REMOVED:</strong> ${delResult.message}`, 'step-tombstone');
        visualizer.addNarration(`Target Slot ${delResult.slotNumber} marked as 🪦 <strong>TOMBSTONE</strong>.`, 'step-tombstone');

        visualizer.renderAllSlots(table.slots);
        visualizer.renderTable(table.slots);
        updateKPIs();
    }

    if (btnRemove) {
        btnRemove.addEventListener('click', () => handleRemoveCar());
    }

    // 12. Quick Actions
    window.SmartParkingApp = {
        quickRemove: (plate) => handleRemoveCar(plate),
        loadPreset: (plate) => {
            if (regInput) {
                regInput.value = plate;
                regInput.dispatchEvent(new Event('input'));
            }
        },
        runBenchmarkSuite: (workloadKey) => comparator.runBenchmark(workloadKey)
    };

    // 13. Random Car Generator
    if (btnRandom) {
        btnRandom.addEventListener('click', () => {
            if (isProcessing) return;
            const states = ['TN', 'KA', 'MH', 'DL', 'KL', 'AP', 'TS', 'GJ', 'RJ', 'UP'];
            const letters = ['AB', 'CD', 'EF', 'GH', 'JK', 'LM', 'MN', 'XY', 'ZZ'];
            const randomState = states[Math.floor(Math.random() * states.length)];
            const randomDist = String(Math.floor(Math.random() * 20) + 1).padStart(2, '0');
            const randomLetters = letters[Math.floor(Math.random() * letters.length)];
            const randomNum = Math.floor(Math.random() * 9000) + 1000;

            const plate = `${randomState} ${randomDist} ${randomLetters} ${randomNum}`;
            if (regInput) {
                regInput.value = plate;
                regInput.dispatchEvent(new Event('input'));
            }
            handleParkCar();
        });
    }

    // 14. Reset Entire Lot
    if (btnReset) {
        btnReset.addEventListener('click', async () => {
            if (isProcessing) return;
            if (confirm(`Are you sure you want to reset all ${table.size} parking slots and statistics?`)) {
                if (isBackendConnected) {
                    try {
                        await fetch(`${API_BASE}/parking/reset`, { method: 'POST' });
                    } catch (e) {
                        console.warn('API reset failed:', e);
                    }
                }

                table.reset();
                visualizer.initSlots(table.size);
                visualizer.renderTable(table.slots);
                visualizer.clearNarration();
                visualizer.clearSlotHighlights();
                visualizer.updatePipeline(0);
                visualizer.addNarration(`<strong>🧹 Parking Lot Reset:</strong> All ${table.size} slots are now EMPTY.`, 'step-probe');
                if (searchTrailContainer) searchTrailContainer.style.display = 'none';
                updateKPIs();
            }
        });
    }

    // 15. Quick Preset Chips Listeners
    const presetChips = document.querySelectorAll('.preset-chip');
    presetChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const plate = chip.dataset.plate;
            if (plate && regInput) {
                regInput.value = plate;
                regInput.dispatchEvent(new Event('input'));
            }
        });
    });

    // 16. Update KPI Dashboard
    function updateKPIs() {
        const stats = table.updateStatistics();
        if (kpiOccupied) kpiOccupied.textContent = `${stats.occupiedSlots} / ${table.size}`;
        if (kpiAvailable) kpiAvailable.textContent = `${stats.availableSlots} / ${table.size}`;
        if (kpiLoadFactor) kpiLoadFactor.textContent = `${stats.loadFactorPercent}%`;
        if (kpiLfFill) {
            kpiLfFill.style.width = `${stats.loadFactorPercent}%`;
            if (stats.loadFactor < 0.5) {
                kpiLfFill.style.backgroundColor = '#10b981';
            } else if (stats.loadFactor < 0.75) {
                kpiLfFill.style.backgroundColor = '#f59e0b';
            } else {
                kpiLfFill.style.backgroundColor = '#ef4444';
            }
        }
        if (kpiCollisions) kpiCollisions.textContent = stats.totalCollisions;
        if (kpiSearches) kpiSearches.textContent = stats.totalSearches;
        if (kpiSearchesSub) {
            kpiSearchesSub.textContent = `${stats.successfulSearches} found • ${stats.failedSearches} missed (${stats.avgSearchProbes} avg probes)`;
        }
    }

    function setControlsDisabled(disabled) {
        if (btnPark) btnPark.disabled = disabled;
        if (btnFind) btnFind.disabled = disabled;
        if (btnRemove) btnRemove.disabled = disabled;
        if (btnRandom) btnRandom.disabled = disabled;
        if (btnReset) btnReset.disabled = disabled;
    }

    // 17. Interactive Hash Calculator Scratchpad (Dynamic for 47 slots)
    const calcInput = document.getElementById('calc-input-key');
    const calcBtn = document.getElementById('calc-compute-btn');
    const calcResults = document.getElementById('calc-results-output');

    function runCalculator() {
        if (!calcInput || !calcResults) return;
        const val = calcInput.value.trim();
        const key = SmartParkingHashTable.extractKey(val);
        if (key === null) {
            calcResults.innerHTML = `<span style="color: #ef4444;">Please enter a valid number or plate string.</span>`;
            return;
        }

        const tableSize = table.size;
        const secPrime = table.secondaryPrime;
        const h1 = key % tableSize;
        const h2 = secPrime - (key % secPrime);

        let linearSteps = [];
        let quadSteps = [];
        let doubleSteps = [];

        for (let i = 0; i < 6; i++) {
            linearSteps.push(`i=${i}: (${h1}+${i})%${tableSize} = <strong>${(h1 + i) % tableSize}</strong>`);
            quadSteps.push(`i=${i}: (${h1}+${i}²)%${tableSize} = <strong>${(h1 + i * i) % tableSize}</strong>`);
            doubleSteps.push(`i=${i}: (${h1}+${i}&times;${h2})%${tableSize} = <strong>${(h1 + i * h2) % tableSize}</strong>`);
        }

        calcResults.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.2rem; margin-top: 1rem;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
                    <div style="background: rgba(59, 130, 246, 0.1); padding: 0.85rem; border-radius: var(--radius-sm); border: 1px solid rgba(59, 130, 246, 0.3);">
                        <div style="font-size: 0.72rem; color: #93c5fd; text-transform: uppercase; font-weight: 700;">Extracted Key</div>
                        <div style="font-size: 1.3rem; font-weight: 800; font-family: var(--font-mono); color: #ffffff;">${key}</div>
                    </div>
                    <div style="background: rgba(16, 185, 129, 0.1); padding: 0.85rem; border-radius: var(--radius-sm); border: 1px solid rgba(16, 185, 129, 0.3);">
                        <div style="font-size: 0.72rem; color: #6ee7b7; text-transform: uppercase; font-weight: 700;">Primary Hash h(k) = key % ${tableSize}</div>
                        <div style="font-size: 1.3rem; font-weight: 800; font-family: var(--font-mono); color: #34d399;">${h1}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${key} % ${tableSize} = ${h1}</div>
                    </div>
                    <div style="background: rgba(236, 72, 153, 0.1); padding: 0.85rem; border-radius: var(--radius-sm); border: 1px solid rgba(236, 72, 153, 0.3);">
                        <div style="font-size: 0.72rem; color: #f472b6; text-transform: uppercase; font-weight: 700;">Secondary Hash h2(k)</div>
                        <div style="font-size: 1.3rem; font-weight: 800; font-family: var(--font-mono); color: #f472b6;">${h2}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${secPrime} - (${key} % ${secPrime}) = ${h2}</div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <div>
                        <strong style="color: #60a5fa; font-size: 0.8rem;">➡️ Linear Probing Trajectory (mod ${tableSize}):</strong>
                        <div style="font-family: var(--font-mono); font-size: 0.75rem; color: #cbd5e1; margin-top: 0.2rem;">
                            ${linearSteps.join(' &nbsp;|&nbsp; ')}
                        </div>
                    </div>
                    <div>
                        <strong style="color: #c084fc; font-size: 0.8rem;">📐 Quadratic Probing Trajectory (mod ${tableSize}):</strong>
                        <div style="font-family: var(--font-mono); font-size: 0.75rem; color: #cbd5e1; margin-top: 0.2rem;">
                            ${quadSteps.join(' &nbsp;|&nbsp; ')}
                        </div>
                    </div>
                    <div>
                        <strong style="color: #f472b6; font-size: 0.8rem;">🎯 Double Hashing Trajectory (Step size = ${h2}, mod ${tableSize}):</strong>
                        <div style="font-family: var(--font-mono); font-size: 0.75rem; color: #cbd5e1; margin-top: 0.2rem;">
                            ${doubleSteps.join(' &nbsp;|&nbsp; ')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    if (calcBtn) calcBtn.addEventListener('click', runCalculator);
    if (calcInput) {
        calcInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') runCalculator();
        });
    }

    runCalculator();
});
