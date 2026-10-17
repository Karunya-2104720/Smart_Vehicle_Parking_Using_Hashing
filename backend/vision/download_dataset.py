"""Download Roboflow License Plate Recognition dataset.

Instructions:
1. Get your free API key from https://roboflow.com
2. Set ROBOFLOW_API_KEY environment variable or update the default below
3. Run: python vision/download_dataset.py

Features:
- Error handling for API failures
- Progress tracking
- Configuration via environment variables
- Dataset validation
"""

import os
import sys
from pathlib import Path
from typing import Optional
from roboflow import Roboflow
from roboflow.core.dataset import Dataset
import logging

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

# Configuration (can be overridden via environment variables)
API_KEY = os.environ.get("ROBOFLOW_API_KEY", "cHvpy0iFQDCFpLvMBRCz")
WORKSPACE = os.environ.get("ROBOFLOW_WORKSPACE", "roboflow-universe-projects")
PROJECT = os.environ.get("ROBOFLOW_PROJECT", "license-plate-recognition-rxg4e")
VERSION = int(os.environ.get("ROBOFLOW_VERSION", "11"))
FORMAT = os.environ.get("ROBOFLOW_FORMAT", "yolov11")


def validate_api_key(api_key: str) -> bool:
    """Validate that the API key is not empty and looks reasonable."""
    if not api_key or api_key.strip() == "":
        logger.error("Roboflow API key is empty. Please set ROBOFLOW_API_KEY environment variable.")
        return False
    if len(api_key) < 10:
        logger.warning("API key seems unusually short. Please verify it's correct.")
    return True


def initialize_roboflow(api_key: str) -> Optional[Roboflow]:
    """Initialize Roboflow client with error handling."""
    try:
        logger.info(f"Initializing Roboflow client...")
        rf = Roboflow(api_key=api_key)
        logger.info("Roboflow client initialized successfully")
        return rf
    except Exception as e:
        logger.error(f"Failed to initialize Roboflow client: {e}")
        return None


def download_dataset(
    rf: Roboflow,
    workspace: str,
    project: str,
    version: int,
    format: str,
    location: Path
) -> Optional[Dataset]:
    """Download dataset with progress tracking and error handling."""
    try:
        logger.info(f"Accessing workspace: {workspace}")
        logger.info(f"Accessing project: {project}")
        logger.info(f"Version: {version}")
        logger.info(f"Format: {format}")
        logger.info(f"Download location: {location}")

        # Access workspace and project
        workspace_obj = rf.workspace(workspace)
        project_obj = workspace_obj.project(project)

        logger.info(f"Downloading dataset version {version}...")
        dataset = project_obj.version(version).download(format, location=str(location))

        logger.info(f"Dataset downloaded successfully to: {location}")
        return dataset

    except Exception as e:
        logger.error(f"Failed to download dataset: {e}")
        logger.error("Please check:")
        logger.error("  1. Your API key is valid")
        logger.error("  2. The workspace and project names are correct")
        logger.error("  3. The version number exists")
        logger.error("  4. You have internet connection")
        return None


def validate_dataset(dataset_dir: Path) -> bool:
    """Validate that the downloaded dataset has the expected structure."""
    logger.info("Validating dataset structure...")

    required_dirs = [
        dataset_dir / "train" / "images",
        dataset_dir / "train" / "labels",
        dataset_dir / "valid" / "images",
        dataset_dir / "valid" / "labels",
        dataset_dir / "test" / "images",
        dataset_dir / "test" / "labels",
    ]

    missing = [d for d in required_dirs if not d.exists()]

    if missing:
        logger.error("Dataset validation failed. Missing directories:")
        for d in missing:
            logger.error(f"  - {d}")
        return False

    # Count images in each split
    splits = {}
    for split in ["train", "valid", "test"]:
        images_dir = dataset_dir / split / "images"
        if images_dir.exists():
            image_count = len(list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.png")))
            splits[split] = image_count
            logger.info(f"  {split}: {image_count} images")

    logger.info("Dataset validation passed!")
    return True


def main():
    """Main execution function."""
    logger.info("=" * 60)
    logger.info("Roboflow Dataset Download Script")
    logger.info("=" * 60)

    # Validate API key
    if not validate_api_key(API_KEY):
        sys.exit(1)

    # Initialize Roboflow
    rf = initialize_roboflow(API_KEY)
    if rf is None:
        sys.exit(1)

    # Download dataset
    dataset = download_dataset(
        rf=rf,
        workspace=WORKSPACE,
        project=PROJECT,
        version=VERSION,
        format=FORMAT,
        location=DATASET_DIR
    )

    if dataset is None:
        sys.exit(1)

    # Validate dataset
    if not validate_dataset(DATASET_DIR):
        logger.warning("Dataset validation failed, but download may have completed.")
        logger.warning("Please manually check the dataset directory.")

    logger.info("=" * 60)
    logger.info("Download complete!")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
