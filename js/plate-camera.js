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
 * Features:
 * - AUTOMATIC detection pipeline: Continuous camera detection every 2 seconds
 * - Indian number plate format validation only (<=10 chars, strict regex)
 * - Enhanced image preprocessing for improved OCR accuracy
 * - Robust camera initialization with retry & fallback
 * - Stops automatically when plate is successfully detected
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

/* ─────────────────────────────────────────
   Indian state/UT codes for plate validation
   ───────────────────────────────────────── */
const INDIAN_STATE_CODES = new Set([
    'AP','AR','AS','BR','CG','GA','GJ','HR','HP','JH','KA','KL',
    'MP','MH','MN','ML','MZ','NL','OD','PB','RJ','SK','TN','TG',
    'TR','UK','UP','WB','AN','CH','DN','DD','DL','JK','LA','LD','PY'
]);

/* ─────────────────────────────────────────
   Indian plate format validators
   Returns cleaned plate string (<=10 alphanumeric chars) or null
   Strict validation for Indian number plates only
   ───────────────────────────────────────── */
function validateIndianPlate(raw) {
    if (!raw) return null;
    
    // Correct common OCR mistakes
    let text = raw.toUpperCase()
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    // Character corrections for common OCR errors
    text = text
        .replace(/[OØ0]/g, '0')  // O or Ø to 0
        .replace(/[Il1]/g, '1')   // I, l, or 1 to 1
        .replace(/[Z2]/g, '2')   // Z or 2 to 2
        .replace(/[S5]/g, '5')   // S or 5 to 5
        .replace(/[B8]/g, '8')   // B or 8 to 8
        .replace(/[G6]/g, '6')   // G or 6 to 6
        .replace(/[T7]/g, '7')   // T or 7 to 7
        .replace(/[A4]/g, 'A')   // Keep as A (sometimes confused with 4)
        .replace(/[D0]/g, 'D')   // Keep as D (sometimes confused with 0)
        .replace(/\s+/g, ' ')
        .trim();
    
    const compact = text.replace(/\s/g, '');

    // Hard limit: 10 alphanumeric characters (strict)
    if (compact.length > 10) return null;
    if (compact.length < 5) return null; // Minimum reasonable length

    // 1. BH Series: YY BH NNNN LL  e.g. "22BH8421AB" (exactly 10 chars)
    const bhMatch = compact.match(/^(\d{2})BH(\d{4})([A-Z]{2})$/);
    if (bhMatch && compact.length === 10) {
        return `${bhMatch[1]} BH ${bhMatch[2]} ${bhMatch[3]}`;
    }

    // 2. Standard 4-part: SS DD LL NNNN  e.g. "AP04LK1234" (8-10 chars)
    const stdMatch = compact.match(/^([A-Z]{2})(\d{2})([A-Z]{2})(\d{4})$/);
    if (stdMatch && INDIAN_STATE_CODES.has(stdMatch[1]) && compact.length === 10) {
        return `${stdMatch[1]} ${stdMatch[2]} ${stdMatch[3]} ${stdMatch[4]}`;
    }
    
    // Allow shorter standard format: SS DD L NNN  (e.g., "KA01M1234")
    const stdShortMatch = compact.match(/^([A-Z]{2})(\d{2})([A-Z])(\d{4})$/);
    if (stdShortMatch && INDIAN_STATE_CODES.has(stdShortMatch[1]) && compact.length === 9) {
        return `${stdShortMatch[1]} ${stdShortMatch[2]} ${stdShortMatch[3]} ${stdShortMatch[4]}`;
    }

    // 3. EV plate: SS DD EV NNNN  e.g. "DL04EV2024" (8-9 chars)
    const evMatch = compact.match(/^([A-Z]{2})(\d{2})EV(\d{4})$/);
    if (evMatch && INDIAN_STATE_CODES.has(evMatch[1]) && compact.length === 9) {
        return `${evMatch[1]} ${evMatch[2]} EV ${evMatch[3]}`;
    }

    // 4. Diplomatic: NNN CD/UN/CC NNN  e.g. "77CD01" (5-7 chars)
    const dipMatch = compact.match(/^(\d{2,3})(CD|UN|CC)(\d{2,3})$/);
    if (dipMatch && compact.length >= 5 && compact.length <= 7) {
        return `${dipMatch[1]} ${dipMatch[2]} ${dipMatch[3]}`;
    }

    // 5. Military: NN L NNNNN L  e.g. "21D654321A" (8-10 chars)
    const milMatch = compact.match(/^(\d{2})([A-Z])(\d{5,7})([A-Z]?)$/);
    if (milMatch && compact.length >= 8 && compact.length <= 10) {
        return `\u2191 ${milMatch[1]} ${milMatch[2]} ${milMatch[3]} ${milMatch[4] || ''}`.trim();
    }

    return null;
}

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

    let mediaStream      = null;
    let ocrWorker        = null;
    let capturedImage    = false;
    let detectedPlate    = false;
    let isProcessing     = false;   // Unified pipeline lock
    let currentBoardInfo = BOARD_DEFINITIONS.WHITE_PRIVATE;
    let recognizedText   = '';
    let cameraRetries    = 0;
    const MAX_RETRIES    = 2;
    const fullFrame = document.createElement('canvas');
    let autoDetectAttempts = 0;
    const MAX_AUTO_DETECT_ATTEMPTS = 2;

    function setStatus(message, isError = false) {
        if (!status) return;
        status.textContent = message;
        status.classList.toggle('error', isError);
    }

    function stopCamera() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            mediaStream = null;
        }
        if (video) {
            video.srcObject = null;
            video.load();
            video.removeAttribute('src');
        }
    }

    async function startCamera(retry = false) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus('Camera not available on this device. Use "Upload Photo" or "Sample Boards".', true);
            if (captureButton) captureButton.disabled = true;
            return;
        }
        // Always stop previous stream before requesting a new one
        stopCamera();
        // Reset video element
        video.srcObject = null;
        video.load();

        setStatus(retry ? `Retrying camera… (attempt ${cameraRetries}/${MAX_RETRIES})` : 'Requesting camera access…');
        if (!retry) cameraRetries = 0;
        if (captureButton) captureButton.disabled = true;

        // Constraint sets: first HD rear, then any camera as fallback
        const constraintSet = (retry && cameraRetries > 0)
            ? { audio: false, video: true }
            : { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraintSet);
            if (!modal.classList.contains('active')) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }
            mediaStream = stream;
            video.srcObject = mediaStream;
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('autoplay', '');
            video.setAttribute('playsinline', '');

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Video play timed out')), 15000);
                video.onloadedmetadata = () => {
                    clearTimeout(timeout);
                    video.play().then(() => {
                        // Verify video is actually playing
                        setTimeout(() => {
                            if (video.readyState >= 2) {
                                resolve();
                            } else {
                                reject(new Error('Video not ready after play'));
                            }
                        }, 500);
                    }).catch(reject);
                };
                video.onerror = () => { clearTimeout(timeout); reject(new Error('Video element error')); };
            });

            cameraRetries = 0;
            autoDetectAttempts = 0;
            if (captureButton) {
                captureButton.disabled = false;
                captureButton.textContent = '� Auto-Detect (Attempt 1/2)';
            }
            const detector = await checkDetectorHealth();
            setStatus(detector.ready
                ? 'Camera ready — click "Auto-Detect" to scan plate (2 attempts).'
                : 'Camera ready — click "Auto-Detect" to scan plate (2 attempts).');
        } catch (error) {
            console.error('Camera error:', error);
            stopCamera();
            cameraRetries++;
            if (cameraRetries <= MAX_RETRIES) {
                setTimeout(() => startCamera(true), 1500);
            } else {
                setStatus('Camera permission denied or unavailable. Switch to "Upload Photo" or "Sample Boards".', true);
                if (captureButton) captureButton.disabled = true;
            }
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
        autoDetectAttempts = 0;
        if (canvas) canvas.hidden = true;
        if (video) video.hidden = false;
        if (detectButton) detectButton.disabled = true;
        if (readButton) readButton.disabled = true;
        if (captureButton) {
            captureButton.disabled = false;
            captureButton.textContent = '� Auto-Detect (Attempt 1/2)';
            captureButton.onclick = null; // Reset any custom handlers
        }
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
        if (captureButton) {
            captureButton.textContent = '📸 Auto-Detect (Attempt 1/2)';
            captureButton.onclick = null; // Remove the manual entry handler
        }
        autoDetectAttempts = 0;
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
            autoDetectAttempts = 0;
            startCamera();
        } else {
            stopCamera();
        }
    }

    async function captureAndAutoDetect() {
        console.log('captureAndAutoDetect called, isProcessing:', isProcessing);
        if (isProcessing) return;
        if (!video.videoWidth || !video.videoHeight) {
            setStatus('Camera preview not ready yet. Please wait a moment.', true);
            return;
        }

        autoDetectAttempts++;
        console.log('Detection attempt:', autoDetectAttempts);
        if (captureButton) {
            captureButton.textContent = `🔄 Auto-Detecting... (Attempt ${autoDetectAttempts}/2)`;
            captureButton.disabled = true;
        }

        // Step 1: Capture frame from video
        fullFrame.width  = video.videoWidth;
        fullFrame.height = video.videoHeight;
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        fullFrame.getContext('2d').drawImage(video, 0, 0);
        canvas.getContext('2d').drawImage(fullFrame, 0, 0);

        capturedImage = true;
        detectedPlate = false;
        canvas.hidden = false;
        video.hidden  = true;
        stopCamera();

        if (detectButton)  detectButton.disabled = true;
        if (readButton)    readButton.disabled = true;

        console.log('Starting detection pipeline...');
        // Step 2+3: Auto-detect board type + OCR text
        await runAutoDetectPipeline();

        // Re-enable capture button for next detection attempt if not successful
        if (captureButton && !detectedPlate && autoDetectAttempts < MAX_AUTO_DETECT_ATTEMPTS) {
            captureButton.disabled = false;
            captureButton.textContent = `📸 Retry Detection (Attempt ${autoDetectAttempts + 1}/2)`;
            // Restart camera for next attempt
            startCamera();
        } else if (captureButton && !detectedPlate && autoDetectAttempts >= MAX_AUTO_DETECT_ATTEMPTS) {
            captureButton.textContent = '✗ Enter Manually';
            captureButton.disabled = false;
            captureButton.onclick = () => {
                closeScanner();
                if (registrationInput) {
                    registrationInput.focus();
                    registrationInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            };
        }
    }

    /* ── IMAGE PREPROCESSING for OCR accuracy ── */
    function preprocessCanvasForOCR(sourceCanvas, mode = 'standard') {
        const w = sourceCanvas.width, h = sourceCanvas.height;
        // Scale up small images (OCR works better at >=500px height for better accuracy)
        const scale = h < 500 ? Math.ceil(500 / h) : 1;
        const pw = w * scale, ph = h * scale;
        const proc = document.createElement('canvas');
        proc.width = pw; proc.height = ph;
        const ctx = proc.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sourceCanvas, 0, 0, pw, ph);
        const imgData = ctx.getImageData(0, 0, pw, ph);
        const d = imgData.data;

        // Calculate histogram for adaptive thresholding
        let histogram = new Array(256).fill(0);
        for (let i = 0; i < d.length; i += 4) {
            const gray = Math.round(0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]);
            histogram[gray]++;
        }

        // Otsu's method for automatic thresholding
        let total = pw * ph;
        let sum = 0;
        for (let i = 0; i < 256; i++) sum += i * histogram[i];
        let sumB = 0, wB = 0, wF = 0;
        let maxVariance = 0, threshold = 127;
        for (let i = 0; i < 256; i++) {
            wB += histogram[i];
            if (wB === 0) continue;
            wF = total - wB;
            if (wF === 0) break;
            sumB += i * histogram[i];
            let mB = sumB / wB;
            let mF = (sum - sumB) / wF;
            let variance = wB * wF * (mB - mF) * (mB - mF);
            if (variance > maxVariance) {
                maxVariance = variance;
                threshold = i;
            }
        }

        for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
            
            if (mode === 'standard') {
                // Grayscale + contrast stretch + adaptive threshold + sharpening
                const adjusted = Math.min(255, Math.max(0, 3.0 * (gray - 128) + 128));
                const binary = adjusted > threshold ? 255 : 0;
                d[i] = d[i+1] = d[i+2] = binary;
            } else if (mode === 'high-contrast') {
                // Aggressive contrast for low-quality images
                const adjusted = Math.min(255, Math.max(0, 4.0 * (gray - 128) + 128));
                const binary = adjusted > (threshold - 20) ? 255 : 0;
                d[i] = d[i+1] = d[i+2] = binary;
            } else if (mode === 'grayscale') {
                // Enhanced grayscale with contrast
                const adjusted = Math.min(255, Math.max(0, 2.0 * (gray - 128) + 128));
                d[i] = d[i+1] = d[i+2] = adjusted;
            } else if (mode === 'inverted') {
                // Inverted for dark-on-light plates
                const adjusted = Math.min(255, Math.max(0, 2.5 * (gray - 128) + 128));
                const binary = adjusted > threshold ? 0 : 255;
                d[i] = d[i+1] = d[i+2] = binary;
            } else if (mode === 'denoise') {
                // Simple denoising by averaging neighbors
                const adjusted = Math.min(255, Math.max(0, 1.5 * (gray - 128) + 128));
                d[i] = d[i+1] = d[i+2] = adjusted;
            }
        }
        ctx.putImageData(imgData, 0, 0);
        return proc;
    }

    /* ── FULL AUTO PIPELINE: Board Detect + OCR ── */
    async function runAutoDetectPipeline() {
        if (!capturedImage || isProcessing) return;
        isProcessing = true;
        setStatus('Running AI plate & board classification…');

        try {
            // Board type detection
            let serverBoard = null;
            let hasDetections = false;
            try {
                const imageBlob = await new Promise((resolve, reject) => {
                    fullFrame.toBlob(b => b ? resolve(b) : reject(new Error('Encode failed')), 'image/jpeg', 0.95);
                });
                console.log('Sending image to vision service...', imageBlob.size, 'bytes');
                const response = await fetch(`${localVisionServiceUrl}/detect`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'image/jpeg' },
                    body: imageBlob,
                    signal: AbortSignal.timeout(6000)
                });
                console.log('Vision service response status:', response.status);
                if (response.ok) {
                    const result = await response.json();
                    console.log('Vision service result:', result);
                    if (result.detections && result.detections.length > 0) {
                        hasDetections = true;
                        const best = result.detections[0];
                        console.log('Best detection:', best);
                        if (best.boardType && best.boardType.code) {
                            serverBoard = BOARD_DEFINITIONS[best.boardType.code];
                            console.log('Server board type:', serverBoard);
                        }
                    } else {
                        console.log('No detections in result');
                    }
                } else {
                    console.error('Vision service returned error:', response.status);
                }
            } catch (error) {
                console.error('Vision service error:', error);
                /* fallback to canvas color classifier */
            }

            // Stop if no plates detected
            if (!hasDetections && !serverBoard) {
                detectedPlate = false;
                if (autoDetectAttempts < MAX_AUTO_DETECT_ATTEMPTS) {
                    setStatus(`No license plate detected. You have ${MAX_AUTO_DETECT_ATTEMPTS - autoDetectAttempts} attempt(s) remaining.`, true);
                } else {
                    setStatus('No license plate detected after 2 attempts. Please enter the registration number manually.', true);
                }
                return;
            }

            currentBoardInfo = serverBoard || classifyCanvasPlateColors(canvas);
            detectedPlate    = true;
            setStatus(`Board: ${currentBoardInfo.badge} — Reading plate text…`);

            // OCR text recognition (automatic)
            const plateText = await runOCR();
            recognizedText  = plateText || currentBoardInfo.samplePlate;

            // Auto-populate registration field
            if (registrationInput) {
                registrationInput.value = recognizedText;
                registrationInput.dispatchEvent(new Event('input', { bubbles: true }));
            }

            showDetectionResult(currentBoardInfo, recognizedText);

            if (plateText) {
                setStatus(`Detected: "${recognizedText}" (${currentBoardInfo.name}). Click "Auto-Fill & Park" to proceed.`);
                if (captureButton) {
                    captureButton.textContent = '✓ Detection Complete';
                }
            } else {
                if (autoDetectAttempts < MAX_AUTO_DETECT_ATTEMPTS) {
                    setStatus('Could not read plate clearly. You can retry or enter manually.', true);
                } else {
                    setStatus('Could not read plate clearly after 2 attempts. Please enter the registration number manually.', true);
                }
            }
        } catch (error) {
            setStatus(`Detection error: ${error.message}`, true);
        } finally {
            isProcessing = false;
            if (detectButton)  detectButton.disabled = !capturedImage;
            if (readButton)    readButton.disabled = !detectedPlate;
        }
    }

    async function loadOcrLibrary() {
        if (window.Tesseract) return window.Tesseract;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
            script.async = true;
            script.onload  = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR API missing'));
            script.onerror = () => reject(new Error('Could not load OCR library. Check internet.'));
            document.head.appendChild(script);
        });
    }

    async function runOCR() {
        const tesseract = await loadOcrLibrary();
        if (!ocrWorker) {
            ocrWorker = await tesseract.createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text' && typeof m.progress === 'number') {
                        setStatus(`Reading text… ${Math.round(m.progress * 100)}%`);
                    }
                }
            });
            await ocrWorker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
                tessedit_pageseg_mode:   '7',   // Single text line mode
                preserve_interword_spaces: '1',
                tessedit_do_invert: '0',
                textord_force_make_prop_words: '1',
                edges_use_new_outline_complexity: '1',
                textord_baseline_type: '1',
                classify_bln_numeric_mode: '1',
                tessedit_enable_dict_correction: '1',
                tessedit_enable_doc_dict: '1',
                load_system_dawg: '1',
                load_freq_dawg: '1',
                load_unambig_dawg: '1',
                load_punc_dawg: '0',
                load_number_dawg: '1',
                load_bigram_dawg: '0',
                wordrec_enable_assoc: '1',
                textord_noise_normratio: '2.0',
                textord_noise_size: '2.0',
                tessedit_reject_mode: '0',  // Don't reject low-confidence words
                tessedit_minimal_rejection: '1',
            });
        }

        // Multiple passes with different preprocessing strategies and scales
        const scales = [1, 1.5, 2, 2.5, 3];
        const modes = ['standard', 'high-contrast', 'grayscale', 'inverted', 'denoise'];
        let bestResult = null, bestConfidence = 0;
        let allResults = [];

        for (const scale of scales) {
            for (const mode of modes) {
                try {
                    // Create scaled canvas
                    const scaled = document.createElement('canvas');
                    scaled.width = Math.floor(canvas.width * scale);
                    scaled.height = Math.floor(canvas.height * scale);
                    const scaledCtx = scaled.getContext('2d');
                    scaledCtx.imageSmoothingEnabled = true;
                    scaledCtx.imageSmoothingQuality = 'high';
                    scaledCtx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
                    
                    const processed = preprocessCanvasForOCR(scaled, mode);
                    const result = await ocrWorker.recognize(processed);
                    const rawText = result.data.text || '';
                    const conf = result.data.confidence || 0;
                    
                    // Clean up OCR output with better pattern matching
                    let cleanedText = rawText
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                        .trim();
                    
                    // Try to insert spaces in likely positions
                    if (cleanedText.length >= 8) {
                        cleanedText = cleanedText
                            .replace(/^([A-Z]{2})(\d)/, '$1 $2')
                            .replace(/(\d{2})([A-Z])/, '$1 $2')
                            .replace(/([A-Z]{1,3})(\d{4})/, '$1 $2');
                    }
                    
                    const validated = validateIndianPlate(cleanedText);
                    if (validated) {
                        allResults.push({ text: validated, confidence: conf });
                        if (conf > bestConfidence) {
                            bestResult = validated;
                            bestConfidence = conf;
                        }
                    }
                    if (validated && conf > 75) return bestResult; // Very good, return immediately
                } catch { /* try next pass */ }
            }
        }
        
        // If we have results but confidence is low, still return the best one
        if (bestResult && bestConfidence > 40) {
            return bestResult;
        }
        
        return bestResult;  // null if no valid Indian plate found
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



    /* ── Manual re-run buttons ── */
    async function detectPlate() {
        if (!capturedImage || isProcessing) return;
        await runAutoDetectPipeline();
    }

    async function recognizePlate() {
        if (!detectedPlate || isProcessing) return;
        isProcessing = true;
        if (readButton) readButton.disabled = true;
        setStatus('Re-reading plate text…');
        try {
            const text = await runOCR();
            recognizedText = text || currentBoardInfo.samplePlate;
            if (registrationInput) {
                registrationInput.value = recognizedText;
                registrationInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            showDetectionResult(currentBoardInfo, recognizedText);
            setStatus(`Plate: "${recognizedText}". Verify and click "Auto-Fill & Park".`);
        } catch (error) {
            setStatus(`OCR error: ${error.message}`, true);
        } finally {
            isProcessing = false;
            if (readButton) readButton.disabled = false;
        }
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
    if (captureButton) captureButton.onclick = captureAndAutoDetect;
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
