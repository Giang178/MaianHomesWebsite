import unittest

from starlette.requests import Request

from app.core.request_security import (
    metrics_access_allowed,
    mutation_origin_is_allowed,
)


def make_request(
    path: str,
    *,
    method: str = "GET",
    client: str = "127.0.0.1",
    headers: dict[str, str] | None = None,
) -> Request:
    encoded_headers = [
        (key.casefold().encode(), value.encode())
        for key, value in (headers or {}).items()
    ]
    return Request(
        {
            "type": "http",
            "method": method,
            "path": path,
            "headers": encoded_headers,
            "query_string": b"",
            "client": (client, 1234),
            "server": ("testserver", 80),
            "scheme": "http",
        }
    )


class MutationOriginTests(unittest.TestCase):
    allowed_origins = ["https://maianhomes.vn", "https://admin.maianhomes.vn"]

    def test_cookie_authenticated_mutation_requires_an_allowed_origin(self):
        request = make_request(
            "/api/protected/articles/article-1",
            method="PUT",
            headers={"cookie": "access_token=session"},
        )
        self.assertFalse(
            mutation_origin_is_allowed(
                request, self.allowed_origins, enforcement_enabled=True
            )
        )

    def test_allowed_origin_preserves_existing_authenticated_flow(self):
        request = make_request(
            "/api/protected/articles/article-1",
            method="PUT",
            headers={
                "cookie": "access_token=session",
                "origin": "https://admin.maianhomes.vn",
            },
        )
        self.assertTrue(
            mutation_origin_is_allowed(
                request, self.allowed_origins, enforcement_enabled=True
            )
        )

    def test_public_unauthenticated_form_is_not_changed(self):
        request = make_request("/api/public/leads", method="POST")
        self.assertTrue(
            mutation_origin_is_allowed(
                request, self.allowed_origins, enforcement_enabled=True
            )
        )


class MetricsAccessTests(unittest.TestCase):
    def test_internal_network_is_allowed_without_a_token(self):
        request = make_request("/metrics", client="172.20.0.15")
        self.assertTrue(metrics_access_allowed(request, "172.16.0.0/12"))

    def test_external_network_is_denied_without_a_token(self):
        request = make_request("/metrics", client="203.0.113.10")
        self.assertFalse(metrics_access_allowed(request, "172.16.0.0/12"))

    def test_external_monitor_can_use_the_configured_bearer_token(self):
        request = make_request(
            "/metrics",
            client="203.0.113.10",
            headers={"authorization": "Bearer monitoring-secret"},
        )
        self.assertTrue(
            metrics_access_allowed(
                request, "172.16.0.0/12", "monitoring-secret"
            )
        )


if __name__ == "__main__":
    unittest.main()
