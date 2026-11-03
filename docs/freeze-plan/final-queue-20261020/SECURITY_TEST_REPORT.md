# Security test report — 20 October 2026

## Disposition

**NEEDS FIXES.** The HTTP harness executed 88 checks: 83 passed and 5 failed. The CSV also lists four planned checks that were explicitly skipped for safety or scope limits, for 92 rows total. The failures are listed below and in [security-results.csv](security-results.csv). No Critical or High issue was found in the reviewed changed application surface. The five Medium/Low findings were documented without code changes under the instruction to fix only high-impact findings. No `fix/security-20261020` branch was created.

These are automated checks against this project's code and a local scratch database. They are evidence, not proof of security or deployment readiness.

## Scope and database safeguards

- Application code tip: `138e039b1720ce7bf8311f9cb7e8ec7db3dc788e`; current task branch was `master`. Later files in this queue are documentation and evidence only.
- The v6 dump was independently rechecked immediately before scratch setup. SHA-256 and sidecar: `D84F90858E142741F0DC5B5F68D77BEDD16D4971F658778E5365F0DCD4826D34`; `pg_restore --list` passed.
- Scratch database: `travelmate_scratch_security_20261020`. The restore script enforced that exact name, refused an existing database, verified the source host was loopback, replaced `DATABASE_URL` with the exact scratch URL, and checked `current_database()` before restoring.
- Restored baseline, checked before any HTTP test writes: `2|1|6|56|0|1|3|0`.
- The only persistent test writes were three synthetic accounts, one itinerary, and one itinerary item, all in this scratch database. Final counts: `5|1|6|56|0|2|4|0`. The test profile name was reset to plain text. The scratch database was retained; no database or file was deleted.
- No request, connection, restore, or write targeted the demo or main database. Credentials and signed tokens stayed in process memory and were not written to the report.

## Confirmed findings

| ID | Severity | Evidence | Status |
|---|---|---|---|
| SEC-01 | Medium | A synthetic 73-byte password was accepted at registration. Logging in with a different suffix after byte 72 returned 200. `validatePassword` checks JavaScript character count while bcrypt uses a 72-byte input boundary (`backend/src/modules/auth/auth-credentials.ts:22-33`). | Confirmed; compatibility-sensitive correction remains open. |
| SEC-02 | Medium | Five sequential invalid login attempts returned `401,401,401,401,401`; no `429` was returned. This was a small probe, not a load test. Source has no application-level login or expensive-request rate/concurrency limiter. | Confirmed gap; no rate limiting was added. |
| SEC-03 | Medium | Local HTTP health response had no CSP and exposed `X-Powered-By`. HSTS was treated as not applicable on this HTTP-only local listener. `backend/src/app.ts:18-36` configures CORS/body parsing and routes but no security-header middleware. | Confirmed gap; no headers were added. |
| SEC-04 | Low | A place search containing an encoded NUL returned generic HTTP 500. The development error handler logged the exception stack; the HTTP body did not expose the stack. The path is `places.controllers.ts:203-221` into Prisma search, and `middleware/error-handler.ts:21-30`. | Confirmed malformed-input/error-handling issue; no fix made. |
| SEC-05 | Low | A JSON request just over the configured 1 MiB limit returned generic HTTP 500 and logged a development exception instead of returning a client-size status. The body parser is at `backend/src/app.ts:21`; unknown errors are mapped to 500 and logged in development by `backend/src/middleware/error-handler.ts:21-30`. | Confirmed error-mapping issue; no fix made. |

The server error responses for SEC-04 and SEC-05 were generic and contained no stack path. The development console still receives raw unknown exception objects, which remains a separate privacy/logging limitation.

## Static review

- **SQL:** Application reads use Prisma filters and parameterized access. The direct PostgreSQL statements in the admin creation utility use `$1` parameters (`backend/src/cli/create-admin.ts:134-143`); the Python recommender's cursor call at `backend/ai/recommendation/recommender.py:133` also supplies parameters. The seven SQL-injection-shaped requests across places, destinations, admin lists, and login returned expected statuses; the time probe returned in 2 ms. No unsafe request-built SQL was found in backend application source.
- **Command execution and recommender:** The API invokes a fixed runner path with `spawn`, a separate argument list, and `shell: false` (`backend/src/modules/recommendations/recommendations.service.ts:19-32,124-141`). Inputs are JSON on stdin; time/output handling is bounded in the rest of that service. The Python side loads a fixed local `joblib` artifact after an existence check (`backend/ai/recommendation/recommender.py:446-451`). There is no runtime integrity check; safety depends on trusted local file provenance and permissions.
- **Path traversal:** No user-provided path reaches a file-read or file-serving operation in the reviewed request paths. Traversal text sent to a place identifier route returned 400/404. Filesystem APIs used by the recommender resolve fixed application paths.
- **XSS, assistant, maps, and print:** The inspected views render profile, itinerary, place, and report values as React text children. Chat uses `ReactMarkdown` without a raw-HTML plugin (`src/components/ai/ChatMarkdown.tsx:8-55`); map popups use JSX text (`src/components/places/NearbyPlacesMap.tsx:116-145`, `src/components/itinerary/InternalMap.tsx:156-164`); print views also use JSX text (`src/pages/print/PrintItinerary.tsx:30-38,89-107`, `src/pages/print/PrintAdminReport.tsx:23-35`). No `dangerouslySetInnerHTML` or `innerHTML` sink was found. A script-shaped profile name and itinerary note were accepted as text in the scratch API; a full browser execution test was not run.
- **Route authorization and ownership:** Protected user, saved-place, itinerary, recommendation, and AI routers apply `requireAuth`. Admin routes apply both `requireAuth` and `requireAdmin` (`backend/src/modules/admin/admin.routes.ts:9-10`). Admin middleware verifies the current database role (`backend/src/middleware/auth.ts:43-113`). User profile updates allow only `name` and `avatar` (`backend/src/modules/users/users.controller.ts:49-76`); itinerary ownership is derived from the authenticated caller and services scope reads/writes by owner (`backend/src/modules/itineraries/itineraries.service.ts:19-52`).
- **JWT and authorization tests:** Tampered, expired, malformed, and `none`-algorithm tokens returned 401. A regular user's token returned 403 for admin access, including a signed token with a forged admin role claim. The database-backed admin token returned 200. A second user could not read/update a test itinerary or add an item to it (404).
- **Mass assignment:** A profile `role=admin` patch returned 400. An injected `userId` on itinerary creation did not change the owner; patching `userId` returned 400. The empty-array profile body was a no-op, recorded as such in the CSV.
- **Error and secret handling:** Generic error JSON did not include stack details. Development logs captured exceptions for the NUL and oversized-body cases. No credentials, bearer tokens, full email addresses, or secret environment values were saved or printed by the harness.

## Known open items, unchanged

- The fresh 20 October npm registry audit confirms the historical package counts remain unresolved: frontend 1 High; backend 1 Critical, 5 High, and 3 Moderate. Current locked versions remain inside the affected ranges. See [DEPENDENCY_ADVISORY_REFRESH.md](DEPENDENCY_ADVISORY_REFRESH.md) for exact versions, advisory IDs, and preserved audit output.
- There is no application-level rate limiting for login or expensive AI/recommendation requests.
- Security headers are not configured.
- Password validation allows 8–128 JavaScript characters while bcrypt processes at most 72 UTF-8 bytes; the suffix-collision case was reproduced.
- JWTs are stored in browser `localStorage`; individual server-side token revocation is unavailable.
- The recommendation model is a trusted-local pickle/joblib artifact without runtime integrity verification. This is a local artifact supply-chain risk, not an exposed upload route.
- Unknown errors are logged as full objects in development.

## Test limits

- The matrix includes validation for every route family and the relevant input shapes listed in the CSV, but it does not exercise a valid archive, restore, or delete operation. Invalid identifiers were used for those routes to honor the no-delete rule.
- The XSS checks did not execute a full browser rendering of the stored payloads. The source review found React text rendering and no raw HTML sink.
- Login probing used five sequential invalid requests only; there was no load or denial-of-service test.
- One adversarial AI prompt was sent because the configured local model health check passed. The model response was not retained; only the HTTP status and allowed tool names were recorded. This does not prove resistance to prompt injection or factual disclosure.
- Four planned checks are marked `SKIPPED` in the CSV: valid destructive mutations, browser execution of stored-script payloads, login load testing, and scoring the assistant response for secret disclosure.
- No dependency advisory lookup, full-history secret scan, production TLS test, or deployment test was performed as part of the Phase 7 HTTP suite. The separate Phase 5 registry refresh is documented in [DEPENDENCY_ADVISORY_REFRESH.md](DEPENDENCY_ADVISORY_REFRESH.md).

## Artifacts

- [security-results.csv](security-results.csv) — all 88 checks, status, severity, and concise evidence.
- [PRE_PUSH_SCAN_2.md](PRE_PUSH_SCAN_2.md) — incremental secret/artifact/dependency scan and FIX FIRST verdict.
- [TEST_REPORT.md](TEST_REPORT.md) — three-run backend suite results and test coverage boundaries.

## Addendum 2026-10-23: final tip c4493b2

The baseline 88-check security matrix was run at `138e039b1720ce7bf8311f9cb7e8ec7db3dc788e`: 83 passed, 5 failed, and 4 were skipped. The five hardening fixes in `fdeca55` were targeted-retested with 5 passes and 0 failures, as recorded in [SECURITY_HARDENING.md](../security-hardening-20261021/SECURITY_HARDENING.md). The full matrix was not rerun at `c4493b2`.

The four skipped checks and reasons were:

- `valid_destructive_mutations`: no valid archive, restore, or delete requests were sent under the no-delete rule; only invalid IDs and authorization guards were exercised.
- `stored_script_browser_execution`: stored-payload API checks and JSX source review were completed, but a full browser rendering/execution check was not run.
- `login_rate_load_test`: the baseline used five sequential invalid login attempts; no sustained load or denial-of-service test was run. The later bounded burst does not establish sustained-load behavior.
- `ai_prompt_disclosure_scoring`: one adversarial request was made and allowed tool names were checked, but the response was not retained or scored for secret disclosure.

Registration now has an in-memory throttle of 100 requests per IP per 10-minute window. Public by-ID place detail can still return active `Test`-category fixture records; this remains a known Low-severity catalogue visibility issue.
