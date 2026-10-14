import asyncio
import logging
from collections.abc import AsyncGenerator
from typing import Any

import httpx
from ollama import AsyncClient, ResponseError

from app.core.config import settings

logger = logging.getLogger(__name__)


class GeminiClientAdapter:
    """Small Ollama-compatible adapter over the official Google Gen AI SDK.

    Existing services use ``generate`` and ``chat``. Keeping that contract here
    lets the provider change remain a backend concern and preserves the public
    SSE contract and evidence validation.
    """

    _endpoint = "https://generativelanguage.googleapis.com"

    def __init__(self) -> None:
        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:  # pragma: no cover - exercised by deployment preflight
            raise RuntimeError("google-genai is required when AI_PROVIDER=gemini") from exc
        api_key = settings.GEMINI_API_KEY.strip()
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is required when AI_PROVIDER=gemini")
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=int(settings.GEMINI_REQUEST_TIMEOUT_SECONDS * 1000)
            ),
        )

    @staticmethod
    def _request_error(exc: Exception) -> httpx.RequestError:
        return httpx.RequestError(
            f"Gemini request failed: {type(exc).__name__}",
            request=httpx.Request("POST", GeminiClientAdapter._endpoint),
        )

    @staticmethod
    def _config(
        options: dict[str, Any] | None = None,
        system: str | None = None,
        json_mode: bool = False,
    ) -> dict[str, Any]:
        options = options or {}
        config: dict[str, Any] = {}
        if system:
            config["system_instruction"] = system
        if "temperature" in options:
            config["temperature"] = options["temperature"]
        if "num_predict" in options:
            config["max_output_tokens"] = options["num_predict"]
        if "thinking_level" in options and "lite" not in settings.GEMINI_MODEL.lower():
            config["thinking_config"] = {
                "thinking_level": options["thinking_level"],
                "include_thoughts": False,
            }
        if json_mode:
            config["response_mime_type"] = "application/json"
        return config

    @staticmethod
    def _contents(messages: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str | None]:
        contents: list[dict[str, Any]] = []
        system_parts: list[str] = []
        for message in messages:
            role = str(message.get("role") or "user")
            content = str(message.get("content") or "").strip()
            if not content:
                continue
            if role == "system":
                system_parts.append(content)
                continue
            contents.append({
                "role": "model" if role == "assistant" else "user",
                "parts": [{"text": content}],
            })
        return contents, "\n\n".join(system_parts) or None

    @staticmethod
    def _response_text(response: Any) -> str:
        return str(getattr(response, "text", "") or "").strip()

    async def generate(
        self,
        *,
        model: str,
        prompt: str,
        format: str | None = None,
        system: str | None = None,
        options: dict[str, Any] | None = None,
    ) -> dict[str, str]:
        config = self._config(options, system, format == "json")
        candidates = [model]
        if model != "gemini-3.5-flash":
            candidates.append("gemini-3.5-flash")
        last_exc: Exception | None = None
        for candidate_model in candidates:
            for attempt in range(2):
                try:
                    response = await self._client.aio.models.generate_content(
                        model=candidate_model,
                        contents=prompt,
                        config=config,
                    )
                    return {"response": self._response_text(response)}
                except Exception as exc:
                    last_exc = exc
                    logger.warning(f"gemini_generate_attempt_failed [{candidate_model}] attempt {attempt}: {exc}")
                    if attempt == 0:
                        await asyncio.sleep(0.5)
        raise self._request_error(last_exc) from last_exc

    async def chat(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        options: dict[str, Any] | None = None,
        stream: bool = True,
    ):
        contents, system = self._contents(messages)
        config = self._config(options, system)

        async def response_stream():
            try:
                if stream:
                    chunks = await self._client.aio.models.generate_content_stream(
                        model=model,
                        contents=contents,
                        config=config,
                    )
                    async for chunk in chunks:
                        content = self._response_text(chunk)
                        if content:
                            yield {"message": {"content": content}}
                else:
                    response = await self._client.aio.models.generate_content(
                        model=model,
                        contents=contents,
                        config=config,
                    )
                    content = self._response_text(response)
                    if content:
                        yield {"message": {"content": content}}
            except Exception as exc:
                raise self._request_error(exc) from exc

        return response_stream()

    async def readiness(self) -> bool:
        try:
            response = await asyncio.wait_for(
                self._client.aio.models.get(model=settings.GEMINI_MODEL.strip()),
                timeout=float(settings.GEMINI_HEALTH_TIMEOUT_SECONDS),
            )
            return bool(response)
        except Exception:
            logger.warning("gemini_readiness_failed", exc_info=True)
            return False


class OllamaService:
    """Provider facade retained for compatibility with existing AI modules."""

    CHAT_PROMPT_VERSION = "mai-do-grounded-v3"
    SEO_PROMPT_VERSION = "seo-geo-v2"
    _client: Any = None
    _provider: str | None = None

    @classmethod
    def active_model(cls) -> str:
        return settings.GEMINI_MODEL if settings.AI_PROVIDER == "gemini" else settings.OLLAMA_MODEL

    @classmethod
    def get_client(cls) -> Any:
        provider = settings.AI_PROVIDER
        if cls._client is None or cls._provider != provider:
            cls._provider = provider
            cls._client = (
                GeminiClientAdapter()
                if provider == "gemini"
                else AsyncClient(host=settings.OLLAMA_HOST, timeout=30.0)
            )
        return cls._client

    @staticmethod
    async def readiness() -> bool:
        """Verify the selected provider and configured model are available."""
        if settings.AI_PROVIDER == "gemini":
            try:
                return await OllamaService.get_client().readiness()
            except Exception:
                logger.warning("gemini_readiness_failed", exc_info=True)
                return False
        try:
            async with httpx.AsyncClient(timeout=float(settings.OLLAMA_HEALTH_TIMEOUT_SECONDS)) as client:
                response = await client.get(f"{settings.OLLAMA_HOST.rstrip('/')}/api/tags")
                response.raise_for_status()
            models = response.json().get("models", [])
            configured = settings.OLLAMA_MODEL.strip()
            return any(
                (model.get("name") or model.get("model")) == configured
                for model in models
                if isinstance(model, dict)
            )
        except (httpx.HTTPError, ValueError, TypeError, AttributeError):
            return False

    SYSTEM_PROMPT = """
You are the AI assistant of Maian Homes. Answer only with data supplied by the endpoint.
Do not guess or invent figures, prices, legal status, progress, yields, or commitments.
"""

    @staticmethod
    async def chat_stream(messages: list[dict], temperature: float = 0.7) -> AsyncGenerator[dict, None]:
        """Authenticated stream used by the legacy protected AI endpoint."""
        client = OllamaService.get_client()
        history = messages[-10:]
        full_messages = [{"role": "system", "content": OllamaService.SYSTEM_PROMPT}] + history
        try:
            async for chunk in await client.chat(
                model=OllamaService.active_model(),
                messages=full_messages,
                options={"temperature": temperature},
                stream=True,
            ):
                content = chunk.get("message", {}).get("content", "")
                if content:
                    yield {"content": content}
        except (ResponseError, httpx.RequestError):
            logger.exception("ai_authenticated_stream_failed", extra={"provider": settings.AI_PROVIDER})
            raise
