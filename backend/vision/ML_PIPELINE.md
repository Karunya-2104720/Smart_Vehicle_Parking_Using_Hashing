# ML Pipeline Documentation

## Overview

This document describes the complete machine learning pipeline for the Smart Parking license plate detection system, as outlined in the system architecture flowchart.

## Pipeline Architecture

The pipeline consists of four main components:

1. **Dataset Management** (Green) - Roboflow integration for dataset download
2. **Model Training Pipeline** (Yellow) - YOLO11 model training and validation
3. **Frontend Runtime** (Pink) - OCR preprocessing and detection requests
4. **Backend Detection Service** (Purple) - YOLO inference with Roboflow fallback

---

## 1. Dataset Management

### Step 2a: Initialize Roboflow Client

**File:** `vision/download_dataset.py`

The dataset download script initializes a Roboflow client to access the license plate recognition dataset.

**Environment Variables:**
- `ROBOFLOW_API_KEY` - Your Roboflow API key (default provided in script)
- `ROBOFLOW_WORKSPACE` - Workspace name (default: "roboflow-universe-projects")
- `ROBOFLOW_PROJECT` - Project name (default: "license-plate-recognition-rxg4e")
- `ROBOFLOW_VERSION` - Dataset version (default: 11)
- `ROBOFLOW_FORMAT` - Dataset format (default: "yolov11")

**Features:**
- Error handling for API failures
- Progress tracking with logging
- Dataset validation after download
- Configuration via environment variables

**Usage:**
```bash
# Set API key (optional if using default)
export ROBOFLOW_API_KEY="your_api_key"

# Download dataset
npm run vision:download
# or
python vision/download_dataset.py
```

### Step 2b: Access Roboflow Project

The script accesses the specified Roboflow workspace and project to retrieve the dataset.

### Step 2c: Download Dataset

The dataset is downloaded in YOLOv11 format to the project root directory.

**Output Structure:**
```
License Plate Recognition.v11i.yolov11/
├── train/
│   ├── images/
│   └── labels/
├── valid/
│   ├── images/
│   └── labels/
├── test/
│   ├── images/
│   └── labels/
└── data.yaml
```

**Validation:**
The script validates that all required directories exist and counts images in each split.

---

## 2. Model Training Pipeline

### Step 2d: Build Dataset Configuration

**File:** `vision/train.py` - `build_dataset_config()`

The training script builds a YOLO dataset configuration YAML file that specifies:
- Dataset path
- Train/validation/test splits
- Number of classes (1: License_Plate)
- Class names

**Output:** `vision/generated-data.yaml`

### Step 2e: Initialize YOLO11 Model

The script initializes a YOLO11 model based on the specified size.

**Model Sizes:**
- `n` - Nano (smallest, fastest)
- `s` - Small
- `m` - Medium
- `l` - Large
- `x` - XLarge (largest, most accurate)

**Default:** YOLO11n (nano) for fast inference

### Step 2f: Train Model

**File:** `vision/train.py` - `main()`

The model is trained on the license plate dataset with configurable hyperparameters.

**Hyperparameters:**
- `--epochs` - Number of training epochs (default: 20)
- `--batch` - Batch size (default: 4)
- `--image-size` - Input image size (default: 640)
- `--fraction` - Fraction of training images to use (default: 1.0)
- `--device` - CUDA device index, cpu, or auto (default: auto)
- `--workers` - Data loading workers (default: 0)
- `--patience` - Early stopping patience (default: 5)
- `--lr` - Initial learning rate (default: 0.01)
- `--optimizer` - Optimizer: auto, SGD, Adam, AdamW (default: auto)
- `--model-size` - Model size: n, s, m, l, x (default: n)
- `--seed` - Random seed (default: 42)

**Usage:**
```bash
# Default training
npm run vision:train

# Quick training (10 epochs, larger batch)
npm run vision:train:quick

# Custom training with specific parameters
npm run vision:train:custom -- --epochs 50 --batch 8 --model-size s --lr 0.001

# Training on CPU
python vision/train.py --device cpu

# Training on specific GPU
python vision/train.py --device 0
```

**Training Features:**
- Comprehensive logging of configuration and progress
- Early stopping based on validation loss
- Automatic mixed precision (AMP) for GPU training
- Training plots and metrics visualization
- Reproducibility with random seed

**Output:**
- Trained weights: `vision/models/license-plate-yolo11n.pt`
- Training logs: `vision/runs/license-plate-yolo11n/`
- Metrics: `vision/models/test-metrics.json`
- Training history: `vision/models/training-log.json`

### Step 2g: Save Best Weights

After training, the best performing model weights (based on validation loss) are saved to:
`vision/models/license-plate-yolo11n.pt`

### Step 2h: Validate on Test Set

The trained model is validated on the test set to evaluate performance.

**Metrics:**
- Precision - Accuracy of positive predictions
- Recall - Ability to find all positive samples
- mAP50 - Mean Average Precision at IoU threshold 0.5
- mAP50-95 - Mean Average Precision across IoU thresholds 0.5 to 0.95

**Output:** `vision/models/test-metrics.json`

---

## 3. Frontend Runtime

### Step 1a: Frontend OCR Preprocessing

**File:** `../js/plate-camera.js` - `preprocessCanvasForOCR()`

The frontend performs image preprocessing before sending to the backend:

**Preprocessing Steps:**
1. **Scaling** - Upscale small images to >=500px height for better OCR accuracy
2. **Grayscale Conversion** - Convert RGB to grayscale
3. **Histogram Calculation** - Compute intensity histogram
4. **Otsu's Thresholding** - Automatic threshold selection
5. **Contrast Enhancement** - Apply contrast stretch
6. **Binarization** - Convert to binary image
7. **Multiple Modes** - Try different preprocessing strategies:
   - `standard` - Grayscale + contrast + adaptive threshold
   - `high-contrast` - Aggressive contrast for low-quality images
   - `grayscale` - Enhanced grayscale with contrast
   - `inverted` - Inverted for dark-on-light plates
   - `denoise` - Simple denoising

**Features:**
- Multi-scale processing (1x, 1.5x, 2x, 2.5x, 3x)
- Multiple preprocessing modes
- Client-side computer vision for board color classification

### Step 1b: Send Detection Request

**File:** `../js/plate-camera.js` - `runAutoDetectPipeline()`

The frontend sends detection requests to the backend:

**Process:**
1. Capture image from camera or file upload
2. Convert to JPEG blob
3. Send POST request to backend detection endpoint
4. Handle response with detection results
5. Display results to user

**Backend Endpoint:** `http://127.0.0.1:8001/detect`

**Request:**
- Method: POST
- Content-Type: image/jpeg
- Body: Image bytes (max 8MB)

**Response:**
```json
{
  "imageWidth": 1280,
  "imageHeight": 720,
  "detections": [
    {
      "x": 100.5,
      "y": 200.3,
      "width": 150.2,
      "height": 50.1,
      "confidence": 0.95,
      "boardType": {
        "code": "WHITE_PRIVATE",
        "name": "Private Vehicle",
        ...
      }
    }
  ]
}
```

---

## 4. Backend Detection Service

### Step 1c: Backend Detection Endpoint

**File:** `vision/detect_server.py` - `/detect` endpoint

FastAPI endpoint that receives image data and returns detection results.

**Features:**
- CORS configuration for frontend access
- Image size validation (max 8MB)
- Content-Type validation (JPEG, PNG, WebP)
- Error handling

### Step 1d: YOLO Model Inference

**File:** `vision/detect_server.py` - `detect()` function

The backend performs YOLO model inference on the received image:

**Process:**
1. Load trained YOLO11 model
2. Run inference with confidence threshold
3. Extract bounding boxes
4. Crop detected plates
5. Classify board color (white, yellow, green, blue, red, black)
6. Return detection results with board type metadata

**Configuration:**
- `VISION_MODEL_PATH` - Path to trained weights (default: `vision/models/license-plate-yolo11n.pt`)
- `VISION_CONFIDENCE` - Confidence threshold (default: 0.25)
- `DEVICE` - CPU or CUDA (auto-detected)

**Board Type Classification:**
The backend classifies number plate board types using HSV color analysis:
- **White (Private)** - Default for non-matching colors
- **Yellow (Commercial)** - Taxi, cab, goods vehicles
- **Green (EV)** - Electric vehicles
- **Blue (Diplomatic)** - Embassy, UN, consular corps
- **Red (Government)** - State officials, VIPs
- **Black (Rental)** - Self-drive rental fleets

### Step 1e: Roboflow Fallback Check

**File:** `vision/detect_server.py` - `detect_with_roboflow()`

If the local YOLO model returns no detections, the backend falls back to Roboflow inference API:

**Configuration:**
- `ROBOFLOW_API_KEY` - Roboflow API key (optional)
- `ROBOFLOW_MODEL_ID` - Model ID (default: "indian-number-platess/2")

**Fallback Logic:**
1. Check if Roboflow API key is configured
2. If no local detections, call Roboflow API
3. Process Roboflow predictions
4. Classify board type for each detection
5. Return Roboflow results

### Step 1f: Return Detection Results

The backend returns detection results to the frontend in JSON format:

**Response Format:**
```json
{
  "imageWidth": 1280,
  "imageHeight": 720,
  "detections": [
    {
      "x": 100.5,
      "y": 200.3,
      "width": 150.2,
      "height": 50.1,
      "confidence": 0.95,
      "boardType": {
        "code": "WHITE_PRIVATE",
        "name": "Private Vehicle",
        "boardColor": "White",
        "textColor": "Black",
        "hex": "#ffffff",
        "badge": "⚪ White Board (Private)",
        "category": "Private / Non-Commercial",
        "suggestedDeck": "General Decks (Decks 2–5)",
        "description": "Standard private motor vehicle..."
      }
    }
  ]
}
```

---

## Complete Workflow

### Initial Setup

1. **Download Dataset:**
   ```bash
   npm run vision:download
   ```

2. **Train Model:**
   ```bash
   npm run vision:train
   ```

3. **Start Backend:**
   ```bash
   npm start
   ```

The backend will automatically start the vision detection service on port 8001.

### Runtime Operation

1. **Frontend:**
   - User opens camera or uploads image
   - Frontend preprocesses image (OCR preprocessing)
   - Frontend sends detection request to backend

2. **Backend:**
   - Receives image at `/api/vision/detect`
   - Forwards to vision service at `http://127.0.0.1:8001/detect`
   - Vision service runs YOLO inference
   - If no detections, falls back to Roboflow
   - Returns detection results with board type

3. **Frontend:**
   - Receives detection results
   - Displays board type and suggested parking deck
   - Runs OCR on detected plate region
   - Validates Indian plate format
   - Auto-fills registration number

---

## Environment Variables

### Backend (`.env`)
```
PORT=5000
HOST=0.0.0.0
FRONTEND_URL=http://localhost:3000
TABLE_SIZE=70
SECONDARY_PRIME=67
```

### Vision Service
```
VISION_MODEL_PATH=vision/models/license-plate-yolo11n.pt
VISION_CONFIDENCE=0.25
VISION_PORT=8001
ROBOFLOW_API_KEY=your_api_key
ROBOFLOW_MODEL_ID=indian-number-platess/2
```

### Dataset Download
```
ROBOFLOW_API_KEY=your_api_key
ROBOFLOW_WORKSPACE=roboflow-universe-projects
ROBOFLOW_PROJECT=license-plate-recognition-rxg4e
ROBOFLOW_VERSION=11
ROBOFLOW_FORMAT=yolov11
```

---

## Troubleshooting

### Dataset Download Fails
- Check internet connection
- Verify API key is valid
- Ensure workspace and project names are correct
- Check Roboflow account has access to the project

### Training Fails
- Ensure dataset is downloaded and validated
- Check CUDA availability if using GPU
- Reduce batch size if out of memory
- Increase patience if training stops early
- Check PyTorch and Ultralytics versions

### Detection Service Not Running
- Check if trained weights exist at `vision/models/license-plate-yolo11n.pt`
- Verify Python dependencies are installed
- Check port 8001 is not in use
- Review vision service logs

### No Detections
- Lower confidence threshold (`VISION_CONFIDENCE`)
- Check image quality and lighting
- Verify model is trained on similar data
- Try Roboflow fallback with API key

### OCR Accuracy Low
- Ensure good lighting and focus
- Use higher resolution images
- Try different preprocessing modes
- Verify plate is clearly visible
- Check Tesseract.js is loaded

---

## Performance Optimization

### Training
- Use GPU for faster training (CUDA)
- Increase batch size if GPU memory allows
- Use mixed precision (AMP) for faster training
- Reduce image size for faster iterations
- Use early stopping to avoid overfitting

### Inference
- Use YOLO11n for fastest inference
- Reduce image size if accuracy allows
- Increase confidence threshold to reduce false positives
- Use CPU inference if GPU not available
- Cache model in memory for repeated requests

### Frontend
- Optimize image size before sending
- Use Web Workers for OCR processing
- Implement progressive image loading
- Cache detection results

---

## Dependencies

### Python
- `ultralytics` - YOLO11 implementation
- `torch` - PyTorch for deep learning
- `roboflow` - Dataset download
- `fastapi` - Vision service API
- `inference-sdk` - Roboflow inference client
- `opencv-python` - Image processing
- `Pillow` - Image manipulation
- `pyyaml` - Configuration files

### Node.js
- `express` - Backend server
- `cors` - CORS middleware
- `dotenv` - Environment variables

### Frontend
- `tesseract.js` - OCR library (loaded from CDN)

---

## Future Enhancements

1. **Model Optimization**
   - Model quantization for faster inference
   - ONNX export for deployment
   - TensorRT optimization for NVIDIA GPUs

2. **Dataset Enhancement**
   - Data augmentation for better generalization
   - Custom dataset upload support
   - Active learning for continuous improvement

3. **Pipeline Improvements**
   - Batch processing for multiple images
   - Video stream processing
   - Real-time detection optimization

4. **Frontend Enhancements**
   - Progressive image upload
   - Client-side model with WebGPU
   - Offline mode support

---

## References

- [YOLO11 Documentation](https://docs.ultralytics.com/)
- [Roboflow Documentation](https://docs.roboflow.com/)
- [Tesseract.js Documentation](https://tesseract.projectnaptha.com/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
