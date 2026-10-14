from contextlib import asynccontextmanager

from app.core.config import settings
from app.db.mongodb import db_manager


@asynccontextmanager
async def website_transaction():
    """Use Mongo transactions in deployed environments and standalone writes locally."""
    if not settings.MARKETING_TRANSACTIONS_ENABLED:
        yield None
        return
    if db_manager.client is None:
        raise RuntimeError("MongoDB client is not initialized")
    async with await db_manager.client.start_session() as session:
        async with session.start_transaction():
            yield session


def session_kwargs(session) -> dict:
    return {"session": session} if session is not None else {}
