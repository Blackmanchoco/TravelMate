# Dependency advisory refresh — 20 October 2026

## Result

The current npm registry audit confirms the historical findings remain present in the committed lockfiles. The root/frontend audit reports 1 High finding. The backend audit reports 1 Critical, 5 High, and 3 Moderate affected package records. These counts match the 16 October 2026 classification. Phase 5 remains FIX FIRST; the repository is not cleared for push.

The audit input was master at 175b9fcc06945fe6b8bc1c14b1bb147ba3d6b297. The application code tip remains 138e039b1720ce7bf8311f9cb7e8ec7db3dc788e. Both commands used npm 11.11.0 and Node.js 24.14.1:

~~~powershell
npm audit --json
~~~

The command ran once from the repository root and once from backend. Both returned exit code 1 because the audit found vulnerabilities. No install, upgrade, or fix command ran. Lockfiles were unchanged. Their SHA-256 values after the audit were:

| Lockfile | SHA-256 |
|---|---|
| package-lock.json | B21FE716A4F781BAC9CF8842A6C93631259695DDECC6D71FBABD83B2BBB667C2 |
| backend/package-lock.json | F6ADFAEB2E80690D1C555CDBE601341F6C846BD63ECDEDF3646B8BBF866D8BD8 |

The first sandboxed registry requests failed before producing advisory data; those JSON and stderr captures are retained. The subsequent network-enabled npm audit requests succeeded and their raw JSON, stderr, and output are retained in this directory. The audit JSON is report version 2. npm marks the available package-level remediation paths as fixAvailable=true; no remediation was applied.

## Current affected lockfile entries

| Workspace | Locked package | npm severity | Current advisory evidence | Status |
|---|---|---|---|---|
| Root/frontend | source-map-js 1.2.1, indirect | High | GHSA-68fv-2mgg-jv7q affects versions below 1.2.2; patched in 1.2.2. | Unresolved; locked version is affected. |
| Backend | proxy-addr 2.0.7, indirect | Critical | GHSA-jqcg-44mw-7w3h affects versions below 2.0.8; patched in 2.0.8. | Unresolved; locked version is affected. |
| Backend | qs 6.15.3, indirect | Moderate | GHSA-x5fp-wj9c-mxmx affects 6.14.2 through 6.15.3; GHSA-4mjr-xmp4-gh2g affects versions below 6.16.0. Both identify 6.16.0 as patched. | Unresolved; locked version is affected by both advisories. |
| Backend | body-parser 1.20.6, indirect | Moderate | npm reports the affected package through qs; locked range is 1.20.5–1.20.6. See the two qs advisories above. | Unresolved inherited audit entry. |
| Backend | express 4.22.2, direct | Moderate | npm reports the affected package through qs. See the two qs advisories above. | Unresolved inherited audit entry. |
| Backend | deepmerge-ts 7.1.5, indirect | High | GHSA-ggr8-5vv4-36mx affects versions below 8.0.0; patched in 8.0.0. | Unresolved; locked version is affected. |
| Backend | @prisma/config 7.10.0, indirect | High | npm reports the affected package through deepmerge-ts. See GHSA-ggr8-5vv4-36mx. | Unresolved inherited audit entry. |
| Backend | prisma 7.10.0, direct | High | npm reports the affected package through @prisma/config and mysql2. See the deepmerge-ts and mysql2 advisories. | Unresolved inherited audit entry. |
| Backend | fast-uri 3.1.6, indirect | High | GHSA-qw65-cvwx-89v3 affects 3.x versions below 3.1.7; GHSA-58mr-gqgx-xq4g affects exactly 3.1.6; GHSA-hrr3-gc8f-f4qj affects 3.x versions below 3.1.8. Version 3.1.8 clears all three listed ranges. | Unresolved; locked version is affected by three advisories. |
| Backend | mysql2 3.15.3, indirect | High | GHSA-3f6p-5ww8-9rcr affects versions below 3.22.0; GHSA-rgwj-5xj2-c3m3 affects versions through 3.23.0. Version 3.23.1 clears both listed ranges. | Unresolved; locked version is affected by both advisories. |

All ten advisory IDs are linked to the current GitHub Advisory Database records: [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), [qs array-limit](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx), [qs isBuffer](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), [deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [fast-uri authority injection](https://github.com/advisories/GHSA-qw65-cvwx-89v3), [fast-uri bracket parsing](https://github.com/advisories/GHSA-58mr-gqgx-xq4g), [fast-uri host normalization](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj), [mysql2 authentication downgrade](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), and [mysql2 compressed protocol](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3).

The package-manager report counts affected package entries, not unique vulnerabilities: one Critical, five High, and three Moderate in backend; one High in root/frontend. The severity on a transitive parent entry is inherited from its vulnerable dependency. The result confirms lockfile applicability; it does not establish exploitability on every application request path.

## Historical comparison and gate

The 16 October classification in ../final-evidence/dependencies/CLASSIFICATION.md listed the same nine backend package entries and the same one frontend entry. Current lockfile versions remain inside the affected ranges. No historical Critical or High entry was cleared, and the fresh audit found the same severity counts.

Phase 5 remains FIX FIRST because proxy-addr is Critical and the lockfiles retain six High package entries across root and backend. Do not mark SAFE TO PUSH or push master.

The next safe action is a separately reviewed dependency-remediation branch. Resolve the Critical and High entries first, assess the npm fix paths for Prisma and its transitive CLI packages for compatibility, run the project checks, then rerun both npm audits and the incremental pre-push scan. Keep the existing lockfiles and application branch unchanged until that remediation work is approved and verified.

## Preserved audit evidence

- root-npm-audit-network.json and backend-npm-audit-network.json: successful current registry responses.
- root-npm-audit-network.stderr.txt and backend-npm-audit-network.stderr.txt: stderr from successful audit commands.
- root-npm-audit.json and backend-npm-audit.json: initial sandboxed request failures.
- root-npm-audit.stderr.txt and backend-npm-audit.stderr.txt: initial failure diagnostics.

No package manifests, lockfiles, source files, databases, backups, or existing audit artifacts were changed or removed.
