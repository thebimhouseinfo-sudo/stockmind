export const crsmState = {
  isRunning: false,
  mode: null,
  ticker: null,
  screeningContext: null,
  currentNode: null,
  failedNode: null,
  nodeStatus: {},
  nodeOutputs: {},
  usage: [],
  finalReport: null,
  logRows: [],
  error: null,
  startedAt: null,
  completedAt: null
};

const subscribers = new Set();

export function subscribeCRSM(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function notifyCRSM() {
  subscribers.forEach(fn => {
    try {
      fn();
    } catch (e) {
      console.error('CRSM subscriber error', e);
    }
  });
}

export function resetState(overrides = {}) {
  Object.keys(crsmState).forEach(key => {
    if (key === 'isRunning') return;
    if (Array.isArray(crsmState[key])) crsmState[key] = [];
    else if (crsmState[key] && typeof crsmState[key] === 'object') crsmState[key] = {};
    else crsmState[key] = null;
  });
  Object.assign(crsmState, overrides);
  crsmState.isRunning = true;
  crsmState.startedAt = new Date().toISOString();
  crsmState.nodeStatus = {};
  crsmState.nodeOutputs = {};
  crsmState.usage = [];
  crsmState.logRows = [];
  crsmState.error = null;
  crsmState.finalReport = null;
}