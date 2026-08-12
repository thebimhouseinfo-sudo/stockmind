# Stock Mind — Implementation Checklist

## Completed

- [x] Keep CRSM as a single engine with SCREENED and DIRECT entry modes.
- [x] Keep manual DIRECT analysis available for arbitrary tickers.
- [x] CRSM settings split into Models / Nodes / Usage / Cost tabs.
- [x] Per-node provider/model assignment with capability requirements.
- [x] Model pricing fields and token-based cost calculation.
- [x] Current-run usage and cost monitor.
- [x] Persistent usage history in browser storage.
- [x] Today / 7 days / 30 days / All-time cost views.
- [x] Average cost per request.
- [x] Cost by provider/model and node.
- [x] Monthly budget and warning threshold.
- [x] Compact source badge for SCREENED vs DIRECT.
- [x] Compact cost summary on the completed CRSM screen.
- [x] Clicking a ranked stock now automatically hands off to CRSM SCREENED.
- [x] Preserve scoring detail as an explicit secondary action.
- [x] Cache versioning by model assignment/capability/pricing configuration and analysis date.

## Next CRSM integration

- [ ] Add a configurable candidate gate so only selected/high-quality screened stocks are eligible for CRSM handoff.
- [ ] Add optional batch CRSM for a controlled candidate list.
- [ ] Add a persistent candidate queue/history.
- [ ] Preserve the full screening context in exported/report metadata.
- [ ] Add dependency-aware Sequential / Parallel execution mode; backend decides which independent nodes can run concurrently.

## Phase 2 — Native SSI Data Layer

### Data source

- [ ] Validate SSI API/SDK access, authentication, permissions, terms and rate limits.
- [ ] Define `MarketDataProvider` abstraction so Stock Mind is not coupled directly to one data source.
- [ ] Implement `SSIProvider` only after the real SSI endpoints and schemas are verified.
- [ ] Keep current manual import as compatibility/fallback during migration.

### Normalized data layer

- [ ] Create canonical stock-data schema mapped from SSI to the fields required by parser/scoring/CRSM.
- [ ] Normalize quote, OHLC, volume, valuation, profitability, growth, leverage and historical data where SSI actually provides them.
- [ ] Attach source, timestamp/trading date and field availability metadata.
- [ ] Mark missing/stale fields explicitly; never silently invent or reuse stale values.

### Snapshot / cache

- [ ] Create an immutable SSI data snapshot per analysis run.
- [ ] Make all CRSM nodes in the same run consume the same snapshot.
- [ ] Version SSI cache keys by provider, ticker, as-of/trading date and schema version.
- [ ] Add data-provider latency, rate-limit and error observability separately from LLM usage.

### Screening / CRSM integration

- [ ] Feed normalized SSI data into the existing screening/scoring layer without rewriting scoring logic unnecessarily.
- [ ] On ticker handoff, acquire/validate the SSI snapshot before starting CRSM SCREENED.
- [ ] Let Node 1 focus on verification/anomalies and external research rather than re-searching known quantitative data.
- [ ] Do not web-search quantitative fields already present and current in the SSI snapshot unless cross-checking an anomaly.

### Targeted Web Research

- [ ] Restrict Web Search primarily to macroeconomics: GDP, CPI, rates, FX and monetary/fiscal policy.
- [ ] Search political, regulatory and legal developments that can materially affect markets/sectors.
- [ ] Search geopolitics, trade, tariffs, war and external shocks.
- [ ] Search company-specific news: M&A, projects, management changes and unusual events.
- [ ] Search sector policy, catalysts, risks and market narratives requiring external verification.
- [ ] Preserve source/date evidence for material web-derived claims.

### Migration

- [ ] Add data-source feature flag: `IMPORT` / `SSI`.
- [ ] Run dual-source comparison on a representative ticker set.
- [ ] Log and surface discrepancies instead of silently overwriting values.
- [ ] Prove parity for all fields required by screening before making SSI the default source.
- [ ] Keep manual import fallback while SSI reliability is being validated.
- [ ] Remove TradingView dependency only after SSI acceptance criteria pass.

### SSI acceptance tests

- [ ] SSI-1: authentication and provider error handling.
- [ ] SSI-2: ticker snapshot normalizes into canonical schema.
- [ ] SSI-3: missing/stale data is explicitly handled.
- [ ] SSI-4: all nodes in one CRSM run use one immutable snapshot.
- [ ] SSI-5: screening parity for all required fields.
- [ ] SSI-6: dual-source discrepancy detection.
- [ ] SSI-7: CRSM does not re-search known quantitative data unnecessarily.
- [ ] SSI-8: macro/politics/policy/news research remains available.
- [ ] SSI-9: manual import fallback works when SSI is unavailable.
- [ ] SSI-10: TradingView workflow is removed only after all criteria pass.

## Cost / observability

- [x] Persist usage history across CRSM runs.
- [x] Add Today / 7 days / 30 days / All-time cost views.
- [x] Add average cost per CRSM report/request.
- [x] Add cost by provider and model.
- [x] Add configurable monthly budget and warning threshold.
- [ ] Account separately for grounding/search charges where provider billing is outside token cost.
- [ ] Add historical cost chart.
- [ ] Add data-provider usage/latency/rate-limit monitoring for SSI.

## Reliability

- [x] Version cache keys so prompt/model/spec configuration changes do not reuse the previous cache namespace.
- [x] Include analysis date in cache keys.
- [ ] Add automated tests for parser and scoring engine.
- [ ] Add tests for CRSM JSON validation and deterministic post-processing.
- [ ] Add CI test/build gate.
- [ ] Add explicit regression test for SCREENED handoff.
- [ ] Add explicit regression test for DIRECT mode.
- [ ] Add execution-mode tests for dependency-aware Sequential / Parallel behavior.
- [ ] Add SSI provider contract and snapshot tests.

## Security

- [ ] Review browser-side API-key storage before public deployment.
- [ ] Decide whether public deployment should use a backend/proxy for provider keys.
- [ ] Review SSI credential storage and deployment strategy before implementation.
- [ ] Review `.continue/` and legacy artifacts for anything that should not be published.

## Documentation

- [ ] Rewrite README to describe Stock Mind + Screening + CRSM architecture.
- [ ] Document node responsibilities and model capability requirements.
- [x] Document SCREENED vs DIRECT execution in the implementation checklist and UI.
- [x] Document pricing configuration and cost accounting assumptions in the Cost UI.
- [ ] Document MarketDataProvider / SSI snapshot architecture and Web Search policy.
