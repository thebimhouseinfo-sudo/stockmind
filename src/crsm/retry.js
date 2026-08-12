import { runPipeline } from './pipeline.js';

export async function retryFromNode({ node, ticker, screeningContext, mode, existingOutputs, onNodeStart, onNodeDone, onNodeError }) {
  if (!node || node === 'node1') return { startedFrom: 'node1', reused: false, result: null };
  const result = await runPipeline({
    ticker,
    screeningContext,
    mode,
    startFrom: node,
    existingOutputs,
    onNodeStart,
    onNodeDone,
    onNodeError
  });
  return { startedFrom: node, reused: true, result };
}