from datetime import datetime, timedelta, timezone
from typing import Any
import hashlib
import ipaddress

import jwt
from slowapi import Limiter
from starlette.requests import Request as StarletteRequest

from app.core.config import settings

ALGORITHM = "HS256"


def _trusted_proxy_networks():
    networks = []
    for value in settings.TRUSTED_PROXY_CIDRS.split(","):
        try:
            networks.append(ipaddress.ip_network(value.strip(), strict=False))
        except ValueError:
            continue
    return networks


def _is_private_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        return ip.is_private or ip.is_loopback
    except ValueError:
        return False


def get_real_client_ip(request: StarletteRequest) -> str:
    """Trích xuất IP thực an toàn. Tránh IP Spoofing từ Header X-Forwarded-For."""
    client_host = request.client.host if request.client else "127.0.0.1"
    
    # Chỉ tin tưởng Header X-Forwarded-For nếu request đi qua Proxy nội bộ/được tin cậy
    try:
        client_ip = ipaddress.ip_address(client_host)
        trusted_proxy = any(client_ip in network for network in _trusted_proxy_networks())
    except ValueError:
        trusted_proxy = False
    if trusted_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Reverse-proxy uy tín gắn IP thực của client vào cuối danh sách.
            # Lấy IP không phải private đầu tiên từ bên phải sang để chống client spoofing.
            ips = [ip.strip() for ip in forwarded.split(",") if ip.strip()]
            for ip in reversed(ips):
                if not _is_private_ip(ip):
                    return ip
            return ips[0] if ips else client_host
    return client_host


def get_client_fingerprint(request: StarletteRequest) -> str:
    supplied = (request.headers.get("x-client-fingerprint") or "").strip()[:128]
    material = "|".join([
        get_real_client_ip(request),
        request.headers.get("user-agent", "unknown")[:256],
        request.headers.get("accept-language", "unknown")[:128],
        supplied,
    ])
    return "lead-fp:" + hashlib.sha256(material.encode("utf-8")).hexdigest()


limiter = Limiter(key_func=get_real_client_ip, storage_uri=settings.RATE_LIMIT_STORAGE_URI)


def create_access_token(subject: str | Any, role: str, email: str, expires_delta: timedelta | None = None, token_version: int = 1, session_id: str | None = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "role": role,
        "email": email,
        "token_version": token_version,
        "sid": session_id,
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt




def verify_token(token: str, expected_purpose: str | None = None) -> dict | None:
    try:
        decoded_token = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        token_purpose = decoded_token.get("purpose")
        if expected_purpose is not None:
            if token_purpose != expected_purpose:
                return None
        else:
            # Nếu verify_token được dùng để kiểm tra access token (expected_purpose=None),
            # tuyệt đối từ chối token có trường purpose (như reset_password, purpose tokens)
            if token_purpose is not None:
                return None
        return decoded_token
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
