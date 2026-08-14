import { node1 } from './nodes/node1.js';
import { node2 } from './nodes/node2.js';
import { node3 } from './nodes/node3.js';
import { node4 } from './nodes/node4.js';
import { node5 } from './nodes/node5.js';
import { node6a } from './nodes/node6a.js';
import { node6b } from './nodes/node6b.js';
import { node7 } from './nodes/node7.js';
import { consumePendingUserEvidence, getPendingUserEvidence } from './user-evidence.js';
import { buildExecutionStages } from './execution-policy.js';
import { loadSettings } from './settings.js';
import { crsmState, notifyCRSM } from './state.js';
import { prepareNode6AOutputs, localizeReportText } from './report-data-normalizer.js';

export const NODES = [
  ['userEvidence', prepareUserEvidence],
  ['node1', node1],
  ['node2', node2],
  ['node3', node3],
  ['node4', node4],
  ['node5', node5],
  ['node6a', node6a],
  ['node6b', node6b],
  ['node7', node7]
];

async function prepareUserEvidence() {
  return consumePendingUserEvidence();
}

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

  const effectiveStart = startFrom === 'node1' && getPendingUserEvidence() ? 'userEvidence' : startFrom;
  const startIndex = NODES.findIndex(([id]) => id === effectiveStart);
  if (startIndex < 0) throw new Error(`startFrom không hợp lệ: ${effectiveStart}`);

  const orderedIds = NODES.slice(startIndex).map(([id]) => id);
  const settings = loadSettings();
  const stages = buildRuntimeStages(orderedIds, settings, executionMode);
  initRuntimeStageState(stages);

  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const stage = stages[stageIndex];
    markStageRunning(stageIndex, stage);

    const result = stage.length === 1
      ? await runNode(stage[0], ctx, { onNodeStart, onNodeDone, onNodeError })
      : await runStage(stage, ctx, { onNodeStart, onNodeDone, onNodeError });

    if (result.failedNode) {
      markStageFailed(stageIndex, result.failedNode, result.error);
      return { ctx, failedNode: result.failedNode, error: result.error };
    }

    markStageDone(stageIndex, stage);
  }

  crsmState.currentNode = null;
  crsmState.currentStage = null;
  crsmState.isRunning = false;
  crsmState.completedAt = new Date().toISOString();
  notifyCRSM();

  return { ctx, failedNode: null, error: null };
}

function buildRuntimeStages(orderedIds, settings, legacyExecutionMode) {
  const stages = buildExecutionStages(orderedIds, settings);
  if (legacyExecutionMode !== 'parallel') return stages.map(stage => [...stage]);
  return stages;
}

function initRuntimeStageState(stages) {
  crsmState.executionStages = stages.map((nodes, index) => ({
    index,
    nodes: [...nodes],
    mode: nodes.length > 1 ? 'parallel' : 'sequential'
  }));
  crsmState.stageStatus = Object.fromEntries(stages.map((_, index) => [index, 'pending']));
  crsmState.executionMode = stages.some(stage => stage.length > 1) ? 'mixed' : 'sequential';
  crsmState.currentStage = null;
  crsmState.currentNode = null;
  notifyCRSM();
}

function markStageRunning(stageIndex, stage) {
  crsmState.currentStage = stageIndex;
  crsmState.stageStatus[stageIndex] = 'running';
  stage.forEach(nodeId => {
    if (crsmState.nodeStatus[nodeId] !== 'done') crsmState.nodeStatus[nodeId] = 'running';
  });
  crsmState.currentNode = stage.length === 1 ? stage[0] : null;
  notifyCRSM();
}

function markStageDone(stageIndex, stage) {
  crsmState.stageStatus[stageIndex] = 'done';
  stage.forEach(nodeId => {
    if (crsmState.nodeStatus[nodeId] !== 'failed') crsmState.nodeStatus[nodeId] = 'done';
  });
  notifyCRSM();
}

function markStageFailed(stageIndex, failedNode, error) {
  crsmState.stageStatus[stageIndex] = 'failed';
  crsmState.failedNode = failedNode;
  crsmState.error = { node: failedNode, message: error?.message || String(error) };
  crsmState.currentNode = failedNode;
  crsmState.isRunning = false;
  notifyCRSM();
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
    crsmState.nodeStatus[nodeId] = 'skipped';
    onNodeDone?.(nodeId, null);
    notifyCRSM();
    return { failedNode: null, error: null };
  }

  crsmState.nodeStatus[nodeId] = 'running';
  if (!crsmState.currentStage && crsmState.executionStages.length) crsmState.currentStage = crsmState.executionStages.findIndex(s => s.nodes.includes(nodeId));
  if (crsmState.executionStages[crsmState.currentStage]?.nodes.length === 1) crsmState.currentNode = nodeId;
  notifyCRSM();

  try {
    const nodeCtx = nodeId === 'node6a' || nodeId === 'node6b'
      ? { ...ctx, outputs: prepareNode6AOutputs(ctx.outputs) }
      : ctx;
    const rawOutput = await fn(nodeCtx);
    const output = (nodeId === 'node6a' || nodeId === 'node6b') && typeof rawOutput === 'string'
      ? localizeReportText(rawOutput)
      : rawOutput;
    ctx.outputs[nodeId] = output;
    if (nodeId === 'node1' && ctx.outputs.userEvidence) {
      ctx.outputs.node1 = { ...output, user_evidence: ctx.outputs.userEvidence };
      crsmState.nodeOutputs[nodeId] = ctx.outputs.node1;
      onNodeDone?.(nodeId, ctx.outputs.node1);
    } else {
      crsmState.nodeOutputs[nodeId] = output;
      onNodeDone?.(nodeId, output);
    }
    crsmState.nodeStatus[nodeId] = 'done';
    notifyCRSM();
    return { failedNode: null, error: null };
  } catch (error) {
    crsmState.nodeStatus[nodeId] = 'failed';
    onNodeError?.(nodeId, error);
    notifyCRSM();
    return { failedNode: nodeId, error };
  }
}
