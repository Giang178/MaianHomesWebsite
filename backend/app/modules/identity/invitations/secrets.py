"""Authenticated encryption for invitation and password-reset email payloads."""

from __future__ import annotations

import base64
import json
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

_AAD_PREFIX = "website-identity-email-v"


def _decode_key(version: int) -> bytes:
    if version == settings.CREDENTIAL_ENCRYPTION_KEY_VERSION:
        encoded = settings.CREDENTIAL_ENCRYPTION_KEY.strip()
    else:
        try:
            previous = json.loads(settings.CREDENTIAL_DECRYPTION_KEYS or "{}")
            encoded = str(previous[str(version)]).strip()
        except (ValueError, TypeError, KeyError) as exc:
            raise RuntimeError(f"Credential encryption key version {version} is unavailable") from exc
    try:
        key = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
    except Exception as exc:
        raise RuntimeError("CREDENTIAL_ENCRYPTION_KEY is not valid URL-safe base64") from exc
    if len(key) != 32:
        raise RuntimeError("CREDENTIAL_ENCRYPTION_KEY must encode exactly 32 bytes")
    return key


def encrypt_secret_payload(payload: dict) -> dict:
    version = int(settings.CREDENTIAL_ENCRYPTION_KEY_VERSION)
    nonce = secrets.token_bytes(12)
    aad = f"{_AAD_PREFIX}{version}".encode("ascii")
    ciphertext = AESGCM(_decode_key(version)).encrypt(
        nonce,
        json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        aad,
    )
    return {
        "nonce": base64.urlsafe_b64encode(nonce).decode("ascii"),
        "ciphertext": base64.urlsafe_b64encode(ciphertext).decode("ascii"),
        "key_version": version,
    }


def decrypt_secret_payload(document: dict) -> dict:
    version = int(document.get("key_version") or 1)
    aad = f"{_AAD_PREFIX}{version}".encode("ascii")
    plaintext = AESGCM(_decode_key(version)).decrypt(
        base64.urlsafe_b64decode(document["nonce"]),
        base64.urlsafe_b64decode(document["ciphertext"]),
        aad,
    )
    return json.loads(plaintext.decode("utf-8"))
