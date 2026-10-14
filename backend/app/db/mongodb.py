import asyncio
import logging

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from app.core.config import settings

logger = logging.getLogger(__name__)


class MongoDB:
    client: AsyncIOMotorClient = None
    db = None


db_manager = MongoDB()


async def connect_to_mongo():
    db_manager.client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        tz_aware=True,
        maxPoolSize=settings.MONGODB_MAX_POOL_SIZE,
        minPoolSize=settings.MONGODB_MIN_POOL_SIZE,
        serverSelectionTimeoutMS=settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
        connectTimeoutMS=settings.MONGODB_CONNECT_TIMEOUT_MS,
        socketTimeoutMS=settings.MONGODB_SOCKET_TIMEOUT_MS,
        waitQueueTimeoutMS=settings.MONGODB_WAIT_QUEUE_TIMEOUT_MS,
        retryWrites=True,
    )
    db_manager.db = db_manager.client[settings.DATABASE_NAME]

    try:
        await db_manager.client.admin.command("ping")
        logger.info(f"--- Connected to MongoDB: {settings.DATABASE_NAME} (tz_aware=True) ---")

        if settings.ENSURE_INDEXES_ON_STARTUP:
            from app.modules.identity.indexes import ensure_identity_indexes
            from app.modules.content.common.indexes import ensure_marketing_indexes
            from app.modules.website.common.indexes import ensure_website_indexes
            from app.modules.system.common.indexes import ensure_system_indexes
            await ensure_identity_indexes(db_manager.db)
            await ensure_marketing_indexes(db_manager.db)
            await ensure_website_indexes(db_manager.db)
            await ensure_system_indexes(db_manager.db)
        logger.info("--- Đã xác minh các chỉ mục MongoDB lõi (chưa di chuyển) ---")
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        logger.error(f"FATAL: Cannot connect to MongoDB server: {e}", exc_info=True)
        raise RuntimeError(f"MongoDB connection failed during index verification: {e}") from e
    except Exception as e:
        logger.error(f"FATAL: Error verifying/creating MongoDB indexes: {e}", exc_info=True)
        raise RuntimeError("Xác minh chỉ mục MongoDB thất bại") from e


async def close_mongo_connection():
    if db_manager.client:
        db_manager.client.close()
        db_manager.client = None
        db_manager.db = None
        logger.info("--- Kết nối MongoDB đã đóng và client đã khởi tạo lại ---")


def get_database():
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if db_manager.client is not None and current_loop is not None:
        try:
            client_loop = db_manager.client.get_io_loop()
            if client_loop.is_closed() or client_loop is not current_loop:
                db_manager.client = AsyncIOMotorClient(
                    settings.MONGODB_URL,
                    tz_aware=True,
                    retryWrites=True,
                )
                db_manager.db = db_manager.client[settings.DATABASE_NAME]
        except Exception:
            pass

    return db_manager.db
