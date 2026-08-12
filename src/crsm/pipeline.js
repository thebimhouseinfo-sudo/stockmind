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

export async function runPipeline({
  ticker,
  screeningContext,
  mode,
  startFrom = 'node1',
  existingOutputs = {},
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

  for (let index = startIndex; index < NODES.length; index += 1) {
    const [nodeId, fn] = NODES[index];
    const status = onNodeStart ? onNodeStart(nodeId) : null;
    if (status === 'skipped') {
      ctx.outputs[nodeId] = null;
      if (onNodeDone) onNodeDone(nodeId, null);
      continue;
    }
    try {
      const output = await fn(ctx);
      ctx.outputs[nodeId] = output;
      if (onNodeDone) onNodeDone(nodeId, output);
    } catch (error) {
      if (onNodeError) onNodeError(nodeId, error);
      return { ctx, failedNode: nodeId, error };
    }
  }

  return { ctx, failedNode: null, error: null };
}