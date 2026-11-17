// Main sensor-to-vision fusion loop and intervention outputs.

// ============================================================================
// MAIN SENSOR-TO-VISION FUSION LOOP
// ============================================================================
let lastTick = performance.now();

function updateFusionPipeline() {
  const now = performance.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  // 1. Update Stage 1 Sensor Telemetry (phone IMU events arrive via handleDeviceMotion)
  if (appState.hardwareSensorsBound || appState.wheelBound || appState.atsConnected) {
    appState.drivingAnomalyScore = Math.max(0, appState.drivingAnomalyScore - appState.anomalyDecayRate);
  }

  // 1b. Poll the G29 wheel and pedals (adds anomaly impulses on swerves, drift-and-jerk, panic brakes)
  pollWheel(now, dt);
  renderWheel();

  // Trigger Stage 2 automatically if Stage 1 anomaly crosses 50% (only while driving)
  if (appState.sessionActive && appState.drivingAnomalyScore >= 50 && !appState.visionActive) {
    activateStage2Vision(appState.lastAnomalyReason
      ? `${appState.lastAnomalyReason} — Rolling FaceMesh...`
      : 'Sensor Threshold Breached! Rolling FaceMesh...',
      appState.lastAnomalySource || 'S');
  }
  appState.lastAnomalyReason = null;
  appState.lastAnomalySource = null;

  // 2. If Stage 2 Vision is active, process face metrics
  let isEyesClosed = false;
  let isLookingAway = false;

  if (appState.visionActive) {
    if (appState.faceDetected) {
      // A closure only counts once it outlasts a normal blink
      const rawClosed = appState.ear < 0.21;
      if (rawClosed) {
        if (appState.eyesClosedSince === null) appState.eyesClosedSince = now;
        appState.eyesClosedFor = (now - appState.eyesClosedSince) / 1000;
      } else {
        appState.eyesClosedSince = null;
        appState.eyesClosedFor = 0;
      }
      isEyesClosed = appState.eyesClosedFor >= CAMERA_CONFIG.blinkToleranceSec;
      // Generous pitch/yaw tolerance so natural forward posture never triggers false alarms
      isLookingAway = Math.abs(appState.yaw) > 28 || Math.abs(appState.pitch) > 25;

      appState.closedFramesWindow.push(rawClosed ? 1 : 0);   // PERCLOS still counts every closed frame
      if (appState.closedFramesWindow.length > 180) appState.closedFramesWindow.shift();
      const closedSum = appState.closedFramesWindow.reduce((a, b) => a + b, 0);
      appState.perclos = Math.round((closedSum / appState.closedFramesWindow.length) * 100);
    }

    // Run the 7-second driver verification timer while the driver is alert
    // (blinks shorter than CAMERA_CONFIG.blinkToleranceSec don't pause or reset it)
    if (!isEyesClosed && !isLookingAway && appState.drivingAnomalyScore < 40) {
      appState.clearFaceSeconds += dt;
      const remExact = Math.max(0, appState.cameraCheckDuration - appState.clearFaceSeconds);
      const rem = Math.max(0, Math.ceil(remExact));
      const pctRemaining = Math.max(0, (remExact / appState.cameraCheckDuration) * 100);
      const barFill = document.getElementById('cam-timer-bar-fill');
      if (barFill) barFill.style.width = `${pctRemaining}%`;
      const inlineTxt = document.getElementById('cam-timer-inline-txt');
      if (inlineTxt) inlineTxt.textContent = `${remExact.toFixed(1)}s`;

      document.getElementById('cam-timer-lbl').textContent = `Checking Driver • ${rem}s left`;
      document.getElementById('vision-state-pill').textContent = `VERIFYING (${rem}s)`;

      if (document.getElementById('chk-autosleep').checked && appState.clearFaceSeconds >= appState.cameraCheckDuration) {
        dismissStage2ToStandby();
      }
    } else {
      // Reset the 7s countdown if drowsiness or distraction is detected
      appState.clearFaceSeconds = 0;
      const barFill = document.getElementById('cam-timer-bar-fill');
      if (barFill) barFill.style.width = '100%';
      const inlineTxt = document.getElementById('cam-timer-inline-txt');
      if (inlineTxt) inlineTxt.textContent = `${appState.cameraCheckDuration.toFixed(1)}s (PAUSED)`;
      document.getElementById('cam-timer-lbl').textContent = 'Suspicious state locked! Timer paused';
      document.getElementById('vision-state-pill').textContent = 'ALERT LOCKED';
    }
  } else {
    appState.perclos = Math.max(0, Math.round(appState.perclos * 0.98));
  }

  // 3. Compute Unified Fusion Alertness Score
  const gazePenalty = isLookingAway ? 75 : (appState.visionActive ? Math.min(35, Math.abs(appState.yaw) * 0.9) : 0);
  const eyePenalty = isEyesClosed ? 85 : appState.perclos;
  const sensorPenalty = Math.round(appState.drivingAnomalyScore);

  const fatigueIndex = (0.45 * eyePenalty) + (0.30 * sensorPenalty) + (0.25 * gazePenalty);
  appState.liveScore = Math.max(0, Math.min(100, Math.round(100 - fatigueIndex)));

  // UFAS shown to the driver: capped by the session ceiling, which only climbs back slowly
  recoverUfasCeiling(dt);
  appState.alertnessScore = appState.sessionActive
    ? Math.max(0, Math.min(Math.round(appState.ufasCeiling), appState.liveScore))
    : appState.liveScore;
  trackTripScore();

  // 4. Update DOM Readouts
  document.getElementById('tele-gforce').textContent = `${appState.accelG.toFixed(2)}g`;
  document.getElementById('tele-gyro').textContent = `${appState.gyroRate.toFixed(1)}°/s`;
  const anomEl = document.getElementById('tele-anomaly');
  anomEl.textContent = `${Math.round(appState.drivingAnomalyScore)}%`;
  anomEl.style.color = appState.drivingAnomalyScore >= 50 ? '#FF3B30' : '#34C759';

  document.getElementById('hud-ear').textContent = appState.ear.toFixed(2);
  document.getElementById('hud-ear').style.color = isEyesClosed ? '#FF453A' : (appState.eyesClosedFor > 0 ? '#FF9F0A' : '#30D158');
  document.getElementById('hud-perclos').textContent = `${appState.perclos}%`;
  document.getElementById('hud-pose').textContent = `${Math.round(appState.yaw)}° / ${Math.round(appState.pitch)}°`;

  // Update Gauge & Status
  let color = '#34C759';
  let statusLabel = 'Driving Normal • Alert';
  if (appState.liveScore < 45 || (appState.visionActive && (isEyesClosed || isLookingAway))) {
    color = '#FF3B30';
    statusLabel = isEyesClosed ? 'CRITICAL: MICROSLEEP VERIFIED' : 'WARNING: DRIVER DISTRACTED';
    setInterventionState('seat', true);

    // 1-second delay before activating the audio buzzer
    if (!appState.criticalStateStart) {
      appState.criticalStateStart = now;
      if (isEyesClosed) tripEvent('eyes', `Eyes closed longer than a blink (${appState.eyesClosedFor.toFixed(1)} s). Seat vibration on, buzzer after 1 s.`);
      else if (isLookingAway) tripEvent('distract', `Driver looking away from the road (yaw ${Math.round(appState.yaw)}°, pitch ${Math.round(appState.pitch)}°).`);
    }
    if (now - appState.criticalStateStart >= 1000) {
      setInterventionState('audio', true);
      playAlertChime(appState.sirenFreq, 0.18);
    } else {
      setInterventionState('audio', false);
    }
  } else if (appState.drivingAnomalyScore >= 50 || appState.liveScore < 70) {
    appState.criticalStateStart = null;
    color = '#FF9500';
    statusLabel = 'Stage 2 Active • Checking Face...';
    setInterventionState('seat', true);
    setInterventionState('audio', false);
  } else {
    appState.criticalStateStart = null;
    setInterventionState('seat', false);
    setInterventionState('audio', false);
    if (!appState.sessionActive) {
      color = '#8E8E93';
      statusLabel = 'Not Driving • Tap Start Driving';
    } else if (appState.visionActive) {
      color = '#FF9500';
      statusLabel = 'Camera Check • Verifying Driver';
    } else if (appState.alertnessScore < 100) {
      color = appState.alertnessScore >= 75 ? '#34C759' : appState.alertnessScore >= 50 ? '#FF9500' : '#FF3B30';
      statusLabel = `Recovering • ${appState.cameraAlerts} camera alert${appState.cameraAlerts === 1 ? '' : 's'}`;
    }
  }

  const scoreNum = document.getElementById('score-num');
  const gaugeFg = document.getElementById('gauge-fg');
  const statusEl = document.getElementById('status-text');

  scoreNum.textContent = appState.alertnessScore;
  document.getElementById('gauge-wrap').classList.toggle('idle', !appState.sessionActive);
  scoreNum.style.color = color;
  gaugeFg.setAttribute('stroke', color);
  gaugeFg.setAttribute('stroke-dashoffset', CIRC - (CIRC * appState.alertnessScore / 100));
  statusEl.textContent = statusLabel;
  statusEl.style.color = color;

  document.getElementById('bar-steer').style.width = `${sensorPenalty}%`;
  document.getElementById('bar-steer').style.background = color;
  document.getElementById('bar-eyes').style.width = `${eyePenalty}%`;
  document.getElementById('bar-eyes').style.background = color;
  document.getElementById('bar-gaze').style.width = `${gazePenalty}%`;
  document.getElementById('bar-gaze').style.background = color;

  // 5. Mirror state to the Bluetooth module (only sends on change / once per second)
  bleSyncState(now);

  requestAnimationFrame(updateFusionPipeline);
}

function setInterventionState(type, active) {
  const pill = document.getElementById('pill-' + type);
  if (!pill) return;
  bleOutputs[type] = active;
  pill.classList.toggle('active', active);
  pill.classList.toggle('standby', !active);
  pill.textContent = active ? 'Active' : 'Standby';
}

function toggleManualIntervention(type) {
  const pill = document.getElementById('pill-' + type);
  const next = !pill.classList.contains('active');
  setInterventionState(type, next);
  if (next) playAlertChime(appState.sirenFreq, 0.14, true);
}
