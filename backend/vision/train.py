"""Fine-tune YOLO11n on the bundled license-plate dataset.

Features:
- Comprehensive logging
- Hyperparameter configuration
- Training metrics tracking
- Model validation
- Export metrics to JSON
"""

import argparse
import json
import logging
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

import torch
import yaml
from ultralytics import YOLO

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

VISION_DIR = Path(__file__).resolve().parent
PROJECT_DIR = VISION_DIR.parent.parent
DATASET_DIR = PROJECT_DIR / "License Plate Recognition.v11i.yolov11"
RUNS_DIR = VISION_DIR / "runs"
MODEL_DIR = VISION_DIR / "models"
OUTPUT_WEIGHTS = MODEL_DIR / "license-plate-yolo11n.pt"
DATA_CONFIG = VISION_DIR / "generated-data.yaml"
METRICS_FILE = MODEL_DIR / "test-metrics.json"
TRAINING_LOG = MODEL_DIR / "training-log.json"


def build_dataset_config() -> None:
    """Build YOLO dataset configuration YAML file."""
    logger.info("Building dataset configuration...")

    required_paths = [
        DATASET_DIR / "train" / "images",
        DATASET_DIR / "valid" / "images",
        DATASET_DIR / "test" / "images",
    ]
    missing = [str(path) for path in required_paths if not path.is_dir()]
    if missing:
        logger.error("Dataset folders not found: " + ", ".join(missing))
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
    logger.info(f"Dataset configuration saved to: {DATA_CONFIG}")


def parse_args() -> argparse.Namespace:
    """Parse command line arguments with comprehensive options."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument("--epochs", type=int, default=20,
                        help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=4,
                        help="Batch size for training")
    parser.add_argument("--image-size", type=int, default=640,
                        help="Input image size")
    parser.add_argument("--fraction", type=float, default=1.0,
                        help="Fraction of training images to use (0, 1]")
    parser.add_argument("--device", default=None,
                        help="CUDA device index, cpu, or auto")
    parser.add_argument("--workers", type=int, default=0,
                        help="Number of data loading workers")
    parser.add_argument("--patience", type=int, default=5,
                        help="Early stopping patience")
    parser.add_argument("--lr", type=float, default=0.01,
                        help="Initial learning rate")
    parser.add_argument("--optimizer", type=str, default="auto",
                        choices=["auto", "SGD", "Adam", "AdamW"],
                        help="Optimizer to use")
    parser.add_argument("--model-size", type=str, default="n",
                        choices=["n", "s", "m", "l", "x"],
                        help="YOLO11 model size (n=nano, s=small, m=medium, l=large, x=xlarge)")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed for reproducibility")
    parser.add_argument("--skip-validation", action="store_true",
                        help="Skip validation after training")
    return parser.parse_args()


def log_training_info(args: argparse.Namespace, device: str, cuda_available: bool) -> None:
    """Log training configuration and system information."""
    logger.info("=" * 70)
    logger.info("TRAINING CONFIGURATION")
    logger.info("=" * 70)
    logger.info(f"Dataset: {DATASET_DIR}")
    logger.info(f"Output weights: {OUTPUT_WEIGHTS}")
    logger.info(f"PyTorch version: {torch.__version__}")
    logger.info(f"CUDA available: {cuda_available}")
    logger.info(f"Training device: {device}")
    if cuda_available:
        logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
        logger.info(f"GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
    logger.info("-" * 70)
    logger.info("Hyperparameters:")
    logger.info(f"  Epochs: {args.epochs}")
    logger.info(f"  Batch size: {args.batch}")
    logger.info(f"  Image size: {args.image_size}")
    logger.info(f"  Training fraction: {args.fraction}")
    logger.info(f"  Learning rate: {args.lr}")
    logger.info(f"  Optimizer: {args.optimizer}")
    logger.info(f"  Model size: YOLO11{args.model_size}")
    logger.info(f"  Patience: {args.patience}")
    logger.info(f"  Workers: {args.workers}")
    logger.info(f"  Seed: {args.seed}")
    logger.info("=" * 70)


def save_training_log(args: argparse.Namespace, metrics: Dict[str, Any]) -> None:
    """Save training configuration and metrics to JSON log."""
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "configuration": {
            "epochs": args.epochs,
            "batch_size": args.batch,
            "image_size": args.image_size,
            "fraction": args.fraction,
            "learning_rate": args.lr,
            "optimizer": args.optimizer,
            "model_size": f"YOLO11{args.model_size}",
            "patience": args.patience,
            "workers": args.workers,
            "seed": args.seed,
        },
        "metrics": metrics
    }

    # Load existing logs if any
    logs = []
    if TRAINING_LOG.exists():
        try:
            with open(TRAINING_LOG, 'r') as f:
                logs = json.load(f)
        except:
            logs = []

    logs.append(log_entry)

    # Save updated logs
    TRAINING_LOG.write_text(json.dumps(logs, indent=2) + "\n", encoding="utf-8")
    logger.info(f"Training log saved to: {TRAINING_LOG}")


def main() -> None:
    """Main training pipeline."""
    args = parse_args()

    # Validate arguments
    if args.epochs < 1 or args.batch < 1 or args.image_size < 32 or not 0 < args.fraction <= 1:
        logger.error("Invalid argument values")
        raise ValueError("epochs, batch, image-size, or fraction is out of range.")

    # Build dataset configuration
    build_dataset_config()

    # Determine device
    cuda_available = torch.cuda.is_available()
    if args.device == "auto" or args.device is None:
        device = "0" if cuda_available else "cpu"
    else:
        device = args.device

    if device != "cpu" and not cuda_available:
        logger.error("CUDA was selected, but this PyTorch installation cannot access CUDA.")
        raise RuntimeError("CUDA was selected, but this PyTorch installation cannot access CUDA.")

    # Log training information
    log_training_info(args, device, cuda_available)

    # Initialize model
    model_name = f"yolo11{args.model_size}.pt"
    logger.info(f"Loading {model_name} model...")
    model = YOLO(model_name)

    # Train model
    logger.info("Starting training...")
    logger.info("Progress will be displayed by Ultralytics during training.")

    try:
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
            patience=args.patience,
            cache=False,
            plots=True,
            amp=cuda_available,
            seed=args.seed,
            lr0=args.lr,
            optimizer=args.optimizer,
            verbose=True,
        )
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise

    # Get best weights
    best_weights = Path(results.save_dir) / "weights" / "best.pt"
    if not best_weights.is_file():
        logger.error(f"Training completed without producing best.pt at {best_weights}")
        raise FileNotFoundError(f"Training completed without producing best.pt at {best_weights}")

    # Copy best weights to output location
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best_weights, OUTPUT_WEIGHTS)
    logger.info(f"Trained detector saved to: {OUTPUT_WEIGHTS}")

    # Validate on test set
    test_metrics = {}
    if not args.skip_validation:
        logger.info("Validating on test set...")
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
            "model": f"YOLO11{args.model_size}",
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

        # Save metrics to JSON
        METRICS_FILE.write_text(
            json.dumps(test_metrics, indent=2) + "\n",
            encoding="utf-8",
        )
        logger.info(f"Test metrics saved to: {METRICS_FILE}")

        # Log metrics
        logger.info("=" * 70)
        logger.info("TEST METRICS")
        logger.info("=" * 70)
        logger.info(f"Precision: {metrics.box.mp:.4f}")
        logger.info(f"Recall: {metrics.box.mr:.4f}")
        logger.info(f"mAP50: {metrics.box.map50:.4f}")
        logger.info(f"mAP50-95: {metrics.box.map:.4f}")
        logger.info("=" * 70)

        # Save training log
        save_training_log(args, test_metrics)
    else:
        logger.info("Validation skipped as requested")
        test_metrics = {
            "model": f"YOLO11{args.model_size}",
            "epochs": args.epochs,
            "validation": "skipped"
        }

    logger.info("Training pipeline completed successfully!")


if __name__ == "__main__":
    main()
