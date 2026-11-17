// Stage 1: phone sensors (accelerometer, gyro, GPS) and camera permission.

// ============================================================================
// STAGE 1: REAL SMARTPHONE SENSORS (ACCELEROMETER, GYRO, GPS) + INJECTORS
// ============================================================================
// Asks for camera permission up front, then immediately releases the camera so it
// stays in gated standby. Later Stage 2 activations reuse the granted permission.
async function requestCameraPermission() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch (e) {
    console.warn('Camera permission error:', e);
    return false;
  }
}

async function enableHardwareSensors() {
  // Start every permission request inside the same tap. iOS only shows the
  // motion prompt if requestPermission() is called directly from the gesture,
  // so it is kicked off first, before anything is awaited.
  let motionRequest;
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    motionRequest = DeviceMotionEvent.requestPermission()
      .then(resp => resp === 'granted')
      .catch(e => { console.warn('DeviceMotion permission error:', e); return false; });
  } else {
    motionRequest = Promise.resolve('DeviceMotionEvent' in window);
  }
  const cameraRequest = requestCameraPermission();

  // 1. Accelerometer & Gyroscope
  const granted = await motionRequest;
  if (granted) {
    window.addEventListener('devicemotion', handleDeviceMotion);
    document.getElementById('dev-motion-status').textContent = 'Live • Streaming 60Hz IMU';
    document.getElementById('dev-motion-status').style.color = '#34C759';
  }

  // 2. Bind HTML5 Geolocation for Speed & Coordinates
  if ('geolocation' in navigator) {
    if (appState.gpsWatchId !== null) {
      navigator.geolocation.clearWatch(appState.gpsWatchId);
    }
    appState.gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        document.getElementById('dev-gps-status').textContent = 'Live • Tracking Location';
        document.getElementById('dev-gps-status').style.color = '#34C759';
        handleGPSPosition(pos);   // speed display + odometer miles (js/gps.js)
      },
      (err) => {
        document.getElementById('dev-gps-status').textContent = err.code === 1 ? 'Location permission denied' : 'Waiting for GPS signal…';
        document.getElementById('dev-gps-status').style.color = '#FF9500';
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    );
  }

  appState.hardwareSensorsBound = true;
  document.getElementById('telemetry-wrap').classList.remove('unlinked');
  document.getElementById('sensor-overlay').classList.add('hidden');

  const statusPill = document.getElementById('sensor-status-pill');
  statusPill.textContent = 'Linked ✓';
  statusPill.classList.add('connected');

  const srcLbl = document.getElementById('sensor-source-lbl');
  srcLbl.textContent = 'Live Telemetry';
  srcLbl.style.color = '#34C759';

  // 3. Camera permission (camera itself stays off until Stage 2 is triggered)
  const camGranted = await cameraRequest;
  const camStatus = document.getElementById('dev-cam-status');
  if (camGranted) {
    camStatus.textContent = 'Permission Granted • Gated Standby';
    camStatus.style.color = '#34C759';
  } else {
    camStatus.textContent = 'Camera blocked • Allow in browser settings';
    camStatus.style.color = '#FF9500';
  }

  if (camGranted) {
    showToast('Motion, GPS & camera access granted. Camera stays in standby until needed.');
    logEvent('Bound smartphone IMU (Accelerometer/Gyro) & GPS sensors. Camera permission granted (standby).');
  } else {
    showToast('Motion & GPS linked, but camera access was denied. Face verification will not work.');
    logEvent('Bound smartphone IMU & GPS sensors. Camera permission denied.', 'warn');
  }
}

function handleDeviceMotion(event) {
  const acc = event.accelerationIncludingGravity;
  const rot = event.rotationRate;

  // Significantly reduced sensitivity: only extreme, violent swerves or very hard jolts
  // will build up anomaly score. Everyday turns, bumps, and stops are ignored.
  if (rot && (rot.alpha !== null || rot.beta !== null || rot.gamma !== null)) {
    const yawRate = Math.max(
      Math.abs(rot.alpha || 0),
      Math.abs(rot.beta || 0),
      Math.abs(rot.gamma || 0)
    );
    appState.gyroRate = yawRate;

    // Require a very sharp whip/swerve (> 145 deg/s) with a gentle multiplier
    if (yawRate > 145) {
      const dirSpike = Math.min(20, (yawRate - 145) * 0.16);
      appState.drivingAnomalyScore = Math.min(100, appState.drivingAnomalyScore + dirSpike);
      appState.lastAnomalySource = 'S';
    }
  }

  if (acc && acc.x !== null) {
    const totalG = Math.hypot(acc.x, acc.y, acc.z) / 9.81;
    appState.accelG = totalG;
    const gDelta = Math.abs(totalG - 1.0);

    // Require a heavy impact/jolt (> 1.65g deviation, i.e. > 2.65g total) with smaller gain
    if (gDelta > 1.65) {
      appState.drivingAnomalyScore = Math.min(100, appState.drivingAnomalyScore + (gDelta - 1.65) * 14);
      appState.lastAnomalySource = 'S';
    }
  }
}
