from app.models.notification import Notification
from app.db.base_service import BaseService


class NotificationService(BaseService):
    def __init__(self):
        super().__init__(collection_name="notifications", model=Notification)

notification_service = NotificationService()
