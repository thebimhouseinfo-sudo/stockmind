# Stockmind CRSM — Single-user GitHub Memo + Vercel + ChatGPT Plugin Plan

Status: PLANNING REVIEW PASS / READY  
GSA Job: J-2AC0  
Planning revision: 2  
Planning review: PASS  
Prior CR: J-035A rev3 FAIL, now superseded by this replacement plan. A new CRITIC_REVIEW is pending only if Human invokes CR again.

## 1. Final architecture

Stockmind is a **personal single-user app**.

There is:
- one Stockmind webapp deployed on Vercel;
- one editable CRSM Analysis List in the browser;
- at most one submitted/active analysis run at a time;
- one fixed GitHub `memo/` folder used as durable runtime state;
- one private Stockmind ChatGPT plugin;
- no Supabase;
- no tenant/account/RLS layer;
- no multi-list queue.

The plugin does not ask the user to choose a ticker, job, mode, or command. A bare invocation means:

```text
read memo/current.json
-> load current run
-> process ticker 1 through CRSM
-> write result/status
-> process ticker 2
-> ...
-> finalize run/index
```

If a host/runtime interruption occurs, the next bare Stockmind invocation resumes automatically from the first unfinished ticker and skips completed results.

## 2. Screener boundary

Keep unchanged:
- TradingView import;
- parser semantics;
- Screener V2 formulas;
- weights;
- ranking;
- grade;
- classification;
- deterministic scoring.

Only handoff changes:
- single ticker CRSM action -> add ticker to Analysis List;
- Dashboard **Analyze Selected** -> add selected tickers to Analysis List;
- neither action starts AI analysis.

## 3. CRSM UI — exactly two pages

### Page 1 — Analysis List

This is the only editing/submission page.

Functions:
- add ticker manually;
- receive ticker(s) from Screener / Dashboard;
- dedupe ticker;
- remove ticker;
- clear draft;
- show source mode per ticker;
- attach documents to the correct ticker;
- one primary **Analyze** button.

The editable draft is stored locally with a versioned browser schema and survives navigation/reload. It is cleared only after the GitHub Memo submission succeeds.

A second submitted run cannot be created while the current run is non-terminal.

### Page 2 — Results

This is the only:
- current-status page;
- history page;
- result page.

It shows:
- READY;
- PROCESSING;
- COMPLETED;
- FAILED;
- terminal run history;
- Visual Report;
- Detail Report;
- Decision Log;
- retry for failed ticker only.

Results polls Memo only while visible. Polling stops when hidden. Transport failure exposes manual refresh.

There is **no third Queue/Progress page**.

## 4. Three analysis sources

Every ticker has exactly one `analysis_source`.

### 4.1 SCREENED_WEB

Input:
- ticker;
- frozen TradingView/Screener snapshot;
- web search through the CRSM pipeline.

Required:
- `screening_context != null`
- `evidence_refs = []`

This is the default when a ticker comes from Screener/Dashboard.

### 4.2 EVIDENCE_WEB

Input:
- ticker;
- one or more uploaded documents belonging specifically to that ticker;
- web search through the CRSM pipeline.

Required:
- `screening_context = null`
- one or more `evidence_refs`

Each document has:
- `document_id`
- `item_id`
- `ticker`
- original filename
- MIME/type
- checksum/size
- routing metadata
- extracted normalized content
- repository path

The plugin must reject a document if its `item_id/ticker` does not match the ticker currently being analysed.

A manual ticker with uploaded documents becomes EVIDENCE_WEB.

### 4.3 WEB_ONLY

Input:
- ticker;
- web search only.

Required:
- `screening_context = null`
- `evidence_refs = []`

A manual ticker with no documents defaults to WEB_ONLY.

## 5. Managed GitHub Memo folder

Target repository: `thebimhouseinfo-sudo/stockmind`  
Runtime branch: `runtime`  
Runtime folder: `memo/`

The runtime branch must be excluded from normal Vercel deployment triggers.

Canonical layout:

```text
memo/
  current.json
  index.json

  runs/
    <run_id>/
      request.json
      status.json

      evidence/
        <ticker>/
          <document_id>.json

      results/
        <ticker>.json
```

### current.json

Small pointer/summary for the one current run.

Contains:
- schema_version;
- run_id;
- state;
- created_at;
- updated_at;
- request_ref;
- status_ref.

At most one current run may be READY/PROCESSING.

### request.json

Immutable after submission.

Contains ordered ticker items:
- item_id;
- ticker;
- analysis_source;
- screening_context or null;
- evidence_refs[];
- pipeline_version;
- created_at.

### status.json

Mutable state file.

Per ticker:
- READY;
- PROCESSING;
- COMPLETED;
- FAILED;
- error;
- result_ref;
- timestamps.

All updates use GitHub exact-SHA optimistic concurrency.

Before analysing an item:

```text
READY -> PROCESSING
commit status
```

After successful analysis:

```text
write immutable result
-> PROCESSING -> COMPLETED
-> commit status
```

This ordering prevents status from claiming completion before the result exists.

### evidence/

Stores the normalized extracted evidence payload used by ChatGPT.

The current browser extraction logic for PDF/XLSX/CSV/TXT/etc. can be adapted so the plugin reads a stable text/structure payload rather than depending on browser memory.

Evidence belongs to exactly one ticker/item.

### results/

One immutable canonical result per completed ticker.

Includes:
- CRSM node outputs required for renderers;
- report data;
- one canonical `decision_record`;
- result_version;
- item_id;
- ticker;
- source mode;
- timestamps.

Normal retry must never overwrite an existing completed result.

### index.json

Catalog of historical runs so Results can browse older analyses after a new run becomes current.

Memo management includes:
- append/update run summary;
- index repair/rebuild from `memo/runs/`;
- orphan detection;
- retry/resume;
- manual cleanup of old terminal run/evidence directories.

First version has **no automatic destructive retention policy**.

## 6. Vercel bridge

The current app is browser/static, therefore Vercel adds a small server-side bridge.

Server routes/modules:
- submit run;
- read current;
- read index;
- read status/result;
- write ticker evidence;
- retry failed ticker;
- Memo repair/maintenance operations.

Rules:
- GitHub credentials stay only in Vercel environment variables;
- browser never receives a GitHub write token;
- exact-SHA conflicts fail closed;
- a second active run submission fails closed;
- bridge contract is implemented/tested **before** Page 1/Page 2 integration;
- runtime-branch Memo commits must not create deploy loops or preview churn.

## 7. Stockmind private ChatGPT plugin

A private plugin is explicitly created and registered.

Admission behavior is fixed:

```text
Stockmind invoked
-> read stockmind/runtime/memo/current.json
-> if no actionable current run: return concise status
-> load request/status
-> process ordered items sequentially
-> write each result/status
-> finalize current/index
```

No additional user interaction:
- no list selection;
- no ticker selection;
- no source-mode question;
- no run/start;
- no confirmation.

The plugin uses bounded GitHub operations only against the fixed Stockmind runtime Memo location.

## 8. Sequential CRSM execution

Ticker-level execution is sequential.

For each item:

```text
load item
-> validate source contract
-> mark PROCESSING
-> CRSM pipeline for this ticker
-> write immutable result
-> mark COMPLETED
-> next ticker
```

Within one ticker, the current CRSM dependency rules may still use safe internal parallelism where already supported by methodology, but the plugin must finish ticker A before moving to ticker B.

Source behavior:
- SCREENED_WEB -> trusted Screener context + web;
- EVIDENCE_WEB -> only that ticker's attached evidence + web;
- WEB_ONLY -> web only.

Preserve the existing Node 1–6 analytical methodology and report contracts.

Node 7 localStorage append stops being canonical. The immutable result contains exactly one canonical decision record.

## 9. Failure and resume

If one ticker fails:
- mark that item FAILED;
- never invalidate completed sibling results;
- retry sets only that failed item back to READY;
- repeated/bare invocation resumes unfinished work;
- already completed ticker results are skipped.

When all items are terminal:
- run becomes COMPLETED or PARTIAL;
- current/index summaries are updated;
- run directory remains available as history.

Because this is single-user, there is no product-level queue sizing architecture. The design is resumable rather than multi-tenant/queue-oriented.

## 10. Implementation topology

1. Freeze current CRSM request/result contracts and create fixtures for all three source modes.
2. **Designer** finalizes the exact two-page UI and evidence interaction.
3. Define GitHub Memo layout/state/evidence contract.
4. Implement/test Vercel GitHub bridge foundation.
5. Implement Page 1 Analysis List + Screener add-to-list.
6. Implement Page 2 Results.
7. Create/register the private Stockmind plugin.
8. Move CRSM execution into sequential plugin processing.
9. Deploy integrated Vercel preview and verify runtime-branch isolation.
10. **Reviewer** compatibility/cutover gate.
11. **Tester** Vercel preview E2E gate.
12. Remove legacy provider runtime only after both gates PASS.
13. **Tester** production verification and release.

## 11. Cutover gate

Keep the old direct-provider path as internal comparison/rollback only until the new path proves:

- SCREENED_WEB;
- EVIDENCE_WEB;
- WEB_ONLY;
- single ticker;
- multi-ticker sequential run;
- interruption/resume;
- wrong-ticker evidence rejection;
- failed ticker retry;
- immutable completed result;
- Visual Report;
- Detail Report;
- Decision Log;
- zero-step plugin invocation;
- two-page UI on Vercel preview.

Reviewer + Tester must PASS before deleting legacy provider code.

## 12. Legacy removal

After cutover PASS remove:
- browser Gemini/OpenAI/Ollama API keys;
- provider/model discovery;
- model assignments;
- provider adapters;
- router/runLLM active browser path;
- provider pricing/cost controls;
- obsolete provider usage/cache logic;
- Node 7 localStorage canonical ownership;
- obsolete Supabase/multi-user/multi-job documentation.

## 13. Verification

Required:
- `npm test`;
- `npm run check`;
- Screener regression;
- add-to-list behavior;
- local draft persistence;
- three source-mode validation;
- ticker-bound evidence and wrong-ticker rejection;
- second-active-run rejection;
- exact-SHA conflicts;
- Memo archive/index/rebuild/orphan/manual-cleanup;
- Results polling/history/render;
- private plugin registration/connection;
- bare invocation with no work;
- bare invocation SCREENED_WEB;
- bare invocation EVIDENCE_WEB;
- bare invocation WEB_ONLY;
- multi-ticker sequential run;
- failure/retry/resume;
- no duplicate completed result;
- Vercel desktop/tablet/mobile QA;
- preview cutover gates;
- production smoke/log inspection;
- rollback target.

## 14. Hard acceptance rules

Migration is complete only when:
- Screener calculation is unchanged;
- CRSM has exactly two pages;
- one active submitted list at a time;
- each ticker has one of the three source modes;
- each uploaded document has a ticker/item owner;
- Analyze writes GitHub Memo and never runs AI in browser;
- Memo has current + history + evidence + immutable results + maintenance;
- private Stockmind plugin bare invocation starts automatically;
- plugin processes tickers sequentially;
- Results is the only status/history/result page;
- Vercel holds GitHub credentials server-side;
- Reviewer and Tester pass cutover;
- legacy browser-provider runtime is removed only after that gate.
