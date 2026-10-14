import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

_EXTRA_FIELDS = (
    "request_id",
    "lead_id",
    "actor",
    "latency_ms",
    "method",
    "path",
    "status",
    "event_id",
    "worker_id",
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in _EXTRA_FIELDS:
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        if record.exc_info:
            payload["exception_type"] = record.exc_info[0].__name__
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_json_logging() -> None:
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(JsonFormatter())
    handlers: list[logging.Handler] = [stream_handler]

    log_file = os.getenv("BACKEND_LOG_FILE", "").strip()
    if log_file:
        try:
            log_path = Path(log_file).expanduser().resolve()
            log_path.parent.mkdir(parents=True, exist_ok=True)
            file_handler = logging.FileHandler(log_path, encoding="utf-8")
            file_handler.setFormatter(JsonFormatter())
            handlers.append(file_handler)
        except OSError as exc:
            stream_handler.handle(
                logging.LogRecord(
                    name=__name__,
                    level=logging.WARNING,
                    pathname=__file__,
                    lineno=0,
                    msg=f"Could not configure BACKEND_LOG_FILE: {exc}",
                    args=(),
                    exc_info=None,
                )
            )

    logging.basicConfig(level=logging.INFO, handlers=handlers, force=True)
