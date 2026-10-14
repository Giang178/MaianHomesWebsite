from fastapi import APIRouter

from app.modules.content.articles.api import router as protected_articles
from app.modules.content.articles.public_api import router as public_articles
from app.modules.content.company_knowledge.api import public_router as public_company_knowledge
from app.modules.content.company_knowledge.api import router as protected_company_knowledge
from app.modules.content.media.api import protected_router as protected_media
from app.modules.content.media.api import public_router as public_media
from app.modules.content.projects.api import router as protected_projects
from app.modules.content.projects.public_api import router as public_projects
from app.modules.identity.invitations.api import protected_router as protected_invitations
from app.modules.identity.invitations.api import public_router as public_invitations
from app.modules.identity.permissions.api import router as protected_permissions
from app.modules.website.branding.api import protected_router as protected_branding
from app.modules.website.branding.api import public_router as public_branding
from app.modules.website.consignments.api import router as public_consignments
from app.modules.website.inquiries.api import protected_router as protected_inquiries
from app.modules.website.inquiries.api import public_router as public_inquiries
from app.modules.website.pages.api import protected_router as protected_pages
from app.modules.website.pages.api import public_router as public_pages
from app.modules.website.team.api import protected_router as protected_team
from app.modules.website.team.api import public_router as public_team
from app.modules.website.recruitment.api import applications_router
from app.modules.website.recruitment.api import protected_router as protected_recruitment
from app.modules.website.recruitment.api import public_router as public_recruitment
from app.modules.website.workspaces.api import protected_router as protected_workspaces
from app.modules.website.workspaces.api import public_router as public_workspaces
from app.modules.website.system.api import email_router as protected_system_email
from app.modules.website.system.api import router as protected_system
from app.modules.website.media.api import router as protected_website_media
from app.modules.website.dashboard.api import router as protected_dashboard
from app.modules.website.analytics.api import router as protected_analytics


public_router = APIRouter()
public_router.include_router(public_pages)
# Register concrete workspace routes before the invitation token route
# (/workspaces/{token}); otherwise values such as "coworking" are consumed as
# invitation tokens and the public workspace pages return a false 404.
public_router.include_router(public_workspaces)
public_router.include_router(public_invitations)
public_router.include_router(public_branding)
public_router.include_router(public_consignments)
public_router.include_router(public_inquiries)
public_router.include_router(public_team)
public_router.include_router(public_recruitment)
public_router.include_router(public_projects)
public_router.include_router(public_articles)
public_router.include_router(public_media)
public_router.include_router(public_company_knowledge)

protected_router = APIRouter()
protected_router.include_router(protected_pages)
protected_router.include_router(protected_invitations)
protected_router.include_router(protected_permissions)
protected_router.include_router(protected_branding)
protected_router.include_router(protected_inquiries)
protected_router.include_router(protected_team)
protected_router.include_router(protected_recruitment)
protected_router.include_router(applications_router)
protected_router.include_router(protected_workspaces)
protected_router.include_router(protected_system)
protected_router.include_router(protected_system_email)
protected_router.include_router(protected_website_media)
protected_router.include_router(protected_dashboard)
protected_router.include_router(protected_analytics)

# Compatibility paths for the existing admin frontend. Their implementations
# live behind the website router while the physical module move is completed.
protected_router.include_router(protected_projects)
protected_router.include_router(protected_articles)
protected_router.include_router(protected_media)
protected_router.include_router(protected_company_knowledge)
