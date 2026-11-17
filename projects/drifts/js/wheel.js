// Stage 1b: Logitech G29 wheel and pedals (Gamepad API).

// ============================================================================
// STAGE 1b: LOGITECH G29 WHEEL & PEDALS (GAMEPAD API)
// ============================================================================
const isWheelPad = (gp) => /G29|c24f|Driving Force|Logitech/i.test(gp.id);

function findWheelPad() {
  if (!navigator.getGamepads) return null;
  const pads = [...navigator.getGamepads()].filter(Boolean);
  return pads.find(isWheelPad) || pads[0] || null;
}

function enableWheelInput() {
  if (!('getGamepads' in navigator)) {
    showToast('This browser does not support the Gamepad API. Use Chrome or Edge.');
    return;
  }
  appState.wheelLinkRequested = true;
  const gp = findWheelPad();
  if (gp) {
    bindWheel(gp);
  } else {
    // Browsers hide gamepads until a button is pressed after the page loads
    document.getElementById('wheel-overlay-sub').textContent = 'Waiting… press any button on the wheel';
    document.getElementById('dev-wheel-status').textContent = 'Waiting for wheel button press…';
    showToast('Press any button on the G29 to finish linking.');
  }
}

function bindWheel(gp) {
  appState.wheelBound = true;
  appState.wheelIndex = gp.index;

  // Reset detector state so old values don't fire false events
  const now = performance.now();
  wheelState.lastSteerDeg = null;
  wheelState.stillStart = now;
  wheelState.correction = null;
  wheelState.reversalDir = 0;
  wheelState.reversalTimes = [];
  wheelState.brakeLowTime = now;
  wheelState.pedalSeen = {};
  wheelState.lastEvent = {};

  document.getElementById('wheel-wrap').classList.remove('unlinked');
  document.getElementById('wheel-overlay').classList.add('hidden');
  const pill = document.getElementById('wheel-status-pill');
  pill.textContent = 'Linked ✓';
  pill.classList.add('connected');
  const lbl = document.getElementById('wheel-source-lbl');
  lbl.textContent = isWheelPad(gp) ? 'Live G29 Input' : 'Live Gamepad Input';
  lbl.style.color = '#34C759';
  const dev = document.getElementById('dev-wheel-status');
  dev.textContent = `Live • ${gp.id.slice(0, 38)}`;
  dev.style.color = '#34C759';

  showToast('G29 wheel & pedals bound to Stage 1 Sentinel!');
  logEvent(`Bound steering wheel: ${gp.id} (${gp.axes.length} axes, ${gp.buttons.length} buttons).`);
  if (!isWheelPad(gp)) {
    logEvent('Linked controller does not identify as a G29. Check axis mapping in WHEEL_CONFIG.', 'warn');
  }
}

function unbindWheel(lost) {
  const wasBound = appState.wheelBound;
  appState.wheelBound = false;
  appState.wheelLinkRequested = false;
  appState.wheelIndex = null;
  appState.steerRate = 0;
  appState.steerStillSeconds = 0;
  appState.steerReversalsPerMin = 0;

  document.getElementById('wheel-wrap').classList.add('unlinked');
  document.getElementById('wheel-overlay').classList.remove('hidden');
  document.getElementById('wheel-overlay-sub').textContent = 'Plug in the wheel, then tap and press any wheel button';
  const pill = document.getElementById('wheel-status-pill');
  pill.textContent = lost ? 'Disconnected' : 'Unlinked';
  pill.classList.remove('connected');
  const lbl = document.getElementById('wheel-source-lbl');
  lbl.textContent = 'Awaiting Link';
  lbl.style.color = '#8E8E93';
  const dev = document.getElementById('dev-wheel-status');
  dev.textContent = 'Tap to bind Gamepad API';
  dev.style.color = '#FF9500';

  if (lost && wasBound) {
    showToast('G29 wheel disconnected!');
    logEvent('Steering wheel disconnected. Stage 1b input lost.', 'danger');
  }
}

window.addEventListener('gamepadconnected', (e) => {
  if (appState.wheelLinkRequested && !appState.wheelBound) bindWheel(e.gamepad);
});
window.addEventListener('gamepaddisconnected', (e) => {
  if (appState.wheelBound && e.gamepad.index === appState.wheelIndex) unbindWheel(true);
});

function readPedal(gp, axis) {
  const raw = gp.axes[axis];
  if (raw === undefined) return 0;
  // Some browsers report exactly 0 until the pedal first moves; treat that as released
  if (!wheelState.pedalSeen[axis]) {
    if (raw === 0) return 0;
    wheelState.pedalSeen[axis] = true;
  }
  const v = WHEEL_CONFIG.pedalsInverted ? -raw : raw;
  return Math.min(1, Math.max(0, (v + 1) / 2));
}

function fireWheelEvent(type, impulse, reason, now) {
  const last = wheelState.lastEvent[type] || 0;
  if (now - last < WHEEL_CONFIG.eventCooldownSec * 1000) return;
  wheelState.lastEvent[type] = now;
  appState.drivingAnomalyScore = Math.min(100, appState.drivingAnomalyScore + impulse);
  appState.lastAnomalyReason = reason;
  appState.lastAnomalySource = 'W';
  logEvent(`[WHEEL] ${reason} (+${impulse} anomaly)`, impulse >= 50 ? 'danger' : 'warn');
}

function pollWheel(now, dt) {
  if (!appState.wheelBound) return;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads[appState.wheelIndex];
  if (!gp) return;
  const C = WHEEL_CONFIG;

  // --- Raw inputs ---
  let s = gp.axes[C.steerAxis] ?? 0;
  if (C.steerInvert) s = -s;
  const deg = s * C.rangeDeg / 2;
  appState.steerDeg = deg;
  appState.throttle = readPedal(gp, C.throttleAxis);
  appState.brake = readPedal(gp, C.brakeAxis);
  appState.clutch = readPedal(gp, C.clutchAxis);

  // --- Steering rate (smoothed) ---
  if (wheelState.lastSteerDeg !== null && dt > 0 && dt < 0.25) {
    const instRate = Math.abs(deg - wheelState.lastSteerDeg) / dt;
    appState.steerRate = appState.steerRate * 0.7 + instRate * 0.3;
  }
  wheelState.lastSteerDeg = deg;

  // 1) Swerve detection
  if (appState.steerRate > C.swerveRateDegPerSec) {
    fireWheelEvent('swerve', C.swerveImpulse,
      `Sudden swerve: ${Math.round(appState.steerRate)}°/s steering input`, now);
  }

  // 2) Stillness → sudden correction (microsleep signature)
  if (Math.abs(deg - wheelState.stillAnchorDeg) > C.stillAngleDeg) {
    const stillFor = (now - wheelState.stillStart) / 1000;
    if (stillFor >= C.stillSeconds && appState.throttle >= C.minThrottleForStill) {
      // Hands were frozen while driving; open a short window to watch for a jerk correction
      wheelState.correction = { start: now, baseDeg: wheelState.stillAnchorDeg, stillFor };
    }
    wheelState.stillAnchorDeg = deg;
    wheelState.stillStart = now;
  }
  appState.steerStillSeconds = (now - wheelState.stillStart) / 1000;

  if (wheelState.correction) {
    const c = wheelState.correction;
    if ((now - c.start) / 1000 > C.correctionWindowSec) {
      wheelState.correction = null;
    } else if (Math.abs(deg - c.baseDeg) >= C.correctionDeg) {
      fireWheelEvent('correction', C.correctionImpulse,
        `Drift-and-jerk steering: ${c.stillFor.toFixed(1)}s no input, then ${Math.round(Math.abs(deg - c.baseDeg))}° correction`, now);
      wheelState.correction = null;
    }
  }

  // Steering reversals (direction changes larger than the gap)
  if (wheelState.reversalDir === 0) {
    if (Math.abs(deg - wheelState.reversalExtreme) > C.reversalGapDeg) {
      wheelState.reversalDir = Math.sign(deg - wheelState.reversalExtreme);
      wheelState.reversalExtreme = deg;
    }
  } else if ((deg - wheelState.reversalExtreme) * wheelState.reversalDir > 0) {
    wheelState.reversalExtreme = deg; // still moving the same way; extend the extreme
  } else if (Math.abs(deg - wheelState.reversalExtreme) > C.reversalGapDeg) {
    wheelState.reversalTimes.push(now);
    wheelState.reversalDir = -wheelState.reversalDir;
    wheelState.reversalExtreme = deg;
  }
  while (wheelState.reversalTimes.length && now - wheelState.reversalTimes[0] > 60000) {
    wheelState.reversalTimes.shift();
  }
  appState.steerReversalsPerMin = wheelState.reversalTimes.length;
  if (appState.steerReversalsPerMin > C.erraticReversalsPerMin) {
    fireWheelEvent('erratic', 20, `Erratic steering: ${appState.steerReversalsPerMin} reversals/min`, now);
  }

  // 3) Panic brake
  if (appState.brake < 0.10) {
    wheelState.brakeLowTime = now;
  } else if (appState.brake >= C.hardBrakeLevel && now - wheelState.brakeLowTime <= C.hardBrakeWindowMs) {
    fireWheelEvent('brake', C.hardBrakeImpulse,
      `Panic brake: 0→${Math.round(appState.brake * 100)}% in ${Math.round(now - wheelState.brakeLowTime)}ms`, now);
    wheelState.brakeLowTime = -Infinity; // one event per press
  }
}

function renderWheel() {
  if (!appState.wheelBound) return;
  const C = WHEEL_CONFIG;
  document.getElementById('g29-wheel-graphic').setAttribute('transform', `rotate(${appState.steerDeg.toFixed(1)})`);
  document.getElementById('wheel-angle').textContent =
    `${appState.steerDeg >= 0 ? '+' : ''}${appState.steerDeg.toFixed(1)}°`;

  for (const [key, val] of [['throttle', appState.throttle], ['brake', appState.brake], ['clutch', appState.clutch]]) {
    const pct = Math.round(val * 100);
    document.getElementById(`pedal-${key}`).style.width = `${pct}%`;
    document.getElementById(`pedal-${key}-pct`).textContent = `${pct}%`;
  }

  const rateEl = document.getElementById('wheel-rate');
  rateEl.textContent = `${Math.round(appState.steerRate)}°/s`;
  rateEl.style.color = appState.steerRate > C.swerveRateDegPerSec ? '#FF3B30' : '';
  document.getElementById('wheel-rate-status').textContent =
    appState.steerRate > C.swerveRateDegPerSec ? 'SWERVE' : appState.steerRate > C.swerveRateDegPerSec * 0.5 ? 'Aggressive' : 'Smooth';

  const srrEl = document.getElementById('wheel-srr');
  srrEl.textContent = `${appState.steerReversalsPerMin}/min`;
  srrEl.style.color = appState.steerReversalsPerMin > C.erraticReversalsPerMin ? '#FF3B30' : '';

  const still = appState.steerStillSeconds;
  const stillEl = document.getElementById('wheel-still');
  stillEl.textContent = `${Math.min(still, 99).toFixed(1)}s`;
  const armed = still >= C.stillSeconds && appState.throttle >= C.minThrottleForStill;
  stillEl.style.color = armed ? '#FF9500' : '';
  document.getElementById('wheel-still-status').textContent = armed ? 'No Input • Watching' : 'Active Hands';
}
