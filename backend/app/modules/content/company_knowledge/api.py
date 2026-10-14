from fastapi import APIRouter, Response

from app.modules.content.common.dependencies import marketing_user
from app.modules.content.company_knowledge.schemas import CompanyKnowledgeTransition, CompanyKnowledgeUpdate
from app.modules.content.company_knowledge.service import company_knowledge_service
from app.modules.system.settings.service import system_settings_service

router = APIRouter(prefix="/company-knowledge", tags=["Protected Company Knowledge"])
public_router = APIRouter(prefix="/company-knowledge", tags=["Public Company Knowledge"])


@public_router.get("")
async def get_published_company_knowledge(response: Response):
    response.headers["Cache-Control"] = "public, max-age=60, s-maxage=300"
    return {
        "company": await company_knowledge_service.published(),
        "contact": await system_settings_service.public_contact(),
    }

@router.get("")
async def get_company_knowledge(current_user: dict = marketing_user):
    return await company_knowledge_service.admin_view()

@router.put("")
async def update_company_knowledge(payload: CompanyKnowledgeUpdate, current_user: dict = marketing_user):
    return await company_knowledge_service.update(payload, current_user)

@router.post("/transition")
async def transition_company_knowledge(payload: CompanyKnowledgeTransition, current_user: dict = marketing_user):
    return await company_knowledge_service.transition(payload, current_user)
