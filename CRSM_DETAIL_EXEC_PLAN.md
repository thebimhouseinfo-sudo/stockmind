# Stockmind CRSM — Detail Execution Plan

Status: REVIEWED / READY  
Parent architecture Job: J-2AC0 rev2  
Execution Job: J-1C2B rev2  
Planning review: PASS  
Verification: `01a0ed5e-de8c-749f-8961-233e5315c941`  
Architecture source: `CRSM_VERCEL_PLUGIN_MIGRATION_PLAN.md`

## Execution rules

- Work in bounded packs. Do not roll PACK N into PACK N+1 before its completion criteria are evidenced.
- Preserve Screener computation exactly.
- Normal CRSM UX must have exactly two pages: **Analysis List** and **Results**.
- Only one active submitted run at a time.
- Item source is exactly one of `SCREENED_WEB`, `EVIDENCE_WEB`, `WEB_ONLY`.
- Uploaded evidence belongs to exactly one `item_id/ticker`.
- Browser never executes model-provider calls in the target architecture.
- Runtime Memo lives on a dedicated `runtime` branch under `memo/`.
- Reviewer and Tester must independently PASS the same preview/source revision before legacy-provider deletion.
- Production promotion and production verification are separate packs.

## Expected target file map

Existing files likely modified:
- `src/app.js`
- `src/crsm/context.js`
- `src/crsm/user-evidence.js`
- `src/crsm/ui/index.js`
- `src/crsm/ui/analysis-dashboard.js`
- `src/crsm/ui/direct.js`
- `src/crsm/ui/progress.js`
- `src/crsm/ui/settings.js`
- `src/crsm/nodes/node1.js` … `node6b.js`
- `src/crsm/nodes/node7.js`
- `package.json`
- relevant CRSM CSS
- `README.md`
- `architect.md`

Expected new source modules:
- `src/crsm/contracts.js` or equivalent schema modules
- `src/crsm/draft-list.js`
- `src/crsm/memo-client.js`
- `src/crsm/result-adapter.js`
- `src/crsm/ui/analysis-list.js`
- `src/crsm/ui/results.js`
- `src/memo/` shared schema/state helpers or equivalent
- `api/_github-runtime.js`
- `api/crsm-submit.js`
- `api/crsm-current.js`
- `api/crsm-history.js`
- `api/crsm-retry.js`
- `api/crsm-maintenance.js`
- `plugin/stockmind/` durable admission/methodology/contracts
- `tests/fixtures/crsm/`
- CRSM contract/Memo/API/UI integration test files

Names may be adjusted to existing conventions, but responsibilities must remain separated.

## PACK 0 — Baseline, contracts, fixtures, execution ref

Owner: **Coder**

Purpose: freeze the migration contract before changing runtime behavior.

Actions:
1. Record current `master` commit and create an isolated implementation ref.
2. Run baseline:
   - `npm test`
   - `npm run check`
3. Define versioned request/result schemas.
4. Define source validators:
   - `SCREENED_WEB`: screening context required, no evidence.
   - `EVIDENCE_WEB`: evidence required and bound to item/ticker, no screening context.
   - `WEB_ONLY`: no screening context, no evidence.
5. Freeze canonical `decision_record` and renderer-required fields.
6. Create golden fixtures:
   - one SCREENED_WEB item/result;
   - one EVIDENCE_WEB item/result;
   - one WEB_ONLY item/result;
   - one mixed 3-ticker run.
7. Add tests without changing visible behavior.

Exit gate:
- old Screener tests still pass;
- invalid source combinations fail;
- wrong-ticker evidence fails;
- no UI behavior changed.

Rollback boundary: one baseline commit/ref.

## PACK 1 — Designer UI implementation spec

Owner: **Designer**

No code UI implementation yet.

Artifact must define:
- Page 1 Analysis List desktop/tablet/mobile;
- Page 2 Results desktop/tablet/mobile;
- row/card anatomy;
- source-mode badges;
- SCREENED snapshot marker;
- document attach/remove state;
- Analyze enabled/disabled/error state;
- active-run blocked state;
- current run/result/history states;
- retry state;
- empty/offline/transport-error state;
- focus and keyboard behavior;
- exact Dashboard/Ranking handoff behavior;
- existing UI/CSS modules to reuse or retire.

Hard constraint: no third Queue/Progress page.

Exit gate: Coder can implement PACK 4/5 without making a new product/UI decision.

## PACK 2 — GitHub Memo protocol + runtime branch

Owner: **Coder**

Runtime layout:

```text
runtime branch
memo/
  current.json
  index.json
  runs/<run_id>/
    request.json
    status.json
    evidence/<ticker>/<document_id>.json
    results/<ticker>.json
```

Implement:
- deterministic path helpers;
- schema validation;
- one-active-run guard;
- ordered item status transitions;
- exact-SHA conflict rules;
- terminal state derivation;
- resume ordering;
- immutable result rule;
- history index;
- index rebuild;
- orphan detection;
- manual cleanup helpers.

Status order:

```text
READY -> PROCESSING -> COMPLETED
                    -> FAILED
FAILED -> READY  // explicit retry only
```

Write order for success:

```text
status PROCESSING
-> immutable result file
-> status COMPLETED
```

Exit gate:
- protocol unit tests pass;
- second active run rejected;
- stale SHA rejected;
- completed result overwrite rejected;
- wrong-ticker evidence rejected;
- runtime branch initial Memo state valid.

## PACK 3 — Vercel GitHub bridge foundation

Owner: **Coder**

Build server-side bridge before UI depends on it.

Expected API responsibilities:
- submit new run;
- read current run;
- read history/index;
- read status/results;
- persist normalized evidence;
- retry failed ticker;
- rebuild/repair index;
- bounded cleanup operations.

Security:
- GitHub credential only in server environment;
- strict repository/branch/path allowlist;
- browser payload validation repeated server-side;
- exact-SHA compare-and-swap;
- fail closed on stale state.

Tests use mocked GitHub transport first.

Exit gate:
- happy-path submit/read;
- active-run conflict;
- stale SHA;
- evidence ownership violation;
- retry;
- index rebuild;
- browser code cannot import privileged helper/token.

## PACK 4 — Analysis List + Screener handoff

Owner: **Coder**  
Requires: PACK 1 + PACK 3.

Change current behavior:
- ticker click no longer calls `runCRSM()`;
- Dashboard **Analyze Selected** no longer calls batch CRSM;
- both add ticker(s) into Analysis List.

Page 1:
- versioned local draft;
- manual add;
- remove/clear;
- dedupe;
- source-mode display;
- SCREENED_WEB snapshot captured at add time;
- WEB_ONLY manual item;
- EVIDENCE_WEB per-ticker attachment;
- stable `document_id + item_id + ticker`;
- Analyze submits through bridge;
- clear draft only after full success;
- preserve draft on failure;
- active current run blocks a second submission.

Legacy direct execution code stays in repo but is removed from normal user actions.

Exit gate:
- reload preserves draft;
- submit failure preserves draft;
- wrong-ticker evidence impossible/rejected;
- Screener output equals baseline fixtures;
- no browser provider call from normal CRSM UI.

## PACK 5 — Results + compatibility adapter

Owner: **Coder**  
Requires: PACK 1 + PACK 3 + PACK 4.

Page 2:
- current run summary;
- ticker READY/PROCESSING/COMPLETED/FAILED;
- historical runs;
- selected result;
- Visual Report;
- Detail Report;
- Decision Log;
- retry failed ticker;
- repairable index-error state.

Polling:
- start only when Results visible;
- stop on navigation/unmount;
- prevent duplicate timers;
- manual refresh after transport failure.

Create result adapter so existing report/export renderers can consume immutable plugin result JSON.

Exit gate:
- fixture results render without `runCRSM()`;
- canonical decision_record drives Decision Log;
- completed sibling result is unchanged by retry;
- exactly two normal CRSM pages remain.

## PACK 6 — Private Stockmind plugin + zero-step admission

Owner: **Coder / plugin deployment task**

Durable plugin source lives in repo under a dedicated plugin contract folder.

Admission:

```text
Stockmind invoked
-> read runtime:memo/current.json
-> no actionable run: concise status
-> actionable run: load request/status and start processing
```

Internal tool boundary:
- fixed repository;
- fixed `runtime` branch;
- fixed `memo/` path;
- read current/request/status/evidence;
- exact-SHA status writes;
- create immutable result;
- update current/index.

No user-facing:
- job selection;
- ticker selection;
- mode selection;
- run/start;
- confirm.

Before porting CRSM methodology, verify plugin can read a fixture run and perform a bounded non-analytical status round trip.

Exit gate:
- private plugin installed/connected;
- bare invocation needs zero extra commands;
- boundary test proves no write outside runtime Memo path.

## PACK 7 — Sequential CRSM methodology port

Owner: **Coder**

Translate current Node 1–6 methodology/prompt contracts into durable plugin-readable artifacts.

Ticker execution:

```text
validate item
-> READY -> PROCESSING
-> run CRSM for one ticker
-> create Node6-compatible outputs
-> create immutable result + decision_record
-> PROCESSING -> COMPLETED
-> advance to next ticker
```

Source rules:
- SCREENED_WEB = trusted Screener snapshot + web;
- EVIDENCE_WEB = only that ticker's evidence + web;
- WEB_ONLY = web only.

Across tickers: strictly sequential.  
Inside one ticker: preserve existing dependency-safe parallelism only if methodology already permits it.

Failure:
- mark only current ticker FAILED;
- preserve completed siblings;
- next invocation resumes first unfinished item;
- skip already completed immutable results.

Exit gate:
- all three golden cases render;
- mixed 3-ticker list is sequential;
- interruption/resume has no duplicate result;
- one decision_record per completed ticker;
- no browser provider path involved.

## PACK 8 — Integrated Vercel preview

Owner: **Coder**

Deploy exact implementation revision to Vercel preview, not production.

Verify:
- Screen;
- Dashboard;
- Ranking;
- Analysis List;
- Results;
- api bridge;
- assets/modules;
- runtime Memo commits do not trigger preview/deploy churn.

Record:
- source commit;
- preview deployment/revision;
- rollback baseline.

Exit gate: one immutable target exists for Reviewer and Tester.

## PACK 9 — Reviewer compatibility gate

Owner: **Reviewer**

Review exact PACK 8 revision:
- source diff;
- Screener non-regression;
- three source contracts;
- evidence ownership;
- Memo state machine;
- sequential execution;
- resume;
- immutable results;
- result/render compatibility;
- legacy path not prematurely removed.

Result: PASS or findings.

**PACK 11 is blocked unless PASS.**

## PACK 10 — Tester preview E2E gate

Owner: **Tester**

Against same PACK 8 preview/source revision:
- desktop/tablet/mobile;
- Analyze Selected add-to-list;
- single ticker add-to-list;
- manual WEB_ONLY;
- EVIDENCE_WEB upload/binding;
- failed submit preserves draft;
- bare Stockmind with no work;
- all three source modes;
- mixed sequential run;
- failure/resume;
- Results polling/history/report rendering;
- no second ChatGPT command.

**PACK 11 is blocked unless PASS.**

## PACK 11 — Legacy provider cleanup

Owner: **Coder**  
Requires: PACK 9 PASS + PACK 10 PASS on same revision.

Remove:
- provider API-key UI;
- provider/model discovery;
- model assignment UI;
- provider adapters;
- active browser router/runLLM path;
- obsolete provider cost controls;
- Node7 localStorage canonical ownership;
- obsolete CRSM progress/run UI when unreferenced.

Then:
- full test/check;
- source/secret scan;
- docs update;
- produce cleanup candidate preview;
- keep pre-cleanup PASS revision as rollback point.

Exit gate:
- no reachable browser model-provider path;
- no privileged GitHub secret client path;
- full regression green.

## PACK 12 — Production promotion

Owner: **Coder**

- smoke cleanup candidate preview;
- promote exact verified cleanup candidate;
- record production deployment;
- record known-good rollback deployment;
- make no unreviewed source changes during promotion.

Do not complete Job yet.

## PACK 13 — Production verification

Owner: **Tester**

- smoke Screen/Dashboard/Ranking;
- smoke Analysis List/Results;
- bounded real Memo submit/read cycle;
- verify plugin reads/writes production-compatible Memo contract;
- inspect deployment/function logs;
- record final verification and rollback target.

Job can complete only after this evidence exists.

## Mandatory command/evidence matrix

| Boundary | Required evidence |
|---|---|
| Baseline | `npm test`, `npm run check`, baseline commit |
| Contracts | source-mode + evidence ownership tests |
| Memo | state transition, stale SHA, one-active-run, immutable result, index rebuild |
| Bridge | mocked GitHub API tests and client-secret boundary |
| Page 1 | draft/reload/failure + Screener regression |
| Page 2 | polling/history/adapter/retry |
| Plugin | connection + path-boundary + zero-step admission |
| Pipeline | 3 source modes + mixed sequential + resume |
| Preview | exact source + exact Vercel preview |
| Cutover | independent Reviewer PASS + Tester PASS |
| Cleanup | post-delete test/check + secret/source scan |
| Production | deployment/log/smoke + rollback reference |

## Stop / escalate conditions

Stop and return to Human if implementation would require:
- a database or Supabase;
- multiple active analysis lists;
- a second source repository;
- another required user command after invoking Stockmind;
- changes to Screener formulas/parser/ranking;
- material changes to CRSM analytical methodology;
- automatic destructive Memo retention.
