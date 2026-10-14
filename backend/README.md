# Backend handoff guide

## Structure

The backend is organized by website domain under `app/modules`:

```text
app/
├── api/             # shared HTTP and WebSocket adapters
├── core/            # configuration, security and runtime primitives
├── db/              # MongoDB lifecycle and connection helpers
├── infrastructure/  # email, storage and AI adapters
├── models/          # shared persistence models
├── modules/
│   ├── website/     # CMS, pages, branding, team, inquiries and workspaces
│   ├── content/     # projects, articles, media, SEO and company knowledge
│   ├── identity/    # accounts, sessions, invitations and permissions
│   ├── activity/    # audit/activity events and outbox
│   ├── notifications/
│   └── system/      # settings, monitoring, idempotency and technical workers
└── services/        # shared persistence base only
```

## Request flow

```text
router/API adapter -> service/use case -> repository -> MongoDB
```

Endpoints validate input and map responses. Business rules belong in domain
services; database access belongs in the owning domain; external integrations
belong in `app/infrastructure`.

## Current domain ownership

- `website`: public website, CMS, team, recruitment, inquiries, consignment and workspace flows.
- `content`: projects, articles, media, SEO and assistant/company knowledge.
- `identity`: authentication, accounts, sessions, invitations and permissions.
- `activity`: audit events and outbox delivery.
- `notifications`: notification persistence and delivery contracts.
- `system`: runtime settings, monitoring, idempotency and system worker.

Attendance, shifts, timekeeping reports and internal Sales CRM are retired and
must not be reintroduced through a route, model, worker, menu or permission.

## Validation before handoff

From `backend`:

```powershell
pytest -q
ruff check app tests
```

Before deployment, also run frontend typecheck/lint/tests/build, Playwright,
Docker build and the staging healthcheck from the repository root.