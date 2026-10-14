import ast
import unittest
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException
from PIL import Image

from app.modules.content.media.policies import validate_image
from app.modules.content.media.service import MarketingMediaService, _render_variants


class TestMarketingArchitectureAndMedia(unittest.TestCase):
    def test_api_routes_do_not_reach_repositories(self):
        root = Path(__file__).parents[1] / "app" / "modules" / "content"
        for relative in (
            "projects/api.py",
            "projects/public_api.py",
            "articles/api.py",
            "articles/public_api.py",
        ):
            tree = ast.parse((root / relative).read_text(encoding="utf-8"))
            repository_attributes = [
                node
                for node in ast.walk(tree)
                if isinstance(node, ast.Attribute) and node.attr == "repository"
            ]
            self.assertEqual([], repository_attributes, relative)

    def test_services_do_not_access_repository_database_property(self):
        root = Path(__file__).parents[1] / "app" / "modules" / "content"
        for relative in (
            "projects/service.py",
            "articles/service.py",
            "articles/public_service.py",
        ):
            source = (root / relative).read_text(encoding="utf-8")
            self.assertNotIn(".repository.db", source, relative)

    def test_valid_image_is_decoded_and_responsive_variants_are_generated(self):
        source = BytesIO()
        Image.new("RGB", (640, 360), color=(25, 80, 120)).save(
            source,
            format="PNG",
        )
        source.seek(0)

        self.assertEqual((640, 360), validate_image(source, "image/png"))
        variants = _render_variants(source.getvalue())
        self.assertEqual(
            {
                "thumbnail_webp",
                "thumbnail_avif",
                "medium_webp",
                "medium_avif",
                "large_webp",
                "large_avif",
                "og_webp",
                "og_avif",
            },
            set(variants),
        )
        self.assertLessEqual(variants["thumbnail_webp"]["width"], 480)

    def test_invalid_image_bytes_are_rejected(self):
        with self.assertRaises(HTTPException):
            validate_image(BytesIO(b"\x89PNG\r\n\x1a\nnot-an-image"), "image/png")

    def test_project_media_ids_are_collected_recursively(self):
        first = "a" * 32
        second = "b" * 32
        payload = {
            "hero_images": [f"/api/protected/marketing-media/{first}"],
            "story_blocks": [
                {"image_url": f"/marketing-media/{second}?variant=large"}
            ],
        }
        self.assertEqual(
            {first, second},
            MarketingMediaService.project_media_ids(payload),
        )

    def test_store_handles_s3_stream_consumption(self):
        import asyncio
        from unittest.mock import MagicMock, patch
        from fastapi import UploadFile
        from app.core.config import settings
        from app.modules.content.media.service import marketing_media_service

        async def run():
            img = Image.new("RGBA", (500, 500), (255, 100, 50, 200))
            buf = BytesIO()
            img.save(buf, format="PNG")
            buf.seek(0)
            upload = UploadFile(filename="logo.png", file=buf, headers={"content-type": "image/png"})

            async def mock_put_fileobj(key, stream, content_type):
                stream.read()
                stream.close()

            with patch.object(settings, "S3_ENABLED", True), \
                 patch("app.modules.content.media.service.storage_service.put_fileobj", side_effect=mock_put_fileobj), \
                 patch("app.modules.content.media.service.get_database") as mock_db:
                mock_collection = MagicMock()
                mock_collection.insert_one = MagicMock(return_value=asyncio.Future())
                mock_collection.insert_one.return_value.set_result(True)
                mock_db.return_value = {"marketing_media": mock_collection, "media_assets": mock_collection}

                result = await marketing_media_service.store("projects", upload, "test-actor", 50 * 1024 * 1024)
                self.assertTrue(result["id"])

        asyncio.run(run())

