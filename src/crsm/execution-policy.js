import { NODES_LOCAL, loadSettings } from './settings.js';

// Dependency stages are fixed by data requirements. Execution policy may only
// choose how independently runnable tasks inside a stage are scheduled.
export const DEPENDENCY_STAGES = [
  ['userEvidence'],
  ['node1'],
  ['node2', 'node3'],
  ['node4'],
  ['node5'],
  ['node6a', 'node6b', 'node7']
];

const STAGE_POLICY_KEYS = [
  'userEvidence',
  'node1',
  'research',
  'node4',
  'node5',
  'reports'
];

export function buildExecutionStages(orderedIds, settings = loadSettings()) {
  const remaining = new Set(orderedIds);
  const stages = [];

  for (const dependencyGroup of DEPENDENCY_STAGES) {
    const available = dependencyGroup.filter(id => remaining.has(id));
    if (!available.length) continue;

    const key = stageKey(dependencyGroup);
    const mode = resolveStageMode(key, available, settings);
    const chunks = mode === 'parallel' && available.length > 1
      ? [available]
      : available.map(id => [id]);

    chunks.forEach(stage => stage.forEach(id => remaining.delete(id)));
    stages.push(...chunks);
  }

  // Preserve forward compatibility if a new node is introduced without being
  // added to the fixed dependency graph yet: run it sequentially rather than
  // silently widening the pipeline's concurrency.
  for (const id of remaining) stages.push([id]);

  return stages;
}

export function resolveStageMode(stageKey, nodeIds, settings = loadSettings()) {
  if (nodeIds.length < 2) return 'sequential';

  const configured = settings?.crsm?.executionPolicy?.parallelStages?.[stageKey];
  const defaultMode = settings?.crsm?.executionPolicy?.default || 'auto';

  if (allLocal(nodeIds)) {
    // Local work has no API concurrency cost. Within dependency bounds it is
    // parallel by default, regardless of the legacy global executionMode.
    return configured === 'sequential' ? 'sequential' : 'parallel';
  }

  // A stage containing AI work is only parallel when explicitly allowed by
  // the stage policy. The user-facing Setting UI will later control this.
  if (configured === 'parallel') return 'parallel';
  if (configured === 'sequential') return 'sequential';
  if (defaultMode === 'parallel') return 'parallel';
  return 'sequential';
}

export function stageKey(nodeIds) {
  if (nodeIds.includes('node2') && nodeIds.includes('node3')) return 'research';
  if (nodeIds.includes('node6a') || nodeIds.includes('node6b') || nodeIds.includes('node7')) return 'reports';
  return STAGE_POLICY_KEYS.find(key => nodeIds.includes(key)) || nodeIds[0];
}

export function allLocal(nodeIds) {
  return nodeIds.every(id => NODES_LOCAL.includes(id));
}

export function getExecutionDescriptor(settings = loadSettings()) {
  return DEPENDENCY_STAGES.map(group => ({
    nodes: [...group],
    stage: stageKey(group),
    allowedParallel: group.length > 1,
    mode: resolveStageMode(group, group, settings)
  }));
}
