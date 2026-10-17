import argparse
import re
import sys
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
            "EasyOCR is required. Install dependencies with: pip install opencv-python easyocr"
        ) from exc
    # English letters and digits are suitable for many plate formats. Add a language
    # code here if plates in your region use a different script.
    return easyocr.Reader(["en"], gpu=False)


def make_detector():
    cascade_path = Path(cv2.data.haarcascades) / "haarcascade_russian_plate_number.xml"
    detector = cv2.CascadeClassifier(str(cascade_path))
    if detector.empty():
        raise SystemExit(f"Could not load OpenCV plate detector: {cascade_path}")
    return detector


def detect_and_read(frame, detector, reader, min_confidence):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    plates = detector.detectMultiScale(
        gray, scaleFactor=1.05, minNeighbors=3, minSize=(50, 18)
    )

    results = []
    for x, y, w, h in plates:
        # Expand the crop slightly so OCR can see characters near the plate edge.
        pad_x, pad_y = max(3, int(w * 0.04)), max(3, int(h * 0.12))
        x1, y1 = max(0, x - pad_x), max(0, y - pad_y)
        x2, y2 = min(frame.shape[1], x + w + pad_x), min(frame.shape[0], y + h + pad_y)
        crop = frame[y1:y2, x1:x2]
        ocr = reader.readtext(crop, detail=1, allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
        words = [clean_plate_text(t) for _, t, conf in ocr if conf >= min_confidence]
        text = " ".join(word for word in words if word)
        results.append((x, y, w, h, text))
    return results


def annotate(frame, detections):
    for x, y, w, h, text in detections:
        cv2.rectangle(frame, (x, y), (x + w, y + h), (40, 220, 40), 2)
        label = text or "Plate"
        cv2.putText(frame, label, (x, max(22, y - 8)), cv2.FONT_HERSHEY_SIMPLEX,
                    0.65, (40, 220, 40), 2, cv2.LINE_AA)
    return frame


def process_image(path, detector, reader, confidence, output):
    image = cv2.imread(str(path))
    if image is None:
        raise SystemExit(f"Cannot open image: {path}")
    detections = detect_and_read(image, detector, reader, confidence)
    for _, _, _, _, text in detections:
        if text:
            print(text)
    annotate(image, detections)
    if output:
        if not cv2.imwrite(str(output), image):
            raise SystemExit(f"Could not save output image: {output}")
        print(f"Saved annotated image to {output}")
    cv2.imshow("Number plate detection", image)
    cv2.waitKey(0)
    cv2.destroyAllWindows()


def process_video(source, detector, reader, confidence, output):
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
        writer = cv2.VideoWriter(str(output), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
        if not writer.isOpened():
            capture.release()
            raise SystemExit(f"Could not create output video: {output}")

    last_seen = set()
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            detections = detect_and_read(frame, detector, reader, confidence)
            for _, _, _, _, text in detections:
                if text and text not in last_seen:
                    print(text, flush=True)
                    last_seen.add(text)
            annotated = annotate(frame, detections)
            if writer:
                writer.write(annotated)
            cv2.imshow("Number plate detection (press q to quit)", annotated)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        capture.release()
        if writer:
            writer.release()
        cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser(
        description="Detect vehicle number plates and read their text using OpenCV and EasyOCR."
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--image", type=Path, help="Image file to process")
    source.add_argument("--source", help="Webcam index (for example 0), video file, or stream URL")
    parser.add_argument("--output", type=Path, help="Save annotated image/video")
    parser.add_argument("--min-confidence", type=float, default=0.25, help="Minimum OCR confidence (0-1)")
    args = parser.parse_args()

    detector = make_detector()
    reader = make_reader()
    if args.image:
        process_image(args.image, detector, reader, args.min_confidence, args.output)
    else:
        process_video(args.source, detector, reader, args.min_confidence, args.output)


if __name__ == "__main__":
    main()
