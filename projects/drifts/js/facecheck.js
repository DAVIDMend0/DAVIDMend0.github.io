// Routine face check: during a trip, wake the camera every N minutes (Profile setting)
// for the usual 7-second check, even if the sensors haven't noticed anything.
// It runs as a "test" check, so it never lowers the UFAS score or counts as an alert,
// but eyes closing or looking away during it are handled like any other check.

const FACECHECK_POLL_MS = 5000;

function faceCheckIntervalMs() {
  const min = parseInt(document.getElementById('sel-facecheck').value, 10);
  return Number.isFinite(min) && min > 0 ? min * 60000 : 0;
}

function runRoutineFaceCheck() {
  const every = faceCheckIntervalMs();
  if (!every || !appState.sessionActive || appState.visionActive || appState.lockoutActive) return;
  if (Date.now() - (appState.lastFaceCheckAt || 0) < every) return;
  tripEvent('routine', `Scheduled check (every ${every / 60000} min). Doesn't lower the score.`);
  logEvent('Routine face check: waking the camera for a quick look.');
  activateStage2Vision('Routine face check • keep driving as usual', 'M', { test: true });
}

function initFaceCheck() {
  setInterval(runRoutineFaceCheck, FACECHECK_POLL_MS);
}
