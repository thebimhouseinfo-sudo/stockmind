# Stock Mind

Standalone stock screener for pasted TradingView data.

## What It Does

- Paste a TradingView screener table directly into the app.
- Clean numeric and percentage values.
- Calculate industry-relative quality, growth, valuation, momentum, mispricing, final score, rank, and grade.
- Review dashboard, ranking table, and ticker detail.
- Copy an optimized AI analysis prompt for any ticker.
- Save data in the browser and export/import JSON.

## Run Locally

Open `index.html` directly in a browser, or run:

```bash
python -m http.server 4321
```

Then open:

```text
http://localhost:4321
```

## Project Structure

```text
index.html          App shell
src/app.js          UI and workflow
src/parser.js       TradingView paste parser and normalization
src/scoring.js      Scoring engine
src/sample.js       Demo dataset
styles.css          Application styles
SPEC.md             Product and scoring specification
legacy/             Previous Apps Script and sheet-oriented files, if archived later
```

## Current Status

This is V1 of the standalone repo. It intentionally avoids framework and build dependencies so it can run anywhere. A later version can migrate the same parser and scoring engine into React/Vite without changing the core logic.
