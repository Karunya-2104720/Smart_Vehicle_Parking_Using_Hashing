"""Local YOLO inference service used by the Smart Parking browser UI."""

import os
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
import torch
from ultralytics import YOLO


HERE = Path(__file__).resolve().parent
MODEL_PATH = Path(os.environ.get(
    "VISION_MODEL_PATH",
    HERE / "models" / "license-plate-yolo11n.pt",
)).resolve()
CONFIDENCE = float(os.environ.get("VISION_CONFIDENCE", "0.25"))
MAX_IMAGE_BYTES = 8 * 1024 * 1024
DEVICE = "0" if torch.cuda.is_available() else "cpu"
ALLOWED_ORIGINS = {
    "https://smart-vehicle-parking-using-hashing.onrender.com",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
}
ALLOWED_ORIGINS.update(
    origin.strip()
    for origin in os.environ.get("VISION_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
)

app = FastAPI(title="Smart Parking YOLO plate detector")
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(ALLOWED_ORIGINS),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    max_age=600,
)
model = None
model_error = None

if MODEL_PATH.is_file():
    try:
        model = YOLO(str(MODEL_PATH))
    except Exception as error:
        model_error = str(error)
else:
    model_error = f"Trained YOLO weights not found: {MODEL_PATH}"


@app.get("/health")
def health():
    return {
        "ready": model is not None,
        "model": str(MODEL_PATH),
        "device": DEVICE,
        "error": model_error,
    }


@app.post("/detect")
async def detect(request: Request):
    if model is None:
        raise HTTPException(status_code=503, detail=model_error or "YOLO model is unavailable.")

    image_bytes = await request.body()
    if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Send a non-empty image no larger than 8 MB.")

    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError) as error:
        raise HTTPException(status_code=400, detail="The request body is not a supported image.") from error

    try:
        result = model.predict(
            source=image,
            conf=CONFIDENCE,
            imgsz=640,
            device=DEVICE,
            verbose=False,
        )[0]
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"YOLO inference failed: {error}") from error

    detections = []
    if result.boxes is not None:
        for box in result.boxes:
            x1, y1, x2, y2 = (float(value) for value in box.xyxy[0].tolist())
            detections.append({
                "x": x1,
                "y": y1,
                "width": x2 - x1,
                "height": y2 - y1,
                "confidence": float(box.conf[0]),
            })
    detections.sort(key=lambda detection: detection["confidence"], reverse=True)

    return {
        "imageWidth": image.width,
        "imageHeight": image.height,
        "detections": detections,
    }
