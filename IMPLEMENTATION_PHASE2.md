# Phase 2 — Native SSI Screener & Quant Data Architecture

> Đây là phần mở rộng implementation plan cho Phase 2. Không thay thế pipeline CRSM hiện tại. Mục tiêu là xây một Native Screener độc lập, dùng dữ liệu SSI trực tiếp khi API/SDK thực tế được xác minh.

## P2.1 — Native Screener là module độc lập

Native Screener là một screener thị trường thông thường, không phải Candidate Gate của CRSM và không phải TradingView clone.

Mục tiêu:
- Có thể chạy độc lập.
- Có thể kết nối vào Stock Mind qua một data/integration contract ổn định.
- Nếu SSI cho phép, universe bao gồm HOSE + HNX + UPCOM và các mã mà SSI API thực tế cung cấp.
- Không chứa CRSM logic, AI reasoning hoặc proprietary Stock Mind score.

Repo mục tiêu:
```text
native-screener/
stockmind/
```

Stock Mind chỉ phụ thuộc vào contract/API của Native Screener/Data Layer, không phụ thuộc implementation nội bộ.

## P2.2 — SSI Data Provider

Xây `SSIProvider` sau khi xác minh API/SDK thực tế:
- authentication
- endpoint
- rate limits
- realtime/delayed semantics
- historical availability
- fundamental availability
- market coverage
- terms of use

Không hard-code các field chưa được xác minh.

Provider phải trả dữ liệu có:
```js
{
  source,
  ticker,
  exchange,
  asOf,
  tradingDate,
  values,
  availability,
  stale,
  rawReference
}
```

## P2.3 — Canonical Market Data Contract

Native Screener/Data Layer chuẩn hóa dữ liệu SSI trước khi các consumer sử dụng.

Contract phải hỗ trợ tối thiểu các nhóm:
- identity: ticker, company, exchange, industry
- price: last, change, OHLC
- trading: volume, turnover, average volume
- size: market cap, shares outstanding
- valuation: P/E, P/B, EPS, dividend yield và các field SSI thực tế cung cấp
- profitability: ROE, ROA, margins
- growth: revenue/profit/EPS growth nếu có
- leverage/liquidity: debt/equity, current ratio và field thực tế có thể lấy
- historical price/volume
- timestamps and data-quality flags

Schema được version hóa để Stock Mind không bị khóa vào schema SSI.

## P2.4 — Native Screener basic metrics

Native Screener chỉ cung cấp các metric cơ bản/phổ biến mà một stock screener thông thường cần.

Nó phải đủ dữ liệu để tái hiện các điều kiện filter hiện tại của Stock Mind, nhưng không biến các metric đó thành proprietary scores.

Các chức năng:
- search ticker
- chọn universe/exchange
- filter theo metric
- nhiều điều kiện filter
- sort theo cột
- hiển thị bảng kết quả
- reset filter
- xem stock detail

Không đưa vào Native Screener:
- Quality Score
- Growth Score
- Valuation Score
- Momentum Score tổng hợp
- Mispricing Score
- Final Score
- Grade A/B/C
- CRSM assessment

## P2.5 — System Methodology vẫn tách riêng

Workflow định lượng của Stock Mind là consumer riêng của canonical dataset:
```text
SSI Data
  ↓
System Filter
  ↓
System formulas
  ↓
Quant Scoring
  ↓
Ranking
  ↓
CRSM
```

Native Screener không biết và không thay đổi methodology này.

Một user có thể filter P/E < 15, ROE > 15%; một user khác có thể dùng Growth hoặc Momentum. Những filter đó không làm thay đổi Stock Mind System Score.

## P2.6 — Handoff vào Stock Mind

Không copy/paste.

Khi user chọn một ticker trong Native Screener:
```text
Native Screener
    ↓
Stock Data Contract
    ↓
Stock Mind
    ↓
existing screening/analysis context
    ↓
CRSM
```

Handoff phải có ticker + canonical snapshot + timestamp. Stock Mind không cần biết dữ liệu đến từ TradingView hay SSI.

Trong giai đoạn chuyển tiếp, manual/legacy import vẫn có thể tồn tại làm fallback.

## P2.7 — Whole-market data processing

SSI data ingestion và Native Screener phải có khả năng xử lý toàn bộ universe mà API cho phép.

Không gọi LLM để filter/rank hàng nghìn mã.

```text
Whole market
  ↓
normalize
  ↓
validate
  ↓
local deterministic filtering
  ↓
sort/rank
```

Batching, caching và concurrency ở Data Layer là implementation concern. Không tạo một API request riêng không cần thiết cho từng metric nếu SSI hỗ trợ batch.

## P2.8 — Historical data layer

Tách current snapshot khỏi historical series.

Historical store/cache phải hỗ trợ:
- trading date
- OHLC
- volume
- turnover nếu có
- buy/sell volume nếu SSI thực sự cung cấp
- corporate-action adjustment metadata nếu có

Các series phải có timestamp/as-of rõ ràng và không trộn dữ liệu giữa các phiên.

## P2.9 — Native chart, không clone TradingView

Stock Detail phải có chart cơ bản vì chart là một phần bắt buộc của quá trình đánh giá cổ phiếu.

Phạm vi chart:
- price
- volume
- một số basic overlays cần thiết
- một số Stock Mind custom indicators thực sự được sử dụng
- timeframe/history phù hợp với dữ liệu SSI

Không implement:
- Pine Script
- indicator marketplace
- hàng trăm built-in indicators
- drawing suite
- TradingView workspace clone
- strategy builder

Chart là visualization/research surface, không phải một sản phẩm charting độc lập.

## P2.10 — Custom indicator engine

Không phụ thuộc Pine Script.

Custom indicators được viết bằng code của Stock Mind và tính trực tiếp từ canonical SSI historical data:
```text
SSI raw historical data
        ↓
indicator formula
        ↓
derived series
        ↓
chart
```

Mỗi indicator phải có:
- id/name
- formula/version
- input fields
- timeframe requirements
- data availability requirements
- output units
- test fixtures

Ví dụ có thể nghiên cứu sau khi dữ liệu thực tế xác nhận:
- accumulation/distribution pressure
- net buy/sell flow
- relative volume
- volume pressure
- momentum variants
- các chỉ số proprietary khác

Không gọi các chỉ số này là "smart money holdings" nếu dữ liệu chỉ cho phép suy ra proxy từ giao dịch. Ownership thực tế cần dữ liệu sở hữu tương ứng.

## P2.11 — Indicator research / validation

Custom indicator mới ban đầu là experimental.

Quy trình:
```text
Raw data
  ↓
new formula
  ↓
chart visualization
  ↓
historical test
  ↓
validate / reject
  ↓
if validated → System Quant metric
```

Không đưa một indicator experimental vào Final Score chỉ vì chart nhìn đẹp.

## P2.12 — Web Search boundary

Sau SSI integration, Web Search không được dùng để lấy lại dữ liệu định lượng đã có trong canonical snapshot.

Web research tập trung vào thông tin không có trong market dataset, ví dụ:
- kinh tế vĩ mô
- chính sách
- chính trị
- pháp lý
- địa chính trị
- thương mại/thuế quan
- company events/news
- industry events/news
- catalysts và risks

CRSM nhận quantitative snapshot từ Data Layer và targeted research từ web.

## P2.13 — Data quality & provenance

Mỗi metric phải có provenance:
```text
provider
field
asOf
tradingDate
unit
availability
stale status
```

Nếu SSI thiếu dữ liệu hoặc dữ liệu stale:
- không tự suy đoán
- không cho AI tự điền số
- đánh dấu missing/stale
- chỉ fallback sang web khi đó là thông tin phù hợp để research và nguồn có thể xác minh

## P2.14 — Migration / backward compatibility

Giai đoạn đầu:
```text
TradingView/manual import ─┐
                           ├→ canonical Stock Data → existing pipeline
SSI Native Screener ───────┘
```

Sau khi SSI provider được validate:
- Native Screener trở thành nguồn chính.
- Manual import trở thành legacy fallback.
- Không xóa parser/scoring cũ cho tới khi regression + dual-source validation đạt yêu cầu.

## P2.15 — Acceptance tests

- SSI provider authentication works.
- Universe coverage matches actual SSI API response.
- HOSE/HNX/UPCOM are included only when actually supported.
- Canonical snapshot is deterministic.
- Missing/stale fields are preserved as missing/stale.
- Native Screener can filter and sort without LLM.
- Native Screener can process the full available universe.
- Current Stock Mind filter can be reproduced from canonical fields.
- User-defined basic filters do not alter System Score.
- Ticker handoff requires no copy/paste.
- Historical chart reproduces source OHLC/volume correctly.
- Custom indicator output is reproducible from the same historical snapshot.
- Experimental indicators cannot silently enter production scoring.
- Web Search is not called for metrics already present and current in SSI snapshot.
- Legacy import still works during migration.
