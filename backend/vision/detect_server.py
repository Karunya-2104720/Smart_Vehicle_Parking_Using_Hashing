"""Local YOLO inference service used by the Smart Parking browser UI."""

import os
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
import torch
from ultralytics import YOLO
import numpy as np
import cv2

BOARD_TYPES = {
    "WHITE_PRIVATE": {
        "code": "WHITE_PRIVATE",
        "name": "Private Vehicle",
        "boardColor": "White",
        "textColor": "Black",
        "hex": "#ffffff",
        "badge": "⚪ White Board (Private)",
        "category": "Private / Non-Commercial",
        "suggestedDeck": "General Decks (Decks 2–5)",
        "description": "Standard private motor vehicle with white background and black lettering."
    },
    "YELLOW_COMMERCIAL": {
        "code": "YELLOW_COMMERCIAL",
        "name": "Commercial Vehicle",
        "boardColor": "Yellow",
        "textColor": "Black",
        "hex": "#fbbf24",
        "badge": "🟡 Yellow Board (Commercial)",
        "category": "Commercial Transport (Taxi / Cab / Goods)",
        "suggestedDeck": "Commercial Deck (Deck 7)",
        "description": "Commercial passenger and goods vehicle with yellow background and black lettering."
    },
    "GREEN_EV": {
        "code": "GREEN_EV",
        "name": "Electric Vehicle (EV)",
        "boardColor": "Green",
        "textColor": "White",
        "hex": "#10b981",
        "badge": "🟢 Green Board (Electric Vehicle)",
        "category": "Clean Energy / Zero-Emission",
        "suggestedDeck": "EV Priority Deck (Deck 1 Charging Bay)",
        "description": "Clean-energy electric vehicle with green background and white lettering."
    },
    "BLACK_RENTAL": {
        "code": "BLACK_RENTAL",
        "name": "Self-Drive Rental Fleet",
        "boardColor": "Black",
        "textColor": "Yellow",
        "hex": "#1e293b",
        "badge": "⚫ Black Board (Self-Drive)",
        "category": "Self-Drive Rental Vehicle",
        "suggestedDeck": "Fleet & Rental Deck (Deck 6)",
        "description": "Commercial self-drive rental vehicle with black background and yellow lettering."
    },
    "BLUE_DIPLOMATIC": {
        "code": "BLUE_DIPLOMATIC",
        "name": "Diplomatic & Embassy",
        "boardColor": "Blue",
        "textColor": "White",
        "hex": "#38bdf8",
        "badge": "🔵 Blue Board (Diplomatic)",
        "category": "Diplomatic / Consular Corps (UN / CD / CC)",
        "suggestedDeck": "Reserved Diplomatic Bay (Deck 1 VIP)",
        "description": "Foreign embassy, consular, or United Nations diplomatic vehicle."
    },
    "RED_GOVERNMENT": {
        "code": "RED_GOVERNMENT",
        "name": "Government Official",
        "boardColor": "Red",
        "textColor": "Gold/White",
        "hex": "#ef4444",
        "badge": "🔴 Red Board (State / Governor / VIP)",
        "category": "State Govt / High Official",
        "suggestedDeck": "VIP Reserved Bay (Deck 1 VIP)",
        "description": "State government official, constitutional dignitary, or governor vehicle."
    },
    "DEFENSE_MILITARY": {
        "code": "DEFENSE_MILITARY",
        "name": "Military & Armed Forces",
        "boardColor": "Olive/Dark",
        "textColor": "White",
        "hex": "#4b5563",
        "badge": "🛡️ Arrow Board (Military / Defence)",
        "category": "Armed Forces / Ministry of Defence",
        "suggestedDeck": "Restricted Defense Zone",
        "description": "Ministry of Defence vehicle marked with upward arrow prefix (↑)."
    },
    "BH_SERIES": {
        "code": "BH_SERIES",
        "name": "Bharat Series (BH)",
        "boardColor": "White",
        "textColor": "Black",
        "hex": "#f8fafc",
        "badge": "🇮🇳 BH Series (Pan-India)",
        "category": "Bharat Series (Pan-India Portability)",
        "suggestedDeck": "General Decks (Decks 2–5)",
        "description": "Nationwide non-transferable registration for seamless inter-state mobility."
    }
}


def classify_plate_board(crop_rgb):
    """Classifies number plate board color and category from RGB cropped plate image."""
    try:
        np_img = np.array(crop_rgb)
        if np_img.size == 0 or np_img.shape[0] < 4 or np_img.shape[1] < 8:
            return BOARD_TYPES["WHITE_PRIVATE"]

        hsv = cv2.cvtColor(np_img, cv2.COLOR_RGB2HSV)
        h, w = hsv.shape[:2]
        pad_y = max(1, int(h * 0.12))
        pad_x = max(1, int(w * 0.08))
        inner = hsv[pad_y:max(pad_y + 1, h - pad_y), pad_x:max(pad_x + 1, w - pad_x)]
        if inner.size == 0:
            inner = hsv

        pixels = inner.reshape(-1, 3)
        h_vals = pixels[:, 0]  # OpenCV Hue: 0-180
        s_vals = pixels[:, 1]  # Saturation: 0-255
        v_vals = pixels[:, 2]  # Value: 0-255

        # Check Green (EV) first: Hue 35 to 85, Saturation >= 35, Value >= 35
        green_mask = (h_vals >= 35) & (h_vals <= 85) & (s_vals >= 35) & (v_vals >= 35)
        green_ratio = float(np.count_nonzero(green_mask)) / float(len(pixels))
        if green_ratio >= 0.22:
            return BOARD_TYPES["GREEN_EV"]

        # Check Yellow (Commercial): Hue 14 to 34, Saturation >= 50, Value >= 60
        yellow_mask = (h_vals >= 14) & (h_vals <= 34) & (s_vals >= 50) & (v_vals >= 60)
        yellow_ratio = float(np.count_nonzero(yellow_mask)) / float(len(pixels))
        if yellow_ratio >= 0.22:
            return BOARD_TYPES["YELLOW_COMMERCIAL"]

        # Check Blue (Diplomatic): Hue 90 to 132, Saturation >= 35, Value >= 40
        blue_mask = (h_vals >= 90) & (h_vals <= 132) & (s_vals >= 35) & (v_vals >= 40)
        blue_ratio = float(np.count_nonzero(blue_mask)) / float(len(pixels))
        if blue_ratio >= 0.20:
            return BOARD_TYPES["BLUE_DIPLOMATIC"]

        # Check Red (Govt / Official): Hue <= 10 or >= 168, Saturation >= 55, Value >= 45
        red_mask = ((h_vals <= 10) | (h_vals >= 168)) & (s_vals >= 55) & (v_vals >= 45)
        red_ratio = float(np.count_nonzero(red_mask)) / float(len(pixels))
        if red_ratio >= 0.20:
            return BOARD_TYPES["RED_GOVERNMENT"]

        # Check Black (Rental / Self-Drive): dominant low brightness
        dark_ratio = float(np.count_nonzero(v_vals < 55)) / float(len(pixels))
        if dark_ratio >= 0.55:
            return BOARD_TYPES["BLACK_RENTAL"]

        # Default: Standard Private Vehicle (White Board)
        return BOARD_TYPES["WHITE_PRIVATE"]
    except Exception:
        return BOARD_TYPES["WHITE_PRIVATE"]


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
            # Ensure coordinates are within image bounds
            cx1 = max(0, min(image.width - 1, int(x1)))
            cy1 = max(0, min(image.height - 1, int(y1)))
            cx2 = max(cx1 + 1, min(image.width, int(x2)))
            cy2 = max(cy1 + 1, min(image.height, int(y2)))
            plate_crop = image.crop((cx1, cy1, cx2, cy2))
            board_type = classify_plate_board(plate_crop)

            detections.append({
                "x": x1,
                "y": y1,
                "width": x2 - x1,
                "height": y2 - y1,
                "confidence": float(box.conf[0]),
                "boardType": board_type,
            })
    detections.sort(key=lambda detection: detection["confidence"], reverse=True)

    return {
        "imageWidth": image.width,
        "imageHeight": image.height,
        "detections": detections,
    }
