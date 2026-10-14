import unittest
from unittest.mock import AsyncMock, patch
from pydantic import BaseModel
from app.services.base import BaseService

class DummyModel(BaseModel):
    id: str

class DummyService(BaseService):
    def __init__(self):
        super().__init__("dummy_collection", DummyModel)

class TestAuditFailure(unittest.IsolatedAsyncioTestCase):
    async def test_audit_log_failure_logs_error_and_does_not_raise(self):
        service = DummyService()
        
        with patch("app.modules.activity.audit.audit_service.log", AsyncMock(side_effect=RuntimeError("Mock DB Audit Error"))):
            with patch("app.services.base.logger.error") as mock_logger_error:
                # Execution should not raise an exception
                await service._audit_log(
                    action="create",
                    document_id="doc123",
                    actor_email="admin@maianhomes.vn",
                    actor_role="CEO",
                    before=None,
                    after={"name": "Test"}
                )
                
                # Verify logger.error was called with exc_info=True
                mock_logger_error.assert_called_once()
                args, kwargs = mock_logger_error.call_args
                self.assertIn("Failed to create audit log for dummy_collection [doc123]", args[0])
                self.assertTrue(kwargs.get("exc_info"))

    async def test_audit_block_failure_logs_error_and_does_not_raise(self):
        service = DummyService()
        
        with patch("app.modules.activity.audit.audit_service.log", AsyncMock(side_effect=RuntimeError("Mock DB Audit Error"))):
            with patch("app.services.base.logger.error") as mock_logger_error:
                # Execution should not raise an exception
                await service._audit_block(
                    document_id="doc123",
                    attempted_action="delete",
                    actor_email="attacker@maianhomes.vn",
                    actor_role="STAFF",
                    existing={"name": "Protected CEO"}
                )
                
                # Verify logger.error was called with exc_info=True
                mock_logger_error.assert_called_once()
                args, kwargs = mock_logger_error.call_args
                self.assertIn("Failed to create audit log for dummy_collection [doc123]", args[0])
                self.assertTrue(kwargs.get("exc_info"))

if __name__ == "__main__":
    unittest.main()
