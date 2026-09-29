# Stockmind CRSM — Vercel + ChatGPT Plugin Migration Plan

Status: REVIEWED / READY  
GSA Job: J-035A  
Planning revision: 3  
Planning review: PASS

## 1. Objective

Migrate Stockmind CRSM from browser-side direct model-provider execution to a Vercel-hosted two-page workflow:

1. **Analysis List**
2. **Results**

The Screener remains computationally unchanged. It only changes how selected tickers are handed to CRSM.

ChatGPT becomes the CRSM execution brain. Invoking the Stockmind plugin is the only ChatGPT-side action required: the plugin automatically scans pending Memo work, claims eligible items, executes the CRSM pipeline, and writes durable results back for the webapp to render.

## 2. Final user flow

### 2.1 SCREENED flow

```text
TradingView
  -> Parser
  -> Screener V2
  -> Dashboard / Ranking
  -> select one or many tickers
  -> Analyze Selected / ticker action
  -> add ticker(s) to CRSM Analysis List
  -> optionally add more tickers manually
  -> Analyze
  -> write one analysis job + N items to Memo
  -> Stockmind plugin invocation
  -> automatic scan / claim / CRSM execution
  -> write durable result(s)
  -> CRSM Results page renders status and reports
```

### 2.2 DIRECT flow

```text
CRSM Analysis List
  -> manually add ticker
  -> ticker is DIRECT
  -> Analyze
  -> Memo job
  -> Stockmind plugin
  -> result
  -> Results page
```

## 3. Product boundary

### Screener stays unchanged

Do not change:
- TradingView import format
- parser semantics
- Screener V2 formulas
- weights
- ranking
- grade
- classification
- deterministic scoring

Only change the handoff:
- single ticker action adds the ticker to CRSM Analysis List
- Dashboard **Analyze Selected** adds selected tickers to CRSM Analysis List
- neither action starts AI analysis

## 4. CRSM UI: exactly two pages

### Page 1 — Analysis List

Purpose: build the editable list that will become the next analysis job.

Required UI:
- current ticker list
- manual ticker input
- Add action
- source badge: SCREENED / MANUAL
- screening-context indicator for SCREENED items
- remove ticker
- clear list
- selected count
- one primary **Analyze** button

Rules:
- SCREENED ticker carries an immutable screening snapshot captured when it enters the list
- manual ticker becomes DIRECT
- duplicate ticker appears once
- if the same ticker is added manually and from Screener, SCREENED context wins
- adding a ticker never starts AI execution
- Analyze is the only submission action
- Analyze writes one durable analysis job containing independent ticker items
- clear the draft only after Memo confirms successful submission
- failed submission must leave the draft intact

Draft persistence:
- draft is separate from Memo
- use a versioned browser-local draft schema
- draft survives navigation and reload before Analyze

Responsive behavior:
- desktop: efficient list layout and compact controls
- tablet: stacked sections
- mobile: card-based rows and reachable primary actions

There must be no third CRSM Queue/Progress page.

### Page 2 — Results

Purpose: one place for job status, history and completed analysis.

Contains:
- pending
- processing
- partial
- completed
- failed
- retry state
- latest-first history
- filters: ticker / mode / status / date
- selected result detail
- Visual Report
- Detail Report
- Decision Log

Synchronization:
- prefer realtime subscription
- reconnect automatically
- bounded polling fallback if realtime is unavailable
- user should not need manual refresh for normal status transitions

Results is the only queue/status/history/result surface.

## 5. Memo Store contract

Initial implementation target: Supabase.

Canonical records:
- `analysis_jobs`
- `analysis_items`
- `analysis_results`

One Analyze action maps to:
```text
1 analysis_job
  -> N analysis_items
  -> 0..N immutable analysis_results
```

Core identifiers and versions:
- analysis_id
- item_id
- request_version
- result_version
- pipeline_version
- mode
- ticker
- screening_context
- evidence references
- created_at / updated_at
- retry lineage
- decision_record

Required server-side operations:
- create_job
- list_jobs
- get_job
- claim_item
- heartbeat / update_item
- write_result
- fail_item
- retry_failed
- cancel_pending

Concurrency rules:
- claim must be atomic
- one item cannot be processed twice
- lease / heartbeat protects in-progress work
- stale lease can be recovered
- completed result is immutable
- retry must not overwrite completed siblings
- partial batch results remain valid

## 6. Vercel architecture

Vercel is the primary deployment surface.

Responsibilities:
- host the webapp
- expose privileged Stockmind server-side routes/functions
- keep privileged credentials server-side
- provide preview deployments for QA
- support production promote / rollback

Secrets:
- Supabase service-role credentials remain server-side
- plugin/server secrets remain server-side
- no privileged secret in browser bundle
- no model-provider API keys in browser settings after cutover

## 7. Stockmind ChatGPT plugin contract

User behavior:

```text
invoke Stockmind plugin
  -> scan pending eligible work
  -> claim work
  -> execute CRSM
  -> write result
  -> continue through discovered pending work
```

No additional user step is allowed.

The plugin must not ask the user to:
- select a job
- select a ticker
- confirm
- type run/start
- issue a second command

If no work is pending:
- return a concise no-pending-work status

Internal tools may include:
- list_pending
- get_job
- claim_item
- heartbeat
- write_result
- fail_item
- retry_failed

These are agent tools, not user-facing commands.

## 8. CRSM execution migration

Move Node 1–6 execution from browser/provider adapters into ChatGPT/plugin orchestration.

Preserve:
- SCREENED trusted-context semantics
- DIRECT behavior
- user evidence behavior
- analytical methodology
- Node 6A / 6B output compatibility

Canonical result:
- exactly one immutable `decision_record` per completed ticker
- webapp renders this record
- Node 7 localStorage append is no longer canonical

Deterministic report formatting/export may remain in the webapp as long as it only transforms returned result data.

## 9. Legacy provider cutover

Do not delete the current provider path immediately.

Temporary migration state:
- plugin path = normal target path
- existing browser/provider path = internal rollback/comparison only

Cutover gate must verify:
- SCREENED single
- SCREENED batch
- DIRECT
- pending -> processing -> result lifecycle
- partial batch failure
- retry
- Visual Report
- Detail Report
- Decision Log
- zero-step plugin behavior

Reviewer + Tester must pass the Vercel preview before deleting legacy provider code.

After PASS remove:
- Gemini/OpenAI/Ollama API-key UI
- model discovery
- node model assignment
- provider adapters
- router
- runLLM active browser path
- provider-specific pricing/cost controls
- obsolete provider telemetry/cache fingerprints
- Node 7 localStorage ownership

## 10. Implementation stages

1. Freeze current CRSM analytical/render contracts and create SCREENED + DIRECT golden fixtures.
2. Designer finalizes the exact two-page CRSM shell.
3. Define Memo schema, security, RLS, state machine and Vercel transport.
4. Implement Page 1 Analysis List and change Screener handoff to add-to-list.
5. Implement Page 2 Results with realtime/poll fallback.
6. Implement Stockmind plugin zero-step admission.
7. Move Node 1–6 execution into plugin orchestration.
8. Configure Vercel preview deployment and server-side transport.
9. Run compatibility/cutover review on preview.
10. Remove legacy direct-provider runtime after PASS.
11. Run production verification, promote preview, inspect logs and preserve rollback target.

## 11. Verification

Required checks:
- baseline and final `npm test`
- baseline and final `npm run check`
- Screener regression: calculations unchanged
- Analyze Selected -> add-to-list behavior
- manual add / multi-add / dedupe / remove / clear
- draft persistence across navigation/reload
- failed Analyze submission preserves draft
- one list -> one job + N items
- atomic claim / duplicate invocation
- stale lease recovery
- partial failure
- retry
- immutable completed result
- authorization / RLS failure cases
- no privileged secret in client bundle
- Results realtime update + polling fallback
- desktop / tablet / mobile browser QA on Vercel preview
- plugin no-work / SCREENED single / batch / DIRECT / partial / retry
- production smoke test
- Vercel deployment/log inspection
- recorded rollback target

## 12. Hard acceptance rules

The migration is not complete unless all are true:
- Screener computation is unchanged
- CRSM has exactly two pages
- Analyze Selected only adds to Analysis List
- manual tickers can be added to the same list
- Analyze writes the list to Memo and does not execute AI in browser
- Results is the only status/history/result page
- invoking Stockmind plugin is the only ChatGPT-side user action
- plugin automatically scans and processes pending work
- completed ticker has one immutable result + decision_record
- Vercel hosts the production app
- privileged secrets remain server-side
- legacy browser model-provider path is removed only after Reviewer/Tester PASS
