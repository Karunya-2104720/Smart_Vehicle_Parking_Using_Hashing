# Vision Service Setup Guide

## Prerequisites

Ensure all Python dependencies are installed:

```bash
cd backend
pip install ultralytics opencv-python pillow torch torchvision inference-sdk
```

## Quick Start

### 1. Verify Model Exists

Check that the trained model exists:
```bash
ls vision/models/license-plate-yolo11n.pt
```

If not found, train the model:
```bash
npm run vision:download  # Download dataset
npm run vision:train     # Train model
```

### 2. Start Vision Service

**Option A: Standalone (for testing)**
```bash
cd backend
npm run vision:service
```

**Option B: Auto-start with backend (recommended)**
```bash
cd backend
npm start
```

The backend will automatically start the vision service if the model exists.

### 3. Verify Service is Running

```bash
curl http://127.0.0.1:8001/health
```

Expected response:
```json
{
  "ready": true,
  "model": "...",
  "device": "0",
  "error": null
}
```

Or check via backend:
```bash
curl http://127.0.0.1:5000/api/vision/health
```

## Configuration

Create a `.env` file in the backend directory (copy from `.env.example`):

```env
PORT=5000
TABLE_SIZE=70
SECONDARY_PRIME=67
FRONTEND_URL=http://localhost:3000
NODE_ENV=development

# Vision Service
VISION_MODEL_PATH=vision/models/license-plate-yolo11n.pt
VISION_CONFIDENCE=0.25
VISION_PORT=8001

# Optional: Roboflow Fallback
# ROBOFLOW_API_KEY=your_api_key
# ROBOFLOW_MODEL_ID=indian-number-platess/2
```

## Troubleshooting

### Vision service not starting

**Check if port 8001 is already in use:**
```bash
# Windows
netstat -ano | findstr :8001

# Kill the process if needed
taskkill /PID <pid> /F
```

**Check Python executable:**
```bash
python --version
```

If Python is not in PATH, set:
```env
PYTHON_EXECUTABLE=C:\Path\To\python.exe
```

### Detection not working in web app

1. **Verify vision service is running:**
   ```bash
   curl http://127.0.0.1:8001/health
   ```

2. **Check browser console for errors** (F12):
   - CORS errors
   - Network errors
   - JavaScript errors

3. **Verify model path is correct:**
   ```bash
   ls vision/models/license-plate-yolo11n.pt
   ```

### No detections found

**Lower confidence threshold:**
```env
VISION_CONFIDENCE=0.15
```

**Check image quality:**
- Ensure good lighting
- Plate should be clearly visible
- Avoid motion blur

## Alternative Detection Methods

### YOLO + EasyOCR (Standalone Testing)

```bash
cd backend/vision
python yolo_easyocr_detect.py --model models/license-plate-yolo11n.pt --source 0
```

Note: EasyOCR requires downloading ~200MB of models on first run.

### OpenCV + EasyOCR (Legacy)

```bash
cd backend/vision
python opencv_easyocr_detect.py --source 0
```

Note: Less accurate for Indian plates. Use only for testing.

## Board Type Classification

The system classifies 8 vehicle board types:

1. **White (Private)** - Standard private vehicles
2. **Yellow (Commercial)** - Taxis, cabs, goods vehicles
3. **Green (EV)** - Electric vehicles
4. **Black (Rental)** - Self-drive rental fleets
5. **Blue (Diplomatic)** - Embassy, UN, consular corps
6. **Red (Government)** - State officials, VIPs
7. **Arrow (Military)** - Armed forces vehicles
8. **BH Series** - Pan-India portability

Classification is done using HSV color analysis on the detected plate crop.

## Performance Tips

- Use GPU if available (CUDA)
- Lower image size for faster inference
- Increase confidence threshold to reduce false positives
- Use YOLO11n for fastest inference

## Security Notes

- Never commit `.env` file with API keys
- Roboflow API key is optional (local YOLO works without it)
- Vision service binds to localhost only (127.0.0.1)
