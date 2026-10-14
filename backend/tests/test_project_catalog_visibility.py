from unittest.mock import AsyncMock

import pytest

from app.modules.content.projects.service import ProjectApplicationService


@pytest.mark.asyncio
async def test_project_reader_sees_the_complete_admin_catalog():
    service = ProjectApplicationService()
    service.repository = AsyncMock()
    service.repository.list_admin.return_value = ([], 0)

    await service.list(
        {"id": "marketing-staff-1", "role": "MARKETING_STAFF"},
        skip=0,
        limit=100,
        workflow=None,
        publication=None,
    )

    service.repository.list_admin.assert_awaited_once_with({}, 0, 100)


@pytest.mark.asyncio
async def test_project_catalog_keeps_explicit_workflow_and_publication_filters():
    service = ProjectApplicationService()
    service.repository = AsyncMock()
    service.repository.list_admin.return_value = ([], 0)

    await service.list(
        {"id": "marketing-staff-1", "role": "MARKETING_STAFF"},
        skip=20,
        limit=10,
        workflow="DRAFT",
        publication="PUBLISHED",
    )

    service.repository.list_admin.assert_awaited_once_with(
        {"workflow_status": "DRAFT", "publication_status": "PUBLISHED"},
        20,
        10,
    )
