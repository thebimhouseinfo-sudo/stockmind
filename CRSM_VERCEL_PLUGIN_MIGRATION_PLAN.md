# Stockmind CRSM — Single-User GitHub Memo + Vercel + ChatGPT Plugin Plan

Status: REVIEWED / READY  
GSA Job: J-47BD  
Planning revision: 3  
Planning review: PASS  
Previous plan J-035A: SUPERSEDED

## 1. Product model

Stockmind is a **personal single-user app**.

There is:
- one Stockmind repository;
- one fixed GitHub Memo folder;
- one submitted active Analysis List at a time;
- no tenant/account-linking layer;
- no Supabase/database queue;
- no multiple pending Analysis Lists.

The Screener remains deterministic. CRSM becomes a two-page web workflow, while ChatGPT executes the analysis.

## 2. Final flow

### SCREENED

```text
TradingView
  -> Parser
  -> Screener V2
  -> Dashboard / Ranking
  -> select ticker(s)
  -> Analyze Selected / ticker action
  -> add to CRSM Analysis List
  -> optionally add more tickers manually
  -> Analyze
  -> Vercel writes one current list into GitHub Memo
  -> invoke Stockmind plugin
  -> plugin reads current list
  -> ticker 1: full CRSM pipeline -> result
  -> ticker 2: full CRSM pipeline -> result
  -> ...
  -> update GitHub Memo after each ticker
  -> Results page polls GitHub Memo and renders output
```

### DIRECT

```text
CRSM Analysis List
  -> manually add ticker
  -> DIRECT item
  -> Analyze
  -> GitHub Memo current list
  -> invoke Stockmind plugin
  -> sequential CRSM execution
  -> Results
```

## 3. Screener boundary

Do not change:
- TradingView import;
- parser semantics;
- Screener V2 formulas;
- thresholds/weights;
- ranking;
- grade;
- classification;
- deterministic score computation.

Only change the handoff:
- single ticker action adds that ticker to CRSM Analysis List;
- Dashboard **Analyze Selected** adds all selected tickers to the same CRSM Analysis List;
- these actions never start CRSM AI execution.

## 4. CRSM UI — exactly two pages

### Page 1 — Analysis List

Purpose: build the one draft list to submit.

Required controls:
- ticker list;
- manual ticker input;
- Add;
- source badge: SCREENED / MANUAL;
- screening-context marker;
- optional evidence attachment per ticker;
- remove ticker;
- clear draft;
- selected count;
- one primary **Analyze** button.

Rules:
- SCREENED items retain frozen Screener context;
- manual items are DIRECT;
- duplicates appear once;
- if the same ticker is added manually and from Screener, SCREENED context wins;
- draft survives navigation/reload using a versioned browser-local schema;
- initial maximum list size is **10 tickers**;
- adding tickers never runs AI;
- only one submitted active list may exist;
- while GitHub `memo/current.json` is READY or PROCESSING, Analyze is disabled;
- Analyze clears the local draft only after GitHub write succeeds;
- failed submission preserves the draft.

### Page 2 — Results

This is the only runtime status/history/result page.

It shows:
- current list state;
- ticker READY / PROCESSING / COMPLETED / FAILED;
- historical results;
- Visual Report;
- Detail Report;
- Decision Log;
- retry for failed ticker only.

Synchronization:
- bounded polling while Results is visible;
- polling stops while page is hidden;
- manual refresh fallback on error;
- no realtime database;
- no third Queue/Progress page.

## 5. GitHub Memo contract

The `stockmind` repository is private.

Runtime state uses a **dedicated runtime branch** in the same repository, separate from the Vercel deployment branch.

Canonical paths:

```text
memo/
  current.json

  results/
    index.json
    <run_id>/
      <ticker>.json

  evidence/
    <run_id>/
      <ticker>/
        ...
```

### current.json

Contains:
- schema_version;
- run_id;
- state;
- created_at;
- updated_at;
- ordered items.

Each item contains:
- ticker;
- mode: SCREENED | DIRECT;
- screening_context when SCREENED;
- evidence_refs;
- item_status;
- error;
- result_ref.

### State rules

Only one current list is active.

A new current list may be created/replaced only when the previous list is not READY or PROCESSING.

Per ticker:

```text
READY
  -> PROCESSING
  -> COMPLETED
     or FAILED
```

Before analyzing a ticker:
1. read current.json;
2. exact-SHA update that ticker to PROCESSING;
3. run CRSM;
4. write immutable result file;
5. exact-SHA update ticker to COMPLETED + result_ref.

This ordering prevents a COMPLETED state without a durable result.

Repeated plugin invocation:
- reads the same current.json;
- skips completed items;
- resumes the first unfinished/retriable item;
- never creates another list.

## 6. User evidence

Existing CRSM evidence support is preserved.

Evidence is **per ticker**, never implicitly shared across all tickers.

The existing browser extraction flow may continue converting supported files such as PDF/XLSX/CSV/TXT/MD/JSON into normalized evidence.

On Analyze:
- extracted evidence is persisted under the ticker's GitHub evidence path;
- current.json stores evidence_refs;
- plugin loads only the refs belonging to the ticker currently being processed.

A retry uses the same evidence refs unless the user explicitly replaces the draft before a new run.

## 7. Stockmind ChatGPT plugin

Stockmind is a **private plugin** for this personal app.

Its admission contract is intentionally simple.

User action:

```text
invoke Stockmind plugin
```

Plugin behavior:

```text
read fixed repo / runtime branch / memo/current.json
  -> validate schema/state
  -> find first unfinished ticker
  -> mark PROCESSING
  -> run CRSM pipeline
  -> write result
  -> mark COMPLETED or FAILED
  -> move to next ticker
  -> continue sequentially
  -> update results/index.json
  -> finish
```

The plugin must not ask the user to:
- choose a list;
- choose a ticker;
- type run/start;
- confirm;
- issue another command.

If no active list exists, return a concise no-work status.

Plugin implementation must include:
- private plugin/harness creation;
- binding to the fixed repository/runtime branch/Memo folder;
- required GitHub connector permissions;
- installation/connection verification;
- read/write verification against the configured Memo paths.

## 8. Sequential CRSM execution

Tickers are sequential.

For each ticker, preserve the existing CRSM analytical methodology and dependency graph.

Conceptually:

```text
Ticker A
  -> Node 1
  -> Node 2 / Node 3 as methodology permits
  -> Node 4
  -> Node 5
  -> Node 6A / Node 6B
  -> immutable result + decision_record
  -> COMPLETE A

Ticker B
  -> full pipeline
  -> COMPLETE B
```

The plugin must finish one ticker before starting the next ticker.

Node-level internal parallelism may remain only where the existing CRSM dependency model already permits it. That does not change the ticker-level sequential rule.

Each completed ticker has exactly:
- one immutable result;
- one canonical `decision_record`.

Node 7 localStorage append is no longer the canonical Decision Log write path.

## 9. Vercel architecture

Vercel hosts:
- the webapp;
- server-side GitHub bridge routes.

Server routes cover:
- write current list;
- read current list;
- read result history/result files;
- persist evidence;
- retry a failed item.

GitHub credentials:
- stay in Vercel environment variables;
- never enter browser code.

### Owner-only access

This is a single-user personal application, but privileged routes still require access control.

Production/preview access and privileged API routes must use an **owner-only gate**, such as Vercel Authentication / Deployment Protection or an equivalent server-validated owner session.

Unauthenticated requests must be rejected **before any GitHub API call**.

### Runtime branch deployment isolation

The GitHub runtime Memo branch must be explicitly excluded from Vercel Git deployment generation.

It is not sufficient to merely make it a non-production branch.

Verification must prove:

```text
commit memo/current.json on runtime branch
  -> no Vercel production deploy
  -> no Vercel preview deploy
```

## 10. Legacy provider cutover

Do not delete the current browser-provider CRSM path immediately.

During migration:
- new plugin/GitHub path = target normal flow;
- legacy direct provider path = internal comparison/rollback only.

Cutover verifies:
- SCREENED;
- DIRECT;
- one ticker;
- capped multi-ticker list;
- sequential order;
- evidence scoping;
- failure/retry;
- reinvocation/resume;
- Visual Report;
- Detail Report;
- Decision Log;
- Results polling;
- bare plugin invocation.

Reviewer + Tester must PASS before deleting legacy provider runtime.

After PASS remove:
- Gemini/OpenAI/Ollama API-key UI;
- provider/model discovery;
- node model assignment;
- provider adapters;
- router;
- browser `runLLM`;
- provider pricing/cost controls;
- obsolete provider telemetry/cache fingerprints;
- Node 7 localStorage canonical ownership.

## 11. Implementation stages

1. Freeze existing CRSM analytical/render contracts and create golden fixtures.
2. Designer finalizes the exact two-page, single-list UI.
3. Define GitHub Memo schema/state/exact-SHA rules.
4. Implement Analysis List and Screener add-to-list handoff.
5. Implement Results over GitHub Memo.
6. Create/register/connect the private Stockmind plugin.
7. Move Node 1–6 into sequential plugin execution.
8. Add Vercel deployment, owner-only GitHub bridge, and runtime-branch deploy exclusion.
9. Run Reviewer + Tester compatibility/cutover gate.
10. Remove legacy provider runtime.
11. Production verification and release.

## 12. Verification

Required:
- baseline/final `npm test`;
- baseline/final `npm run check`;
- Screener regression unchanged;
- Analyze Selected -> add-to-list;
- manual add;
- dedupe/remove/clear;
- draft survives reload;
- failed GitHub submission preserves draft;
- one-active-list guard;
- 10-item cap;
- exact-SHA READY->PROCESSING->COMPLETED transitions;
- result-before-COMPLETED ordering;
- per-ticker evidence isolation;
- retry failed ticker without touching completed siblings;
- repeated plugin invocation skips completed work;
- Results polling/history/render;
- private plugin registration/connection;
- bare invocation with no list;
- bare invocation with one ticker;
- bare invocation with capped multi-ticker list;
- owner-only route negative test;
- no GitHub secret in browser;
- runtime branch commit creates no Vercel deployment;
- desktop/tablet/mobile preview QA;
- production smoke/log inspection;
- rollback target retained.

## 13. Hard acceptance rules

Migration is complete only when:
- Screener calculations are unchanged;
- CRSM has exactly two pages;
- exactly one active submitted list exists;
- Screener and manual tickers feed the same Analysis List;
- Analyze writes GitHub Memo and does not run AI in browser;
- plugin invocation is the only ChatGPT-side user action;
- plugin reads the fixed current list directly from GitHub;
- tickers are processed sequentially;
- results are immutable and written back to GitHub;
- Results is the sole status/history/result page;
- privileged Vercel routes are owner-only;
- runtime Memo commits do not generate Vercel deployments;
- legacy provider runtime is removed only after Reviewer/Tester PASS.
