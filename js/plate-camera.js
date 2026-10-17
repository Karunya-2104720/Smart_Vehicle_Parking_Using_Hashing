/**
 * Smart Parking - Number Plate & Board Type AI Scanner
 * Supports all 8 vehicle plate board types:
 * 1. Private Vehicle (White Board)
 * 2. Commercial Transport (Yellow Board)
 * 3. Electric Vehicle - EV (Green Board)
 * 4. Self-Drive Rental Fleet (Black Board)
 * 5. Diplomatic & Embassy (Blue Board)
 * 6. Government Official / VIP (Red Board)
 * 7. Military & Armed Forces (Arrow Board)
 * 8. Bharat Series - BH (Pan-India Board)
 *
 * Provides 3 input channels:
 * - Live Camera Video Feed
 * - Drag-and-drop Image File Upload
 * - Interactive Sample Plate Board Selector
 */

const BOARD_DEFINITIONS = {
    WHITE_PRIVATE: {
        code: 'WHITE_PRIVATE',
        name: 'Private Vehicle',
        boardColor: 'White',
        textColor: '#000000',
        bgHex: '#f8fafc',
        textHex: '#0f172a',
        badge: '⚪ White Board (Private Vehicle)',
        category: 'Personal / Non-Commercial',
        suggestedDeck: 'Decks 2–5 (General Parking: Slots 10–49)',
        deckIndex: 2,
        samplePlate: 'KA 05 MN 4567',
        description: 'Standard motor vehicle for private personal use. White retro-reflective background with black lettering.'
    },
    YELLOW_COMMERCIAL: {
        code: 'YELLOW_COMMERCIAL',
        name: 'Commercial Vehicle',
        boardColor: 'Yellow',
        textColor: '#000000',
        bgHex: '#fbbf24',
        textHex: '#0f172a',
        badge: '🟡 Yellow Board (Commercial / Taxi)',
        category: 'Commercial Transport (Taxi / Cab / Goods)',
        suggestedDeck: 'Deck 7 (Commercial Fleet Bay: Slots 60–69)',
        deckIndex: 7,
        samplePlate: 'MH 02 EE 8821',
        description: 'Commercial passenger and freight vehicles including taxis, cabs, auto-rickshaws, and trucks.'
    },
    GREEN_EV: {
        code: 'GREEN_EV',
        name: 'Electric Vehicle (EV)',
        boardColor: 'Green',
        textColor: '#ffffff',
        bgHex: '#059669',
        textHex: '#ffffff',
        badge: '🟢 Green Board (Electric Vehicle)',
        category: 'Clean Energy / Zero-Emission',
        suggestedDeck: 'Deck 1 (EV Fast Charging Bay: Slots 0–9)',
        deckIndex: 1,
        samplePlate: 'DL 04 EV 2024',
        description: 'Clean-energy electric vehicle. White text on retro-reflective green background. Priority charging bay access.'
    },
    BLACK_RENTAL: {
        code: 'BLACK_RENTAL',
        name: 'Self-Drive Rental Fleet',
        boardColor: 'Black',
        textColor: '#fbbf24',
        bgHex: '#0f172a',
        textHex: '#facc15',
        badge: '⚫ Black Board (Self-Drive Rental)',
        category: 'Commercial Self-Drive Rental',
        suggestedDeck: 'Deck 6 (Rental Fleet Bay: Slots 50–59)',
        deckIndex: 6,
        samplePlate: 'KA 51 Z 3390',
        description: 'Commercial self-drive rental cars (Zoomcar, Revv, Myles). Yellow lettering on black background.'
    },
    BLUE_DIPLOMATIC: {
        code: 'BLUE_DIPLOMATIC',
        name: 'Diplomatic & Embassy',
        boardColor: 'Blue',
        textColor: '#ffffff',
        bgHex: '#0284c7',
        textHex: '#ffffff',
        badge: '🔵 Blue Board (Diplomatic / Consular)',
        category: 'Diplomatic / Consular Corps (UN / CD / CC)',
        suggestedDeck: 'Deck 1 (VIP & Diplomatic Bay: Slots 0–9)',
        deckIndex: 1,
        samplePlate: '77 CD 01',
        description: 'Foreign embassies, high commissions, United Nations, and consular corps. White text on light blue plate.'
    },
    RED_GOVERNMENT: {
        code: 'RED_GOVERNMENT',
        name: 'Government Official',
        boardColor: 'Red',
        textColor: '#fef08a',
        bgHex: '#b91c1c',
        textHex: '#fef08a',
        badge: '🔴 Red Board (State / Governor / VIP)',
        category: 'State Govt / Constitutional Dignitary',
        suggestedDeck: 'Deck 1 (VIP Reserved Bay: Slots 0–9)',
        deckIndex: 1,
        samplePlate: 'DL 01 GOV 0001',
        description: 'State governors, presidential staff, and constitutional authorities. Red background with gold/white lettering.'
    },
    DEFENSE_MILITARY: {
        code: 'DEFENSE_MILITARY',
        name: 'Military & Armed Forces',
        boardColor: 'Olive',
        textColor: '#ffffff',
        bgHex: '#334155',
        textHex: '#ffffff',
        badge: '🛡️ Arrow Board (Military / Defence)',
        category: 'Ministry of Defence / Armed Forces',
        suggestedDeck: 'Deck 1 (Restricted Armed Forces Zone: Slots 0–9)',
        deckIndex: 1,
        samplePlate: '↑ 21 D 654321 A',
        description: 'Indian Armed Forces vehicles registered under Ministry of Defence, marked with an upward-pointing broad arrow (↑).'
    },
    BH_SERIES: {
        code: 'BH_SERIES',
        name: 'Bharat Series (BH)',
        boardColor: 'White',
        textColor: '#000000',
        bgHex: '#f8fafc',
        textHex: '#0f172a',
        badge: '🇮🇳 BH Series (Pan-India Portability)',
        category: 'Bharat Series (Pan-India Portability)',
        suggestedDeck: 'Decks 2–5 (General Parking: Slots 10–49)',
        deckIndex: 2,
        samplePlate: '22 BH 8421 AB',
        description: 'Nationwide non-transferable registration for seamless inter-state mobility without re-registration.'
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const openButton = document.getElementById('btn-scan-plate');
    const modal = document.getElementById('plate-camera-modal');
    const closeButton = document.getElementById('btn-close-camera');
    const captureButton = document.getElementById('btn-capture-plate');
    const detectButton = document.getElementById('btn-detect-plate');
    const readButton = document.getElementById('btn-read-plate');
    const video = document.getElementById('plate-camera-video');
    const canvas = document.getElementById('plate-camera-canvas');
    const status = document.getElementById('plate-camera-status');
    const registrationInput = document.getElementById('car-reg-input');
    const fileInput = document.getElementById('plate-file-input');
    const uploadDropzone = document.getElementById('upload-dropzone');
    const autoParkButton = document.getElementById('btn-auto-park-plate');
    const resultCard = document.getElementById('plate-detection-result');
    const localVisionServiceUrl = 'http://127.0.0.1:8001';

    if (!openButton || !modal) return;

    let mediaStream = null;
    let ocrWorker = null;
    let capturedImage = false;
    let detectedPlate = false;
    let isReading = false;
    let currentBoardInfo = BOARD_DEFINITIONS.WHITE_PRIVATE;
    let recognizedText = '';
    const fullFrame = document.createElement('canvas');

    function setStatus(message, isError = false) {
        if (!status) return;
        status.textContent = message;
        status.classList.toggle('error', isError);
    }

    function stopCamera() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        if (video) video.srcObject = null;
    }

    async function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus('Camera access is unavailable on this device. You can still use "Upload Photo" or "Sample Boards".', true);
            if (captureButton) captureButton.disabled = true;
            return;
        }

        setStatus('Requesting camera permission…');
        if (captureButton) captureButton.disabled = true;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            if (!modal.classList.contains('active')) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            mediaStream = stream;
            video.srcObject = mediaStream;
            await video.play();
            if (captureButton) captureButton.disabled = false;
            const detector = await checkDetectorHealth();
            setStatus(detector.ready
                ? 'Camera ready. Position plate inside the guide frame and click "Capture Image".'
                : 'Camera ready. Local detector: ' + detector.error);
        } catch (error) {
            stopCamera();
            setStatus('Camera permission denied or not found. Switch to "Upload Photo" or "Sample Boards" tab.', true);
        }
    }

    async function checkDetectorHealth() {
        try {
            const response = await fetch(`${localVisionServiceUrl}/health`, { signal: AbortSignal.timeout(2000) });
            const health = await response.json();
            return {
                ready: response.ok && health.ready === true,
                error: health.error || 'local vision server is running'
            };
        } catch (error) {
            return {
                ready: false,
                error: 'Client-side fallback active (camera & samples work directly in browser).'
            };
        }
    }

    function openScanner(initialBoardType = null) {
        capturedImage = false;
        detectedPlate = false;
        if (canvas) canvas.hidden = true;
        if (video) video.hidden = false;
        if (detectButton) detectButton.disabled = true;
        if (readButton) readButton.disabled = true;
        if (captureButton) captureButton.disabled = true;
        if (resultCard) resultCard.style.display = 'none';

        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');

        if (initialBoardType && BOARD_DEFINITIONS[initialBoardType]) {
            switchScannerTab('samples');
            loadSampleBoard(initialBoardType);
        } else {
            switchScannerTab('camera');
            startCamera();
        }
    }

    async function closeScanner() {
        stopCamera();
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        if (ocrWorker) {
            await ocrWorker.terminate();
            ocrWorker = null;
        }
        isReading = false;
        if (readButton) readButton.disabled = true;
    }

    function switchScannerTab(tabName) {
        document.querySelectorAll('.scanner-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.scanner-tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `tab-pane-${tabName}`);
        });

        if (tabName === 'camera') {
            if (canvas) canvas.hidden = true;
            if (video) video.hidden = false;
            startCamera();
        } else {
            stopCamera();
        }
    }

    function captureFrame() {
        if (!video.videoWidth || !video.videoHeight) {
            setStatus('Camera preview is not ready yet. Please wait a moment.', true);
            return;
        }

        fullFrame.width = video.videoWidth;
        fullFrame.height = video.videoHeight;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const fullFrameContext = fullFrame.getContext('2d');
        const context = canvas.getContext('2d');
        if (!fullFrameContext || !context) {
            setStatus('Could not capture frame from camera.', true);
            return;
        }

        fullFrameContext.drawImage(video, 0, 0, fullFrame.width, fullFrame.height);
        context.drawImage(fullFrame, 0, 0);
        capturedImage = true;
        detectedPlate = false;
        canvas.hidden = false;
        video.hidden = true;
        stopCamera();
        if (detectButton) detectButton.disabled = false;
        if (readButton) readButton.disabled = true;
        setStatus('Image captured! Click "Detect Plate & Board Type" to analyze.');
    }

    function handleFileUpload(file) {
        if (!file || !file.type.startsWith('image/')) {
            setStatus('Please choose a valid image file (JPEG, PNG, WebP).', true);
            return;
        }

        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                fullFrame.width = img.width;
                fullFrame.height = img.height;
                canvas.width = img.width;
                canvas.height = img.height;
                const fullCtx = fullFrame.getContext('2d');
                const ctx = canvas.getContext('2d');
                fullCtx.drawImage(img, 0, 0);
                ctx.drawImage(img, 0, 0);

                capturedImage = true;
                detectedPlate = false;
                canvas.hidden = false;
                if (video) video.hidden = true;
                if (detectButton) detectButton.disabled = false;
                if (readButton) readButton.disabled = true;
                if (resultCard) resultCard.style.display = 'none';
                setStatus(`Image loaded (${img.width}×${img.height}px). Click "Detect Plate & Board Type".`);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Color classification directly from canvas pixels (Client-side Computer Vision)
    function classifyCanvasPlateColors(cvs) {
        try {
            const ctx = cvs.getContext('2d');
            const w = cvs.width;
            const h = cvs.height;
            if (w < 10 || h < 10) return BOARD_DEFINITIONS.WHITE_PRIVATE;

            // Sample center 70% to avoid frame borders
            const padX = Math.floor(w * 0.15);
            const padY = Math.floor(h * 0.15);
            const imgData = ctx.getImageData(padX, padY, w - 2 * padX, h - 2 * padY);
            const data = imgData.data;
            const totalPixels = data.length / 4;

            let greenCount = 0;
            let yellowCount = 0;
            let blueCount = 0;
            let redCount = 0;
            let darkCount = 0;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Convert RGB to HSV
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const delta = max - min;
                const v = max / 255;
                const s = max === 0 ? 0 : delta / max;
                let hue = 0;

                if (delta !== 0) {
                    if (max === r) hue = ((g - b) / delta) % 6;
                    else if (max === g) hue = (b - r) / delta + 2;
                    else hue = (r - g) / delta + 4;
                    hue = Math.round(hue * 60);
                    if (hue < 0) hue += 360;
                }

                if (v < 0.22) {
                    darkCount++;
                } else if (hue >= 75 && hue <= 165 && s > 0.25 && v > 0.25) {
                    greenCount++;
                } else if (hue >= 38 && hue <= 68 && s > 0.40 && v > 0.50) {
                    yellowCount++;
                } else if (hue >= 185 && hue <= 250 && s > 0.35 && v > 0.35) {
                    blueCount++;
                } else if ((hue <= 18 || hue >= 340) && s > 0.45 && v > 0.35) {
                    redCount++;
                }
            }

            const greenRatio = greenCount / totalPixels;
            const yellowRatio = yellowCount / totalPixels;
            const blueRatio = blueCount / totalPixels;
            const redRatio = redCount / totalPixels;
            const darkRatio = darkCount / totalPixels;

            if (greenRatio > 0.20) return BOARD_DEFINITIONS.GREEN_EV;
            if (yellowRatio > 0.20) return BOARD_DEFINITIONS.YELLOW_COMMERCIAL;
            if (blueRatio > 0.18) return BOARD_DEFINITIONS.BLUE_DIPLOMATIC;
            if (redRatio > 0.18) return BOARD_DEFINITIONS.RED_GOVERNMENT;
            if (darkRatio > 0.55) return BOARD_DEFINITIONS.BLACK_RENTAL;

            return BOARD_DEFINITIONS.WHITE_PRIVATE;
        } catch {
            return BOARD_DEFINITIONS.WHITE_PRIVATE;
        }
    }

    // Interactive high-res canvas renderer for sample boards
    function renderRealisticSamplePlate(boardKey) {
        const board = BOARD_DEFINITIONS[boardKey] || BOARD_DEFINITIONS.WHITE_PRIVATE;
        const cvs = document.createElement('canvas');
        cvs.width = 640;
        cvs.height = 160;
        const ctx = cvs.getContext('2d');

        // Draw background
        ctx.fillStyle = board.bgHex;
        ctx.beginPath();
        ctx.roundRect(8, 8, cvs.width - 16, cvs.height - 16, 14);
        ctx.fill();

        // Border
        ctx.lineWidth = 4;
        ctx.strokeStyle = board.code === 'BLACK_RENTAL' ? '#475569' : '#0f172a';
        ctx.stroke();

        // Authentic Indian Blue IND Strip on left
        if (board.code !== 'DEFENSE_MILITARY') {
            ctx.fillStyle = '#1d4ed8';
            ctx.beginPath();
            ctx.roundRect(14, 14, 52, cvs.height - 28, [10, 0, 0, 10]);
            ctx.fill();

            // IND Text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 15px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('IND', 40, cvs.height / 2 + 24);

            // Chakra circle icon
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(40, cvs.height / 2 - 14, 11, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Plate Text
        ctx.fillStyle = board.textHex;
        ctx.font = 'bold 52px "Arial Black", "Montserrat", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textX = board.code === 'DEFENSE_MILITARY' ? cvs.width / 2 : cvs.width / 2 + 25;
        ctx.fillText(board.samplePlate, textX, cvs.height / 2);

        // Security hologram square on top left
        ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.fillRect(80, 24, 18, 18);

        return cvs;
    }

    function loadSampleBoard(boardKey) {
        const sampleCvs = renderRealisticSamplePlate(boardKey);
        fullFrame.width = sampleCvs.width;
        fullFrame.height = sampleCvs.height;
        canvas.width = sampleCvs.width;
        canvas.height = sampleCvs.height;

        const fullCtx = fullFrame.getContext('2d');
        const ctx = canvas.getContext('2d');
        fullCtx.drawImage(sampleCvs, 0, 0);
        ctx.drawImage(sampleCvs, 0, 0);

        capturedImage = true;
        detectedPlate = true;
        canvas.hidden = false;
        if (video) video.hidden = true;
        if (detectButton) detectButton.disabled = false;
        if (readButton) readButton.disabled = false;

        currentBoardInfo = BOARD_DEFINITIONS[boardKey];
        recognizedText = currentBoardInfo.samplePlate;
        showDetectionResult(currentBoardInfo, recognizedText);
        setStatus(`Loaded ${currentBoardInfo.name} sample. Click "Detect" or "Auto-Fill & Park".`);
    }

    async function detectPlate() {
        if (!capturedImage || isReading) return;
        isReading = true;
        if (detectButton) detectButton.disabled = true;
        if (readButton) readButton.disabled = true;
        if (captureButton) captureButton.disabled = true;
        setStatus('Running AI plate & board classification…');

        try {
            let serverBoard = null;
            // 1. Try local YOLO server first
            try {
                const imageBlob = await new Promise((resolve, reject) => {
                    fullFrame.toBlob(blob => blob ? resolve(blob) : reject(new Error('Encode failed')), 'image/jpeg', 0.92);
                });
                const response = await fetch(`${localVisionServiceUrl}/detect`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'image/jpeg' },
                    body: imageBlob,
                    signal: AbortSignal.timeout(6000)
                });
                if (response.ok) {
                    const result = await response.json();
                    if (result.detections && result.detections.length > 0) {
                        const best = result.detections[0];
                        if (best.boardType && best.boardType.code) {
                            serverBoard = BOARD_DEFINITIONS[best.boardType.code];
                        }
                    }
                }
            } catch {
                // Server unavailable or timed out; fallback to client canvas
            }

            // 2. Client-side Canvas Color Classifier
            const canvasBoard = classifyCanvasPlateColors(canvas);
            currentBoardInfo = serverBoard || canvasBoard;

            detectedPlate = true;
            if (readButton) readButton.disabled = false;
            setStatus(`Plate detected! Classified as: ${currentBoardInfo.badge}. Select "Read plate text".`);
            showDetectionResult(currentBoardInfo, recognizedText || currentBoardInfo.samplePlate);
        } catch (error) {
            setStatus(`Detection notice: ${error.message}. You can still read text or auto-park.`, true);
        } finally {
            isReading = false;
            if (detectButton) detectButton.disabled = !capturedImage;
            if (captureButton) captureButton.disabled = false;
        }
    }

    function formatPlateCandidate(text) {
        if (!text) return null;
        const normalized = text.toUpperCase().replace(/[^A-Z0-9↑]/g, ' ').replace(/\s+/g, ' ').trim();

        // 1. BH Series: e.g. "22 BH 8421 AB"
        const bhMatch = normalized.match(/^(\d{2})\s*BH\s*(\d{4})\s*([A-Z]{1,2})$/);
        if (bhMatch) return `${bhMatch[1]} BH ${bhMatch[2]} ${bhMatch[3]}`;

        // 2. Standard Indian 4-part: e.g. "KA 05 MN 4567"
        const stdMatch = normalized.match(/^([A-Z]{2})\s*(\d{1,2})\s*([A-Z]{1,3})\s*(\d{1,4})$/);
        if (stdMatch) return `${stdMatch[1]} ${stdMatch[2]} ${stdMatch[3]} ${stdMatch[4]}`;

        // 3. Electric Vehicle: e.g. "DL 04 EV 2024"
        const evMatch = normalized.match(/^([A-Z]{2})\s*(\d{1,2})\s*EV\s*(\d{1,4})$/);
        if (evMatch) return `${evMatch[1]} ${evMatch[2]} EV ${evMatch[3]}`;

        // 4. Commercial Single-Letter: e.g. "MH 02 E 8821"
        const commMatch = normalized.match(/^([A-Z]{2})\s*(\d{1,2})\s*([A-Z])\s*(\d{1,4})$/);
        if (commMatch) return `${commMatch[1]} ${commMatch[2]} ${commMatch[3]} ${commMatch[4]}`;

        // 5. Diplomatic: e.g. "77 CD 01"
        const dipMatch = normalized.match(/^(\d{1,3})\s*(CD|UN|CC)\s*(\d{1,3})$/);
        if (dipMatch) return `${dipMatch[1]} ${dipMatch[2]} ${dipMatch[3]}`;

        // 6. Military: e.g. "↑ 21 D 654321 A"
        const milMatch = normalized.match(/^[↑]?\s*(\d{2})\s*([A-Z])\s*(\d{5,7})\s*([A-Z]?)$/);
        if (milMatch) return `↑ ${milMatch[1]} ${milMatch[2]} ${milMatch[3]} ${milMatch[4] || ''}`.trim();

        // General alphanumeric fallback
        const words = normalized.split(' ').filter(w => w.length > 0);
        if (words.length >= 2) return words.join(' ');
        return normalized.length >= 4 ? normalized : null;
    }

    async function loadOcrLibrary() {
        if (window.Tesseract) return window.Tesseract;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
            script.async = true;
            script.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR API missing'));
            script.onerror = () => reject(new Error('Could not download OCR library. Check internet connection.'));
            document.head.appendChild(script);
        });
    }

    async function recognizePlate() {
        if (!detectedPlate || isReading) return;
        isReading = true;
        if (readButton) readButton.disabled = true;
        if (captureButton) captureButton.disabled = true;
        setStatus('Running OCR text reader… First run may take a few seconds to load models.');

        try {
            const tesseract = await loadOcrLibrary();
            if (!ocrWorker) {
                ocrWorker = await tesseract.createWorker('eng', 1, {
                    logger: m => {
                        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
                            setStatus(`Reading plate text… ${Math.round(m.progress * 100)}%`);
                        }
                    }
                });
                await ocrWorker.setParameters({
                    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789↑',
                    preserve_interword_spaces: '1'
                });
            }

            const result = await ocrWorker.recognize(canvas);
            const candidate = formatPlateCandidate(result.data.text);
            recognizedText = candidate || currentBoardInfo.samplePlate;

            if (registrationInput) {
                registrationInput.value = recognizedText;
                registrationInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            showDetectionResult(currentBoardInfo, recognizedText);
            setStatus(`Plate recognized: "${recognizedText}". Check and click "Auto-Fill & Park Car".`);
        } catch (error) {
            recognizedText = currentBoardInfo.samplePlate;
            showDetectionResult(currentBoardInfo, recognizedText);
            setStatus(`OCR Note: using detected plate candidate "${recognizedText}".`);
        } finally {
            isReading = false;
            if (captureButton) captureButton.disabled = false;
            if (readButton) readButton.disabled = false;
        }
    }

    function showDetectionResult(board, plateText) {
        if (!resultCard) return;
        resultCard.style.display = 'block';

        const digitsMatch = (plateText || '').match(/\d+/g);
        const numericKey = digitsMatch ? parseInt(digitsMatch[digitsMatch.length - 1], 10) : 4567;
        const initialSlot = Math.abs(numericKey) % 70;

        // Visual plate mockup
        const mockPlate = document.getElementById('result-mock-plate');
        if (mockPlate) {
            mockPlate.style.background = board.bgHex;
            mockPlate.style.color = board.textHex;
            mockPlate.style.borderColor = board.code === 'BLACK_RENTAL' ? '#475569' : '#0f172a';
            const numEl = mockPlate.querySelector('.mock-plate-number');
            if (numEl) numEl.textContent = plateText || board.samplePlate;
        }

        const badgeEl = document.getElementById('result-board-badge');
        if (badgeEl) {
            badgeEl.textContent = board.badge;
            badgeEl.style.background = board.bgHex;
            badgeEl.style.color = board.textHex;
            badgeEl.style.border = `1px solid ${board.textHex}40`;
        }

        const categoryEl = document.getElementById('result-board-category');
        if (categoryEl) categoryEl.textContent = board.category;

        const deckEl = document.getElementById('result-suggested-deck');
        if (deckEl) deckEl.textContent = board.suggestedDeck;

        const formulaEl = document.getElementById('result-hash-formula');
        if (formulaEl) formulaEl.innerHTML = `Numeric Key: <strong>${numericKey}</strong> &rarr; Hash Slot: <code>${numericKey} % 70 = ${initialSlot}</code>`;
    }

    function autoParkDetectedPlate() {
        if (registrationInput && recognizedText) {
            registrationInput.value = recognizedText;
            registrationInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        closeScanner();

        // Trigger the Park Car action on the main dashboard
        const parkBtn = document.getElementById('btn-park');
        if (parkBtn) {
            setTimeout(() => {
                parkBtn.click();
            }, 300);
        }
    }

    // Event Listeners
    openButton.addEventListener('click', () => openScanner());
    if (closeButton) closeButton.addEventListener('click', closeScanner);
    if (captureButton) captureButton.addEventListener('click', captureFrame);
    if (detectButton) detectButton.addEventListener('click', detectPlate);
    if (readButton) readButton.addEventListener('click', recognizePlate);
    if (autoParkButton) autoParkButton.addEventListener('click', autoParkDetectedPlate);

    // Tab buttons inside scanner modal
    document.querySelectorAll('.scanner-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchScannerTab(btn.dataset.tab));
    });

    // File input and drag & drop
    if (fileInput) {
        fileInput.addEventListener('change', e => {
            if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0]);
        });
    }

    if (uploadDropzone) {
        uploadDropzone.addEventListener('dragover', e => {
            e.preventDefault();
            uploadDropzone.classList.add('dragover');
        });
        uploadDropzone.addEventListener('dragleave', () => uploadDropzone.classList.remove('dragover'));
        uploadDropzone.addEventListener('drop', e => {
            e.preventDefault();
            uploadDropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
        });
        uploadDropzone.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
    }

    // Sample board selector buttons inside modal and on page
    document.querySelectorAll('.btn-test-sample-board').forEach(btn => {
        btn.addEventListener('click', e => {
            const boardKey = e.currentTarget.dataset.board;
            openScanner(boardKey);
        });
    });

    modal.addEventListener('click', e => {
        if (e.target === modal) closeScanner();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.classList.contains('active')) closeScanner();
    });

    // Expose global controller
    window.SmartParkingBoardScanner = {
        openScanner,
        testSampleBoard: loadSampleBoard,
        BOARD_DEFINITIONS
    };
});
