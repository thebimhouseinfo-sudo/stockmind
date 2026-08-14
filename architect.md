# Stock Mind Architecture

This is the current architecture reference. It is the orientation document for future work. Old current-phase specs, TODOs, and implementation plans were removed because the implemented system is now the source of truth. `IMPLEMENTATION_PHASE2.md` is intentionally kept as future-scope planning because Phase 2 has not been implemented yet.

## 1. Product Shape

Stock Mind has two layers:

1. **Screener**: deterministic TradingView import, normalization, scoring, ranking, dashboard grouping, and candidate selection.
2. **CRSM**: deeper AI-assisted analysis for selected tickers, using the screener snapshot when the ticker came from the screener.

The core rule is simple: the screener is cheap, deterministic, and transparent; CRSM is expensive, research-heavy, and only runs after the user chooses candidates.

## 2. Main Flow

```text
TradingView table
  -> parser
  -> Screener V2 scoring
  -> Dashboard / Ranking
  -> selected ticker(s)
  -> CRSM SCREENED mode
  -> report / decision log

Manual ticker
  -> CRSM DIRECT mode
  -> report / decision log
```

SCREENED and DIRECT share the same CRSM engine. DIRECT must remain available even when no screener data exists.

## 3. Current Runtime Files

Core app:

- `index.html`: app shell and script/style loading.
- `src/app.js`: top-level UI state, tabs, import/share flow, dashboard/ranking/detail/CRSM handoff.
- `src/parser.js`: TradingView paste parser and field normalization.
- `src/scoring.js`: deterministic Screener V2 entrypoint and app-facing score/stat helpers.
- `src/share-code.js`: local, file-based screener export/import codec.
- `tests/core.test.mjs`: parser, Screener V2, and share round-trip tests.

Screener V2 modules:

- `src/screener-v2/registry.js`: thresholds, metadata, calibration status.
- `src/screener-v2/contract-validator.js`: input contract and data-quality state.
- `src/screener-v2/price-dislocation.js`: 52-week price/dislocation profile.
- `src/screener-v2/momentum-volume.js`: momentum and volume profile.
- `src/screener-v2/full-evaluation.js`: full row evaluation.
- `src/screener-v2/diagnostic-runner.js`: diagnostics.
- `src/screener-v2/state.js`: shared Screener V2 constants/state helpers.

CRSM:

- `src/crsm/context.js`: builds the trusted screening snapshot for CRSM.
- `src/crsm/engine.js`: public CRSM run entrypoint.
- `src/crsm/pipeline.js`: node orchestration.
- `src/crsm/router.js`: provider/model resolution and capability checks.
- `src/crsm/llm.js`: shared LLM call abstraction.
- `src/crsm/providers/`: provider adapters.
- `src/crsm/model-discovery.js`: model discovery for configured API keys.
- `src/crsm/settings.js`: model/provider/node settings.
- `src/crsm/nodes/`: CRSM node implementations.
- `src/crsm/ui/`: CRSM UI, settings UI, reports, progress, error states.

Removed historical/test UI and docs:

- Mapping preview tab and export scripts were removed from runtime.
- Current-phase spec, TODO, and implementation-plan documents were removed. Use this file plus source code instead.
- `IMPLEMENTATION_PHASE2.md` remains as future-scope planning only.

## 4. Screener Rules

The screener is deterministic. It must not call LLMs or depend on CRSM.

Responsibilities:

- Parse TradingView data.
- Normalize fields into the app schema.
- Validate critical inputs.
- Produce Screener V2 scores, rank, grade, group, flags, and notes.
- Show full ranking for inspection.
- Show dashboard candidate groups for action.
- Build a trusted snapshot for CRSM.

Dashboard is the primary action surface. Ranking is for full-universe inspection. User actions:

- Click a ticker: run single SCREENED CRSM.
- Select multiple tickers on Dashboard: batch SCREENED CRSM.
- Use Ranking to inspect all rows.

## 5. Share / Import

Stock Mind supports local, no-cloud screener sharing.

Screen tab layout:

```text
[Open TradingView] [Import & Screen]
TradingView -> Ctrl+A -> Ctrl+C -> Import & Screen
[Share Screen] [Import Screen]
```

Rules:

- `Share Screen` exports a `.stockmind` file.
- `Import Screen` opens a file picker and imports a `.stockmind` file.
- The file contains screener rows/scores only.
- The file must not contain API keys, CRSM settings, provider settings, or private CRSM reports.
- Imported files replace the current screener dataset and rerun deterministic scoring.

## 6. CRSM Screening Snapshot Contract

When CRSM runs in SCREENED mode, it receives a snapshot generated from the selected screener row. CRSM must treat this snapshot as trusted user-provided screening context.

Node 1 uses the snapshot as verified internal evidence and should only search for:

- missing critical stock facts;
- current facts that may have changed;
- direct/manual ticker data when the user did not come through the screener;
- verification or explanation of important discrepancies.

CRSM must not silently recalculate or overwrite screener scores, rank, grade, or deterministic classifications.

## 7. CRSM Pipeline

```text
Node 1: company/data/current fact grounding
Node 2: technical and smart money
Node 3: fundamentals and valuation
Node 4: macro/causal context
Node 5: synthesis and decision
Node 6A: HTML report
Node 6B: Word report
Node 7: decision log
```

Node 6A, Node 6B, and Node 7 are local/reporting operations. They are not provider-model assignment targets.

## 8. Provider And Model Settings

Settings separates availability from assignment:

- Providers: API key and model inventory.
- Model inventory: models available per provider.
- CRSM Engine: provider/model assignment per node.
- Usage: current-run telemetry.
- Cost: historical cost and budget monitoring.

Auto model discovery:

- Gemini and OpenAI can auto-scan available models after the user enters an API key.
- Ollama Cloud is excluded from auto-scan.
- Auto-scan updates provider model inventory.
- If a node's selected model is no longer available after scanning, the app moves that node to the first available model for that provider.

Provider calls must stay behind:

```text
node -> runLLM() -> router -> provider adapter -> model API
```

Nodes must never call provider APIs directly.

## 9. Data Ownership

| Data | Owner | Rule |
|---|---|---|
| TradingView pasted data | Screener | Raw user import source |
| Parsed rows | Parser | Normalized app input |
| Scores/rank/grade/group | Screener V2 | Deterministic, trusted snapshot |
| External current facts | CRSM Node 1+ | Search and verify |
| Analysis/decision | CRSM Node 5 | Interpret evidence |
| Reports | Local report nodes | Render/export only |
| Provider/API settings | Settings | Never include in share files |
| Usage/cost telemetry | CRSM usage | Observability only |

## 10. Development Rules

1. Keep screener logic deterministic.
2. Do not move deterministic scoring into CRSM.
3. Preserve both SCREENED and DIRECT CRSM modes.
4. Treat the screener snapshot as trusted context, not as a prompt suggestion.
5. When changing screener output, review `src/crsm/context.js`, Node 1, and Node 1 prompt.
6. Do not let missing non-critical TradingView data create noisy warnings.
7. Only flag missing data strongly when it affects critical scoring or CRSM reliability.
8. Keep Dashboard as the candidate action surface.
9. Keep Ranking as full-universe inspection.
10. Keep provider calls behind router/provider adapters.
11. Never store or export API keys in share/import artifacts.
12. Avoid reviving removed Mapping preview code unless explicitly requested for parser debugging.
13. Before pushing, run `npm test`.

## 11. Quick Orientation

For most future tasks, start with:

```text
architect.md
src/app.js
src/parser.js
src/scoring.js
src/screener-v2/
src/crsm/context.js
src/crsm/settings.js
src/crsm/router.js
```

Then inspect only the specific UI, node, provider, or scoring module needed for the requested change.
