"# Stock Mind + CRSM Integration — Implementation Plan (FINAL v3)

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
├── parser.js               (giữ nguyên)
├── scoring.js              (giữ nguyên)
├── sample.js               (giữ nguyên)
├── crsm/
│   ├── engine.js           public entry runCRSM({...})
│   ├── pipeline.js         Node 1→7 orchestrator
│   ├── retry.js            preserve completed outputs
│   ├── state.js            crsmState độc lập
│   ├── cache.js            cache completed runs
│   ├── context.js          buildScreeningContext(stock)
│   ├── llm.js              runLLM({nodeId, prompt, ...})
│   ├── router.js           resolveProviderModel + capability check
│   ├── usage.js            per-node usage tracker
│   ├── prompts/            generated từ legacy/CRSM/*.md
│   ├── nodes/              business logic per node
│   ├── providers/          gemini, openai, ollama-cloud (fetch REST)
│   ├── settings.js         AppSettings + CRSMModelRouting
│   └── ui/                 progress, snapshot, status, error, direct, settings
styles.css                  (sửa nhỏ)
build-prompts.js            build-time script
package.json                (sửa: thêm scripts)
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
  \"build:prompts\": \"node build-prompts.js\",
  \"dev\": \"npm run build:prompts && python -m http.server 4321\",
  \"start\": \"npm run build:prompts && python -m http.server 4321\",
  \"prebuild\": \"npm run build:prompts\"
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
      node3: { provider: 'gemini', model: 'gemini-2.5-flash', enabled: true },  // default fallback
      node4: { provider: 'gemini', model: 'gemini-2.5-flash', enabled: true },
      node5: { provider: 'gemini', model: 'gemini-2.5-flash', enabled: true }   // default fallback
      // node6a/6b/7 không có ở đây — system-managed local renderers
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
- SCREENED: `SCREENED:${ticker}:${screening_as_of}` — ASP 12/08/2026 KHÔNG đè ASP 13/08/2026.
- DIRECT: `DIRECT:${ticker}:${todayISODate()}`.

Cache only completed runs. DIRECT và SCREENED không share cache entry.

## 11. retry.js

```js
retryFromNode(failedNode) {
  const preserved = { ...crsmState.nodeOutputs };  // KHÔNG recreate empty ctx
  return runPipeline({
    ...,
    startFrom: failedNode,
    existingOutputs: preserved
  });
}
```

## 12. pipeline.js

```js
const NODES = [['node1',node1], ['node2',node2], ...];

runPipeline({ ticker, screeningContext, startFrom='node1', existingOutputs={}, ... }) {
  const ctx = { ticker, screeningContext, outputs: { ...existingOutputs } };
  // iterate từ startFrom, mỗi node fn(ctx) → ctx.outputs[node] = output
  // nếu throw → return incomplete, KHÔNG tiếp tục
}
```

## 13. nodes/

Mỗi node có pattern:
```js
export async function node1(ctx) {
  const userPrompt = buildUserPrompt(ctx);   // inject ticker, screeningContext, peer data...
  const result = await runLLM({ nodeId: 'node1', prompt: userPrompt, systemInstruction: node1Prompt, responseFormat: 'json' });
  return validateOutput(JSON.parse(result.text));
}
```

Đặc biệt Node 3: phát hiện EPS_REVENUE_DISCONNECT (EPS Growth vs Revenue Growth chênh lệch lớn) → flag trong `screening_flags`.

Node 5: SOLE AUTHORITY cho `screen_vs_crsm.status` theo ngưỡng `|diff|≤5 / 5<|diff|≤15 / |diff|>15`.

Node 6A/6B: chỉ RENDER, không tính lại.

Node 7: append-only log.

## 14. engine.js

```js
export async function runCRSM({ mode, ticker, screeningContext=null, onProgress, onError, onComplete }) {
  // 1. cache check
  // 2. reset crsmState, set mode/ticker/screeningContext
  // 3. validate: SCREENED mode phải có screeningContext; DIRECT mode screeningContext = null
  // 4. runPipeline với onNodeStart/onNodeDone/onNodeError hooks
  // 5. cacheSet khi complete
}
```

## 15. UI integration (app.js)

- Thêm tab `crsm` vào topbar (Paste / Dashboard / Ranking / CRSM).
- Khi click ticker từ Ranking → chuyển sang tab CRSM, gọi `runCRSM({mode:'SCREENED', ticker, screeningContext: buildScreeningContext(stock)})`.
- Tab CRSM có 2 entry points:
  - Direct: input ticker + button "Phân tích bằng CRSM" → `runCRSM({mode:'DIRECT', ticker, screeningContext: null})`.
- Progress bar hiển thị node1→node7 với status từng node.
- Screening Snapshot card (chỉ SCREENED) ở đầu, render từ `screeningContext` + `crsmState.nodeOutputs.node5.screen_vs_crsm`.
- Error state: hiển thị `failedNode` + nút Retry.
- Back button → quay lại Ranking mà KHÔNG mất `state.rows`, `state.search`, filters.

## 16. styles.css

Thêm ~80 dòng cho:
- `.crsm-progress` (progress bar với 8 step: node1..node7)
- `.screening-snapshot` (card 9 sub-scores: Score/Rank/Grade/Quality/Growth/Valuation/Micro/Momentum/Mispricing)
- `.crsm-status` (CONFIRMED/PARTIAL/DIVERGENT badge với 3 màu)
- `.crsm-direct-entry` (form nhập ticker)
- `.crsm-error` (error block với retry button)
- `.settings-panel` (3 sections)

## 17. Acceptance tests

- **TEST 1 SCREENED**: Click ASP từ Ranking → CRSM tab mở, screening_snapshot hiển thị Score=83.01/Rank=1/Grade=A. mode='SCREENED'.
- **TEST 2 DIRECT**: Nhập HAH từ CRSM tab → CRSM chạy. mode='DIRECT', screeningContext=null, KHÔNG có screening_snapshot.
- **TEST 3 DIVERGENT**: Mock Screen=83, CRSM=58 → diff=-25 → status='DIVERGENT'. Node 6 chỉ render.
- **TEST 4 CONFIRMED**: Mock Screen=83, CRSM=85 → diff=+2 → status='CONFIRMED'.
- **TEST 5 EPS_REVENUE_DISCONNECT**: ASP Revenue=+6.1%, EPS=+316.22% → Node 3 flag `EPS_REVENUE_DISCONNECT`, Node 1 có `financial_income/expense/other_income/other_expense` raw.
- **TEST 6 Routing Test A**: Node 1=Gemini, Node 2=Gemini, Node 3=OpenAI, Node 4=Gemini, Node 5=Ollama → tất cả chạy với provider/model đúng.
- **TEST 7 Routing Test B**: Assign OpenAI model (không web grounding) cho Node 1 → BLOCKED với lý do rõ ràng.
- **TEST 8 Regression**: Paste TradingView → ranking hoạt động như cũ, không CRSM.
- **TEST 9 Retry**: Node 1✓, Node 2✓, Node 3✗ → Retry Node 3 → Node 1/2 KHÔNG chạy lại, Node 3/4/5/6/7 chạy.
- **TEST 10 Back**: CRSM tab → Back → Ranking state giữ nguyên.

## 18. Stop condition

Nếu StockScreener regression test fail → DỪNG coding, fix integration trước. KHÔNG \"improve\" code không liên quan.
"