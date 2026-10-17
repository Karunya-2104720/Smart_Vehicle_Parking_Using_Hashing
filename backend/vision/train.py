"""Fine-tune YOLO11n on the bundled license-plate dataset."""

import argparse
import json
import shutil
from pathlib import Path

import torch
import yaml
from ultralytics import YOLO


VISION_DIR = Path(__file__).resolve().parent
PROJECT_DIR = VISION_DIR.parent.parent
DATASET_DIR = PROJECT_DIR / "License Plate Recognition.v11i.yolov11"
RUNS_DIR = VISION_DIR / "runs"
MODEL_DIR = VISION_DIR / "models"
OUTPUT_WEIGHTS = MODEL_DIR / "license-plate-yolo11n.pt"
DATA_CONFIG = VISION_DIR / "generated-data.yaml"


def build_dataset_config() -> None:
    required_paths = [
        DATASET_DIR / "train" / "images",
        DATASET_DIR / "valid" / "images",
        DATASET_DIR / "test" / "images",
    ]
    missing = [str(path) for path in required_paths if not path.is_dir()]
    if missing:
        raise FileNotFoundError("Dataset folders not found: " + ", ".join(missing))

    config = {
        "path": str(DATASET_DIR),
        "train": "train/images",
        "val": "valid/images",
        "test": "test/images",
        "nc": 1,
        "names": ["License_Plate"],
    }
    DATA_CONFIG.write_text(yaml.safe_dump(config, sort_keys=False), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch", type=int, default=4)
    parser.add_argument("--image-size", type=int, default=640)
    parser.add_argument("--fraction", type=float, default=1.0, help="Fraction of training images to use (0, 1].")
    parser.add_argument("--device", default=None, help="CUDA device index, cpu, or auto")
    parser.add_argument("--workers", type=int, default=0)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.epochs < 1 or args.batch < 1 or args.image_size < 32 or not 0 < args.fraction <= 1:
        raise ValueError("epochs, batch, image-size, or fraction is out of range.")

    build_dataset_config()
    cuda_available = torch.cuda.is_available()
    if args.device == "auto" or args.device is None:
        device = "0" if cuda_available else "cpu"
    else:
        device = args.device

    print(f"Dataset: {DATASET_DIR}")
    print(f"PyTorch: {torch.__version__}; CUDA available: {cuda_available}; training device: {device}")
    if cuda_available:
        print(f"GPU: {torch.cuda.get_device_name(0)}")
    elif device != "cpu":
        raise RuntimeError("CUDA was selected, but this PyTorch installation cannot access CUDA.")

    model = YOLO("yolo11n.pt")
    results = model.train(
        data=str(DATA_CONFIG),
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.image_size,
        fraction=args.fraction,
        device=device,
        workers=args.workers,
        project=str(RUNS_DIR),
        name="license-plate-yolo11n",
        exist_ok=True,
        patience=5,
        cache=False,
        plots=True,
        amp=cuda_available,
        seed=42,
    )

    best_weights = Path(results.save_dir) / "weights" / "best.pt"
    if not best_weights.is_file():
        raise FileNotFoundError(f"Training completed without producing best.pt at {best_weights}")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best_weights, OUTPUT_WEIGHTS)
    print(f"Trained detector saved to: {OUTPUT_WEIGHTS}")

    trained_model = YOLO(str(OUTPUT_WEIGHTS))
    metrics = trained_model.val(
        data=str(DATA_CONFIG),
        split="test",
        imgsz=args.image_size,
        device=device,
        workers=args.workers,
        plots=True,
    )
    test_metrics = {
        "model": "YOLO11n",
        "dataset": "License Plate Recognition.v11i.yolov11",
        "epochs": args.epochs,
        "trainingFraction": args.fraction,
        "imageSize": args.image_size,
        "device": device,
        "precision": float(metrics.box.mp),
        "recall": float(metrics.box.mr),
        "mAP50": float(metrics.box.map50),
        "mAP50_95": float(metrics.box.map),
    }
    (MODEL_DIR / "test-metrics.json").write_text(
        json.dumps(test_metrics, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        "Test metrics: "
        f"precision={metrics.box.mp:.4f}, recall={metrics.box.mr:.4f}, "
        f"mAP50={metrics.box.map50:.4f}, mAP50-95={metrics.box.map:.4f}"
    )


if __name__ == "__main__":
    main()
