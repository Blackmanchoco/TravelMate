# Incremental pre-push scan — 20 October 2026

## Verdict

FIX FIRST. The repository is not cleared for push by this scan. The initial scan recorded historical dependency advisories without a current registry lookup. A fresh npm registry audit was completed on 20 October 2026 against both committed lockfiles; it confirms the same affected package counts and that the historical Critical/High versions remain locked. Exact versions, advisory IDs, raw output, and lockfile hashes are in DEPENDENCY_ADVISORY_REFRESH.md. Under the queue rule that unresolved Critical or High findings cannot be marked READY, this scan cannot return SAFE TO PUSH.

Do not push master until the dependency findings have been resolved or formally triaged under an updated Phase 5 review, and the required checks return SAFE TO PUSH. The current audit reports root/frontend 1 High and backend 1 Critical, 5 High, and 3 Moderate affected package entries. No push or tag was performed.

## Commit ranges and repository state

- Scan baseline: 2a296d143ad3817b2e76e58b51d687469e8b3c48.
- Incremental work after the baseline: 12 commits, 68 changed paths.
- Full local push range: origin/master 039b6dcf25675c7163c639af96ae9e156ed3fb53 to master 138e039b1720ce7bf8311f9cb7e8ec7db3dc788e; 105 commits, 807 changed paths.
- Current master is 105 commits ahead of origin/master. No Git remote mutation occurred.
- The pre-existing working-tree edit to docs/freeze-plan/STATE.md and untracked docs/freeze-plan/final-integration-20261019/PRE_PUSH_SCAN.md remain preserved and untouched.

The 68 incremental paths classify as 34 place photos, 7 admin-shell screenshots, 4 frontend source files, 6 credits-related files, 8 freeze-plan reports/evidence files, 5 scripts/tests, and 4 other documentation/configuration files.

## Secret and personal-data checks

- Scanned non-merge commit patches after the baseline for private-key headers, AWS/GitHub token shapes, bearer tokens, credential-bearing PostgreSQL URLs, and password/secret/API-key assignments: 0 matches.
- One email-shaped string was added in admin browser evidence and uses the synthetic example.test domain. No other-domain email additions were found.
- Read-only scan of C:\FYP\photo-inbox\credits.csv found 35 rows, no email matches, and no phone-like matches in non-URL, non-date, non-ID fields.
- The Phase 2 credit reconciliation remains the evidence for all 47 visible credits: every in-use image has a visible credit and every visible credit has an in-use image. Place 13 is visible credit item 27; place 99 is item 42.
- The 34 added JPEG place photos contain 0 APP1 (EXIF/XMP) segments, 0 APP13 (IPTC) segments, and 0 malformed JPEGs. The seven new PNG screenshots were visually reviewed in the Phase 3 report; generated account values are redacted or synthetic.
- The venue-level contact recorded in ranked-candidates.json is pre-existing historical candidate evidence and is documented in PREPUSH_DECISIONS.md. It was not changed by this incremental range.

## Artifact and commit hygiene

- Changed tracked files larger than 5 MiB: 0.
- Changed tracked dump/backup/model artifacts: 0.
- Tracked dump files: 0.
- Dependency lockfiles and dependency version blocks are unchanged. backend/package.json adds only the warm-ai script; it does not add or change a dependency.
- Commit hygiene after the scan baseline: one author identity, 0 non-ASCII subjects, 0 attribution trailers.
- git diff --stat 2a296d143ad3817b2e76e58b51d687469e8b3c48 HEAD -- backend/src is empty (0 changed paths).
- Existing tracked recommendation model artifacts remain in the baseline and are documented in PREPUSH_DECISIONS.md; no model artifact was added in this range.

## Historical findings and limits

The 18 October security reports and 19 October differential review remain the sources for authentication, rate-limit, logging, model-artifact, and test-coverage limitations. AUDIT.md reports that the earlier local offline npm audit returned zero from cache; it was not a current registry check. The 20 October live npm audit is recorded in DEPENDENCY_ADVISORY_REFRESH.md. The current incremental range and the subsequent audit changed no dependency versions or lockfiles. No dependency advisory is declared fixed or cleared.

The existing generic venue contact is classified in PREPUSH_DECISIONS.md as a public venue-role mailbox in historical OSM-derived candidate evidence, not a personal contact or credential. This scan did not rewrite the historical file or its Git history.

## Safe next actions

- Phases 6–8 are documented in their reports; do not repeat their verified work.
- Phase 4 remains partial. The three post-merge evaluations and final browser smoke are BLOCKED because the available integration runner drops its generated scratch database in finally, and the standing instruction requires all scratch databases and artifacts to be kept. The runner was not invoked, no cleanup guard was bypassed, and no pass is claimed. Use a reviewed no-delete integration path that retains the database and artifacts.
- Phase 5 remains FIX FIRST. The current npm audit confirms the historical Critical and High entries are still present in the lockfiles. Resolve or formally triage those findings, then rerun both npm audits and this incremental scan.
- No database was connected to or changed in this Phase 4/5 continuation. The existing browser-test scratch database is not a pristine v6 baseline.
- Keep push, tag, and demo restore actions behind their exact user gates. The current no-demo/main-mutation rule also blocks both demo restore commands unless the user later explicitly revises that rule.
