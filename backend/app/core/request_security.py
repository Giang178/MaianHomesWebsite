import ipaddress
import secrets
from collections.abc import Iterable

from starlette.requests import Request


UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
COOKIE_AUTH_PUBLIC_MUTATIONS = frozenset(
    {
        "/api/public/auth/logout",
        "/api/public/auth/complete-first-login",
    }
)


def normalized_origins(origins: Iterable[str]) -> set[str]:
    return {origin.strip().rstrip("/").casefold() for origin in origins if origin.strip()}


def mutation_origin_is_allowed(
    request: Request,
    allowed_origins: Iterable[str],
    *,
    enforcement_enabled: bool,
) -> bool:
    if not enforcement_enabled or request.method.upper() not in UNSAFE_METHODS:
        return True
    if not request.cookies.get("access_token"):
        return True
    path = request.url.path
    if not (
        path.startswith("/api/protected/")
        or path in COOKIE_AUTH_PUBLIC_MUTATIONS
    ):
        return True
    origin = (request.headers.get("origin") or "").strip().rstrip("/").casefold()
    return bool(origin) and origin in normalized_origins(allowed_origins)


def metrics_access_allowed(
    request: Request,
    allowed_cidrs: str,
    configured_token: str = "",
) -> bool:
    expected_token = configured_token.strip()
    authorization = request.headers.get("authorization") or ""
    if expected_token and authorization.startswith("Bearer "):
        supplied_token = authorization.removeprefix("Bearer ").strip()
        if secrets.compare_digest(supplied_token, expected_token):
            return True

    client_host = request.client.host if request.client else ""
    try:
        client_ip = ipaddress.ip_address(client_host)
    except ValueError:
        return False
    for value in allowed_cidrs.split(","):
        try:
            if client_ip in ipaddress.ip_network(value.strip(), strict=False):
                return True
        except ValueError:
            continue
    return False
