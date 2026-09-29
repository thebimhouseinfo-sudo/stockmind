export function createResultsPoller({
  poll,
  intervalMs = 5000,
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval
} = {}) {
  if (typeof poll !== 'function') throw new Error('poll function is required');
  if (typeof setIntervalImpl !== 'function' || typeof clearIntervalImpl !== 'function') {
    throw new Error('timer functions are required');
  }

  let timer = null;
  let active = false;

  function start() {
    if (active) return false;
    active = true;
    timer = setIntervalImpl(async () => {
      if (!active) return;
      try {
        await poll();
      } catch {
        // Transport errors are surfaced and stop the poller by the caller.
      }
    }, intervalMs);
    return true;
  }

  function stop() {
    if (!active) return false;
    active = false;
    if (timer != null) clearIntervalImpl(timer);
    timer = null;
    return true;
  }

  function isActive() {
    return active;
  }

  return { start, stop, isActive };
}
