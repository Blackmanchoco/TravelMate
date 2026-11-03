# Compound trip-length fix: verified locally

18 October 2026, overnight. User-authorized deterministic fix on fix/assistant-compound-request, with no model-authored schedules, dependency/schema/recommender/timeout changes. No merge/push/tag/demo restore. Source verification SHA-256: `BC1EF3E68F58BDB5AC0110892BEC2CF4150FF99A7F9F1594255F8FFC56319772` for backend/src/modules/ai/ai.service.ts.

Hotel/restaurant requests containing a trip-length phrase now retain the exact existing catalogue list and append one fixed limitation. Supports positive integer day/days, one-ten English numbers, Chinese numeral/digit days, NFKC fullwidth digits and bounded day/planning spelling variants. Generic category spelling detection remains the existing implementation. Other categories and explicit schedule recognition retain their prior behavior. The new recognition does not create times, schedules or Add cards for commercial categories.

Decision: **3 nights alone is accommodation stay length, not scheduling**. It remains an ordinary catalogue request. Explicit plan/trip wording still uses the existing scheduling trigger. Opening age (3days ago), weekly opening days, and Chinese month/day dates remain ordinary requests. These controls compare the entire response, not merely the presence of a substring.

## Test-first development and review

- Original failed supplemental run remains intact:33passed/1failed/11unrun. Bare N-days gap, not an original-case regression. Original file SHA-256 `905A3A0B172CA1CD8C787C5136050D2F25671A84411F261E7A5FAF587FA7D81A`.
- Added11positive trip-length/typo tests and12exact unchanged controls first:11failed/50passed on unchanged application. Implemented deterministic matching, then suite passed211/211.
- Independent reviewer identified spaced/Chinese-numeral calendar dates. Added3controls first:3failed/61passed, then removed complete month/day expressions before duration recognition. Re-review approved, no remaining actionable finding. Final suite214/214across27files.
- The first whole-suite harness attempt intercepted an existing negative connection-guard fixture with an extra preload. It rejected before any connection, but changed the expected error. Removed that global test preloader; original test/assertions unchanged, subsequent full suite passed. Live child evaluator still has target guard preload; Python connections have an evaluation-only sitecustomize guard.
- Safe evaluator stop metadata now preserves lowercase caseId, iteration and an explicitly safe reason (e.g. Fixed reply mismatch). Unknown exception text remains withheld. Two tests verify useful case metadata and rejection of arbitrary exception/reason text.

## Separate results, never combined into a misleading score

| Evaluation | Pass/total | Server-rule | Model-authored | Direct-tool |
|---|---:|---:|---:|---:|
| Historical original artifact |183/183|138|18|27|
| Fresh ORIGINAL regression |183/183|138|18|27|
| Four earlier compound cases, fresh regression |12/12|12|0|0|
| Final NEW supplement,26cases x3 |78/78|78|0|0|

Fresh regression used the untouched existing evaluator, which contains original183plus earlier12rows, on an independently created scratch. Report groups are split by the four known compound_ IDs. Regression source hash before/after matched; cases/assertions unchanged. Origin for regression rows is reconstructed from handler paths in the classified derivative; new supplemental raw rows explicitly record origin, basis and actual model-call count. All78supplemental replies made an initial model call whose wording was discarded by the server. These are system acceptance results, not model-only quality scores. Setup direct-tool requests are not counted as evaluated direct-tool rows.

Final supplement: [verified summary](verified-travelmate_scratch_20261017183007486/summary.json), adjacent supplement.jsonl; SHA-256 `CD037FE64C32AA0780B14565640813F3EC87AD74FC9F1064D9F6C4BBB8A33101`.

Fresh regression: [regression summary](legacy-travelmate_scratch_20261017183240697/summary.json), adjacent regression-classified.jsonl. Raw unmodified run is preserved under ignored .local-data/regression-travelmate_scratch_20261017183240697; SHA-256 `130DF49380A11734BB7CC43A87B96AE659C8F66E07FA5EF890D8456F99A37DE3`. Tracked classified copy is parsed-equivalent for all original fields, with added origin metadata, and ASCII escapes for hook compatibility. Historical raw hash before/after every run remains `471913F7ECAC18252B336CD8249AA76E7708B72F9DC43F4E3CC5B7AE6B37F97D`.

Fresh checks: backend214/214, typecheck/build; frontend lint/build passed. Four existing lint warnings and Vite chunk warning remain; no new lint warning after removing unused runner import. Logs are sanitized and non-ASCII text escaped; original evaluation raw is never rewritten. A setup-only legacy attempt failed before running cases, with no known cause established; its scratch was dropped and its failed summary retained. The fresh complete rerun above passed.

## Isolation and cleanup

Source .env was read only to construct the local PostgreSQL URL in process memory. Only its database name was substituted. Explicit DATABASE_URL was set before imports, config/current_database checked, and explicitly passed to each child. All application pool connections checked the unique owned travelmate_scratch timestamp; regression Node child guard and Python psycopg2 guard checked connection targets. Temporary account passwords/tokens/JWT secret remained in memory. Maintenance postgres was used only for owned CREATE/DROP and database-name catalog listings, never main/demo tables.

Final supplemental scratch travelmate_scratch_20261017183007486 and regression scratch travelmate_scratch_20261017183240697 were dropped. All earlier scratch attempts were also dropped or never created. Bounded fixtures closed. Before/after database-name lists matched: postgres,template0,template1,travelmate,travelmate_backup_verify_20261005,travelmate_c4_restore_20261004,travelmate_c4_restore_20261005,travelmate_demo_20261006. No main/demo connection/count/write; name equality is not a row-content inspection claim. Running demo services untouched. Warm-up loaded Ollama; no service restart/unload.

Continue with testing/security audit, then deterministic Explore alias before07:30. B dropped, C manual flow retained. Deployment security still NEEDS FIXES because existing dependency findings remain unresolved. User manually rechecks compound and N-days English/Chinese/typos/3nights controls after mandatory Python/Ollama warm-up and two200recommendation calls. No integration/publication/restore/tag gate is granted by this report.
