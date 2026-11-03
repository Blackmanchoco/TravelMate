# Backend test report — 20 October 2026

This is the initial single-run checkpoint. The authoritative three-run report, per-case results, and coverage boundaries are in [TEST_REPORT.md](TEST_REPORT.md), [results.json](results.json), and [test-cases.csv](test-cases.csv).

## Scope

The backend checks below ran on local master code tip 138e039b1720ce7bf8311f9cb7e8ec7db3dc788e after the Phase 4 local merges. The report is documentation-only. No package install, database connection, migration, seed, or network command was run.

## Results

| Check | Command | Result |
|---|---|---|
| Backend Vitest suite | npm test -- --reporter=dot | PASS: 32 files, 260 tests; 0 failures. |
| TypeScript typecheck | npm run typecheck | PASS, exit 0. |
| Backend compile | npm run build | PASS, exit 0. |
| Recommendation safety tests | Configured project Python interpreter; unittest discover -s ai/recommendation -p test_*.py | PASS: 4 tests. |
| Candidate selector tests | Configured project Python interpreter; unittest discover -s ai/data -p test_*.py | PASS: 6 tests. |

The configured Python interpreter was C:\FYP\travelmate\backend\.venv\Scripts\python.exe. The standard workspace sandbox denied process launch; an approved escalation ran the two local unit suites successfully. An initial attempt with the bundled Python runtime stopped at import because that runtime does not contain joblib; it was not a test failure and did not run the data suite. No packages were installed.

## Not run

- npm run test:db was not run. It is a database integration entry point with an older fixed fixture guard, outside the exact scratch target and baseline requirements for this queue.
- The three post-merge AI evaluations (original 183, compound 12, supplement 78) and final browser smoke are BLOCKED under Phase 4. The integration runner unconditionally drops its generated scratch database in finally. It was not invoked because the standing instruction requires every scratch database and artifact to be retained.
- No database write was attempted. The existing browser-test scratch database is not a pristine v6 baseline.
- No coverage percentage is claimed. No security clearance or deployment readiness is implied by unit, typecheck, or build results.

## Reproduction

From C:\FYP\travelmate-master\backend:

- npm test -- --reporter=dot
- npm run typecheck
- npm run build
- C:\FYP\travelmate\backend\.venv\Scripts\python.exe -m unittest discover -s ai/recommendation -p test_*.py
- C:\FYP\travelmate\backend\.venv\Scripts\python.exe -m unittest discover -s ai/data -p test_*.py
