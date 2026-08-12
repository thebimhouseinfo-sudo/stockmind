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

## Cost / observability

- [x] Persist usage history across CRSM runs.
- [x] Add Today / 7 days / 30 days / All-time cost views.
- [x] Add average cost per CRSM report/request.
- [x] Add cost by provider and model.
- [x] Add configurable monthly budget and warning threshold.
- [ ] Account separately for grounding/search charges where provider billing is outside token cost.
- [ ] Add historical cost chart.

## Reliability

- [x] Version cache keys so prompt/model/spec configuration changes do not reuse the previous cache namespace.
- [x] Include analysis date in cache keys.
- [ ] Add automated tests for parser and scoring engine.
- [ ] Add tests for CRSM JSON validation and deterministic post-processing.
- [ ] Add CI test/build gate.
- [ ] Add explicit regression test for SCREENED handoff.
- [ ] Add explicit regression test for DIRECT mode.

## Security

- [ ] Review browser-side API-key storage before public deployment.
- [ ] Decide whether public deployment should use a backend/proxy for provider keys.
- [ ] Review `.continue/` and legacy artifacts for anything that should not be published.

## Documentation

- [ ] Rewrite README to describe Stock Mind + Screening + CRSM architecture.
- [ ] Document node responsibilities and model capability requirements.
- [x] Document SCREENED vs DIRECT execution in the implementation checklist and UI.
- [x] Document pricing configuration and cost accounting assumptions in the Cost UI.
