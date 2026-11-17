// Driving session, UFAS penalties, full-screen lockout and "I am safe" hold.

function handleArrivedSafely() {
  // 0. End the driving session (an active alarm can only be cleared by "I am safe")
  if (appState.lockoutActive) return;
  endTripLog();
  const tripMin = appState.sessionStartedAt ? Math.round((Date.now() - appState.sessionStartedAt) / 60000) : 0;
  const tripAlerts = appState.cameraAlerts;
  appState.sessionActive = false;
  appState.sessionStartedAt = null;
  appState.ufasCeiling = 100;
  appState.cameraAlerts = 0;
  updateSessionButton();
  updateUfasAlertLine();

  // 1. Stop camera recording and reset Stage 2 Vision
  if (appState.visionActive) bleCameraSignal(false);
  bleSend('R', { force: true });   // tells the module the trip ended (all outputs off)
  appState.visionActive = false;
  stopRealWebcam();
  document.getElementById('vision-standby-overlay').classList.remove('hidden');
  const vCard = document.getElementById('vision-card');
  vCard.classList.remove('triggered');
  vCard.classList.add('collapsed');
  const barFill = document.getElementById('cam-timer-bar-fill');
  if (barFill) barFill.style.width = '0%';
  const vPill = document.getElementById('vision-state-pill');
  vPill.textContent = 'SLEEPING';
  vPill.classList.remove('active');
  document.getElementById('island-cam-dot').classList.remove('cam-active');
  document.getElementById('cam-timer-lbl').textContent = 'Standby (Saves Battery)';
  document.getElementById('dev-cam-status').textContent = 'Gated Standby • 468 Landmarks';

  // 2. Disconnect phone hardware sensors (IMU + GPS)
  window.removeEventListener('devicemotion', handleDeviceMotion);
  if (appState.gpsWatchId !== null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(appState.gpsWatchId);
    appState.gpsWatchId = null;
  }
  resetGPS();
  const gpsMiles = maintTripEnded();
  appState.hardwareSensorsBound = false;
  appState.drivingAnomalyScore = 0;
  appState.accelG = 1.00;
  appState.gyroRate = 0.0;
  appState.perclos = 0;
  appState.closedFramesWindow = [];
  appState.criticalStateStart = null;

  // Restore frosted sensor link overlay
  document.getElementById('telemetry-wrap').classList.add('unlinked');
  document.getElementById('sensor-overlay').classList.remove('hidden');
  const statusPill = document.getElementById('sensor-status-pill');
  statusPill.textContent = 'Unlinked';
  statusPill.classList.remove('connected');
  const srcLbl = document.getElementById('sensor-source-lbl');
  srcLbl.textContent = 'Awaiting Link';
  srcLbl.style.color = '#8E8E93';

  document.getElementById('dev-motion-status').textContent = 'Tap to bind DeviceMotion API';
  document.getElementById('dev-motion-status').style.color = '#FF9500';
  document.getElementById('dev-gps-status').textContent = 'Tap to bind Geolocation API';
  document.getElementById('dev-gps-status').style.color = '#FF9500';

  // 3. Unlink the G29 wheel
  unbindWheel(false);

  // 4. Disconnect ATS telemetry and start the next trip with a clean collision score
  disconnectATS();
  resetATSTrip();

  setInterventionState('seat', false);
  setInterventionState('audio', false);

  exitDrivingMode();

  showToast(gpsMiles >= 0.1
    ? `You have arrived! ${gpsMiles.toFixed(1)} mi added to your odometer.`
    : 'You have arrived! Camera stopped & all sensors disconnected.');
  logEvent(`Trip ended after ${tripMin} min with ${tripAlerts} camera alert${tripAlerts === 1 ? '' : 's'}. Camera stopped and all sensors disconnected.`);
}

// ============================================================================
// DRIVING SESSION, UFAS PENALTIES & FULL-SCREEN LOCKOUT ALARM
// ----------------------------------------------------------------------------
// UFAS = min(session ceiling, live fusion score)
//  • Every camera alert during a session lowers the ceiling by 25 points.
//  • The ceiling then climbs back slowly (only while the camera is in standby
//    and driving is calm), so the score can't snap back to 100 after a check.
//  • After N camera alerts in one session (Profile setting, default 4) a
//    full-screen alarm starts and only stops when "I am safe" is held for 7 s.
//    Every further alert in the same session sounds the alarm again.
// Interventions (seat vibration / buzzer) still follow the LIVE score, so a
// low ceiling alone never sets off the buzzer.
// ============================================================================
// Eye closures shorter than this are treated as normal blinks: they don't reset
// the 7 s verification timer and don't trigger an alert. Longer closures do.
const CAMERA_CONFIG = {
  blinkToleranceSec: 0.5
};

const UFAS_CONFIG = {
  penaltyPerCameraAlert: 25,
  recoveryPointsPerMin: 5,      // 75 -> 100 takes about 5 minutes of calm driving
  recoveryMaxAnomaly: 25,       // no recovery while Stage 1 sensors are still agitated
  safeHoldMs: 7000,
  lockoutMinVolume: 0.6         // the lockout alarm ignores a volume slider set lower than this
};

let lockoutSoundTimer = null;
let lockoutClockTimer = null;
const safeHold = { start: null, raf: null };
const SAFE_RING_CIRC = 2 * Math.PI * 86;

function lockoutThreshold() {
  const v = parseInt(document.getElementById('sel-lockout-alerts')?.value, 10);
  return Number.isFinite(v) ? v : 4;
}

function unlockAudio() {
  // iOS only allows WebAudio after a tap, so warm it up on Start Driving
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
}

function toggleDrivingSession() {
  if (appState.sessionActive) handleArrivedSafely();
  else startDrivingSession();
}

function startDrivingSession() {
  unlockAudio();
  const anyInput = appState.hardwareSensorsBound || appState.wheelBound || appState.atsConnected;
  // Same single permission request as the Sensors tab (motion, GPS & camera).
  // Must run inside this tap so iOS shows its motion prompt.
  if (!anyInput) enableHardwareSensors();

  appState.sessionActive = true;
  appState.sessionStartedAt = Date.now();
  appState.ufasCeiling = 100;
  appState.cameraAlerts = 0;
  appState.lockoutCount = 0;
  appState.drivingAnomalyScore = 0;
  appState.alertnessScore = Math.min(100, appState.liveScore);
  updateSessionButton();
  updateUfasAlertLine();
  beginTripLog();
  appState.lastFaceCheckAt = Date.now();
  enterDrivingMode();
  logEvent(`Driving session started. Full-screen alarm after ${lockoutThreshold()} camera alerts.`);
  if (anyInput) showToast('Driving session started. DRIFTS is monitoring.');
}

function updateSessionButton() {
  const btn = document.getElementById('btn-session');
  const active = appState.sessionActive;
  btn.classList.toggle('btn-start', !active);
  document.getElementById('btn-session-lbl').textContent = active ? 'I have arrived' : 'Start Driving';
  document.getElementById('btn-session-icon-start').style.display = active ? 'none' : '';
  document.getElementById('btn-session-icon-end').style.display = active ? '' : 'none';
}

function updateUfasAlertLine() {
  const el = document.getElementById('ufas-alert-line');
  if (!appState.sessionActive) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const n = appState.cameraAlerts, max = lockoutThreshold();
  el.textContent = `Camera alerts this trip: ${n} of ${max}`;
  el.style.color = n >= max ? '#FF3B30' : n >= max - 1 ? '#FF9500' : '#8E8E93';
}

// Called once each time the camera wakes up during a session
function applyCameraAlertPenalty(sourceCode, reasonText = '') {
  appState.cameraAlerts++;
  const before = Math.round(appState.ufasCeiling);
  appState.ufasCeiling = Math.max(0, appState.ufasCeiling - UFAS_CONFIG.penaltyPerCameraAlert);
  appState.alertnessScore = Math.min(appState.alertnessScore, Math.round(appState.ufasCeiling));
  updateUfasAlertLine();
  const why = String(reasonText).replace(/\s*—\s*Rolling FaceMesh\.*$/, '').replace(/ Rolling FaceMesh\.*$/, '');
  const src = (typeof BLE_SOURCE_NAMES !== 'undefined' && BLE_SOURCE_NAMES[sourceCode]) || 'manual';
  tripEvent('camera', `#${appState.cameraAlerts} from ${src}${why ? `: ${why}` : ''}. UFAS ceiling ${before} → ${Math.round(appState.ufasCeiling)}.`);
  logEvent(`Camera alert #${appState.cameraAlerts} this trip: UFAS ceiling ${before} → ${Math.round(appState.ufasCeiling)}.`,
    appState.cameraAlerts >= lockoutThreshold() - 1 ? 'danger' : 'warn');
  if (appState.cameraAlerts >= lockoutThreshold()) triggerLockout();
}

// Slow climb back toward 100 while things are calm
function recoverUfasCeiling(dt) {
  if (!appState.sessionActive || appState.visionActive || appState.lockoutActive) return;
  if (appState.drivingAnomalyScore > UFAS_CONFIG.recoveryMaxAnomaly) return;
  if (appState.ufasCeiling >= 100) return;
  appState.ufasCeiling = Math.min(100, appState.ufasCeiling + (UFAS_CONFIG.recoveryPointsPerMin / 60) * dt);
}

// ---------- Who makes the alarm noise: this phone or the Bluetooth module ----------
function moduleOwnsSound() {
  const mirror = document.getElementById('ble-opt-interventions');
  return (appState.bleLinkPending || appState.bleConnected) && (!mirror || mirror.checked);
}

function updateSoundOwner() {
  const owner = moduleOwnsSound()
    ? (appState.bleConnected ? (bleDevice?.name || 'DRIFTS module') : 'DRIFTS module (linking…)')
    : 'This phone';
  const bleLbl = document.getElementById('ble-sound-owner');
  if (bleLbl) bleLbl.textContent = owner;
  const sub = document.getElementById('sub-audio-owner');
  if (sub) {
    sub.textContent = moduleOwnsSound() ? `Sound handled by ${owner}` : 'Sound plays on this phone';
    sub.style.color = moduleOwnsSound() ? '#34C759' : '#8E8E93';
  }
}

// ---------- Lockout alarm ----------
function formatAlarmClock(d = new Date()) {
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function triggerLockout() {
  const overlay = document.getElementById('lockout');
  appState.lockoutCount++;
  const n = appState.cameraAlerts;
  document.getElementById('lockout-desc').textContent = `${n} camera alert${n === 1 ? '' : 's'} this trip`;
  document.getElementById('lockout-time').textContent = formatAlarmClock();
  clearInterval(lockoutClockTimer);
  lockoutClockTimer = setInterval(() => {
    document.getElementById('lockout-time').textContent = formatAlarmClock();
  }, 1000);

  if (appState.lockoutActive) return;           // already showing; just refresh the count
  appState.lockoutActive = true;
  appState.lockoutStartedAt = Date.now();
  tripEvent('alarm', `${n} camera alerts this trip. Alarm sounding until "I am safe" is held for 7 s.`);
  resetSafeHold();
  overlay.classList.remove('clearing');
  overlay.hidden = false;
  document.getElementById('safe-btn').focus({ preventScroll: true });

  startLockoutSound();
  bleSend('L1', { force: true });
  logEvent(`FULL-SCREEN ALARM: ${n} camera alerts this trip. Waiting for driver to hold "I am safe".`, 'danger');
}

function startLockoutSound() {
  clearInterval(lockoutSoundTimer);
  let high = false;
  const tick = () => {
    if (navigator.vibrate) navigator.vibrate([350, 150, 350]);
    if (moduleOwnsSound()) return;             // the ESP32 / Pi is sounding the alarm
    high = !high;
    const base = appState.sirenFreq || 880;
    playTone(high ? base * 1.26 : base, 0.32, Math.max(UFAS_CONFIG.lockoutMinVolume, appState.sirenVolume));
  };
  tick();
  lockoutSoundTimer = setInterval(tick, 420);
}

function stopLockoutSound() {
  clearInterval(lockoutSoundTimer);
  lockoutSoundTimer = null;
  if (navigator.vibrate) navigator.vibrate(0);
}

function clearLockout(reason) {
  if (!appState.lockoutActive) return;
  appState.lockoutActive = false;
  stopLockoutSound();
  clearInterval(lockoutClockTimer);
  bleSend('L0', { force: true });
  const overlay = document.getElementById('lockout');
  overlay.classList.add('clearing');
  setTimeout(() => { if (!appState.lockoutActive) overlay.hidden = true; }, 520);
  if (reason === 'safe') {
    const waited = appState.lockoutStartedAt ? Math.round((Date.now() - appState.lockoutStartedAt) / 1000) : 0;
    tripEvent('safe', `Driver held the button for 7 s, ${waited} s after the alarm started.`);
    logEvent(`Driver held "I am safe" for 7 s. Alarm stopped. Any further camera alert this trip sounds it again.`);
    showToast('Alarm stopped. If you feel drowsy, pull over and rest.');
  }
}

// ---------- 7-second "I am safe" hold ----------
function setSafeRing(p) {
  document.getElementById('safe-ring-fill').style.strokeDashoffset = String(SAFE_RING_CIRC * (1 - p));
}

function resetSafeHold() {
  cancelAnimationFrame(safeHold.raf);
  safeHold.start = null;
  const wrap = document.getElementById('safe-hold');
  wrap.classList.remove('holding', 'done');
  setSafeRing(0);
  document.getElementById('safe-btn-sub').textContent = 'Hold 7s';
  document.getElementById('safe-hint').textContent = 'Press and hold for 7 seconds';
}

function beginSafeHold(e) {
  if (!appState.lockoutActive || safeHold.start !== null) return;
  if (e && e.cancelable) e.preventDefault();
  if (e && e.pointerId !== undefined) {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  }
  safeHold.start = performance.now();
  document.getElementById('safe-hold').classList.add('holding');
  document.getElementById('safe-hint').textContent = 'Keep holding…';
  safeHold.raf = requestAnimationFrame(safeHoldFrame);
}

function safeHoldFrame() {
  if (safeHold.start === null) return;
  const elapsed = performance.now() - safeHold.start;
  const p = Math.min(1, elapsed / UFAS_CONFIG.safeHoldMs);
  setSafeRing(p);
  document.getElementById('safe-btn-sub').textContent = `${Math.ceil((UFAS_CONFIG.safeHoldMs - elapsed) / 1000)}s`;
  if (p >= 1) { completeSafeHold(); return; }
  safeHold.raf = requestAnimationFrame(safeHoldFrame);
}

function endSafeHold() {
  if (safeHold.start === null) return;
  cancelAnimationFrame(safeHold.raf);
  safeHold.start = null;
  document.getElementById('safe-hold').classList.remove('holding');
  setSafeRing(0);                                  // ring drains back (CSS transition)
  document.getElementById('safe-btn-sub').textContent = 'Hold 7s';
  document.getElementById('safe-hint').textContent = 'Released too early. Hold for the full 7 seconds';
}

function completeSafeHold() {
  safeHold.start = null;
  const wrap = document.getElementById('safe-hold');
  wrap.classList.remove('holding');
  wrap.classList.add('done');
  setSafeRing(1);
  document.getElementById('safe-btn-sub').textContent = 'Confirmed';
  document.getElementById('safe-hint').textContent = 'Stay alert';
  clearLockout('safe');
}

function initSafeButton() {
  const btn = document.getElementById('safe-btn');
  const ring = document.getElementById('safe-ring-fill');
  ring.style.strokeDasharray = String(SAFE_RING_CIRC);
  setSafeRing(0);
  btn.addEventListener('pointerdown', beginSafeHold);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => btn.addEventListener(t, endSafeHold));
  btn.addEventListener('contextmenu', e => e.preventDefault());
  btn.addEventListener('keydown', e => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) beginSafeHold(e);
  });
  btn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') endSafeHold(); });
  btn.addEventListener('blur', endSafeHold);
}

// ============================================================================
