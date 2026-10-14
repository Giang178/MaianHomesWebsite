# Infrastructure adapters

This package contains technical adapters for systems outside the application.
It must not contain business rules, HTTP routes, or role checks.

| File | Responsibility |
| --- | --- |
| `object_storage.py` | Local-file and S3-compatible object storage I/O |
| `email_delivery.py` | SMTP delivery adapter |
| `ai_runtime.py` | Ollama client lifecycle and readiness probe |

Naming rule: use the external capability in the filename. Avoid generic names
such as `service.py`, `helper.py`, or `utils.py` at this level.
