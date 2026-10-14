from fastapi import HTTPException


def validate_password(password: str, policy: dict) -> None:
    errors: list[str] = []
    minimum = int(policy.get("password_min_length", 8))
    if len(password) < minimum:
        errors.append(f"at least {minimum} characters")
    if policy.get("require_uppercase", True) and not any(char.isupper() for char in password):
        errors.append("an uppercase letter")
    if policy.get("require_lowercase", True) and not any(char.islower() for char in password):
        errors.append("a lowercase letter")
    if policy.get("require_digit", True) and not any(char.isdigit() for char in password):
        errors.append("a number")
    if policy.get("require_special", True) and not any(not char.isalnum() for char in password):
        errors.append("a special character")
    if errors:
        raise HTTPException(status_code=422, detail="Mật khẩu phải chứa " + ", ".join(errors))


async def validate_effective_password(password: str) -> None:
    from app.modules.identity.service import identity_service

    validate_password(password, await identity_service.get_policy())

