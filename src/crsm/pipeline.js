import { node1 } from './nodes/node1.js';
import { node2 } from './nodes/node2.js';
import { node3 } from './nodes/node3.js';
import { node4 } from './nodes/node4.js';
import { node5 } from './nodes/node5.js';
import { renderNode6A } from './nodes/node6a.js';
import { renderNode6B } from './nodes/node6b.js';
import { node7 } from './nodes/node7.js';

export const NODES = [
  ['node1', node1],
  ['node2', node2],
  ['node3', node3],
  ['node4', node4],
  ['node5', node5],
  ['node6a', renderNode6A],
  ['node6b', renderNode6B],
  ['node7', node7]
];

const PARALLEL_STAGES = [
  ['node2', 'node3']
];

export async function runPipeline({
  ticker,
  screeningContext,
  mode,
  startFrom = 'node1',
  existingOutputs = {},
  executionMode = 'sequential',
  onNodeStart,
  onNodeDone,
  onNodeError
}) {
  const ctx = {
    ticker,
    screeningContext,
    mode: mode || (screeningContext ? 'SCREENED' : 'DIRECT'),
    outputs: { ...existingOutputs }
  };

  const startIndex = NODES.findIndex(([id]) => id === startFrom);
  if (startIndex < 0) throw new Error(`startFrom không hợp lệ: ${startFrom}`);

  const orderedIds = NODES.slice(startIndex).map(([id]) => id);
  const stages = executionMode === 'parallel'
    ? buildParallelStages(orderedIds)
    : orderedIds.map(id => [id]);

  for (const stage of stages) {
    const result = stage.length === 1
      ? await runNode(stage[0], ctx, { onNodeStart, onNodeDone, onNodeError })
      : await runStage(stage, ctx, { onNodeStart, onNodeDone, onNodeError });

    if (result.failedNode) return { ctx, failedNode: result.failedNode, error: result.error };
  }

  return { ctx, failedNode: null, error: null };
}

function buildParallelStages(orderedIds) {
  const remaining = new Set(orderedIds);
  const stages = [];

  for (const stage of PARALLEL_STAGES) {
    const available = stage.filter(id => remaining.has(id));
    if (!available.length) continue;
    stages.push(available);
    available.forEach(id => remaining.delete(id));
  }

  orderedIds.forEach(id => {
    if (remaining.has(id)) stages.push([id]);
  });

  return stages;
}

async function runStage(stage, ctx, callbacks) {
  const results = await Promise.allSettled(stage.map(nodeId => runNode(nodeId, ctx, callbacks)));
  const failedIndex = results.findIndex(result => result.status === 'fulfilled' && result.value.failedNode);
  if (failedIndex >= 0) return results[failedIndex].value;
  const rejectedIndex = results.findIndex(result => result.status === 'rejected');
  if (rejectedIndex >= 0) return { failedNode: stage[rejectedIndex], error: results[rejectedIndex].reason };
  return { failedNode: null, error: null };
}

async function runNode(nodeId, ctx, { onNodeStart, onNodeDone, onNodeError }) {
  const fn = NODES.find(([id]) => id === nodeId)?.[1];
  if (!fn) throw new Error(`Không tìm thấy node ${nodeId}.`);

  const status = onNodeStart ? onNodeStart(nodeId) : null;
  if (status === 'skipped') {
    ctx.outputs[nodeId] = null;
    onNodeDone?.(nodeId, null);
    return { failedNode: null, error: null };
  }

  try {
    const output = await fn(ctx);
    ctx.outputs[nodeId] = output;
    onNodeDone?.(nodeId, output);
    return { failedNode: null, error: null };
  } catch (error) {
    onNodeError?.(nodeId, error);
    return { failedNode: nodeId, error };
  }
}
