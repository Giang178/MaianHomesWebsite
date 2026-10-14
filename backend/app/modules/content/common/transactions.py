from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.mongodb import db_manager


@asynccontextmanager
async def marketing_transaction():
    """Use Mongo transactions in production while preserving standalone local dev."""
    if not getattr(settings, "MARKETING_TRANSACTIONS_ENABLED", False):
        yield None
        return
    if db_manager.client is None:
        raise RuntimeError("MongoDB client chưa được khởi tạo")
    async with await db_manager.client.start_session() as session:
        async with session.start_transaction():
            yield session

