from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

REQUESTS = Counter(
    "maian_http_requests_total",
    "HTTP requests handled by the API",
    ["method", "route", "status_class"],
)
LATENCY = Histogram(
    "maian_http_request_duration_seconds",
    "HTTP request latency",
    ["method", "route"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)
ACTIVITY_WRITES = Counter(
    "maian_activity_writes_total",
    "Activity event write outcomes",
    ["delivery", "outcome"],
)
ACTIVITY_PURGES = Counter(
    "maian_activity_purges_total",
    "Activity purge outcomes",
    ["outcome"],
)
AI_REQUESTS = Counter(
    "maian_ai_requests_total",
    "AI request outcomes separated by public chatbot and internal SEO",
    ["surface", "outcome"],
)
AI_LATENCY = Histogram(
    "maian_ai_generation_duration_seconds",
    "End-to-end AI generation latency",
    ["surface"],
    buckets=(0.25, 0.5, 1, 2.5, 5, 10, 20, 30, 45),
)
AI_TTFR = Histogram(
    "maian_ai_time_to_first_response_seconds",
    "Time to first validated AI response event",
    ["surface"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 30, 45),
)
AI_EVENTS = Counter(
    "maian_ai_quality_events_total",
    "AI quality and grounding events",
    ["surface", "event"],
)


def observe(method: str, route: str, status_code: int, seconds: float) -> None:
    safe_route = route if route.startswith("/") else "unknown"
    REQUESTS.labels(method=method, route=safe_route, status_class=f"{status_code // 100}xx").inc()
    LATENCY.labels(method=method, route=safe_route).observe(seconds)


def observe_activity_write(delivery: str, outcome: str) -> None:
    ACTIVITY_WRITES.labels(delivery=delivery, outcome=outcome).inc()


def observe_activity_purge(outcome: str) -> None:
    ACTIVITY_PURGES.labels(outcome=outcome).inc()


def observe_ai(surface: str, outcome: str, seconds: float, events: list[str] | None = None, time_to_first_seconds: float | None = None) -> None:
    AI_REQUESTS.labels(surface=surface, outcome=outcome).inc()
    AI_LATENCY.labels(surface=surface).observe(seconds)
    AI_TTFR.labels(surface=surface).observe(time_to_first_seconds if time_to_first_seconds is not None else seconds)
    for event in events or []:
        AI_EVENTS.labels(surface=surface, event=event).inc()


def exposition() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST
