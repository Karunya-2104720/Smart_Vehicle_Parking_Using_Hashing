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
    const localVisionServiceUrl = 'http://127.0.0.1:8001';

    if (!openButton || !modal || !closeButton || !captureButton || !detectButton ||
        !readButton || !video || !canvas || !status || !registrationInput) {
        return;
    }

    let mediaStream = null;
    let ocrWorker = null;
    let capturedImage = false;
    let detectedPlate = false;
    let isReading = false;
    const fullFrame = document.createElement('canvas');

    function setStatus(message, isError = false) {
        status.textContent = message;
        status.classList.toggle('error', isError);
    }

    function stopCamera() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        video.srcObject = null;
    }

    async function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus('Camera access is unavailable. Use HTTPS or open the site on localhost.', true);
            captureButton.disabled = true;
            return;
        }

        setStatus('Requesting camera permission…');
        captureButton.disabled = true;

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
            captureButton.disabled = false;
            const detector = await checkDetectorHealth();
            setStatus(detector.ready
                ? 'Camera ready. Capture the vehicle; YOLO will find the plate in the image.'
                : `Camera ready, but the YOLO detector is unavailable: ${detector.error}`,
            !detector.ready);
        } catch (error) {
            stopCamera();
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                setStatus('Camera permission was denied. Allow camera access in your browser, then reopen this scanner.', true);
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                setStatus('No camera was found on this device.', true);
            } else {
                setStatus(`Could not start the camera: ${error.message}`, true);
            }
        }
    }

    async function checkDetectorHealth() {
        try {
            const response = await fetch(`${localVisionServiceUrl}/health`);
            const health = await response.json();
            return {
                ready: response.ok && health.ready === true,
                error: health.error || 'inference service is not responding'
            };
        } catch (error) {
            return {
                ready: false,
                error: 'Start the Smart Parking backend on this laptop, then allow local-network access in your browser.'
            };
        }
    }

    function openScanner() {
        capturedImage = false;
        detectedPlate = false;
        canvas.hidden = true;
        video.hidden = false;
        detectButton.disabled = true;
        readButton.disabled = true;
        captureButton.disabled = true;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        startCamera();
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
        readButton.disabled = true;
    }

    function captureFrame() {
        if (!video.videoWidth || !video.videoHeight) {
            setStatus('Camera is not ready yet. Wait for the preview, then try again.', true);
            return;
        }

        fullFrame.width = video.videoWidth;
        fullFrame.height = video.videoHeight;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const fullFrameContext = fullFrame.getContext('2d');
        const context = canvas.getContext('2d');
        if (!fullFrameContext || !context) {
            setStatus('Could not capture an image from the camera.', true);
            return;
        }

        fullFrameContext.drawImage(video, 0, 0, fullFrame.width, fullFrame.height);
        context.drawImage(fullFrame, 0, 0);
        capturedImage = true;
        detectedPlate = false;
        canvas.hidden = false;
        video.hidden = true;
        stopCamera();
        detectButton.disabled = false;
        readButton.disabled = true;
        setStatus('Image captured. Select “Detect plate with YOLO” to locate the plate.');
    }

    async function detectPlate() {
        if (!capturedImage || isReading) return;
        isReading = true;
        detectButton.disabled = true;
        readButton.disabled = true;
        captureButton.disabled = true;
        setStatus('Running YOLO11n plate detection…');

        try {
            const imageBlob = await new Promise((resolve, reject) => {
                fullFrame.toBlob(blob => {
                    if (blob) resolve(blob);
                    else reject(new Error('Could not encode the captured image.'));
                }, 'image/jpeg', 0.92);
            });
            const response = await fetch(`${localVisionServiceUrl}/detect`, {
                method: 'POST',
                headers: { 'Content-Type': 'image/jpeg' },
                body: imageBlob
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.detail || result.error || 'YOLO detection failed.');
            }

            const detections = result.detections || [];
            if (detections.length === 0) {
                detectedPlate = false;
                setStatus('YOLO did not find a plate. Retake the image with the vehicle closer and better lit.', true);
                return;
            }

            const detection = detections[0];
            const paddingX = detection.width * 0.3;
            const paddingY = detection.height * 0.5;
            const left = Math.max(0, Math.floor(detection.x - paddingX));
            const top = Math.max(0, Math.floor(detection.y - paddingY));
            const right = Math.min(fullFrame.width, Math.ceil(detection.x + detection.width + paddingX));
            const bottom = Math.min(fullFrame.height, Math.ceil(detection.y + detection.height + paddingY));
            const cropWidth = right - left;
            const cropHeight = bottom - top;
            const context = canvas.getContext('2d');
            if (!context || cropWidth <= 0 || cropHeight <= 0) {
                throw new Error('YOLO returned an invalid plate region.');
            }

            canvas.width = cropWidth * 3;
            canvas.height = cropHeight * 3;
            context.drawImage(fullFrame, left, top, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
            detectedPlate = true;
            readButton.disabled = false;
            setStatus(`YOLO found ${detections.length} plate${detections.length === 1 ? '' : 's'}; best confidence ${(detection.confidence * 100).toFixed(1)}%. Select “Read plate text”.`);
        } catch (error) {
            detectedPlate = false;
            setStatus(`Plate detection failed: ${error.message}`, true);
        } finally {
            isReading = false;
            detectButton.disabled = !capturedImage;
            captureButton.disabled = false;
        }
    }

    function loadOcrLibrary() {
        if (window.Tesseract) return Promise.resolve(window.Tesseract);

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
            script.async = true;
            script.onload = () => {
                if (window.Tesseract) resolve(window.Tesseract);
                else reject(new Error('OCR library loaded without its public API.'));
            };
            script.onerror = () => reject(new Error('Could not download the OCR library. Check your internet connection.'));
            document.head.appendChild(script);
        });
    }

    function formatPlateCandidate(text) {
        const normalized = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const match = normalized.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/);
        if (!match) return null;
        return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
    }

    async function recognizePlate() {
        if (!detectedPlate || isReading) return;
        isReading = true;
        readButton.disabled = true;
        captureButton.disabled = true;
        setStatus('Loading OCR and reading the captured image… The first run may take a little longer.');

        try {
            const tesseract = await loadOcrLibrary();
            if (!ocrWorker) {
                ocrWorker = await tesseract.createWorker('eng', 1, {
                    logger: event => {
                        if (event.status === 'recognizing text' && typeof event.progress === 'number') {
                            setStatus(`Reading plate… ${Math.round(event.progress * 100)}%`);
                        }
                    }
                });
                await ocrWorker.setParameters({
                    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
                    preserve_interword_spaces: '1'
                });
            }

            const result = await ocrWorker.recognize(canvas);
            const candidate = formatPlateCandidate(result.data.text);
            if (!candidate) {
                setStatus('OCR text did not match the expected plate format. Retake a clearer, closer image or enter the plate manually.', true);
                return;
            }

            registrationInput.value = candidate;
            registrationInput.dispatchEvent(new Event('input', { bubbles: true }));
            setStatus('Plate recognized. Check or correct the registration field before parking.');
            registrationInput.focus();
        } catch (error) {
            setStatus(`Plate reading failed: ${error.message}`, true);
        } finally {
            isReading = false;
            captureButton.disabled = false;
            readButton.disabled = !detectedPlate;
        }
    }

    openButton.addEventListener('click', openScanner);
    closeButton.addEventListener('click', closeScanner);
    captureButton.addEventListener('click', captureFrame);
    detectButton.addEventListener('click', detectPlate);
    readButton.addEventListener('click', recognizePlate);

    modal.addEventListener('click', event => {
        if (event.target === modal) closeScanner();
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && modal.classList.contains('active')) {
            closeScanner();
        }
    });
});
