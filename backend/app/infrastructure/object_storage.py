import asyncio
import hashlib
import logging
import os
import shutil
import threading
from collections.abc import AsyncIterator
from contextlib import suppress
from pathlib import Path
from tempfile import SpooledTemporaryFile
from typing import BinaryIO

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageUnavailableError(RuntimeError):
    """Object storage is temporarily unavailable to serve the request."""


class StorageCapacityError(StorageUnavailableError):
    """The process-local S3 concurrency gate could not be acquired in time."""


class StorageObjectNotFoundError(FileNotFoundError):
    """The requested object does not exist in object storage."""


class _S3ObjectStream:
    """Async iterator that owns an S3 body and its concurrency permit."""

    def __init__(self, body, gate: asyncio.Semaphore, chunk_size: int) -> None:
        self._body = body
        self._gate = gate
        self._chunk_size = chunk_size
        self._closed = False

    def __aiter__(self):
        return self

    async def __anext__(self) -> bytes:
        if self._closed:
            raise StopAsyncIteration
        try:
            chunk = await asyncio.to_thread(self._body.read, self._chunk_size)
        except BaseException:
            self._finish()
            raise
        if not chunk:
            self._finish()
            raise StopAsyncIteration
        return chunk

    async def aclose(self) -> None:
        self._finish()

    def _finish(self) -> None:
        if self._closed:
            return
        self._closed = True
        try:
            self._body.close()
        finally:
            self._gate.release()

    def __del__(self):
        with suppress(Exception):
            self._finish()


async def spool_upload(upload, max_bytes: int) -> tuple[BinaryIO, int, str]:
    stream = SpooledTemporaryFile(max_size=2 * 1024 * 1024, mode="w+b")
    digest = hashlib.sha256()
    size = 0
    while True:
        chunk = await upload.read(256 * 1024)
        if not chunk:
            break
        size += len(chunk)
        if size > max_bytes:
            stream.close()
            raise ValueError("quá_lớn")
        digest.update(chunk)
        stream.write(chunk)
    stream.seek(0)
    return stream, size, digest.hexdigest()


class StorageService:
    def __init__(self) -> None:
        self._client_instance = None
        self._client_owner: tuple | None = None
        self._client_lock = threading.Lock()
        self._operation_gate_instance: asyncio.Semaphore | None = None
        self._operation_gate_owner: tuple | None = None
        self._operation_gate_lock = threading.Lock()

    @staticmethod
    def _client_signature() -> tuple:
        return (
            os.getpid(),
            settings.S3_ENDPOINT_URL,
            settings.S3_ACCESS_KEY,
            settings.S3_SECRET_KEY,
            settings.S3_REGION,
            settings.S3_MAX_POOL_CONNECTIONS,
        )

    def _client(self):
        signature = self._client_signature()
        with self._client_lock:
            if self._client_instance is None or self._client_owner != signature:
                # boto3 clients are thread-safe after construction.  Reusing
                # one adequately sized HTTP pool avoids TLS/TCP connection
                # churn across concurrent uploads and streamed downloads.
                import boto3
                from botocore.config import Config

                previous = self._client_instance
                previous_owner = self._client_owner
                self._client_instance = boto3.client(
                    "s3",
                    endpoint_url=settings.S3_ENDPOINT_URL,
                    aws_access_key_id=settings.S3_ACCESS_KEY,
                    aws_secret_access_key=settings.S3_SECRET_KEY,
                    region_name=settings.S3_REGION,
                    config=Config(
                        connect_timeout=3,
                        read_timeout=30,
                        max_pool_connections=settings.S3_MAX_POOL_CONNECTIONS,
                        retries={"max_attempts": 3, "mode": "standard"},
                    ),
                )
                self._client_owner = signature
                if previous is not None and previous_owner and previous_owner[0] == os.getpid():
                    try:
                        previous.close()
                    except Exception:
                        logger.warning("s3_stale_client_close_failed", exc_info=True)
            return self._client_instance

    def _operation_gate(self) -> asyncio.Semaphore:
        loop = asyncio.get_running_loop()
        signature = (os.getpid(), id(loop), settings.S3_MAX_CONCURRENCY)
        with self._operation_gate_lock:
            if (
                self._operation_gate_instance is None
                or self._operation_gate_owner != signature
            ):
                self._operation_gate_instance = asyncio.Semaphore(
                    settings.S3_MAX_CONCURRENCY
                )
                self._operation_gate_owner = signature
            return self._operation_gate_instance

    async def _acquire_operation_slot(self) -> asyncio.Semaphore:
        gate = self._operation_gate()
        try:
            await asyncio.wait_for(
                gate.acquire(),
                timeout=settings.S3_OPERATION_ACQUIRE_TIMEOUT_SECONDS,
            )
        except (asyncio.TimeoutError, TimeoutError) as exc:
            raise StorageCapacityError(
                "Object storage concurrency limit reached"
            ) from exc
        return gate

    async def _run_s3(self, operation):
        gate = await self._acquire_operation_slot()
        work = asyncio.create_task(asyncio.to_thread(operation))
        release_on_exit = True
        try:
            return await asyncio.shield(work)
        except asyncio.CancelledError:
            # A running thread cannot be cancelled.  Keep the permit assigned
            # to it until the SDK call actually returns so cancelled requests
            # cannot silently exceed the configured S3 concurrency bound.
            release_on_exit = False

            def release_after_work(task: asyncio.Task) -> None:
                with suppress(BaseException):
                    task.result()
                gate.release()

            work.add_done_callback(release_after_work)
            raise
        finally:
            if release_on_exit:
                gate.release()

    async def close(self) -> None:
        """Close the process-local S3 HTTP pool; safe to call repeatedly."""
        with self._client_lock:
            client = self._client_instance
            owner = self._client_owner
            self._client_instance = None
            self._client_owner = None
        if client is not None and owner and owner[0] == os.getpid():
            try:
                await asyncio.to_thread(client.close)
            except Exception:
                logger.warning("s3_client_close_failed", exc_info=True)

    async def ensure_bucket(self) -> None:
        def ensure():
            client = self._client()
            try:
                client.head_bucket(Bucket=settings.S3_BUCKET)
            except Exception:
                client.create_bucket(Bucket=settings.S3_BUCKET)
        await self._run_s3(ensure)

    async def check_bucket(self) -> None:
        def check():
            self._client().head_bucket(Bucket=settings.S3_BUCKET)
        await self._run_s3(check)

    async def put_fileobj(self, key: str, stream: BinaryIO, content_type: str) -> None:
        def put():
            stream.seek(0)
            self._client().upload_fileobj(
                stream, settings.S3_BUCKET, key,
                ExtraArgs={"ContentType": content_type},
            )
        await self._run_s3(put)

    async def presign_get(self, key: str, filename: str, expires_seconds: int = 300) -> str:
        def sign():
            return self._client().generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": settings.S3_BUCKET,
                    "Key": key,
                    "ResponseContentDisposition": f'attachment; filename="{filename}"',
                },
                ExpiresIn=expires_seconds,
            )
        return await self._run_s3(sign)

    async def get_bytes(self, key: str) -> bytes:
        def get():
            response = self._client().get_object(Bucket=settings.S3_BUCKET, Key=key)
            body = response["Body"]
            try:
                return body.read()
            finally:
                body.close()
        return await self._run_s3(get)

    async def open_stream(
        self,
        key: str,
        *,
        chunk_size: int = 256 * 1024,
    ) -> tuple[AsyncIterator[bytes], int | None, str | None]:
        """Open an S3 object without buffering the complete body in API RAM."""
        if chunk_size <= 0:
            raise ValueError("chunk_size must be positive")

        def open_object():
            return self._client().get_object(Bucket=settings.S3_BUCKET, Key=key)

        gate = await self._acquire_operation_slot()
        work = asyncio.create_task(asyncio.to_thread(open_object))
        try:
            response = await asyncio.shield(work)
        except asyncio.CancelledError:
            # Preserve the concurrency permit while the uncancellable SDK call
            # is still running, then close any returned body to return its HTTP
            # connection to the shared pool.
            def close_after_cancel(task: asyncio.Task) -> None:
                try:
                    cancelled_response = task.result()
                    cancelled_body = cancelled_response.get("Body")
                    if cancelled_body is not None:
                        cancelled_body.close()
                except asyncio.CancelledError:
                    logger.debug("s3_cancelled_operation_never_started")
                except Exception:
                    logger.debug(
                        "s3_cancelled_operation_cleanup_failed",
                        exc_info=True,
                    )
                finally:
                    gate.release()

            work.add_done_callback(close_after_cancel)
            raise
        except BaseException as exc:
            gate.release()
            if not isinstance(exc, Exception):
                raise
            try:
                from botocore.exceptions import BotoCoreError, ClientError

                if isinstance(exc, ClientError):
                    error = exc.response.get("Error") or {}
                    code = str(error.get("Code") or "")
                    status_code = (exc.response.get("ResponseMetadata") or {}).get(
                        "HTTPStatusCode"
                    )
                    if code in {"NoSuchKey", "NoSuchObject", "NotFound", "404"} or status_code == 404:
                        raise StorageObjectNotFoundError(key) from exc
                if isinstance(exc, BotoCoreError):
                    raise StorageUnavailableError(
                        "Object storage request failed"
                    ) from exc
            except ImportError:
                pass
            raise StorageUnavailableError("Object storage request failed") from exc

        try:
            body = response["Body"]
            raw_length = response.get("ContentLength")
            content_length = int(raw_length) if raw_length is not None else None
            stream = _S3ObjectStream(body, gate, chunk_size)
            return stream, content_length, response.get("ContentType")
        except Exception:
            body = response.get("Body")
            try:
                if body is not None:
                    body.close()
            finally:
                gate.release()
            raise

    async def delete(self, key: str) -> None:
        def remove():
            self._client().delete_object(Bucket=settings.S3_BUCKET, Key=key)
        await self._run_s3(remove)

    async def write_local(self, path: Path, stream: BinaryIO) -> None:
        def write():
            path.parent.mkdir(parents=True, exist_ok=True)
            stream.seek(0)
            with path.open("wb") as target:
                shutil.copyfileobj(stream, target, length=256 * 1024)
        await asyncio.to_thread(write)


storage_service = StorageService()
