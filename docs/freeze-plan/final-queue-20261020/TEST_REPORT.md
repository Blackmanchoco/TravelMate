# Backend test report — 20 October 2026

## Scope

The full backend Vitest suite was run three consecutive times on the merged application code tip `138e039b1720ce7bf8311f9cb7e8ec7db3dc788e`. The later master changes in this queue are documentation and evidence only. Node was `v24.14.1`; the local PostgreSQL server and `pg_restore` client were `18.6` (the unit suite itself did not connect to a database).

## Results

| Run | Command | Files | Tests | Passed | Failed | Pending/skipped |
|---:|---|---:|---:|---:|---:|---:|
| 1 | `npm test -- --reporter=json --outputFile=.../backend-test-run-1.json` | 32 | 260 | 260 | 0 | 0 |
| 2 | `npm test -- --reporter=json --outputFile=.../backend-test-run-2.json` | 32 | 260 | 260 | 0 | 0 |
| 3 | `npm test -- --reporter=json --outputFile=.../backend-test-run-3.json` | 32 | 260 | 260 | 0 | 0 |

The 260 unique test cases were executed 780 times. Status was stable across all runs: 0 flaky cases and 0 skipped/pending cases. Per-case suite, name, status, and duration are in [test-cases.csv](test-cases.csv); aggregate run and case data are in [results.json](results.json). The three raw Vitest JSON reports are retained alongside them.

## Coverage by area

| Area | Unique cases | Coverage boundary |
|---|---:|---|
| Assistant tools and guards | 156 | Category intent, search, schedule, context budget, fallback, tool guards, and failure logs. Model truthfulness and adversarial robustness are not established by unit tests. |
| Places, destinations, and search | 42 | Catalogue visibility, search aliases, counts, and candidate/import guards. Full route/database behavior is not established by this suite. |
| Itineraries | 35 | Schedule, dates, item position, budget alert, preference match, and related service behavior. Not a full authenticated route matrix. |
| Admin/archive/audit | 14 | Archive protection, place validation/vocabulary, and report summary. Not a full admin write/read API integration suite. |
| Report/print | 3 | Print model and report summary behavior. Browser print/PDF output requires manual verification. |
| Auth/RBAC | 4 | Admin credential preparation and related focused validation. Registration/login/JWT behavior has separate static and Phase 7 HTTP evidence, not broad unit coverage. |
| Database guards | 2 | Exact-name/isolation guard logic. The database integration suite was not run. |
| Recommendations | 2 | Runner failure/spawn logging. Model quality and a full recommendation API/database run are not covered here. |
| Evaluation stop guard | 2 | Evaluation harness stop behavior. These are not AI acceptance cases. |
| Saved places | 0 | No dedicated saved-place unit tests in this Vitest run. Phase 7 covered safe read/validation/authorization requests only. |
| Cross-cutting validation | — | Validation is embedded in feature suites; there is no standalone exhaustive validator suite. |

### Not covered by the Vitest run

- `npm run test:db` and the database integration files under `backend/test/db`.
- Full post-merge AI evaluator reruns and final browser smoke are BLOCKED under Phase 4. The available integration runner drops its generated scratch database in `finally`; it was not invoked under the standing keep-all-scratch-artifacts rule.
- Saved-place persistence boundaries, every authenticated API route combination, concurrent updates, production TLS/header behavior, and manual print/PDF rendering.
- No coverage percentage is claimed.

## AI system-level acceptance results

These are historical evaluation artifacts from earlier phases, reported separately; they were not rerun after the local Phase 4 merge because the current integration runner owns and drops its generated scratch database. The post-merge reruns are BLOCKED, not passed.

| Evaluation | Historical result | Origin split | Evidence / limit |
|---|---:|---|---|
| Original evaluation | 183/183 | 138 server-rule, 18 model-authored, 27 direct-tool | System-level acceptance, not 183 independent prompts. |
| Earlier compound cases | 12/12 | Server-rule | Four compound cases repeated three times; historical combined evidence is in the compound evaluation reports. |
| Separate supplement | 78/78 | 78 server-rule, 0 model-authored, 0 direct-tool | The report records an initial model call for each response; fixed server rules supplied the evaluated answers. |

The evaluator judges use keywords/regular expressions and some predicates are permissive. A pass is not proof of factual correctness or adversarial robustness. The post-merge runs are BLOCKED and are recorded as such in [STATE.md](STATE.md).

## Other verified checks on the same application tip

- Backend `npm run typecheck`: passed.
- Backend `npm run build`: passed.
- Frontend lint, typecheck, and build: passed in Phase 4; four existing lint warnings and the existing large-chunk warning remain.
- Python recommendation tests: 4/4; candidate selector tests: 6/6, using the configured project interpreter. No packages were installed.
- Photo tests: 8/8; admin shell SSR: 1/1. Browser shell evidence from Phase 3: 21/21.

## Protection and state record

| Item | Test-run state |
|---|---|
| Local refs | Master was `2ec087ce3fbc9e8f66bf0151043d63fe96699026` before the three suite runs and remained unchanged by those runs. It was 106 commits ahead of `origin/master`. |
| Push/tag | No push or tag was performed; `freeze-2026-10-20` was absent at the checkpoint. |
| Backups | The v6 hash was rechecked before the later Phase 7 scratch restore; the Phase 2 report records unchanged v6 folder hashes. The Phase 6 suite did not write backup files. |
| Demo ports | No listener was observed on 5174 or 5055 after the test work. |
| Databases | The three Vitest runs made no database connection or write. No demo/main database was touched. Phase 7 used a separate retained scratch DB; see [SECURITY_TEST_REPORT.md](SECURITY_TEST_REPORT.md). |

## Reproduction

From `C:\FYP\travelmate-master\backend`, run the three commands above with distinct output filenames. Additional checks previously run on code tip `138e039...`: `npm run typecheck`, `npm run build`, the configured Python unittest suites, `node --test --test-concurrency=1 scripts/photos/*.test.mjs`, and `node scripts/admin/admin-shell.test.mjs`.

## Addendum 2026-10-23: final tip c4493b2

Verified at `c4493b2730e3a45f30097ad3f70d6a49b8c655ef` (`master`). The complete backend Vitest suite was run with a process-memory `DATABASE_URL` override to the exact loopback scratch database `travelmate_scratch_security_20261020`; a read-only `current_database()` check verified the target first. Credentials and URLs were not emitted.

| Check | Result | Duration |
|---|---|---:|
| Backend Vitest (`npm test -- --maxWorkers=1`) | 34 files; 268 passed, 0 failed, 0 skipped | 8.16 s Vitest; 9.437 s measured |
| Backend typecheck (`npm run typecheck`) | Passed; 0 diagnostics | 2.080 s |
| Backend build (`npm run build`) | Passed | 2.203 s |
| Frontend typecheck (`tsc -b`) | Passed; 2 referenced projects, 0 diagnostics | 2.904 s |
| Frontend lint (`npm run lint`) | Exit 0; 0 errors, 5 warnings | 0.969 s |
| Frontend build (`npm run build`) | Passed; 2,567 modules transformed | 4.90 s Vite; 9.220 s measured |

The initial default-parallel `npm test` attempt timed out in `test/security-hardening.test.ts` after its 10-second `beforeAll` limit: 33 files passed and 265 tests passed, with 3 tests skipped after the hook failure (11.74 s Vitest; 35.089 s measured). The complete serial rerun passed all 268 tests. The first frontend TypeScript runs returned `EPERM` writing build metadata through the `node_modules` junction into `C:\FYP\travelmate\node_modules`; typecheck and package build passed with only the two build-info destinations temporarily redirected to OS temp, and the original TypeScript config bytes were restored. Vite reported the existing main chunk at 559.71 kB, above its 500 kB warning threshold.

The four known lint warnings were `src/context/ItineraryContext.tsx:377:17` (`react(only-export-components)`), `backend/scripts/warm-ai.mjs:51:23` (`eslint(no-unsafe-finally)`), `src/context/SavedPlacesContext.tsx:221:17` (`react(only-export-components)`), and `backend/src/modules/itineraries/itineraries.service.ts:37:70` (`eslint(no-unsafe-optional-chaining)`). The run also reported `scripts/demo/serve-scratch-built.mjs:36:54` (`eslint(no-useless-escape)`) from the pre-existing untracked worktree file; it was left untouched.

The separate `npm run test:db` integration runner was not invoked because `backend/test/db/entry.ts` only allows the exact database name `travelmate_c4_restore_20261005`, which is outside the scratch-only constraint. No restore or database test writes were performed. Diff verification from `2a296d1` to `c4493b2` found no modified files under `backend/ai` or assistant-related paths; the changed-file list is empty. The three AI evaluations (183/183, 12/12, and 78/78) were run at `2a296d1`; `backend/ai` is unchanged since that commit, so they were not rerun.
