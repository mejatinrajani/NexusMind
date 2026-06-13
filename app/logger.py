import sys
import logging
from logging.handlers import RotatingFileHandler
from .config import settings

def setup_logger(module_name: str) -> logging.Logger:
    """
    Initializes a thread-safe, structured logger that outputs concurrently
    to stdout and a rolling, size-capped log file on disk.
    """
    logger = logging.getLogger(module_name)
    logger.setLevel(logging.INFO)
    
    # Prevent duplicate handlers from stacking if initialized multiple times across concurrent tasks
    if logger.hasHandlers():
        return logger

    # Enforce clear, structural string formatting for clean terminal output
    log_format = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Stream Handler for active terminal output
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(log_format)
    logger.addHandler(console_handler)

    # Rotating File Handler for historical trace capture
    log_file_path = settings.DATA_DIR / "nexusmind.log"
    file_handler = RotatingFileHandler(
        filename=log_file_path,
        maxBytes=10 * 1024 * 1024,  # Cap file size at 10MB
        backupCount=5,              # Archive up to 5 old trace files
        encoding="utf-8"
    )
    file_handler.setFormatter(log_format)
    logger.addHandler(file_handler)

    return logger