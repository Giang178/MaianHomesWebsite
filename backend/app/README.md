# Backend application structure

## Stable entry point

`main.py` owns FastAPI setup, middleware, lifecycle, health endpoints and
 top-level router registration. Deployment uses `app.main:app`.

## Directory responsibilities

| Directory | Responsibility |
| --- | --- |
| `api/` | Shared HTTP and WebSocket transport |
| `core/` | Configuration, security, logging and runtime controls |
| `db/` | MongoDB connection lifecycle only |
| `infrastructure/` | External providers and technical adapters |
| `modules/` | Website domain capabilities |
| `models/` | Shared persistence models |
| `services/` | Shared persistence base; no business features |

## Rules

1. New business code belongs in `modules/<domain>/<capability>`.
2. Keep API, schemas, repository and service together in the owning domain.
3. `main.py` and routers compose modules; they do not implement business rules.
4. Do not add generic catch-all utilities or services.
5. Internal renames must preserve public URLs, database collection names,
   environment variables and deployment entry points unless a migration exists.
6. Do not recreate attendance, shift or internal Sales CRM modules.

## Target tree

```text
app/
├── main.py
├── api/
├── core/
├── db/
├── infrastructure/
├── modules/
│   ├── activity/
│   ├── content/
│   ├── identity/
│   ├── notifications/
│   ├── system/
│   └── website/
├── models/
└── services/
```