# Dependency remediation — 21 October 2026

## Scope and branch

Implemented only on `chore/dependency-remediation-20261021`, in `C:\FYP\travelmate-dependency-remediation-20261021`, based on master commit `f386fa6a4fc84d531a43fc418e199c9b7ea2e7b2`. Master was not checked out or modified. The existing master changes to `docs/freeze-plan/STATE.md` and `docs/freeze-plan/final-integration-20261019/PRE_PUSH_SCAN.md` remain in place. No database command was run; Prisma Client generation read the checked-in schema and used an unreachable placeholder URL without opening a connection.

The only package manifest change is a backend npm override for `fast-uri: ^3.1.8`. Direct dependency ranges were retained. Root `package.json` was unchanged. npm updates were performed lockfile-only with lifecycle scripts disabled, then lockfile-pinned installs were materialized with `npm install --ignore-scripts`; `npm ci` was rejected by automatic review because it removes `node_modules`, so it was not run.

| Lockfile | Prior SHA-256 | Updated SHA-256 |
|---|---|---|
| `package-lock.json` | `B21FE716A4F781BAC9CF8842A6C93631259695DDECC6D71FBABD83B2BBB667C2` | `4F17478F1537EF70FC4E20139294B0F4C53560C28CFF24BC630875CA7423B0D3` |
| `backend/package-lock.json` | `F6ADFAEB2E80690D1C555CDBE601341F6C846BD63ECDEDF3646B8BBF866D8BD8` | `1C2C15E17B56D630FCDDBA3995B3F3BE1AA5BB836C0D062AF3239ED78C974552` |

## Verified paths and fixed floors

| Lockfile path | Before | After | Result |
|---|---:|---:|---|
| Root `source-map-js` via `@tailwindcss/vite → @tailwindcss/node` and `vite → postcss` | 1.2.1 | 1.2.2 | Meets GHSA-68fv-2mgg-jv7q patched floor 1.2.2. |
| Backend `express → qs` | 4.22.2 / 6.15.3 | 4.22.3 / 6.16.1 | Express 4.22.3 declares `qs ~6.16.0`; path is above both qs advisory floors. |
| Backend `express → body-parser → qs` | 1.20.6 / 6.15.3 | 1.20.8 / 6.16.1 | body-parser 1.20.8 declares `qs ~6.16.0`; independently resolves to the patched shared qs. |
| Backend `express → proxy-addr` | 4.22.2 / 2.0.7 | 4.22.3 / 2.0.8 | Meets GHSA-jqcg-44mw-7w3h patched floor 2.0.8. |
| Backend `prisma → mysql2` | 7.10.0 / 3.15.3 | 7.10.1 / 3.24.4 | Above GHSA-3f6p-5ww8-9rcr floor 3.22.0 and GHSA-rgwj-5xj2-c3m3 floor 3.23.1. |
| Backend `prisma → @prisma/config → deepmerge-ts` | 7.10.0 / 7.1.5 | 7.10.1 / 8.0.2 | Meets GHSA-ggr8-5vv4-36mx patched floor 8.0.0. |
| Backend `prisma → @prisma/dev → @prisma/streams-local → ajv → fast-uri` | 7.10.0 / 3.1.6 | 7.10.1 / 3.1.9 | The root backend override resolves Ajv's `^3.0.1` request to 3.1.9, above the 3.1.8 floor for all three recorded fast-uri advisories. |

Registry-resolved metadata was checked against the official Express 4.22.3, body-parser 1.20.8 and Prisma ORM 7.10.1 release/package metadata. `npm ls` and `npm explain` verified the installed parent paths above; the lockfile was independently checked for the same package versions. Express 4 and body-parser remain within their existing semver constraints. Prisma direct packages moved together from 7.10.0 to the patch release 7.10.1, within existing `^7.10.0` ranges. The fast-uri override crosses no major boundary (3.x); the deepmerge-ts 8.x change comes from Prisma's patched `@prisma/config` 7.10.1 metadata.

Upstream evidence: [Express 4.22.3 package metadata](https://github.com/expressjs/express/blob/v4.22.3/package.json), [body-parser 1.20.8 package metadata](https://github.com/expressjs/body-parser/blob/1.20.8/package.json), [Prisma 7.10.1 release notes](https://github.com/prisma/orm/releases/tag/7.10.1), [Prisma config 7.10.1 metadata](https://github.com/prisma/orm/blob/7.10.1/packages/config/package.json), and [Prisma CLI 7.10.1 metadata](https://github.com/prisma/orm/blob/7.10.1/packages/cli/package.json). Patched ranges are recorded in [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [qs array-limit](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx), [qs isBuffer](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), [deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [fast-uri authority](https://github.com/advisories/GHSA-qw65-cvwx-89v3), [fast-uri bracket parsing](https://github.com/advisories/GHSA-58mr-gqgx-xq4g), [fast-uri host normalization](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj), [mysql2 authentication](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), and [mysql2 compressed protocol](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3).

Compatibility notes: the Express update remains on major version 4; body-parser stays on 1.x and 1.20.8 uses the same code base as 1.20.7 while selecting patched qs. Prisma 7.10.1 is the upstream patch release. The app uses Prisma's PostgreSQL adapter; mysql2 is a Prisma CLI dependency and is not the app's database adapter. Prisma's config dependency moves deepmerge-ts across major 8; config merge semantics are the main compatibility risk, while this project's plain-object Prisma config passed client generation, build, typecheck, and unit tests. The fast-uri override affects all copies of that package in the backend dependency tree but remains within v3. No database integration test was run under the no-database constraint.

The lockfile-only Prisma update also refreshed semver-compatible packages in Prisma's configuration graph (`exsolve` 1.1.1→1.1.3, `pkg-types` 2.3.1→2.4.0, `rc9` 3.0.1→3.1.0, and the matching nested `confbox` record) and updated mysql2's declared dependency set. The root lockfile adds six bundled optional Tailwind WASM package records from npm's lockfile refresh; no root package version changed beyond `source-map-js`. These are lockfile effects inside the approved dependency graphs; no application source or unrelated top-level dependency was changed.

## Audits and non-database validation

Both audits ran against the updated lockfiles with npm 11.11.0 and Node 24.14.1 on 21 October 2026:

- Root `npm audit --json`: exit 0; 0 info, 0 low, 0 moderate, 0 high, 0 critical.
- Backend `npm audit --json`: exit 0; 0 info, 0 low, 0 moderate, 0 high, 0 critical.
- `npm run build` (root): passed; existing Vite chunk-size warning remains.
- `npm run lint` (root): exit 0; four existing lint warnings remain.
- `npm run typecheck` (backend): passed.
- `npm run build` (backend): passed.
- `npm test` (backend): 32 files, 260 tests passed. The default Vitest command did not invoke `test:db` or `test/db/*.integration.ts`.
- `npx prisma generate --schema prisma/schema.prisma`: passed; schema-only, no database connection.

No migration, integration evaluator, browser smoke, database access, restore, push, or tag operation was performed.

## Incremental pre-push scan

The remediation delta was scanned against base `f386fa6a4fc84d531a43fc418e199c9b7ea2e7b2`. Seven changed paths (the package manifest/lockfiles and handoff records) were reviewed. `git diff --check` returned no lines; deletion count was 0; no dump, backup, database, or backend source file changed. Secret-pattern counts were 0 for private-key headers, AWS keys, GitHub token shapes, bearer tokens, credential-bearing PostgreSQL URLs, and password/secret/API-key assignments. No untracked non-ignored files were present. The scans apply only to this branch delta and do not replace a final scan of any later integration or push range.

## Gate and remaining work

Phase 5's dependency findings are cleared by the two current audits. The overall push gate remains **FIX FIRST**: Phase 4's three post-merge evaluations and final browser smoke remain BLOCKED because the only available integration runner drops its scratch database in `finally`; Phase 7 also retains its recorded three Medium and two Low findings (83 passed, 5 failed, 4 skipped). Do not invoke that runner or change it to bypass cleanup. This incremental scan covers only this branch delta; the full push-range review still needs to be refreshed after integration. The next safe action is to review this local commit, then either provide a reviewed no-delete integration path or carry the explicit Phase 4 and Phase 7 conditions into the gate review. This branch has not been merged, pushed, or tagged.

## Post-commit review checkpoint — 21 October 2026

### Commit and dependency review

Read-only review confirmed branch chore/dependency-remediation-20261021, HEAD 4eee5a564f9458b0cea9010af092a43e62f4319e, and parent/base f386fa6a4fc84d531a43fc418e199c9b7ea2e7b2. The worktree was clean before this documentation checkpoint. The complete base-to-HEAD diff is one commit and seven paths: the two lockfiles, the backend fast-uri override, and four dependency/handoff documents. There are no application source, evaluator, authentication, schema, database, backup, or temporary-artifact paths in the diff; no file deletion is present. git diff --check is clean. The existing root and backend lockfile SHA-256 values above match the checked-out files.

The lockfile and installed-tree paths agree. Root source-map-js 1.2.2 resolves through both vite 8.1.5 → postcss 8.5.25 → source-map-js and @tailwindcss/vite 4.3.3 → @tailwindcss/node 4.3.3 → source-map-js. Backend express 4.22.3 → qs 6.16.1 and express → body-parser 1.20.8 → qs 6.16.1 are both present. express → proxy-addr 2.0.8 is present. Prisma resolves to 7.10.1; its @prisma/config 7.10.1 → deepmerge-ts 8.0.2 and mysql2 3.24.4 paths are present. Its @prisma/dev 0.24.17 → @prisma/streams-local 0.1.11 → ajv 8.20.0 → fast-uri 3.1.9 path uses the backend root override fast-uri: ^3.1.8. Read-only npm explain confirmed these paths and versions.

The commit's report records both post-remediation audits as exit 0 with zero findings. A search of accessible repository evidence paths found no raw post-remediation audit JSON to inspect or checksum. The private backup directory was inaccessible and was not inspected. The JSON captures in dependency-advisory-refresh-20261020/ are earlier pre-remediation audits against the old lockfiles. Treat the zero-finding result as the reported isolated-branch result, not as evidence that the integrated push range is safe. A fresh audit with retained raw output and a full-range scan are still required after integration.

No database, backup, scratch database, log, or generated artifact was accessed, modified, or removed during this review. The master worktree remains at f386fa6a4fc84d531a43fc418e199c9b7ea2e7b2 with its pre-existing docs/freeze-plan/STATE.md modification and untracked docs/freeze-plan/final-integration-20261019/PRE_PUSH_SCAN.md. The same four sibling worktrees remain dirty: travelmate, travelmate-itinerary-add-flow, detached travelmate-review-a676, and travelmate-warm-ai-script. No unrelated worktree was changed.

### Phase 4 runner and safe options

The inspected runner is backend/ai/evaluation/run-local-integration-20261018.mjs. It creates an output directory at line 17, marks its timestamped scratch database created after CREATE DATABASE at line 142, and drops that database in finally at line 389 whenever it was created. Its supported modes include --audit, --t1, --integrated, alias modes, and other evaluation modes, but no keep-database/no-cleanup option exists. --api-only skips some test commands; it does not suppress database creation or the finally drop. The runner does not remove its output directory, but it does delete the generated scratch database, so every mode that reaches database creation is unsafe under the retention requirement.

Phase 4 therefore remains BLOCKED. There is no safe supported execution path in the inspected repository. Keep the evaluations and final browser smoke unrun until an already-supported runner/path is available and its retention behavior is verified in source. Do not invoke this runner or substitute a different evaluation path that changes the checks' semantics.

### Gates and next action

The five Phase 7 findings and their existing evidence remain unchanged: three Medium and two Low; the report records 83 passed, 5 failed, and 4 skipped. The overall push verdict remains FIX FIRST. The next safe action is to keep Phase 4 blocked and obtain a supported, source-verifiable no-delete execution path for the same evaluations; after integration, rerun the current audits and the full integrated push-range scan. No merge, push, tag, restore, or database operation was performed.
