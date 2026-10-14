# Staging load profiles

These profiles are read-only evidence gates. Run them only against disposable
local data or an explicitly confirmed staging target.

## Website capacity profile

`mixed_1000_k6.js` exercises public Next.js HTML routes and, when an admin
cookie is provided, a small authenticated activity read. It ramps through
25/50/125/250/500/750/1000 VU and rejects production hosts. Above 125 VU the
exact staging host and ceiling are required in `CONFIRM_HIGH_LOAD`.

```powershell
k6 run `
  -e BASE_URL=https://staging.example.com `
  -e LOAD_TEST_TARGET=staging `
  -e EXPECTED_TARGET_HOST=staging.example.com `
  -e CONFIRM_STAGING_TARGET=staging:staging.example.com `
  -e EXPECTED_RELEASE=<immutable-release> `
  -e EXPECTED_IMAGE_REVISION=<immutable-git-sha> `
  -e EXPECTED_LOAD_TEST_MARKER=<staging-only-marker> `
  -e EXPECTED_DEPLOYMENT_TIER=staging `
  -e MAX_VUS=125 `
  backend/tests/load/mixed_1000_k6.js
```

## Activity API profile

`activity_k6.js` validates the protected audit-event list with a supplied
`AUTH_COOKIE`. Its default module is `SYSTEM`; it does not exercise retired
HR, IT or Sales endpoints.

## WebSocket profile

`websocket_1000_k6.js` ramps notification WebSockets through the same staged
ceilings. Each VU must use a unique ignored `*.sessions.json` cookie pool.

All profiles share `target_guard.js`, which verifies release identity,
staging hostname, deployment tier and readiness before and during the run.
Never spoof `X-Forwarded-For` or run these profiles against production.