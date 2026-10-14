import unittest
from unittest.mock import patch

from app.infrastructure.ai_runtime import GeminiClientAdapter, OllamaService


class _Response:
    def __init__(self, text: str):
        self.text = text


class _Models:
    async def generate_content(self, **kwargs):
        self.generate_kwargs = kwargs
        return _Response('{"answer":"ok"}')

    async def generate_content_stream(self, **kwargs):
        self.stream_kwargs = kwargs

        async def chunks():
            yield _Response("hello")
            yield _Response(" world")

        return chunks()


class _Aio:
    def __init__(self):
        self.models = _Models()


class _Client:
    def __init__(self):
        self.aio = _Aio()


class GeminiRuntimeTests(unittest.IsolatedAsyncioTestCase):
    def test_config_and_content_mapping(self):
        self.assertEqual(
            GeminiClientAdapter._config({"temperature": 0.2, "num_predict": 600}, "policy", True),
            {
                "temperature": 0.2,
                "max_output_tokens": 600,
                "system_instruction": "policy",
                "response_mime_type": "application/json",
            },
        )
        with patch(
            "app.infrastructure.ai_runtime.settings.GEMINI_MODEL",
            "gemini-3.5-flash-lite",
        ):
            self.assertEqual(
                GeminiClientAdapter._config({"thinking_level": "LOW"}),
                {},
            )
        with patch(
            "app.infrastructure.ai_runtime.settings.GEMINI_MODEL",
            "gemini-3.5-flash",
        ):
            self.assertEqual(
                GeminiClientAdapter._config({"thinking_level": "LOW"}),
                {
                    "thinking_config": {
                        "thinking_level": "LOW",
                        "include_thoughts": False,
                    }
                },
            )
        contents, system = GeminiClientAdapter._contents([
            {"role": "system", "content": "policy"},
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi"},
        ])
        self.assertEqual(system, "policy")
        self.assertEqual(contents[0]["role"], "user")
        self.assertEqual(contents[1]["role"], "model")

    async def test_generate_and_stream_keep_existing_contract(self):
        adapter = object.__new__(GeminiClientAdapter)
        adapter._client = _Client()
        generated = await adapter.generate(
            model="gemini-3.5-flash-lite",
            prompt="prompt",
            format="json",
            system="policy",
            options={"temperature": 0.2, "num_predict": 100},
        )
        self.assertEqual(generated, {"response": '{"answer":"ok"}'})
        stream = await adapter.chat(
            model="gemini-3.5-flash-lite",
            messages=[{"role": "user", "content": "hello"}],
            options={"temperature": 0.2},
            stream=True,
        )
        chunks = [chunk async for chunk in stream]
        self.assertEqual(chunks, [
            {"message": {"content": "hello"}},
            {"message": {"content": "world"}},
        ])

    def test_active_model_switches_with_provider(self):
        with patch("app.infrastructure.ai_runtime.settings.AI_PROVIDER", "gemini"), \
             patch("app.infrastructure.ai_runtime.settings.GEMINI_MODEL", "gemini-test"):
            self.assertEqual(OllamaService.active_model(), "gemini-test")


if __name__ == "__main__":
    unittest.main()