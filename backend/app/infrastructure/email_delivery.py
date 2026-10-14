"""Infrastructure-only asynchronous SMTP adapter.

Business templates and retry behavior live in the owning module/outbox worker.
This adapter never logs an email body or credential.
"""
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html_body: str) -> bool:
    try:
        from app.modules.system.settings.service import system_settings_service
        config = await system_settings_service.smtp_config()
    except Exception:
        logger.warning("Chưa cấu hình SMTP; bỏ qua việc gửi email")
        return False
    message = MIMEMultipart("alternative")
    message["From"] = f"{config['from_name']} <{config['from_email']}>"
    message["To"] = to
    message["Subject"] = subject
    message.attach(MIMEText(html_body, "html", "utf-8"))
    try:
        import aiosmtplib
        await aiosmtplib.send(
            message, hostname=config["host"], port=config["port"],
            username=config["username"], password=config["password"],
            start_tls=bool(config.get("start_tls", True)),
        )
        logger.info("Đã gửi email", extra={"recipient_domain": to.rsplit("@", 1)[-1] if "@" in to else "invalid"})
        return True
    except ModuleNotFoundError:
        logger.error("Thư viện aiosmtplib chưa được cài đặt; tính năng gửi email không khả dụng")
        return False
    except Exception:
        logger.exception("Gửi email SMTP thất bại", extra={"recipient_domain": to.rsplit("@", 1)[-1] if "@" in to else "invalid"})
        return False
