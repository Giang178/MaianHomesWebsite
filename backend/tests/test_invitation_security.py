from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.modules.identity.invitations import service as invitation_module
from app.modules.identity.invitations.secrets import (
    decrypt_secret_payload,
    encrypt_secret_payload,
)


def test_invitation_secret_payload_is_encrypted_at_rest():
    cleartext = {"setup_url": "https://admin.example/setup-account?token=top-secret"}

    encrypted = encrypt_secret_payload(cleartext)

    assert "top-secret" not in encrypted["ciphertext"]
    assert decrypt_secret_payload(encrypted) == cleartext


@pytest.mark.asyncio
async def test_issue_rejects_disabled_account(monkeypatch):
    account_id = ObjectId()
    users = SimpleNamespace(find_one=AsyncMock(return_value={
        "_id": account_id,
        "role": "MARKETING",
        "status": "DISABLED",
        "is_protected": False,
    }))
    monkeypatch.setattr(invitation_module, "get_database", lambda: {"user_accounts": users})
    monkeypatch.setattr(invitation_module.settings, "ACCOUNT_CREDENTIAL_DELIVERY_ENABLED", True)

    with pytest.raises(HTTPException) as caught:
        await invitation_module.invitation_service.issue(str(account_id), {"id": "admin"})

    assert caught.value.status_code == 409
    assert caught.value.detail["code"] == "ACCOUNT_NOT_PENDING_SETUP"


@pytest.mark.asyncio
async def test_issue_stores_only_encrypted_setup_url(monkeypatch):
    account_id = ObjectId()
    users = SimpleNamespace(
        find_one=AsyncMock(return_value={
            "_id": account_id,
            "email": "new-admin@example.com",
            "full_name": "New Admin",
            "role": "ADMIN",
            "status": "PENDING_SETUP",
            "is_protected": False,
        }),
        update_one=AsyncMock(),
    )
    invitations = SimpleNamespace(update_many=AsyncMock(), insert_one=AsyncMock())
    outbox = SimpleNamespace(insert_one=AsyncMock())
    database = {
        "user_accounts": users,
        "account_invitations": invitations,
        "outbox_events": outbox,
    }
    monkeypatch.setattr(invitation_module, "get_database", lambda: database)
    monkeypatch.setattr(invitation_module.settings, "ACCOUNT_CREDENTIAL_DELIVERY_ENABLED", True)

    result = await invitation_module.invitation_service.issue(str(account_id), {"id": "admin"})

    assert result["delivery_queued"] is True
    event = outbox.insert_one.await_args.args[0]
    assert "setup_url" not in event["payload"]
    secret = decrypt_secret_payload(event["secret"])
    assert secret["setup_url"].startswith(invitation_module.settings.ADMIN_SETUP_URL)
    assert "token=" in secret["setup_url"]


@pytest.mark.asyncio
async def test_disabled_password_reset_does_not_touch_database(monkeypatch):
    monkeypatch.setattr(invitation_module.settings, "PASSWORD_RESET_ENABLED", False)
    monkeypatch.setattr(
        invitation_module,
        "get_database",
        lambda: pytest.fail("database must not be used when password reset is disabled"),
    )

    result = await invitation_module.invitation_service.request_reset("person@example.com")

    assert result["message"] == invitation_module.invitation_service.GENERIC_RESET_RESPONSE


@pytest.mark.asyncio
async def test_reset_token_is_claimed_once_and_revokes_all_sessions(monkeypatch):
    account_id = str(ObjectId())
    invitation = {"_id": ObjectId(), "account_id": account_id}
    invitations = SimpleNamespace(
        find_one_and_update=AsyncMock(side_effect=[invitation, None]),
        update_many=AsyncMock(),
    )
    users = SimpleNamespace(update_one=AsyncMock(return_value=SimpleNamespace(matched_count=1)))
    sessions = SimpleNamespace(update_many=AsyncMock())
    database = {
        "account_invitations": invitations,
        "user_accounts": users,
        "auth_sessions": sessions,
    }
    monkeypatch.setattr(invitation_module, "get_database", lambda: database)
    monkeypatch.setattr(invitation_module.settings, "PASSWORD_RESET_ENABLED", True)
    monkeypatch.setattr(invitation_module, "validate_effective_password", AsyncMock())
    monkeypatch.setattr(
        invitation_module.account_service,
        "hash_password_async",
        AsyncMock(return_value="hashed-password"),
    )

    result = await invitation_module.invitation_service.reset_password("reset-token", "SafePass1!")
    assert result["success"] is True

    claim_filter = invitations.find_one_and_update.await_args_list[0].args[0]
    assert claim_filter["used_at"] is None
    assert claim_filter["revoked_at"] is None
    session_filter = sessions.update_many.await_args.args[0]
    assert {next(iter(item)) for item in session_filter["$or"]} == {
        "account_id",
        "employee_id",
    }

    with pytest.raises(HTTPException) as caught:
        await invitation_module.invitation_service.reset_password("reset-token", "SafePass1!")
    assert caught.value.status_code == 400
