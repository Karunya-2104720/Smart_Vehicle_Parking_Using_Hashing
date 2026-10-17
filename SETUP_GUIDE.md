# Smart Parking System - Setup & Usage Guide

## Current Status ✅

All systems are working correctly:
- ✅ Backend server running (port 5000)
- ✅ Vision service running (port 8001)
- ✅ Trained YOLO model loaded
- ✅ Detection pipeline operational
- ✅ Board type classification working

## Quick Start

### For Windows Users

1. **Start the backend:**
   ```bash
   cd backend
   start.bat
   ```

   Or manually:
   ```bash
   cd backend
   npm start
   ```

2. **Open the frontend:**
   - Open `index.html` in your browser
   - Or go to http://localhost:5000 (if backend serves frontend)

### For Linux/Mac Users

```bash
cd backend
npm start
```

## How Detection Works

### Detection Flow

1. **User opens camera** in the web app
2. **User clicks "Auto-Detect"** (2 attempts allowed)
3. **Frontend captures image** from camera
4. **Image sent to vision service** (port 8001)
5. **YOLO model detects plates** in the image
6. **Board type classified** (White, Yellow, Green, etc.)
7. **OCR reads plate text** (Tesseract.js in browser)
8. **Results displayed** to user
9. **If no detection after 2 attempts**: User prompted to enter manually

### Vision Service Architecture

```
Frontend (Browser)
    ↓ POST image
Backend (port 5000)
    ↓ Proxy request
Vision Service (port 8001)
    ↓ YOLO detection
Backend Response
    ↓ JSON results
Frontend Display
```

## Troubleshooting

### Detection Not Working

**1. Check if vision service is running:**
```bash
curl http://127.0.0.1:8001/health
```

Should return:
```json
{"ready":true,"model":"...","device":"0","error":null}
```

**2. If not running, start it:**
```bash
cd backend
npm run vision:service
```

**3. Check browser console (F12):**
- Look for CORS errors
- Look for network errors
- Look for JavaScript errors

**4. Verify model exists:**
```bash
ls backend/vision/models/license-plate-yolo11n.pt
```

### Port Already in Use

**Windows:**
```bash
netstat -ano | findstr :8001
taskkill /PID <pid> /F
```

**Linux/Mac:**
```bash
lsof -ti:8001 | xargs kill -9
```

### No Detections Found

- **Lower confidence threshold** in `.env`:
  ```env
  VISION_CONFIDENCE=0.15
  ```

- **Ensure good lighting** on the license plate
- **Keep plate steady** (avoid motion blur)
- **Position plate clearly** in camera frame

## Configuration

### Environment Variables (.env)

Create `.env` in backend directory:

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

## Board Type Detection

The system automatically classifies 8 vehicle board types:

| Board Type | Color | Vehicle Type | Suggested Deck |
|------------|-------|--------------|----------------|
| White | White background, Black text | Private vehicles | Decks 2-5 |
| Yellow | Yellow background, Black text | Commercial/Taxi | Deck 7 |
| Green | Green background, White text | Electric Vehicles | Deck 1 (Charging) |
| Black | Black background, Yellow text | Self-drive rental | Deck 6 |
| Blue | Blue background, White text | Diplomatic/Embassy | Deck 1 (VIP) |
| Red | Red background, Gold/White text | Government/VIP | Deck 1 (VIP) |
| Arrow | Olive/Dark background, White text | Military/Defense | Deck 1 (Restricted) |
| BH Series | White background, Black text | Pan-India portability | Decks 2-5 |

## Training the Model (if needed)

If you need to retrain the model:

```bash
cd backend

# Download dataset
npm run vision:download

# Train model (default 20 epochs)
npm run vision:train

# Quick training (10 epochs)
npm run vision:train:quick

# Custom training
npm run vision:train:custom -- --epochs 50 --batch 8
```

## Alternative Detection Methods

### Standalone Testing with Camera

**YOLO + EasyOCR:**
```bash
cd backend/vision
python yolo_easyocr_detect.py --model models/license-plate-yolo11n.pt --source 0
```

**OpenCV + EasyOCR (less accurate):**
```bash
cd backend/vision
python opencv_easyocr_detect.py --source 0
```

## File Structure

```
backend/
├── server.js              # Main Express server
├── start.bat              # Windows startup script
├── .env.example           # Environment variables template
├── vision/
│   ├── detect_server.py   # YOLO detection service (port 8001)
│   ├── train.py           # Model training script
│   ├── download_dataset.py # Dataset download
│   ├── yolo_easyocr_detect.py # Alternative detection
│   ├── opencv_easyocr_detect.py # Legacy detection
│   ├── models/
│   │   └── license-plate-yolo11n.pt # Trained model
│   └── README.md          # Vision service documentation
└── js/
    └── plate-camera.js    # Frontend detection logic
```

## Performance Tips

- **Use GPU** if available (CUDA) for faster inference
- **Lower image size** in train.py for faster training
- **Increase confidence threshold** to reduce false positives
- **Use YOLO11n** (nano) for fastest inference

## Security Notes

- Never commit `.env` file with API keys
- Vision service binds to localhost only (127.0.0.1)
- Roboflow API key is optional (local YOLO works without it)
- Backend should not be exposed to public internet without authentication

## Support

For detailed documentation:
- Vision service: `backend/vision/README.md`
- ML Pipeline: `backend/vision/ML_PIPELINE.md`
- Backend API: `backend/API.md`

## Summary

Your system is **fully operational**. The vision service is running and ready to detect license plates. Simply:

1. Start the backend with `start.bat` or `npm start`
2. Open the web app
3. Click "Scan Plate" to open camera
4. Click "Auto-Detect" to scan (2 attempts)
5. System will detect plate, classify board type, and read text

If detection fails after 2 attempts, you can enter the plate number manually.
