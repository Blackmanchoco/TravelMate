# Dependency advisory refresh — 2026-10-23

Audited integration source commit: `b6fef938ccdd4ffada0d3b6280b67b600b9c55ef` (`integrate/deps-runner-20261023`). Commands were read-only `npm audit --json`; no `npm audit fix` was run. Root audit exited 1 in 1,437 ms and backend audit exited 1 in 1,222 ms because advisories remain. Raw outputs are `root-npm-audit.json` and `backend-npm-audit.json`.

## Severity counts

| Scope | 2026-10-20 baseline | 2026-10-23 refresh |
|---|---:|---:|
| Root | 1 High (1 total) | 1 High (1 total) |
| Backend | 1 Critical, 5 High, 3 Moderate (9 total) | 1 High, 2 Moderate (3 total) |

The comparison uses the saved 20 October network audit JSON. Its root High (`source-map-js`) and all nine backend package entries (`@prisma/config`, `body-parser`, `deepmerge-ts`, `express`, `fast-uri`, `mysql2`, `prisma`, `proxy-addr`, `qs`) are absent from the fresh report. The root count remains one because the current High is a different package: Vite.

## Current findings

- **Root — `vite@8.1.5`, High, direct dev dependency**, affected range `8.0.0 - 8.1.5`; npm reports a fix is available. The audit lists [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw), [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw), and [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22).
- **Backend — `vite@8.3.2`, High, transitive dev tooling** (installed as Vitest's optional peer), affected range `8.3.0 - 8.3.2`; npm reports a fix is available. It includes the five Vite advisories above plus [GHSA-vfpm-58rq-9qcg](https://github.com/advisories/GHSA-vfpm-58rq-9qcg).
- **Backend — `@vitest/mocker@4.1.11` and `vitest@4.1.11`, Moderate**. The audit reports `vitest@4.1.12` as an available non-major fix. Advisories: [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) and [GHSA-xp26-3454-mjgp](https://github.com/advisories/GHSA-xp26-3454-mjgp).

The previous 20 October dependency findings are no longer present, but the current locks still resolve Vite/Vitest releases in the fresh affected ranges. The audit marks fixes available; they remain unresolved here because this step was explicitly limited to recording `npm audit --json` results, with no audit fix or additional dependency change authorized.

## Production-only audit (2026-10-23)

Audited integration source commit: `8a33518fce2630a44d5168de83fab56507f333aa`. Read-only commands were `npm audit --omit=dev --json` at the root and in `backend`; outputs are saved as `root-production-audit.json` and `backend-production-audit.json`.

| Scope | Info | Low | Moderate | High | Critical | Total | Audit exit |
|---|---:|---:|---:|---:|---:|---:|---:|
| Root | 0 | 0 | 0 | 1 | 0 | 1 | 1 |
| Backend | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Production-pruned dependency-tree inspection (`npm ls --all --omit=dev`) found root `vite@8.1.5` through `@tailwindcss/vite@4.3.3`; therefore the root High Vite advisory is present in the production dependency graph despite Vite being directly declared in `devDependencies`. Root `vitest` and `@vitest/mocker` are absent. Backend `vite`, `vitest`, and `@vitest/mocker` are all absent from the production dependency graph. No audit fix or dependency change was made; the root production High remains unresolved.

### Root High triage (facts)

The audited root production dependency graph contains `vite@8.1.5`, resolved through `@tailwindcss/vite@4.3.3`. The root `package.json` declares `@tailwindcss/vite` in `dependencies` (`^4.3.3`) and `vite` in `devDependencies` (`^8.1.1`). The root npm audit groups five Vite advisories under one High-severity Vite finding; the individual GitHub advisory severities and conditions are:

- [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), “launch-editor: escapeCmdArgs() omits % escaping on Windows” — Moderate. Vite range `>=8.0.0, <=8.1.5`; fixed Vite version `8.1.6` (the affected `launch-editor` range is `<=2.14.1`, fixed in `2.14.2`). Component: dev-server editor launcher. Preconditions: the application runs on Windows; an attacker can place a file with a malicious name containing `&` or `%`; and the attacker can either inject a malicious environment variable or add an NTFS alternate data stream to that file.
- [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw), “launch-editor: Editor CLI flag misinterpretation causing arbitrary command execution for some editors” — Moderate. Vite range `>=8.0.0, <=8.1.5`; fixed Vite version `8.1.6` (the affected `launch-editor` range is `<=2.14.1`, fixed in `2.14.2`). Component: dev-server editor launcher. Preconditions for Vite users: an attacker can create a file-system entry beginning with `+` or `-` in the working directory; the selected editor is Vim/gVim, MacVim, Emacs/Emacsclient, or a qualifying Notepad++ setup; and the user is using WSL.
- [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), “launch-editor: `fs.existsSync()` existence check can be bypassed on Windows” — High. Vite range `>=8.0.0, <=8.1.5`; fixed Vite version `8.1.6` (the affected `launch-editor` range is `<=2.14.1`, fixed in `2.14.2`). Component: dev-server editor launcher. Preconditions: the application runs on Windows and an attacker controls the file argument supplied to the editor launcher; a crafted path ending in `\\..:line:column` can pass the existence check and reach the shell command.
- [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw), “Vite: Cross origin script execution through Vite custom middleware” — Low. Vite range `>=8.0.0, <=8.1.5`; fixed Vite version `8.1.6`. Component: dev-server custom middleware. Preconditions: the app passes an unchanged browser request URL to `server.transformIndexHtml` (typically middleware mode or custom app type); transformed HTML contains an inline module script; and that page exposes sensitive values to the script or permits critical actions.
- [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22), “Vite: Files outside `server.fs.allow` could be served when project paths match system paths on non-Windows machine” — Moderate. Vite range `>=8.0.0, <=8.1.5`; fixed Vite version `8.1.6`. Component: dev-server filesystem middleware. Preconditions: the app exposes the Vite dev server to the network; it imports a file whose root-relative browser URL matches an absolute readable host path; the sensitive file is not excluded by `server.fs.deny`; and the server runs on a non-Windows system.

A repository import search across `scripts/demo/serve-built.mjs`, backend source and compiled output, frontend source and compiled output found no module imports from `vite` or `@vitejs/*`. `scripts/demo/serve-built.mjs` imports `backend/dist/app.js` and `scripts/demo/built-app.mjs`. The compiled frontend asset contains Vite-generated `__vite__mapDeps` helper identifiers, but no import of the Vite package. Vite references found in root scripts are the `dev`, `build`, and `preview` commands; `scripts/demo/start-demo.ps1` references the Vite CLI.

## Vite 8.1.6 audit refresh — 2026-10-23

Fresh read-only audits were run after the root lock resolved `vite@8.1.6`. The preceding Root High triage describes the pre-patch `vite@8.1.5` snapshot. No `npm audit fix` was run.

| Scope | Audit | Info | Low | Moderate | High | Critical | Total | Exit |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Root | `npm audit --json` | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Root | `npm audit --omit=dev --json` | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Backend | `npm audit --json` | 0 | 0 | 2 | 1 | 0 | 3 | 1 |
| Backend | `npm audit --omit=dev --json` | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Raw JSON: `root-npm-audit-vite-8.1.6.json`, `root-production-audit-vite-8.1.6.json`, `backend-npm-audit-vite-8.1.6.json`, and `backend-production-audit-vite-8.1.6.json`.
