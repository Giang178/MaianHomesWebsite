from fastapi import Header, HTTPException


async def get_optional_idempotency_key(
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> str | None:
    """Extract, validate, and normalize the optional Idempotency-Key header.

    Guards against direct programmatic function invocations where default argument
    evaluates to the Header instance instead of a string or None.
    """
    if not isinstance(idempotency_key, str):
        return None
    key = idempotency_key.strip()
    if not key:
        return None
    if len(key) > 128:
        raise HTTPException(
            status_code=422,
            detail="Khóa Idempotency-Key không hợp lệ",
        )
    return key
