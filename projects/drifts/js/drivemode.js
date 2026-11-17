// Driving mode: while a trip is running, only the Monitor tab is available (fewer
// distractions, no accidental taps into settings) and the screen is kept awake so
// the camera, sensors and alarms keep working.

let wakeLock = null;
let wakeLockWarned = false;

function enterDrivingMode() {
  document.getElementById('phone-root').classList.add('driving');
  closeSheet();
  showScreen('home');
  requestWakeLock();
}

function exitDrivingMode() {
  document.getElementById('phone-root').classList.remove('driving');
  wakeLockWarned = false;
  releaseWakeLock();
}

function isDrivingMode() {
  return document.getElementById('phone-root').classList.contains('driving');
}

// ---------- Screen Wake Lock ----------
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    logEvent('This browser cannot keep the screen on. Set auto-lock to "Never" while driving.', 'warn');
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) {
    // Can fail if the page isn't visible/focused yet; retried on return and on the next tap
    if (!wakeLockWarned) {
      wakeLockWarned = true;
      logEvent('Could not keep the screen on yet. DRIFTS will retry; you can also set auto-lock to "Never".', 'warn');
    }
  }
}

function releaseWakeLock() {
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}

function initDrivingMode() {
  // The browser drops the wake lock whenever the app is hidden; take it back on return
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isDrivingMode() && !wakeLock) requestWakeLock();
  });
  document.addEventListener('pointerdown', () => {
    if (isDrivingMode() && !wakeLock && 'wakeLock' in navigator) requestWakeLock();
  });
}
