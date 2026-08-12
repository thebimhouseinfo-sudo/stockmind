# Stock Mind + CRSM Integration — Implementation Plan (FINAL v3)

> Bản plan đã được duyệt qua 3 rounds review. Đây là tài liệu tham chiếu, không phải runtime code.

## 0. Nguyên tắc bắt buộc

- **parser.js, scoring.js, sample.js**: KHÔNG đụng.
- **legacy/Appscript/***: KHÔNG đụng.
- **legacy/CRSM/*.md**: source of truth cho prompts; build-time generate ra `src/crsm/prompts/*.js`.
- CRSM là layer độc lập trong `src/crsm/`, không lẫn vào `app.js`.
- Node không gọi SDK provider trực tiếp; chỉ gọi `runLLM()`.
- StockScreener regression: trước CRSM, tất cả flow cũ phải hoạt động y nguyên.

## 1. Cấu trúc file mới

```
src/
├── app.js                  (sửa)
├── parser.js              (giữ nguyên)
├── scoring.js             (giữ nguyên)
├── sample.js              (giữ nguyên)
├── crsm/
│   ├── engine.js           public entry runCRSM({...})
│   ├── pipeline.js         Node 1→7 orchestrator
│   ├── retry.js            preserve completed outputs
│   ├── state.js            crsmState độc lập
│   ├── cache.js            cache completed runs
│   ├── context.js          buildScreeningContext(stock)
│   ├── llm.js              runLLM({nodeId, prompt, ...})
│   ├── router.js            resolveProviderModel + capability check
│   ├── usage.js             per-node usage tracker
│   ├── prompts/             generated từ legacy/CRSM/*.md
│   ├── nodes/               business logic per node
│   ├── providers/            gemini, openai, ollama-cloud (fetch REST)
│   ├── settings.js           AppSettings + CRSMModelRouting
│   └── ui/                   progress, snapshot, status, error, direct, settings
styles.css                    (sửa nhỏ)
build-prompts.js              build-time script
package.json                  (sửa: thêm scripts)
```

## 2. LLM call flow

```
nodeN.js → runLLM({nodeId, prompt, responseFormat})
       → llm.js → router.resolve(nodeId, settings) → {provider, model, webGrounding}
              → provider.generate({prompt, model, apiKey, webGrounding, ...})
                  → fetch() REST
```

## 3. Build-time prompts

`build-prompts.js` convert `legacy/CRSM/*.md` → `src/crsm/prompts/*.js` (escape template literal).

`package.json` scripts:
```json
{
  "build:prompts": "node build-prompts.js",
  "dev": "npm run build:prompts && python -m http.server 4321",
  "start": "npm run build:prompts && python -m http.server 4321",
  "prebuild": "npm run build:prompts"
}
```

Sửa `NODE_3.md` → `npm run dev` → app tự rebuild prompts trước khi serve.

## 4. crsmState (state.js)

```js
export const crsmState = {
  isRunning: false,
  mode: null,                      // 'SCREENED' | 'DIRECT'
  ticker: null,
  screeningContext: null,          // null nếu DIRECT
  currentNode: null,
  nodeStatus: { /* node1..node7: pending|running|done|failed|skipped */ },
  nodeOutputs: {},
  usage: [],                       // [{nodeId, provider, model, inputTokens, outputTokens, ...}]
  finalReport: null,
  logRows: [],
  error: null,
  startedAt: null,
  completedAt: null
};
```

Subscribe pattern qua `subscribeCRSM(fn)` để UI re-render.

## 5. context.js

`buildScreeningContext(stock)` map StockScreener row → Master schema:

```js
{
  source: 'StockScreener',
  ticker: stock.TICKER,
  industry: stock.INDUSTRY,
  screening_as_of: todayISODate(),     // ISO YYYY-MM-DD
  screen_score: stock.FINALSCORE,
  screen_rank: stock.RANK,
  screen_grade: stock.GRADE,
  quality_score, growth_score, valuation_score, micro_score, momentum_score, mispricing_score,
  metrics: { price, pe, roe, roic, revenue_growth, eps_growth, debt_ratio, return_1m..12m },
  industry_benchmarks: { pe_median, roe_median }
}
```

`todayISODate()` → ISO 8601 YYYY-MM-DD. UI dùng `formatDateVN()` riêng để hiển thị DD/MM/YYYY.

DIRECT mode: KHÔNG gọi `buildScreeningContext`, truyền `null`.

## 6. settings.js

AppSettings:
```js
{
  theme: 'light',
  crsm: {
    providers: {
      gemini: {
        apiKey: null,
        models: [
          { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', builtin: true,
            capabilities: { webGrounding: true, structuredOutput: true, reasoning: true } },
          { id: 'gemini-3-flash', displayName: 'Gemini 3.0 Flash', builtin: true,
            capabilities: { webGrounding: true, structuredOutput: true, reasoning: true } }
        ]
      },
      openai: { apiKey: null, models: [] },
      ollamaCloud: { apiKey: null, models: [] }
    },
    nodeAssignment: {
      node1: { provider: 'gemini', model: 'gemini-2.5-flash', enabled: true },
      node2: { provider: 'gemini', model: 'gemini-2.5-flash', enabled: true },
      node3: { provider: 'gemini', model: 'gemini-2.5-flash', enabled: true },
      node4: { provider: 'gemini', model: 'gemini-2.5-flash', enabled: true },
      node5: { provider: 'gemini', model: 'gemini-2.5-flash', enabled: true }
    }
  }
}
```

**Đã loại bỏ**: defaults.webGrounding/reasoning/fast, auto-routing, fallback chain, tournament, voting, custom OpenAI-compatible provider.

**User-declared capability warning**: Settings UI hiển thị disclaimer khi thêm model mới.

**Settings UI layout** (3 sections):
- PROVIDERS & MODELS — Gemini (built-in 2.5 Flash + 3.0 Flash, + Add model), OpenAI, Ollama Cloud
- NODE MODEL ASSIGNMENT — Node 1/2/3/4/5 với dropdown provider+model
- LOCAL PIPELINE — Node 6A/6B/7 hiển thị [Local Renderer] / [Local Log], không có dropdown

## 7. Providers (3 cái, fetch REST)

- **gemini.js**: `generativelanguage.googleapis.com/v1beta`. Web grounding chỉ bật khi router truyền `webGrounding: true` → `body.tools = [{ googleSearch: {} }]`.
- **openai.js**: `api.openai.com/v1/chat/completions`. OpenAI không có native web grounding.
- **ollama-cloud.js**: `ollama.com/v1/chat/completions` (OpenAI-compatible).

CORS: Gemini đã enable CORS cho browser. OpenAI/Ollama Cloud cần test thực tế; nếu fail do CORS, hiển thị warning trong Settings.

## 8. router.js

Node requirements:
```js
{
  node1: { webGrounding: true,  structuredOutput: true },
  node2: { webGrounding: true,  structuredOutput: true },
  node3: { webGrounding: false, structuredOutput: true },
  node4: { webGrounding: true,  structuredOutput: true },
  node5: { webGrounding: false, structuredOutput: true }
}
```

`resolveProviderModel(nodeId)`:
1. Lấy assignment từ settings.
2. Nếu `provider === 'local'` → trả `{ local: true }`.
3. Validate API key có trong provider config.
4. Tìm model trong `providerCfg.models`.
5. Check capabilities match requirements. Nếu thiếu → throw error rõ ràng, KHÔNG tự thay model.

## 9. llm.js

```js
export async function runLLM({ nodeId, prompt, systemInstruction, responseFormat = 'json', signal }) {
  const resolved = await resolveProviderModel(nodeId);
  if (resolved.local) throw new Error('Local node cannot call runLLM');
  const provider = getProvider(resolved.provider);
  // call provider.generate, record usage, return {text, usage}
}
```

## 10. cache.js

Cache key:
- SCREENED: `SCREENED:${ticker}:${screening_as_of}`
- DIRECT: `DIRECT:${ticker}:${todayISODate()}`.

Cache only completed runs. DIRECT và SCREENED không share cache entry.

## 11. retry.js

```js
retryFromNode(failedNode) {
  const preserved = { ...crsmState.nodeOutputs };
  return runPipeline({
    ...,
    startFrom: failedNode,
    existingOutputs: preserved
  });
}
```

## 12. pipeline.js

The pipeline is dependency-aware. Default execution is sequential. An optional parallel mode may execute independent nodes concurrently, but a node must wait whenever its required upstream output is not available. The backend owns the dependency graph and concurrency decisions; users only select Sequential or Parallel in Settings.

Conceptual graph:
```text
                 Node 1
                /      \
             Node 2    Node 3
                \       /
                 Node 4
                    |
                 Node 5
                /   |   \
             6A    6B    7
```

Sequential mode executes all runnable nodes one at a time. Parallel mode may run independent runnable nodes together (for example Node 2 + Node 3 after Node 1), while preserving all data dependencies. The engine must never run a node before its required outputs exist.

The pipeline must also enforce a provider/API-safe execution policy: Parallel means "run independent work concurrently when safe", not "fire every node at once". Concurrency limits and future provider-specific rate limits remain backend concerns.

## 13. nodes/

Mỗi node có pattern:
```js
export async function node1(ctx) {
  const userPrompt = buildUserPrompt(ctx);
  const result = await runLLM({ nodeId: 'node1', prompt: userPrompt, systemInstruction: node1Prompt, responseFormat: 'json' });
  return validateOutput(JSON.parse(result.text));
}
```

Đặc biệt Node 3: phát hiện EPS_REVENUE_DISCONNECT → flag trong `screening_flags`.

Node 5: SOLE AUTHORITY cho `screen_vs_crsm.status` theo ngưỡng `|diff|≤5 / 5<|diff|≤15 / |diff|>15`.

Node 6A/6B: chỉ RENDER, không tính lại.

Node 7: append-only log.

## 14. engine.js

```js
export async function runCRSM({ mode, ticker, screeningContext=null, onProgress, onError, onComplete }) {
  // 1. cache check
  // 2. reset crsmState, set mode/ticker/screeningContext
  // 3. validate: SCREENED mode phải có screeningContext; DIRECT mode screeningContext = null
  // 4. runPipeline with dependency-aware execution hooks
  // 5. cacheSet khi complete
}
```

## 15. UI integration (app.js)

- Thêm tab `crsm` vào topbar.
- Khi click ticker từ Ranking/Dashboard → chuyển sang tab CRSM và gọi `runCRSM({mode:'SCREENED', ticker, screeningContext: buildScreeningContext(stock)})` ngay lập tức.
- Tab CRSM có Direct entry point cho ticker tùy ý.
- Progress bar hiển thị node1→node7 với status từng node.
- Error state: hiển thị `failedNode` + nút Retry.
- Settings được access trực tiếp từ header.

## 16. styles.css

Thêm UI cho progress, screening snapshot, source/mode badge, direct entry, error state và Settings.

## 17. Acceptance tests

- **TEST 1 SCREENED**: Click ASP từ Ranking → CRSM chạy ngay, screening snapshot hiển thị Score/Rank/Grade.
- **TEST 2 DIRECT**: Nhập HAH từ CRSM tab → CRSM chạy, mode='DIRECT'.
- **TEST 3 DIVERGENT**: Mock Screen=83, CRSM=58 → status='DIVERGENT'.
- **TEST 4 CONFIRMED**: Mock Screen=83, CRSM=85 → status='CONFIRMED'.
- **TEST 5 EPS_REVENUE_DISCONNECT**: Node 3 flag được tạo đúng.
- **TEST 6 Routing Test A**: các node chạy với provider/model được assign.
- **TEST 7 Routing Test B**: model thiếu web grounding cho Node 1 → BLOCKED.
- **TEST 8 Regression**: screening flow hoạt động.
- **TEST 9 Retry**: preserve completed outputs.
- **TEST 10 Handoff**: click ticker từ Dashboard/Ranking → CRSM bắt đầu ngay, không cần bấm Run lần hai.
- **TEST 11 Execution mode**: Sequential chạy từng runnable node; Parallel chạy các node độc lập đồng thời nhưng không vi phạm dependency.

## 18. Stop condition

Nếu StockScreener regression test fail → DỪNG coding, fix integration trước. KHÔNG improve code không liên quan.

---

# PHASE 2 — Native Market Data Layer / SSI Integration (FUTURE)

> Mục tiêu: loại bỏ sự phụ thuộc vào TradingView clipboard workflow và giảm Web Search đối với dữ liệu định lượng. Phase này chỉ bắt đầu khi có API/SDK/endpoint SSI phù hợp và được xác thực quyền truy cập, schema và điều khoản sử dụng.

## 19. Kiến trúc Data Layer

Stock Mind sẽ chuyển từ mô hình:

```text
TradingView → clipboard/import → parser → screening → CRSM
```

sang:

```text
SSI API
   ↓
Data Provider
   ↓
Normalized Stock Data
   ↓
Validation + Snapshot + Cache
   ↓
Screening / Ranking
   ↓
CRSM
```

Thiết kế provider abstraction:

```text
MarketDataProvider
├── current/manual import provider   ← compatibility trong giai đoạn chuyển tiếp
└── SSIProvider                      ← mục tiêu chính
```

`parser.js` và scoring hiện tại không bị viết lại chỉ để phục vụ SSI. Một lớp normalization sẽ map dữ liệu SSI về schema mà screening đang dùng.

## 20. SSI provider requirements

Khi implement, xác định và validate trước các endpoint thực tế SSI cung cấp, tối thiểu nếu có:

- symbol/ticker
- realtime hoặc delayed price
- OHLC
- volume
- market data snapshot
- valuation metrics: P/E, P/B, EPS và các chỉ số SSI thực sự cung cấp
- fundamental metrics: revenue, profit, ROE, ROA, debt/leverage và các trường thực tế có thể lấy
- historical price/volume cho các horizon mà scoring sử dụng
- timestamp/as-of và trading date

Không giả định field/API nào chưa được xác minh. Mọi field phải có metadata về nguồn, timestamp và trạng thái `available/missing/stale`.

## 21. Canonical normalized schema

Data Layer tạo một snapshot chuẩn, ví dụ:

```js
{
  source: 'SSI',
  asOf: '2026-08-12T...',
  tradingDate: '2026-08-12',
  ticker: 'VCB',
  market: 'HOSE',
  quote: { price, open, high, low, volume },
  valuation: { pe, pb, eps },
  profitability: { roe, roa, roic },
  growth: { revenueGrowth, epsGrowth },
  leverage: { debtRatio },
  history: { ... },
  sourceFields: { ... }
}
```

Tên field cuối cùng phải bám schema thực tế của SSI và schema hiện tại của Stock Mind; không tự bịa dữ liệu hoặc suy luận field chưa có.

## 22. Snapshot / cache policy

Một lần lấy SSI data tạo một immutable analysis snapshot cho một run:

```text
SSI snapshot
   ↓
Screening
   ↓
CRSM Node 1..N
```

Các node trong cùng một CRSM run dùng cùng snapshot, tránh việc Node 1 và Node 3 nhìn thấy dữ liệu market khác thời điểm.

Cache key phải bao gồm ít nhất:

```text
provider + ticker + tradingDate/asOf + schemaVersion
```

Dữ liệu stale phải được đánh dấu rõ thay vì âm thầm dùng như dữ liệu realtime.

## 23. Web Search policy after SSI

Web Search không còn là nguồn chính cho dữ liệu định lượng đã có trong SSI.

CRSM chỉ search khi cần thông tin không có trong market-data snapshot, chủ yếu:

- kinh tế vĩ mô: GDP, CPI, lãi suất, tỷ giá, chính sách tiền tệ
- chính trị/chính sách và pháp lý có ảnh hưởng thị trường/ngành
- địa chính trị, thương mại, thuế quan, chiến tranh và các cú sốc bên ngoài
- tin doanh nghiệp: M&A, dự án, thay đổi lãnh đạo, sự kiện bất thường
- tin và chính sách ngành
- catalyst/risk/narrative cần xác minh từ nguồn bên ngoài

Nếu một định lượng đã có trong SSI snapshot, node **không search lại chỉ để lấy cùng một con số**, trừ khi đang thực hiện cross-check vì phát hiện bất thường hoặc stale data.

## 24. CRSM handoff after SSI

Handoff mới:

```text
Dashboard / Ranking
       ↓
Click ticker
       ↓
Get/validate SSI snapshot
       ↓
Screening context
       ↓
CRSM SCREENED
```

CRSM nhận snapshot + screening context. Node 1 tập trung vào verification/anomaly detection và research bổ sung, thay vì dùng web search để thu thập lại toàn bộ market/fundamental data.

## 25. Migration / compatibility

Trong giai đoạn chuyển tiếp:

- Giữ manual import workflow để regression và fallback.
- Không xóa parser cho tới khi SSI provider chứng minh được parity với các field scoring cần thiết.
- Có feature flag/data-source setting: `IMPORT` / `SSI`.
- Chạy dual-source validation trên một tập mã trước khi SSI trở thành nguồn mặc định.
- So sánh SSI snapshot với dữ liệu import hiện tại và log discrepancies.
- Chỉ bỏ TradingView workflow sau khi parity, reliability và permission/access requirements đạt acceptance criteria.

## 26. Acceptance tests — SSI Phase

- **SSI-1**: provider kết nối thành công và xác thực auth/error handling.
- **SSI-2**: ticker snapshot normalize đúng canonical schema.
- **SSI-3**: missing/stale fields không làm scoring âm thầm dùng dữ liệu sai.
- **SSI-4**: cùng một CRSM run dùng cùng một immutable snapshot.
- **SSI-5**: screening results từ SSI có parity với required screening fields.
- **SSI-6**: dual-source comparison phát hiện discrepancy và không overwrite silently.
- **SSI-7**: CRSM không web-search lại các định lượng đã có trong snapshot.
- **SSI-8**: web research vẫn hoạt động cho macro/politics/policy/news/catalysts.
- **SSI-9**: manual import fallback vẫn hoạt động khi SSI unavailable.
- **SSI-10**: chỉ khi tất cả acceptance tests pass mới xem xét bỏ TradingView workflow.

## 27. Security / operational requirements

- Không commit SSI credentials vào repository.
- Thiết kế credential storage phù hợp deployment model trước khi public deployment.
- Respect SSI API rate limits, terms and access permissions.
- Có retry/backoff và explicit rate-limit errors.
- Có usage/latency logging cho data provider, tách khỏi LLM usage.

## 28. Phase 2 stop condition

Không bắt đầu xóa TradingView/import code chỉ vì SSI endpoint đã gọi được. Phải chứng minh:

1. field coverage đủ cho screening;
2. snapshot consistency đủ cho CRSM;
3. reliability/rate-limit behavior chấp nhận được;
4. discrepancy handling rõ ràng;
5. web-search reduction thực sự đạt mục tiêu;
6. manual fallback vẫn tồn tại trong giai đoạn migration.
