import argparse
import re
from pathlib import Path

import cv2


def clean_plate_text(text: str) -> str:
    """Normalize OCR output for display and matching."""
    return re.sub(r"[^A-Z0-9]", "", text.upper())


def make_reader():
    try:
        import easyocr
    except ImportError as exc:
        raise SystemExit(
            "EasyOCR is required. Install dependencies with: "
            "py -m pip install ultralytics easyocr opencv-python"
        ) from exc
    # Add language codes here if plates use a different writing system.
    return easyocr.Reader(["en"], gpu=False)


def make_detector(model_path: Path, device: str):
    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise SystemExit(
            "Ultralytics is required. Install dependencies with: "
            "py -m pip install ultralytics easyocr opencv-python"
        ) from exc

    if not model_path.is_file():
        raise SystemExit(
            f"Plate detection weights not found: {model_path}\n"
            "Pass a license-plate-trained YOLO11n weights file with --model. "
            "The general yolo11n.pt COCO model does not detect license plates."
        )
    model = YOLO(str(model_path))
    return model


def detect_and_read(frame, detector, reader, min_ocr_confidence, detection_confidence, device):
    prediction = detector.predict(
        source=frame,
        conf=detection_confidence,
        device=device,
        verbose=False,
    )[0]
    results = []
    if prediction.boxes is None:
        return results

    for box in prediction.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(frame.shape[1], x2), min(frame.shape[0], y2)
        if x2 <= x1 or y2 <= y1:
            continue

        crop = frame[y1:y2, x1:x2]
        ocr = reader.readtext(
            crop,
            detail=1,
            allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        )
        text = " ".join(
            cleaned
            for _, raw_text, confidence in ocr
            if confidence >= min_ocr_confidence
            if (cleaned := clean_plate_text(raw_text))
        )
        detection_conf = float(box.conf[0])
        results.append((x1, y1, x2, y2, text, detection_conf))
    return results


def annotate(frame, detections):
    for x1, y1, x2, y2, text, confidence in detections:
        cv2.rectangle(frame, (x1, y1), (x2, y2), (40, 220, 40), 2)
        label = f"{text or 'Plate'} {confidence:.2f}"
        cv2.putText(
            frame, label, (x1, max(22, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX,
            0.6, (40, 220, 40), 2, cv2.LINE_AA,
        )
    return frame


def process_image(path, detector, reader, min_ocr_confidence, detection_confidence, device, output):
    image = cv2.imread(str(path))
    if image is None:
        raise SystemExit(f"Cannot open image: {path}")
    detections = detect_and_read(
        image, detector, reader, min_ocr_confidence, detection_confidence, device
    )
    for *_, text, _confidence in detections:
        if text:
            print(text)
    annotate(image, detections)
    if output:
        if not cv2.imwrite(str(output), image):
            raise SystemExit(f"Could not save output image: {output}")
        print(f"Saved annotated image to {output}")
    cv2.imshow("YOLO11n number plate detection", image)
    cv2.waitKey(0)
    cv2.destroyAllWindows()


def process_video(source, detector, reader, min_ocr_confidence, detection_confidence, device, output):
    # Numeric source selects a local camera; otherwise treat it as a video path/URL.
    camera_source = int(source) if source.isdigit() else source
    capture = cv2.VideoCapture(camera_source)
    if not capture.isOpened():
        raise SystemExit(f"Cannot open camera/video source: {source}")

    writer = None
    if output:
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
        writer = cv2.VideoWriter(
            str(output), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height)
        )
        if not writer.isOpened():
            capture.release()
            raise SystemExit(f"Could not create output video: {output}")

    last_seen = set()
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            detections = detect_and_read(
                frame, detector, reader, min_ocr_confidence, detection_confidence, device
            )
            for *_, text, _confidence in detections:
                if text and text not in last_seen:
                    print(text, flush=True)
                    last_seen.add(text)
            annotated = annotate(frame, detections)
            if writer:
                writer.write(annotated)
            cv2.imshow("YOLO11n number plate detection (press q to quit)", annotated)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        capture.release()
        if writer:
            writer.release()
        cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser(
        description="Detect plates with a plate-trained YOLO11n model and read text with EasyOCR."
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--image", type=Path, help="Image file to process")
    source.add_argument("--source", help="Webcam index (for example 0), video file, or stream URL")
    parser.add_argument("--model", type=Path, default=Path("best.pt"),
                        help="License-plate-trained YOLO11n weights (default: best.pt)")
    parser.add_argument("--output", type=Path, help="Save annotated image/video")
    parser.add_argument("--device", default="cpu", help="Inference device, e.g. cpu, 0, or cuda:0")
    parser.add_argument("--min-ocr-confidence", type=float, default=0.25,
                        help="Minimum EasyOCR confidence (0-1)")
    parser.add_argument("--detection-confidence", type=float, default=0.25,
                        help="Minimum YOLO detection confidence (0-1)")
    args = parser.parse_args()

    detector = make_detector(args.model, args.device)
    reader = make_reader()
    if args.image:
        process_image(args.image, detector, reader, args.min_ocr_confidence,
                      args.detection_confidence, args.device, args.output)
    else:
        process_video(args.source, detector, reader, args.min_ocr_confidence,
                      args.detection_confidence, args.device, args.output)


if __name__ == "__main__":
    main()
