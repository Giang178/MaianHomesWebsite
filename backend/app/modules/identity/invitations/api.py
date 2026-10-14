from fastapi import APIRouter, Depends, Request

from app.api.deps import require_permissions
from app.core.security import limiter
from app.modules.identity.invitations.schemas import SetupAccountPayload
from app.modules.identity.invitations.service import invitation_service

protected_router = APIRouter(prefix="/website/accounts", tags=["Website Accounts"])
public_router = APIRouter(prefix="/auth", tags=["Authentication"])


@protected_router.post("/{account_id}/issue")
async def issue_account(account_id: str, current_user: dict = Depends(require_permissions("website.accounts.update"))):
    return await invitation_service.issue(account_id, current_user)


@public_router.post("/setup-account")
@limiter.limit("5/minute")
async def setup_account(request: Request, payload: SetupAccountPayload):
    return await invitation_service.complete(payload.token, payload.password)
