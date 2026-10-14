# Backend domain modules

Each directory is a maintained business boundary. Keep routes, schemas,
policies, repositories and services inside their owning domain.

| Module | Responsibility |
| --- | --- |
| `website` | CMS, pages, branding, public team, recruitment, inquiries, consignment and workspace |
| `content` | Projects, articles, media, SEO and company knowledge |
| `identity` | Accounts, authentication, sessions, invitations and permissions |
| `activity` | Audit events and outbox |
| `notifications` | Notification persistence and delivery contracts |
| `system` | Runtime settings, monitoring, idempotency and technical worker |

`app/api` contains shared transport adapters only. `app/services` contains the
shared persistence base only. Business rules must be implemented in a domain
service and all mutations must be exposed through backend APIs.

Attendance, shifts, internal Sales CRM and their workers, routes, models,
notifications and tests are retired and must not be added back.