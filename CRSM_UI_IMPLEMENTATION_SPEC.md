# Stockmind CRSM — UI Implementation Spec

Status: PACK 1 DESIGNER COMPLETE  
Parent execution Job: J-1C2B  
Target branch: `crsm-memo-migration`  
Target baseline for design: `fd43e069c9f010bc52d4246d3180b22f5d41b060`

## 1. Design boundary

Keep the existing Stock Mind visual system:
- sticky white topbar;
- Inter/system typography;
- `--blue` primary accent;
- white panels on `--bg`;
- existing `.panel`, `.btn`, `.tabs`, `.table-wrap`, `.muted` primitives;
- existing max-width shell.

Do not redesign Screen, Dashboard or Ranking. Only CRSM handoff text/action behavior changes.

Normal CRSM navigation has exactly two subpages:

```text
CRSM
  Analysis List
  Results
```

No Queue page. No Node Progress page. No model/provider settings inside the new normal CRSM flow.

## 2. Global CRSM subnav

Inside the existing top-level `CRSM` tab, use the current subnav location.

Labels:
- `Analysis List`
- `Results`

Behavior:
- entering CRSM opens `Analysis List`;
- Dashboard/Ranking handoff navigates directly to `Analysis List`;
- after a successful Analyze submission, navigate to `Results`;
- Results stays selected on refresh while its route/view is active.

Do not use an extra wizard step.

## 3. Analysis source presentation

Human-facing labels:

| Contract | UI label | Meaning |
|---|---|---|
| `SCREENED_WEB` | Screener + Web | Frozen TradingView/Screener snapshot plus web research |
| `EVIDENCE_WEB` | Documents + Web | Documents belonging to this ticker plus web research |
| `WEB_ONLY` | Web only | Web research with no Screener snapshot and no document evidence |

Source mode is always visible as text, not color-only.

### Source transition rules

1. Ticker added from Screener/Dashboard is created as `SCREENED_WEB`.
2. Manually added ticker with no document is created as `WEB_ONLY`.
3. On a manual `WEB_ONLY` item, adding the first document explicitly changes the item to `EVIDENCE_WEB`.
4. Removing the last document from an `EVIDENCE_WEB` item explicitly returns it to `WEB_ONLY`.
5. `SCREENED_WEB` does not expose document attachment controls because the approved contract forbids mixed Screener/evidence input.
6. Duplicate ticker add never changes the existing source automatically. Preserve the existing item and show a small non-blocking notice such as `VCB đã có trong Analysis List`.
7. To change a `SCREENED_WEB` ticker into a document-driven analysis, the user removes that item and manually adds the ticker again, then attaches documents. This avoids hidden source mutation.

## 4. Page 1 — Analysis List

### 4.1 Desktop structure

Use one main panel under a compact page header.

```text
Analysis List
Prepare tickers before sending them to Stockmind.

[ Ticker input________________ ] [ Add ]

--------------------------------------------------------
Ticker | Source | Context / Documents | Action
--------------------------------------------------------
VCB    | Screener + Web | Rank #1 · Grade A | Remove
HPG    | Documents + Web | 2 documents      | Remove
FPT    | Web only        | Web research only| Remove
--------------------------------------------------------

[ Clear list ]                         [ Analyze ]
```

Recommended desktop content width: existing `.main` max width.  
Do not introduce a fixed narrow modal or wizard.

### 4.2 Page header

Left:
- eyebrow: `CRSM`;
- H1: `Analysis List`;
- helper: `Chuẩn bị danh sách mã trước khi gửi sang Stockmind.`

Right:
- if no active submitted run: no extra status control;
- if a submitted run is READY/PROCESSING: show a compact info banner across the panel, not a separate page:
  - `Analysis đang chạy`
  - `Xem Results →`
  - all add/remove/Analyze controls disabled while the active run is non-terminal.

This keeps one operational list model and avoids preparing a second hidden list while another run is active.

### 4.3 Manual ticker composer

One row:
- text input placeholder: `Nhập mã, ví dụ VCB`;
- primary/secondary action: `Add`.

Rules:
- normalize to uppercase on submit;
- reject blank/invalid ticker inline;
- duplicate ticker shows non-blocking notice;
- successful add places focus back in ticker input on desktop;
- manual add creates `WEB_ONLY`.

No source dropdown.

### 4.4 Item row anatomy

Each item row/card contains:

**Ticker block**
- ticker large/bold;
- optional small origin line:
  - Screener item: `Added from Screener`;
  - manual item: `Added manually`.

**Source badge**
- exact human-readable label from section 3.

**Context area**

For `SCREENED_WEB`:
- compact snapshot summary using available data only:
  - rank;
  - grade;
  - final Screener V2 score if present;
  - industry if present;
- a small secondary label: `Snapshot frozen when added`.

Do not display full Screener details on this page.

For `WEB_ONLY`:
- text: `No attached evidence`;
- action: `Attach documents`.

For `EVIDENCE_WEB`:
- compact list of attached document chips:
  - filename;
  - remove control;
- secondary action: `Add documents`;
- document count;
- every chip belongs to this ticker row visually and structurally.

**Row action**
- `Remove` text button.

### 4.5 Evidence interaction

Use the browser file picker tied to the row being edited.

After parsing:
- show filename immediately;
- show a brief parsing state;
- on extraction failure show error under that row only;
- successful document creates stable `document_id` and remains visibly attached to the current ticker.

Do not create a global evidence tray.

Multiple documents for the same ticker are allowed.

If the final document is removed:
- source badge changes from `Documents + Web` to `Web only`;
- no confirmation dialog is required because the user explicitly removed the evidence.

### 4.6 Empty state

When draft list is empty:

```text
No tickers yet
Add a ticker manually or choose tickers from Screener.
[ ticker input ] [ Add ]
```

Keep the composer available; do not show a full-page illustration.

### 4.7 Analyze action

Primary button label: `Analyze`.

Enabled only when:
- draft has at least one valid item;
- no item has evidence extraction error;
- no active submitted run exists;
- no submission is currently in flight.

During submit:
- button text `Submitting…`;
- disable edit controls;
- do not clear draft until bridge confirms request/status/current/index/evidence writes all succeeded.

On success:
- clear local draft;
- navigate to Results.

On transport/conflict failure:
- preserve draft;
- show compact error banner above action row;
- keep user on Analysis List.

### 4.8 Clear list

Secondary danger-neutral action:
- label `Clear list`;
- disabled when list empty;
- single-user personal app: no modal required unless evidence files are attached; with evidence attached, use a lightweight confirm because local extracted content will be discarded.

## 5. Screener / Dashboard handoff

### Dashboard

Keep the existing multi-selection mechanism.

The existing user-facing `Analyze Selected` action changes behavior only:
- add selected tickers to Analysis List as `SCREENED_WEB`;
- dedupe against existing draft;
- navigate to CRSM → Analysis List;
- show notice: `N mã đã được thêm vào Analysis List`.

Do not start AI.

### Ranking / Detail

Existing single ticker CRSM action changes to add-to-list behavior.

To minimize unrelated visual churn, existing button placement is retained. The label may remain `Phân tích bằng CRSM →` during migration, but the action must add the ticker to Analysis List and navigate there. Do not show node progress.

## 6. Page 2 — Results

Results is the only current status, history and result-detail surface.

### 6.1 Desktop layout

Use a two-column layout inside the current max-width shell:

```text
Results
Current run summary

+----------------------+-----------------------------------+
| Current / History    | Selected ticker result            |
|                      |                                   |
| VCB  Processing      | VCB · Screener + Web              |
| HPG  Ready           | [summary metrics/status]          |
| FPT  Completed       |                                   |
|                      | Visual | Detail | Decision Log    |
| History              |                                   |
| 29 Sep · 3 tickers   | result content                    |
| 27 Sep · 1 ticker    |                                   |
+----------------------+-----------------------------------+
```

Suggested desktop grid:
- left rail: 280–340 px;
- right result panel: remaining flexible width.

### 6.2 Current run summary

Header shows:
- `Current run`;
- run status: READY / PROCESSING / COMPLETED / PARTIAL;
- created time;
- completed count `2/3`.

Do not expose internal GitHub SHA/path IDs in normal UI.

### 6.3 Ticker status rows

Each ticker row displays:
- ticker;
- source label;
- textual state:
  - `Waiting` for READY;
  - `Processing`;
  - `Completed`;
  - `Failed`.

Use icons/colors only as support. Text is mandatory.

For PROCESSING:
- subtle spinner only;
- no Node 1–6 tree.

For FAILED:
- one-line diagnostic;
- `Retry` button.

For COMPLETED:
- row selectable;
- selecting loads immutable result.

For READY:
- selectable for status context, but result detail shows `Waiting for analysis`.

### 6.4 History

Below Current run in the left rail.

Each historical run item:
- date/time;
- ticker count;
- terminal state;
- optional compact summary such as `3 completed` or `2 completed · 1 failed`.

Selecting history replaces the left ticker list with that run and loads its first completed ticker result.

History is read-only.

### 6.5 Result detail header

For selected completed ticker:
- ticker;
- source badge;
- analysis date;
- decision;
- AI Score;
- confidence.

Use existing report values only. No new derived investment score.

### 6.6 Result tabs

Use exactly:
- `Visual Report`;
- `Detail Report`;
- `Decision Log`.

Visual Report:
- existing Node6A HTML renderer output;
- iframe remains acceptable initially.

Detail Report:
- existing Node6B Markdown/Word-ready content;
- existing Word export behavior may stay.

Decision Log:
- render the canonical immutable `decision_record` for the selected result;
- history can show rows across completed results, but no localStorage append is performed.

### 6.7 Polling state

Polling has no visible global progress animation.

When Results is visible and run is non-terminal:
- fetch current/status on bounded interval;
- preserve selected ticker if still present;
- update only status/results data.

When tab/page loses visibility or user leaves Results:
- polling stops.

Transport error:
- retain last known data;
- display `Could not refresh results`;
- button `Refresh`.

Do not blank the whole page.

### 6.8 No-current-run state

If no current run exists but history exists:
- show history immediately;
- right detail shows last selected/most recent completed result.

If no current run and no history:
- empty state:
  - `No analysis results yet`;
  - button `Go to Analysis List`.

## 7. Responsive behavior

### Desktop ≥ 1024 px

Analysis List:
- table-like rows;
- ticker/source/context/actions aligned horizontally;
- action bar aligned bottom/right.

Results:
- persistent left run/history rail;
- result detail at right;
- report iframe height approx 70–78vh.

### Tablet 768–1023 px

Analysis List:
- rows become 2-column cards:
  - top: ticker + source + Remove;
  - bottom: context/documents.

Results:
- left rail becomes a full-width top panel;
- result detail below;
- history may collapse under `History`.

### Mobile < 768 px

Keep topbar behavior consistent with current app.

Analysis List:
- one card per ticker;
- ticker/source on first line;
- context/documents stacked;
- Add and Attach controls full width where necessary;
- Analyze action full width;
- no horizontal table scroll for the list page.

Results:
- current run ticker states are cards;
- history is a compact expandable section;
- result tabs horizontally scroll only if required;
- report content is full-width;
- iframe may use 65–72vh.

Do not squeeze the desktop table into mobile.

## 8. Loading / disabled / error states

Mandatory coverage:

Analysis List:
- empty;
- populated;
- duplicate add notice;
- invalid ticker;
- evidence parsing;
- evidence parse error;
- submitting;
- active-run locked;
- submission conflict;
- offline/transport failure.

Results:
- no current/no history;
- current READY;
- mixed READY/PROCESSING/COMPLETED;
- completed;
- partial/failed;
- retry in flight;
- index/history unavailable;
- polling transport failure;
- result file missing/corrupt.

Errors should be local to the affected panel/ticker where possible.

## 9. Accessibility

- all actions are native buttons;
- file inputs have visible labels;
- focus ring must remain visible;
- status and source are text, not only color;
- disabled controls use `disabled`, not CSS-only appearance;
- error text is associated with the relevant row/input;
- preserve logical keyboard order;
- do not autofocus on mobile after navigation;
- manual ticker input may autofocus only on desktop.

## 10. CSS implementation guidance

Reuse current root tokens. Add classes in `styles.css`; avoid new runtime-injected style blocks.

Suggested class families:
- `.crsm-list-page`
- `.crsm-list-head`
- `.crsm-list-composer`
- `.crsm-list-row`
- `.crsm-source-badge`
- `.crsm-evidence-list`
- `.crsm-list-actions`
- `.crsm-results-page`
- `.crsm-results-grid`
- `.crsm-results-rail`
- `.crsm-result-item`
- `.crsm-run-history`
- `.crsm-result-detail`
- `.crsm-result-summary`
- `.crsm-poll-error`

Do not carry forward the current large injected CRSM dashboard stylesheet as the durable implementation.

## 11. Component / file map for Coder

Expected new modules:
- `src/crsm/ui/analysis-list.js` — Page 1 markup + event binding helpers.
- `src/crsm/ui/results.js` — Page 2 markup + event binding helpers.
- `src/crsm/draft-list.js` — draft persistence/state only.
- `src/crsm/memo-client.js` — browser bridge client only.
- `src/crsm/result-adapter.js` — immutable result to current report-render shape.

Expected integration changes:
- `src/app.js`
  - CRSM subnav becomes Analysis List / Results;
  - Dashboard/Ranking handoff adds to draft;
  - navigation after add/submit;
  - remove normal direct `runCRSM()` trigger from user actions while keeping legacy code internally until cutover.
- `src/crsm/context.js`
  - reused to freeze SCREENED_WEB snapshot at add time.
- `src/crsm/user-evidence.js`
  - extraction logic reused, but evidence becomes ticker-bound draft data rather than one global pending payload.
- `styles.css`
  - durable Page 1/Page 2 styles.
- `src/crsm/ui/analysis-dashboard.js`, `direct.js`, `progress.js`
  - stop being normal CRSM surfaces after PACK 4/5;
  - retain only if needed for hidden legacy rollback until PACK 11.

## 12. Asset requirements

No new image asset is required.

Use:
- current CSS primitives;
- text badges;
- simple CSS status dots/spinners;
- existing typography.

Do not add an icon library solely for these two pages.

## 13. Design coverage evidence

Source evidence:
- current `src/app.js` uses top-level CRSM tab plus Analysis/Reports subnav;
- current Dashboard/Ranking invoke immediate CRSM and therefore define the exact handoff locations to change;
- current `styles.css` already provides the app shell, panel/button/table primitives;
- current CRSM analysis dashboard is progress/node-centric and is intentionally not carried into the target two-page flow.

Rendered UI observation:
- attempted `https://thebimhouseinfo-sudo.github.io/stockmind/` at desktop/tablet/mobile;
- public GitHub Pages currently returns `404 Site not found`;
- therefore rendered visual comparison is unavailable at PACK 1 and source/CSS evidence is the design baseline.

## 14. Hard design acceptance

Coder implementation matches this spec only if:
- CRSM has exactly two normal subpages;
- Screener actions add to Analysis List and never start AI;
- source contract is always visible and never changes silently;
- documents are visually bound to exactly one ticker row;
- Analyze is the only submission action;
- Results owns status + history + reports;
- no Node pipeline tree is shown in the target UI;
- mobile uses cards instead of horizontal desktop-list compression;
- existing Stock Mind shell/visual language remains recognizable;
- no new external visual asset dependency is introduced.
