# Identity configuration

Account policy, account email templates and security settings are managed from
the website administration system page. CEO and ADMIN changes are published
directly through the backend API; no approval step is required.

## Ownership

- `app.modules.identity`: authentication, accounts, sessions, invitations,
  password policy and email-template contracts.
- `app.modules.system`: system settings, SMTP resolution, idempotency and
  monitoring.
- `app.modules.activity`: audit events for configuration and account changes.
- `app.infrastructure.email_delivery`: SMTP transport only; it owns no business
  template or approval workflow.

Environment credentials remain a fallback for technical operation. Sensitive
settings are encrypted at rest and are never returned as ciphertext or secrets
by the API.

For SMTP submission on port `587`, set `SMTP_START_TLS=true`. The API rejects
port `587` with STARTTLS disabled. A database-backed company email setting takes
priority over the environment fallback and must be verified with the test-email
action before credential delivery and password-reset readiness can pass.

## Deployment

Run the website bootstrap and index verification before staging validation:

```powershell
python -m scripts.database_bootstrap
python -m scripts.verify_website_bootstrap
```

After the API is live but before opening traffic, sign in as CEO/ADMIN, save the
company email configuration, send a test email from the system settings page,
and confirm `/health/ready` reports `smtp: ok`.

The deployment worker entry point is
`app.modules.system.jobs.system_monitor`. Public URLs, collection names and
runtime environment variable names are preserved unless a migration is part of
the release.
