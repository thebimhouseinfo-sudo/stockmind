You are appending one row to a personal decision-tracking log — not producing a new report.

---

# 🎯 PURPOSE

CRSM has no memory between runs. This log is the only way to later check whether past BUY/SELL calls were actually right — and it feeds Node 8 (Performance & Calibration), which needs a price-at-analysis baseline to measure outcomes against. Every full pipeline run appends exactly one row here — do this automatically, even if the user didn't ask for it.

---

# 📋 FORMAT

Append to the end of the existing log table (create the table with this header if it doesn't exist yet):

| Ngày phân tích | Mã | Chế độ | Giá tại thời điểm PT | Screen Score | Screen Rank | Screen Grade | Quyết định | AI Score | Confidence | CRSM−Screen Diff | Entry | Trading Stop | TP1 | TP2 | Thesis Invalidation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| [DATE] | [TICKER] | [ANALYSIS_MODE] | [PRICE_AT_ANALYSIS] | [SCREEN_SCORE] | [SCREEN_RANK] | [SCREEN_GRADE] | [DECISION] | [AI_SCORE]/100 | [CONFIDENCE]% | [SCREEN_CRSM_DIFFERENCE] | [ENTRY_ZONE] | [TRADING_STOP_PRICE] | [TP1_PRICE] | [TP2_PRICE] | [THESIS_INVALIDATION] |

- `[PRICE_AT_ANALYSIS]` → Node 1 `market_data.price.value` at the time of this run — record only this, at write time. Do NOT try to fill in future prices (+5D/+20D/+60D) in this same step; that is Node 8's job on a LATER run, reading this log and fetching current prices then.
- `[ANALYSIS_MODE]` → "DIRECT" or "SCREENED", from Node 1.
- `[SCREEN_SCORE]` / `[SCREEN_RANK]` / `[SCREEN_GRADE]` → from Node 1 `screening_summary.screen_score / .screen_rank / .screen_grade`; if `analysis_mode` = "DIRECT", write `—` in these columns (this is a structural "not applicable" for a DIRECT-mode row, not a missing-data null — don't write "Chưa có dữ liệu" here).
- `[CRSM−Screen Diff]` (the `Screen−CRSM Diff` column was renamed to `CRSM−Screen Diff` for sign-convention clarity) → take this value from Node 5's `screen_vs_crsm.score_difference`, which is **defined as `crsm_score − screen_score`** (NOT `screen_score − crsm_score`). The column name and the value must use the same convention. If `analysis_mode` = "DIRECT", write `—` in this column. Do NOT recompute the diff here — Node 5 is the sole authority on it.
- These screening fields are recorded now purely for later use — **Node 8 does not analyze them yet** (not enough history). Just make sure they land in the log correctly every time so that analysis is possible once enough runs have accumulated.

---

# ⚠️ RULES

* Append-only — never edit or delete a prior row, even if a later run on the same ticker reaches a different conclusion. Contradicting a past call is useful signal, not an error to fix.
* If the same ticker is analyzed again on a later date, add a NEW row rather than overwriting the old one, so the history of calls on that ticker is visible over time.
* When the user asks "show log" / "xem lịch sử dự đoán" / "how did past calls do", print the full table as-is (add no commentary about accuracy unless the user asks you to evaluate it — that's Node 8).
