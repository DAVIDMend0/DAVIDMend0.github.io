// Stage 2: MediaPipe FaceMesh camera verification.

// ============================================================================
// STAGE 2: CONDITIONAL MEDIAPIPE FACEMESH ACTIVATION & VERIFICATION
// ============================================================================
const videoEl = document.getElementById('webcam-video');
const canvasEl = document.getElementById('vision-canvas');
const ctx = canvasEl.getContext('2d');
let faceMesh = null;

async function initMediaPipe() {
  try {
    faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    faceMesh.onResults(onMediaPipeResults);
  } catch (e) {
    console.warn('MediaPipe initialization error:', e);
  }
}

function activateStage2Vision(reasonText, sourceCode = 'M', opts = {}) {
  const wasActive = appState.visionActive;
  appState.visionActive = true;
  appState.lastFaceCheckAt = Date.now();   // any camera check resets the routine timer (js/facecheck.js)
  if (!wasActive) bleCameraSignal(true, sourceCode, reasonText);
  // Every real camera alert during a driving session lowers the UFAS ceiling
  if (!wasActive) { appState.cameraWokeAt = performance.now(); appState.eyesClosedSince = null; appState.eyesClosedFor = 0; }
  if (!wasActive && appState.sessionActive && !opts.test) applyCameraAlertPenalty(sourceCode, reasonText);
  appState.clearFaceSeconds = 0;
  appState.pitchBaseline = null;
  appState.yawBaseline = null;

  document.getElementById('vision-standby-overlay').classList.add('hidden');
  const vCard = document.getElementById('vision-card');
  vCard.classList.add('triggered');
  vCard.classList.remove('collapsed'); // Automatically open dropdown when checking driver
  const barFill = document.getElementById('cam-timer-bar-fill');
  if (barFill) barFill.style.width = '100%';
  const inlineTxt = document.getElementById('cam-timer-inline-txt');
  if (inlineTxt) inlineTxt.textContent = `${appState.cameraCheckDuration.toFixed(1)}s`;
  const pill = document.getElementById('vision-state-pill');
  pill.textContent = `VERIFYING (${appState.cameraCheckDuration}s)`;
  pill.classList.add('active');
  document.getElementById('island-cam-dot').classList.add('cam-active');
  document.getElementById('cam-timer-lbl').textContent = `Checking Driver • ${appState.cameraCheckDuration}s left`;

  showToast(reasonText);

  if (!appState.webcamRunning) {
    startRealWebcam();
  }
}

function dismissStage2ToStandby() {
  if (appState.visionActive) bleCameraSignal(false);
  appState.visionActive = false;
  appState.drivingAnomalyScore = 0;
  stopRealWebcam();
  document.getElementById('vision-standby-overlay').classList.remove('hidden');
  const vCard = document.getElementById('vision-card');
  vCard.classList.remove('triggered');
  vCard.classList.add('collapsed'); // Automatically collapse and hide the camera UI
  const barFill = document.getElementById('cam-timer-bar-fill');
  if (barFill) barFill.style.width = '0%';
  const pill = document.getElementById('vision-state-pill');
  pill.textContent = 'SLEEPING';
  pill.classList.remove('active');
  document.getElementById('island-cam-dot').classList.remove('cam-active');
  document.getElementById('cam-timer-lbl').textContent = 'Standby (Saves Battery)';
  if (appState.sessionActive) {
    const secs = appState.cameraWokeAt ? ((performance.now() - appState.cameraWokeAt) / 1000).toFixed(0) : '?';
    tripEvent('clear', `Camera back to standby after ${secs} s. UFAS held at ${Math.round(appState.ufasCeiling)}, recovering ~${UFAS_CONFIG.recoveryPointsPerMin} pts/min.`);
  }
  logEvent(appState.sessionActive
    ? `Driver verified alert. Camera back to standby. UFAS held at ${Math.round(appState.ufasCeiling)} and recovering slowly.`
    : 'Driver verified alert. Stage 2 FaceMesh returned to low-power standby.');
}

async function startRealWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' }
    });
    videoEl.srcObject = stream;
    await videoEl.play();

    // Adapt canvas dimensions directly to the native camera stream dimensions
    if (videoEl.videoWidth && videoEl.videoHeight) {
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
    }

    appState.webcamRunning = true;
    document.getElementById('dev-cam-status').textContent = 'Live Webcam Active';
    pumpWebcamToFaceMesh();
  } catch (err) {
    showToast('Camera permission is required for live face verification.');
  }
}

function stopRealWebcam() {
  if (videoEl.srcObject) {
    videoEl.srcObject.getTracks().forEach(t => t.stop());
    videoEl.srcObject = null;
  }
  appState.webcamRunning = false;
  appState.faceDetected = false;
}

async function pumpWebcamToFaceMesh() {
  if (!appState.webcamRunning) return;
  if (appState.visionActive && videoEl.readyState >= 2 && faceMesh) {
    await faceMesh.send({ image: videoEl });
  }
  requestAnimationFrame(pumpWebcamToFaceMesh);
}

function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function calcEAR(lm, idx) {
  const v1 = dist2D(lm[idx[1]], lm[idx[5]]);
  const v2 = dist2D(lm[idx[2]], lm[idx[4]]);
  const h = dist2D(lm[idx[0]], lm[idx[3]]) || 0.1;
  return (v1 + v2) / (2.0 * h);
}

function onMediaPipeResults(results) {
  // Dynamically match canvas resolution to incoming camera frame dimensions
  if (videoEl.videoWidth && videoEl.videoHeight) {
    if (canvasEl.width !== videoEl.videoWidth || canvasEl.height !== videoEl.videoHeight) {
      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
    }
  }

  const w = canvasEl.width;
  const h = canvasEl.height;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(results.image, 0, 0, w, h);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    appState.faceDetected = true;
    const lm = results.multiFaceLandmarks[0];
    const leftE = calcEAR(lm, [33, 160, 158, 133, 153, 144]);
    const rightE = calcEAR(lm, [362, 385, 387, 263, 373, 380]);
    appState.ear = (leftE + rightE) / 2;

    const nose = lm[1], lEye = lm[33], rEye = lm[263];
    const eyeMidX = (lEye.x + rEye.x) / 2;
    const eyeMidY = (lEye.y + rEye.y) / 2;
    const eyeDist = dist2D(lEye, rEye) || 0.1;

    const rawYaw = ((nose.x - eyeMidX) / eyeDist) * -75;
    const rawPitchRatio = (nose.y - eyeMidY) / eyeDist;

    // Auto-calibrate neutral forward gaze so the driver doesn't have to look down
    if (appState.pitchBaseline === null) {
      appState.pitchBaseline = rawPitchRatio;
      appState.yawBaseline = rawYaw;
    } else if (Math.abs(appState.yaw) < 15 && Math.abs(appState.pitch) < 15) {
      // Gently adapt baseline to natural upright posture
      appState.pitchBaseline = appState.pitchBaseline * 0.995 + rawPitchRatio * 0.005;
      appState.yawBaseline = appState.yawBaseline * 0.995 + rawYaw * 0.005;
    }

    appState.yaw = rawYaw - appState.yawBaseline;
    appState.pitch = (appState.pitchBaseline - rawPitchRatio) * 75;

    drawConnectors(ctx, lm, FACEMESH_TESSELATION, { color: '#0A84FF35', lineWidth: 0.6 });
    drawConnectors(ctx, lm, FACEMESH_RIGHT_EYE, { color: '#30D158', lineWidth: 1.6 });
    drawConnectors(ctx, lm, FACEMESH_LEFT_EYE, { color: '#30D158', lineWidth: 1.6 });
  } else {
    appState.faceDetected = false;
  }
  ctx.restore();
}
