"""
Logger estructurado para el backend
"""
import logging
import sys
from datetime import datetime
from typing import Optional


class ColoredFormatter(logging.Formatter):
    """Formatter con colores para consola"""

    COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET = "\033[0m"

    def format(self, record):
        log_color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{log_color}{record.levelname}{self.RESET}"
        return super().format(record)


def setup_logger(
    name: str = "backend-nucleo",
    level: int = logging.INFO,
    debug: bool = False
) -> logging.Logger:
    """
    Configura un logger con formato estructurado
    """
    logger = logging.getLogger(name)
    logger.setLevel(level if not debug else logging.DEBUG)

    # Evitar duplicar handlers
    if logger.handlers:
        return logger

    # Handler para consola
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level if not debug else logging.DEBUG)

    # Formato
    if debug:
        fmt = "%(asctime)s | %(levelname)s | %(name)s | %(filename)s:%(lineno)d | %(message)s"
    else:
        fmt = "%(asctime)s | %(levelname)s | %(message)s"

    formatter = ColoredFormatter(fmt, datefmt="%Y-%m-%d %H:%M:%S")
    console_handler.setFormatter(formatter)

    logger.addHandler(console_handler)
    return logger


logger = setup_logger(debug=False)
