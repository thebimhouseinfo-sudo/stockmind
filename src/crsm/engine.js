import { crsmState, resetState, notifyCRSM } from './state.js';
import { runPipeline } from './pipeline.js';
import { cacheGet, cacheSet, cacheKey } from './cache.js';

export async function runCRSM({ mode, ticker, screeningContext = null, startFrom = 'node1', existingOutputs = null, bypassCache = false, onProgress, onError, onComplete } = {}) {
  const validMode = mode === 'SCREENED' || mode === 'DIRECT';
  if (!validMode) throw new Error(`mode không hợp lệ: ${mode}`);
  if (mode === 'SCREENED' && !screeningContext) {
    throw new Error('SCREENED mode bắt buộc có screeningContext.');
  }
  if (mode === 'DIRECT') screeningContext = null;
  if (!ticker) throw new Error('Thiếu ticker.');

  const isRetry = startFrom !== 'node1';

  if (!isRetry && !bypassCache) {
    const cached = cacheGet({ mode, ticker });
    if (cached) {
      hydrateFromCache({ mode, ticker, screeningContext, outputs: cached });
      notifyCRSM();
      onComplete?.({ mode, ticker, outputs: cached, cachedRun: true, failedNode: null });
      return { mode, ticker, outputs: cached, cachedRun: true, failedNode: null };
    }
  }

  resetState({ mode, ticker, screeningContext });
  if (existingOutputs) {
    crsmState.nodeOutputs = { ...existingOutputs };
    Object.keys(existingOutputs).forEach(id => {
      crsmState.nodeStatus[id] = 'done';
    });
  }
  crsmState.logRows.push(isRetry ? `↻ retry từ node ${startFrom}` : `▶ bắt đầu run ${mode}`);

  let result;
  try {
    result = await runPipeline({
      ticker,
      screeningContext,
      mode,
      startFrom,
      existingOutputs: crsmState.nodeOutputs,
      onNodeStart: nodeId => {
        crsmState.currentNode = nodeId;
        crsmState.nodeStatus = { ...crsmState.nodeStatus, [nodeId]: 'running' };
        crsmState.logRows.push(`→ node ${nodeId} running`);
        notifyCRSM();
        onProgress?.({ nodeId, status: 'running' });
      },
      onNodeDone: (nodeId, output) => {
        crsmState.nodeOutputs = { ...crsmState.nodeOutputs, [nodeId]: output };
        crsmState.nodeStatus = { ...crsmState.nodeStatus, [nodeId]: 'done' };
        crsmState.logRows.push(`✔ node ${nodeId} done`);
        notifyCRSM();
        onProgress?.({ nodeId, status: 'done', output });
      },
      onNodeError: (nodeId, error) => {
        crsmState.currentNode = null;
        crsmState.failedNode = nodeId;
        crsmState.nodeStatus = { ...crsmState.nodeStatus, [nodeId]: 'failed' };
        crsmState.error = { node: nodeId, message: String(error?.message || error) };
        crsmState.logRows.push(`✖ node ${nodeId} failed: ${error?.message || error}`);
        notifyCRSM();
        onError?.({ nodeId, error, partial: crsmState.nodeOutputs });
      }
    });
  } catch (error) {
    crsmState.isRunning = false;
    crsmState.error = { node: null, message: String(error?.message || error) };
    notifyCRSM();
    return { mode, ticker, failedNode: null, error };
  }

  crsmState.isRunning = false;
  crsmState.finalReport = crsmState.nodeOutputs.node6a || null;
  crsmState.completedAt = new Date().toISOString();

  if (result.failedNode) {
    notifyCRSM();
    return { mode, ticker, failedNode: result.failedNode, error: result.error, outputs: crsmState.nodeOutputs, cachedRun: false };
  }

  if (!isRetry) cacheSet({ mode, ticker }, crsmState.nodeOutputs);
  notifyCRSM();
  onComplete?.({
    mode,
    ticker,
    outputs: crsmState.nodeOutputs,
    cachedRun: false,
    failedNode: null,
    log: crsmState.logRows
  });
  return { mode, ticker, failedNode: null, outputs: crsmState.nodeOutputs, cachedRun: false };
}

function hydrateFromCache({ mode, ticker, screeningContext, outputs }) {
  resetState({ mode, ticker, screeningContext });
  crsmState.isRunning = false;
  crsmState.nodeOutputs = { ...outputs };
  crsmState.nodeStatus = Object.fromEntries(Object.keys(outputs).map(id => [id, 'done']));
  crsmState.logRows = ['loaded from cache'];
  crsmState.finalReport = outputs.node6a || null;
  crsmState.completedAt = outputs.completedAt || null;
  if (outputs.node1?.timestamp) crsmState.logRows.push(`as of ${outputs.node1.timestamp}`);
}