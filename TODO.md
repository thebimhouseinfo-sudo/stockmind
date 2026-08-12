# Stock Mind — Implementation Checklist

## Completed in this pass

- [x] Keep CRSM as a single engine with SCREENED and DIRECT entry modes.
- [x] Keep manual DIRECT analysis available for tickers outside the screener.
- [x] Prepare CRSM settings as a control center instead of one long settings block.
- [x] Add Models tab for providers, API keys and model list.
- [x] Add Nodes tab for per-node provider/model assignment.
- [x] Keep local Node 6A / 6B / 7 visible separately from paid LLM nodes.
- [x] Add Usage tab with request count and input/output/total token counters.
- [x] Add Cost tab with current-run total cost and per-node cost.
- [x] Store input/output pricing on model definitions.
- [x] Calculate estimated cost from actual token usage returned by the provider.
- [x] Add model pricing fields when creating a custom model.
- [x] Load dedicated settings styles without disturbing the main application stylesheet.

## Next CRSM integration

- [ ] Make clicking an already-screened/ranked stock perform an automatic SCREENED handoff.
- [ ] Preserve the existing manual DIRECT entry for arbitrary tickers.
- [ ] Show the source of an analysis clearly: SCREENED vs DIRECT.
- [ ] Pass the complete screening context into CRSM and preserve it in the report.
- [ ] Add a candidate gate so only selected/high-quality screened stocks are sent to CRSM.
- [ ] Support batch CRSM for a controlled candidate list.

## Cost / observability

- [ ] Persist usage history across CRSM runs instead of only the current run.
- [ ] Add Today / 7 days / 30 days / All-time cost views.
- [ ] Add average cost per CRSM report.
- [ ] Add cost by provider and model.
- [ ] Add configurable monthly budget and warning threshold.
- [ ] Account separately for grounding/search charges where the provider bills them outside token cost.
- [ ] Add a compact cost summary to the completed CRSM report.

## Reliability

- [ ] Version cache keys so prompt/model/spec changes cannot return stale CRSM results.
- [ ] Add cache invalidation by analysis date and configuration version.
- [ ] Add automated tests for parser and scoring engine.
- [ ] Add tests for CRSM JSON validation and deterministic post-processing.
- [ ] Add CI test/build gate.

## Security

- [ ] Review browser-side API-key storage before public deployment.
- [ ] Decide whether public deployment should use a backend/proxy for provider keys.
- [ ] Review `.continue/` and legacy artifacts for anything that should not be published.

## Documentation

- [ ] Rewrite README to describe Stock Mind + Screening + CRSM architecture.
- [ ] Document node responsibilities and model capability requirements.
- [ ] Document SCREENED vs DIRECT execution.
- [ ] Document pricing configuration and cost accounting assumptions.
