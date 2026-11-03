# Manual handoff — 20 October 2026

Use PowerShell. All commands that change Git refs or the demo database require the corresponding exact user gate in the task. Keep passwords, database URLs, and bearer tokens in memory; do not paste them into logs or screenshots. The demo and main databases were not restored by Phase 2. The v7 file is a candidate until reviewed and explicitly restored.

## Current queue order

Phase 3 is merged into local master. Its report is docs/freeze-plan/admin-shell-20261020/REPORT.md. The browser harness wrote test accounts only to travelmate_scratch_20261019_finalalias; that scratch database is no longer a pristine v6 baseline.

Phase 4 is PARTIAL; its three post-merge AI evaluations and final browser smoke are still pending. The original integration runner unconditionally drops its generated scratch database in `finally` and remains unchanged. A reviewed retention-safe copy is available on `chore/retention-safe-runner-20261021`; do not run either runner until the user separately authorizes execution. No evaluation or final browser smoke pass is claimed.

Phase 5 is DONE with FIX FIRST. The fresh 20 October npm registry audit confirms the historical package findings remain in both lockfiles: root/frontend 1 High; backend 1 Critical, 5 High, and 3 Moderate package entries. No dependency was installed or upgraded. See DEPENDENCY_ADVISORY_REFRESH.md for exact versions, advisories, hashes, tool versions, and raw output. Push remains blocked.

Phase 4/5 application SHA: 138e039b1720ce7bf8311f9cb7e8ec7db3dc788e. Dependency audit input: master HEAD 175b9fcc06945fe6b8bc1c14b1bb147ba3d6b297, 108 commits ahead of origin/master at the start of recovery. The final documentation commit advances master; its SHA is printed with this handoff. Run `git rev-parse HEAD` again for the exact SHA before any gate.

At recovery start, master had no staged changes. The preserved pre-existing master changes were the unstaged docs/freeze-plan/STATE.md edit and untracked docs/freeze-plan/final-integration-20261019/PRE_PUSH_SCAN.md. Four sibling worktrees were also dirty and remain untouched: fix/assistant-category-safety, fix/itinerary-add-flow, detached travelmate-review-a676, and chore/warm-ai-script. The other ten sibling worktrees were clean. The queue documentation and npm audit evidence are the only files included in this checkpoint update.

Phase 6 is recorded in TEST_REPORT.md, results.json, test-cases.csv, and the three backend-test-run JSON files. The backend suite passed 260/260 in each of three runs (780 case executions total; no skips or flakes); typecheck/build and Python suites 4/4 and 6/6 passed on application code tip 138e039b1720ce7bf8311f9cb7e8ec7db3dc788e. Historical AI evaluation results are split out in TEST_REPORT.md. The three post-merge evaluator runs and final browser smoke are BLOCKED under Phase 4 because the available integration runner deletes its generated scratch database.

Phase 7's security report is complete and recorded in SECURITY_TEST_REPORT.md plus security-results.csv. The CSV has 92 rows: 88 executed checks (83 pass, 5 fail) and four skipped checks with reasons. The exact security scratch `travelmate_scratch_security_20261020` was restored from the v6 dump after rechecking SHA-256 `D84F90858E142741F0DC5B5F68D77BEDD16D4971F658778E5365F0DCD4826D34`, applying the exact-name guard and explicit `DATABASE_URL` override, and confirming baseline `2|1|6|56|0|1|3|0`. Security test writes left it at `5|1|6|56|0|2|4|0`; it is retained and is not a clean v6 fixture. Findings: the bcrypt suffix collision, missing login rate limiting, missing security headers, encoded-NUL search 500, and oversized-body 500. Do not use this scratch as a baseline for another write. No security fix branch was needed for the scoped high-impact-only rule.

Phase 8 is recorded in docs/freeze-plan/CURRENT_STATE.md and the read-only plan at `C:\FYP\REORG_PLAN.md` with its CSV. No files were moved. The report additions are documentation-only. Before any database write, verify the v6 checksum, exact scratch name and identity, exact-name guard, explicit `DATABASE_URL` override, and the expected baseline. Never restore to, write to, or mutate demo/main.

Gate menu: go push, go tag, go push tag, go restore v6, go restore v7. Push is currently blocked by the FIX FIRST verdict. Both demo restore actions are blocked by the current no-demo/main-mutation rule unless the user later explicitly revises it. Each gate still requires its exact user message; phase completion does not imply a gate.

## Start the reviewed local demo

In the first PowerShell window, identify the existing listener and stop **only** its exact PID. Inspect the printed process before entering the PID.

```powershell
$listeners = @(Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 5174 -State Listen -ErrorAction SilentlyContinue)
$listeners | Select-Object LocalAddress,LocalPort,OwningProcess
$oldPid = [int](Read-Host 'Exact 5174 listener PID to stop')
if ($oldPid -notin @($listeners | ForEach-Object OwningProcess)) { throw 'PID is not the listed 5174 listener.' }
Get-Process -Id $oldPid | Select-Object Id,ProcessName,Path
Stop-Process -Id $oldPid
& 'C:\FYP\travelmate-master\scripts\demo\start-reviewed-build.ps1' -DatabaseName 'travelmate_demo_20261006' -SourceBackend 'C:\FYP\travelmate\backend'
```

The last command serves the compiled master build at `http://127.0.0.1:5174` and stays in the foreground. It does not seed or restore. If there is no 5174 listener, omit the PID selection and `Stop-Process` lines and run only the final command. Do not stop a 5055 listener without identifying and reviewing its exact PID separately.

In a second PowerShell window, use a signed-in user with saved preferences. Enter the bearer token at the secure prompt; it is not printed. This warm-up requires the existing Python environment and Ollama model.

```powershell
$base = 'http://127.0.0.1:5174/api'
$token = [System.Net.NetworkCredential]::new('', (Read-Host 'Demo bearer token' -AsSecureString)).Password
$headers = @{ Authorization = "Bearer $token" }
$userId = (Invoke-RestMethod -Uri "$base/users/me" -Headers $headers).data.id
$preferences = (Invoke-RestMethod -Uri "$base/users/me/preferences" -Headers $headers).data
if (-not $userId -or -not $preferences) { throw 'Use a signed-in account with saved preferences.' }
. 'C:\FYP\travelmate-master\scripts\demo\demo-common.ps1'
$demoConnection = Get-DemoConnection -DatabaseName 'travelmate_demo_20261006' -EnvironmentFile 'C:\FYP\travelmate\backend\.env'
$previousDatabaseUrl = [Environment]::GetEnvironmentVariable('DATABASE_URL', 'Process')
Push-Location 'C:\FYP\travelmate-master\backend'
try {
  $env:DATABASE_URL = $demoConnection.Url
  $warm = @{ userId = $userId; limit = 5; destinationId = $null } | ConvertTo-Json -Compress | & 'C:\FYP\travelmate\backend\.venv\Scripts\python.exe' '.\ai\recommendation\recommendation_runner.py' | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or -not $warm.ok -or @($warm.items).Count -ne 5) { throw 'Python warm-up did not return five items.' }
  npm run warm-ai
  if ($LASTEXITCODE -ne 0) { throw 'Ollama warm-up failed.' }
  ollama ps
} finally {
  Pop-Location
  [Environment]::SetEnvironmentVariable('DATABASE_URL', $previousDatabaseUrl, 'Process')
  $demoConnection = $null
}
$statuses = @(1..2 | ForEach-Object { (Invoke-WebRequest -Uri "$base/recommendations?limit=5" -Headers $headers -Method Get).StatusCode })
if (($statuses -join ',') -ne '200,200') { throw "Recommendation warm-up failed: $($statuses -join ',')" }
$statuses
```

## 21 October 2026 dependency remediation checkpoint

The dependency fix is isolated on branch `chore/dependency-remediation-20261021` at `C:\FYP\travelmate-dependency-remediation-20261021`, based on master `f386fa6a4fc84d531a43fc418e199c9b7ea2e7b2`. Master and its pre-existing dirty files were left untouched. Do not merge or push this branch as part of the dependency task.

The root and backend `npm audit --json` commands both returned exit 0 with zero findings. Root build/lint, backend typecheck/build, the 260-test backend unit suite, and schema-only Prisma Client generation passed. See `DEPENDENCY_REMEDIATION_20261021.md` for exact versions, paths, command output summaries, and scan scope.

The overall push gate remains **FIX FIRST**: Phase 4's post-merge evaluations and final browser smoke are still BLOCKED by the available runner's scratch-database deletion in `finally`; Phase 7 also retains three Medium and two Low findings (83 passed, 5 failed, 4 skipped). Do not execute that runner, bypass its cleanup, or perform any database or restore operation. The next safe action is to review the local dependency commit and use a reviewed no-delete integration path; then refresh the full push-range review. If unavailable, preserve the Phase 4 blocker and Phase 7 findings and stop before push/tag/restore gates.

Run the six alias checks on both public place routes. The first five should each return total 1 and place ID 37; `xyzabc` should return total 0.

```powershell
$queries = @('KL Tower', 'KL tower', 'kl tower', 'Menara Kuala Lumpur', 'Kuala Lumpur Tower', 'xyzabc')
foreach ($query in $queries) {
  $encoded = [System.Net.WebUtility]::UrlEncode($query)
  foreach ($route in @('places/destination/1', 'places')) {
    $result = Invoke-RestMethod -Uri "http://127.0.0.1:5174/api/${route}?page=1&limit=6&search=$encoded"
    '{0} | {1} | total={2} | ids={3}' -f $route, $query, $result.data.pagination.total, ($result.data.items.id -join ',')
  }
}
```

## Manual browser checklist

- [ ] Explore category dropdown includes **Accommodation** and **Restaurant**; the food quick action opens the correct category; category badges use the reviewed wording.
- [ ] Hotel, restaurant, and attractions queries work in English and Chinese, including common typos. Check the compound request and “Penang hotels, 3 days” in the assistant.
- [ ] Search `KL Tower`, `kl tower`, `Menara Kuala Lumpur`, and `Kuala Lumpur Tower`; confirm the actual place opens.
- [ ] Add a place to a dated itinerary, then add it again; confirm two independent items and the selected dates.
- [ ] Check the Admin console as both a traveller and an ADMIN. After the admin-shell merge, ADMIN sees the Admin tab bar and account menu; traveller sees the original header and no Admin link.
- [ ] Open Admin Report and print view; manually **Save as PDF** and inspect the PDF. Confirm the report remains usable for both roles as intended.
- [ ] Browse new place photos, including Stadthuys (13) and Mandarin Oriental (99), and check at least one honest category placeholder including Traders Hotel (102). Confirm square place 55 crop and image-error fallback.
- [ ] Open `/credits`: 47 titled credits should display; Stadthuys is item 27 and Mandarin Oriental is item 42. Check the right-to-left author, literal `*angys*`, and the 2017 Hotel Jen note.
- [ ] Archived places remain absent from public browsing/search but visible in authorized Admin/history contexts.

## Git gates — commands to run only after the matching user message

Before `go push`, Phase 5 must say **SAFE TO PUSH**. It currently says FIX FIRST because the refreshed audit still reports Critical and High dependencies. After a reviewed fix and verification, check that the final SHA in `STATE.md` matches HEAD and the working tree contains no unexpected changes. Then push master only:

```powershell
git -c safe.directory=C:/FYP/travelmate-master -C C:\FYP\travelmate-master status --short --branch
git -c safe.directory=C:/FYP/travelmate-master -C C:\FYP\travelmate-master rev-parse HEAD
git -c safe.directory=C:/FYP/travelmate-master -C C:\FYP\travelmate-master push origin master
```

After `go tag`, create the **local annotated tag only** at the verified final SHA. After `go push tag`, push **only that tag**:

```powershell
$finalSha = (git -c safe.directory=C:/FYP/travelmate-master -C C:\FYP\travelmate-master rev-parse HEAD).Trim()
git -c safe.directory=C:/FYP/travelmate-master -C C:\FYP\travelmate-master tag -a freeze-2026-10-20 $finalSha -m 'Freeze reviewed TravelMate build 2026-10-20'
git -c safe.directory=C:/FYP/travelmate-master -C C:\FYP\travelmate-master push origin refs/tags/freeze-2026-10-20
```

The restore commands below are destructive and are blocked by the current standing instruction forbidding demo/main mutations. Do not run either command, even after a restore gate, unless the user later explicitly revises that instruction. The exact go restore v6 or go restore v7 message remains required after any such revision. The v7 command requires restore-v7 support on master. Never infer a restore gate from go push or go tag.

```powershell
& 'C:\FYP\travelmate-master\scripts\demo\rebuild-demo.ps1' -DatabaseName 'travelmate_demo_20261006' -BackupDirectory 'C:\FYP\travelmate-private-backups\2026-10-06-demo' -SnapshotKind 'seeded-v6' -EnvironmentFile 'C:\FYP\travelmate\backend\.env'
& 'C:\FYP\travelmate-master\scripts\demo\rebuild-demo.ps1' -DatabaseName 'travelmate_demo_20261006' -BackupDirectory 'C:\FYP\travelmate-private-backups\2026-10-20-demo-v7' -SnapshotKind 'seeded-v7' -EnvironmentFile 'C:\FYP\travelmate\backend\.env'
```

Run **only one** of the two lines for the corresponding exact user message. Verify `CLEAN_COUNTS=2|1|6|56|0|1|3|0|56` and public discoverable count 56 after the restore, and record the demo state in `STATE.md`.

## If Codex is unavailable

The source of truth is the branch/SHA table in `STATE.md`, the photo report under `docs/freeze-plan/photo-import-20261020/`, and the private v6/v7 `.sha256` sidecars. Keep the current master, branches, private backups, and pre-existing uncommitted files intact. Continue the remaining phases in the queue order, run their stated checks, then update `STATE.md` with exact results. Do not push, tag, or restore by inference; perform only the one gate the user explicitly chooses. If a phase fails, leave its branch unmerged and record the failure before moving on.

## Phase 4 retention-safe runner checkpoint — 21 October 2026

The isolated worktree is `C:\FYP\travelmate-retention-safe-evaluator-20261021` on branch `chore/retention-safe-runner-20261021`, based on `f386fa6a4fc84d531a43fc418e199c9b7ea2e7b2`. Use the copy at `backend/ai/evaluation/run-local-integration-20261018-retain.mjs` only after separate explicit authorization. The original evaluator at `backend/ai/evaluation/run-local-integration-20261018.mjs` is unchanged. The copy retains the scratch database and generated artifacts; do not run the original, and do not remove retained databases or artifacts.

Static checkpoint evidence: original SHA-256 `9228730A6A8B478820FD98E628CEA1E43310DF5DD7F21583C299E1E86DE0EED6`; copy SHA-256 `1AC95D08C9E800AEE6089AE3D5F0CD04D8ED14ACEB35A0744EACFF4524CB302E`; `node --check` passed; the static deletion-call scan returned no matches. The exact-name guard and existing final database-name query remain in the copy.

Before a run reaches evaluation work, the retained copy verifies the complete baseline immediately after restoring v6. It requires `current_database()` to match the generated scratch name and the ordered counts `2|1|6|56|0|1|3|0` (users, preferences, destinations, discoverable places, archived places, itineraries, itinerary items, saved places). A target mismatch, query error, or count mismatch stops the run before build/test commands, account registration, preference setup, or evaluation writes. This covers `--legacy` (original plus earlier compound cases) and the separate `--supplement-only` run.

Execution checkpoint: the authorized `--legacy` command started at `2026-10-21T01:27:39.0033706+08:00` and exited 1 at `2026-10-21T01:27:39.1223406+08:00` because Node could not resolve `pg` (`MODULE_NOT_FOUND`). It failed before connecting, restoring, or running any case. Original 183 and compound 12 were not run; supplement 78 was not started. The empty proposed-target output directory `docs/freeze-plan/compound-supplement-20261018/legacy-travelmate_scratch_20261020172739091/` was preserved; no scratch database or evaluation output exists for this attempt. The existing execution authorization remains valid, but the missing runtime dependency must be made available and the complete preflight rerun before continuing. Final browser smoke remains a separate pending check.

The push verdict remains **FIX FIRST**. A zero-finding audit on the isolated dependency-remediation branch is not evidence that the integrated push range is safe. Do not merge, push, tag, restore v6/v7, or change demo/main databases by inference.
## 21 October 2026 commit review checkpoint

Reviewed 4eee5a564f9458b0cea9010af092a43e62f4319e on chore/dependency-remediation-20261021; its parent is the stated base f386fa6a4fc84d531a43fc418e199c9b7ea2e7b2. The diff is limited to the two dependency lockfiles, the backend fast-uri override, and four documentation files. Lockfile paths and versions were independently checked. The committed remediation report records both updated audits as zero findings, but a search of accessible repository evidence paths found no raw post-remediation JSON to inspect or checksum; the saved audit JSON in dependency-advisory-refresh-20261020/ refers to the earlier lockfiles. Do not use isolated-branch audit results to clear the integrated push range.

The existing Phase 4 runner backend/ai/evaluation/run-local-integration-20261018.mjs creates a timestamped scratch DB and drops it in finally after creation. It has no supported keep-database/no-cleanup option; --api-only still follows the same cleanup path. Phase 4 stays BLOCKED. Do not run the runner or substitute checks with different semantics. Next safe action: obtain a source-verifiable, supported no-delete path for the same evaluations; then rerun the two audits and full integrated push-range scan. Phase 7 evidence remains unchanged at 83 passed, 5 failed, and 4 skipped with three Medium and two Low findings. Gate remains FIX FIRST. No database, backup, log, generated artifact, master worktree, or sibling dirty worktree was changed; no merge, push, tag, or restore was performed.
