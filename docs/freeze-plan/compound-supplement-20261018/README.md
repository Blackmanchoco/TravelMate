# Overnight supplemental evaluation: STOP on missing N-days limitation

Historical failed run below is preserved. User subsequently authorized development fixes and adjusted the stop rule. See [FINAL_REPORT.md](FINAL_REPORT.md) for the completed fix,214unit tests, original183/183regression, prior12/12compound and new78/78supplement. No historical raw was changed.

18 October 2026, 02:19:03-02:20:16 MYT. Tested existing branch `fix/assistant-compound-request` at `3f3d1a5e2cdb2fde4d06bfa7c009a064885ed4f2`. No application source changed. No new commit, merge, push or tag. Runner, cases, records and this evidence are uncommitted pending review of the failed acceptance gate.

## Result and first stop

Separate new evaluation: **33 pass / 34 completed, 1 failure, 11 not run** out of 45 planned rows (15 cases x3). This is an interrupted failed acceptance run, not45/45 and not an update to the historical183/183. All34 completed responses are **server-rule** (33pass/1fail), model-authored0, direct-tool evaluation rows0. Actual model calls34. Direct catalogue tool calls used as fixture setup are not counted as separate acceptance rows. Every raw response row records its origin, basis, model-call count, response, expectation and tool usage.

| Case group | Pass/completed | Outcome |
|---|---:|---|
| Hotel English, Chinese, hotel typo |9/9|Catalogue plus exact fixed limitation|
| Restaurant English, Chinese, restaurant typo |9/9|Catalogue plus exact fixed limitation|
| English/Chinese hotel and restaurant controls |12/12|Exact unchanged catalogue reply, no limitation appended|
| `any recommend place for penang`, forced unavailable |3/3|Exact honest fixed fallback, no substituted/invented places|
| `Penang hotels, 3 days` |0/1|Catalogue correct, required limitation missing; immediate stop|
| Remaining iterations and hyphenated days/Chinese days/planning typo cases |0/0|11rows not run after stop|

Failing request: `Penang hotels, 3 days`.

Actual reply:

> TravelMate currently lists 3 hotels in Penang: JEN Penang Georgetown by Shangri-La, Shangri-La Golden Sands Resort, Yeng Keng Hotel. These are catalogue matches.

Required additional sentence:

> This chat cannot build a schedule; use Itinerary and Add to choose days and slots.

HTTP200; real successful search_places arguments destinationPenang/categoryAccommodation/limit5, resultCount3; one initial model call. This is a deterministic recognition gap: `requestsSchedule` at backend/src/modules/ai/ai.service.ts:335-336 recognizes plan/build/etc followed by trip/itinerary, or scheduling slots, but has no bare N-days alternative. `withScheduleLimitation` consequently returns the catalogue reply unchanged. The failure is not a fabricated hotel or schedule, timeout, database problem or model variance; it preserves the incomplete response behavior for an explicitly requested trigger. No assertion was weakened and no fix was applied after the stop.

`summary.json.stop` contains the conservative generic `SETUP_OR_RUNTIME_ERROR_WITHHELD` because the runner's safe exception allowlist rejected lowercase case IDs in its internal stop string. This is a reporting limitation in the runner, not a setup failure in the completed live run: the row, console and summary results identify hotel_bare_n_days iteration1 as the stopping failure. Do not rerun or reinterpret it as passing.

## Historical evaluation remains separate

The original61case file contains schedule_request_english and schedule_request_chinese (master evaluator lines197/206): recommendations plus scheduling, but neither hotel nor restaurant compound. Original historical result remains183/183, with reconstructed origins server-rule138/138, model-authored18/18, direct tool27/27. It was not rerun tonight. Original raw SHA-256 was checked before and after and remains:

`471913F7ECAC18252B336CD8249AA76E7708B72F9DC43F4E3CC5B7AE6B37F97D`

Earlier compound branch195/195 is also historical: original183 plus four attractions/place cases x3. It does not establish acceptance of these new hotel/restaurant/N-days requirements. No existing raw JSONL or case file was modified. New supplement.jsonl SHA-256:

`905A3A0B172CA1CD8C787C5136050D2F25671A84411F261E7A5FAF587FA7D81A`

## Isolation, checks and cleanup

Before the first connection, the runner read only the DATABASE_URL setting from the explicitly authorized source file into process memory, parsed local host/source database, and substituted only its database name. No credential/connection string was printed or persisted. Every build/warm-up and application import received an explicit scratch DATABASE_URL, overriding dotenv; dotenv/config was pointed at a nonexistent file, parent cwd had no .env, and generated scratch JWT/account/password/token remained in memory. Imported env and SQL current_database were checked. pg.Pool.connect validated the owned scratch target before application connections. Maintenance postgres access was restricted to database-name catalog queries and exact owned CREATE/DROP; no connection to main/demo and no demo count queries.

Only successful run scratch: `travelmate_scratch_20261017181903340`. Two earlier sandbox setup attempts could not read the private snapshot (EPERM), created no databases and ran no cases; their attempt summaries remain saved. The same guarded runner with required private-file access then restored checksum-verified v6 and confirmed56discoverable places. The misleading02:23preflight STATE heading was an estimated label; actual run timestamps here and in summary are authoritative.

| Fresh check | Result |
|---|---|
| v6 checksum and scratch restore |Pass|
| Backend build |Pass, exit0|
| Ollama shared-prompt warm-up |Pass, exit0|
| Supplemental live API |33pass/1fail/11not run|
| Unit suite, separate typecheck, frontend lint/build |Not run after acceptance stop|
| Scratch cleanup |Dropped, exact name absent from final database-name list|
| Fixture cleanup |Port59921closed, checked after runner exit|

Warm-up loaded qwen3:8b for the test; no Ollama service restart or unload was issued. No running demo process was restarted or changed. No Python warm-up was needed for the forced-failure case: only that fixture's configured executable was temporarily set to a nonexistent path, yielding the real RECOMMENDER_UNAVAILABLE spawn error. The existing assistant converted it to its fixed honest message; the fixture setting was restored. Production timeout/recommender source/dependencies unchanged.

Before and after database-name lists matched exactly: postgres, template0, template1, travelmate, travelmate_backup_verify_20261005, travelmate_c4_restore_20261004, travelmate_c4_restore_20261005, travelmate_demo_20261006. This verifies scratch absence and preserved names; no claim of independent row-level verification on main/demo is made. Neither was connected to by this run.

## Morning handoff and next authorization

The first failed acceptance case blocks further unattended work. Testing/security audit1b and Explore alias2b were not started. No new thesis testing/security report exists. Historical dependency findings remain frontend1high and backend1critical/5high/3moderate packages; deployment security remains NEEDS FIXES and this run did not reassess those advisories. Photo work was not resumed: historical56places/9with photos/47missing and existing intake on feat/category-placeholders; no v7. B is explicitly dropped by the user. C remains the manual Explore/assistant search/recommender/Add picker flow; the mentor item generating two itineraries to compare is not delivered.

Current heads: master0c6aab0; compound3f3d1a5; placeholders e069b8b; freeze docs07b4e9d. No new commit because acceptance failed. No audit/alias branch or screenshot exists from this run. Do not merge or publish the compound branch as satisfying the expanded acceptance criteria.

Suggested narrow resumption prompt:

> Go fix the confirmed compound N-days detection gap with zero dependencies and no schema change. Keep catalogue replies unchanged and append only the fixed language-appropriate sentence. Preserve this failed raw run, run a new separate supplemental evaluation including all remaining cases, and recheck the original evaluation on a new owned scratch DB. Keep the authorized in-memory .env connection handling, scratch guards, 07:30 build cutoff, B dropped, C retained and all other stop conditions. After passing, continue testing/security audit, Explore alias and morning report; no merge, push, tag or demo restore.

After all work is fully verified, review before any later authorization. Possible separate gates: local merge of fully verified compound/audit/photo/alias/final docs in that order followed by integration checks; push reviewed master only; prepare a scratch-verified licensed-photo v7 for review (no restore); separately restore its reviewed exact hash/counts/reset effects; separately create the reviewed freeze tag; separately publish that exact tag. Those gates are not granted here and unavailable branches must not be invented.

Before the demo: close GPU apps, plug in power/best-performance, nvidia-smi(non-Ollama under about1.5GB), mandatory Python warm-up, npm run warm-ai, ollama ps, two authenticated recommendation calls both200. The observed cold path21.75s exceeds the unchanged20s limit; first-call503remains an expected risk. No timeout change. Manually check Explore hotel/restaurant dropdown; English/Chinese/typo hotel, restaurant and attractions queries; compound and bare N-days prompts; Kuala Lumpur Tower and KL tower searches (alias fix not delivered); dated Add/re-add; Admin report/native Save as PDF; missing/load-error photo placeholders on a build containing that branch. No B comparison flow.
