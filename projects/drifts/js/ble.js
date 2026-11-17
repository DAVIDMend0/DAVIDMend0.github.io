// Bluetooth output to the DRIFTS module (ESP32 / Raspberry Pi).

// ============================================================================
// BLUETOOTH OUTPUT: DRIFTS MODULE (ESP32 / RASPBERRY PI) VIA WEB BLUETOOTH
// ----------------------------------------------------------------------------
// Uses the Nordic UART Service UUIDs so generic BLE tools (nRF Connect, etc.)
// can also see the messages. Every message is short ASCII (< 20 bytes):
//   C1:<src>  camera activated   src = M manual, S phone sensors, W wheel, A ATS
//   C0        camera back to standby
//   I<s><b>   interventions      e.g. I10 = seat vibration on, buzzer off
//   S<0-100>  alertness score    (only if streaming is enabled)
//   P         heartbeat every 5 s, so the module can detect a lost link
//   L1 / L0   full-screen alarm on / off (module sounds a continuous alarm)
//   R         trip ended: turn everything off
//   T         test signal
// The module may reply on the TX characteristic (notify); replies are shown in the card.
// ============================================================================
const BLE_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_RX_CHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // app -> module (write)
const BLE_TX_CHAR = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // module -> app (notify)
const BLE_SOURCE_NAMES = { M: 'manual', S: 'phone sensors', W: 'G29 wheel', A: 'ATS telemetry' };

let bleDevice = null;
let bleRx = null;
let bleQueue = Promise.resolve();
let bleQueueDepth = 0;
let bleReconnectTries = 0;
const bleOutputs = { seat: false, audio: false };
const bleLast = { interventions: null, scoreAt: 0, score: null, heartbeatAt: 0 };

function bleSupported() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

async function connectBLE() {
  if (!bleSupported()) {
    showToast('Web Bluetooth is not available in this browser. Use Chrome/Edge, or Bluefy on iPhone.');
    return;
  }
  // The phone gives the alarm sound to the module as soon as Link is tapped
  appState.bleLinkPending = true;
  updateSoundOwner();
  try {
    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ services: [BLE_SERVICE] }, { namePrefix: 'DRIFTS' }],
      optionalServices: [BLE_SERVICE]
    });
  } catch (e) {
    if (e.name !== 'NotFoundError') showToast('Bluetooth pairing failed: ' + e.message);
    appState.bleLinkPending = false;   // nothing linked: the phone keeps the alarm sound
    updateSoundOwner();
    return; // NotFoundError = user closed the picker
  }
  appState.bleWantConnected = true;
  bleDevice.addEventListener('gattserverdisconnected', onBLEDisconnected);
  await openBLEConnection();
}

async function openBLEConnection() {
  setBLEStatus('Connecting…', false);
  try {
    const server = await bleDevice.gatt.connect();
    const service = await server.getPrimaryService(BLE_SERVICE);
    bleRx = await service.getCharacteristic(BLE_RX_CHAR);
    try {
      const tx = await service.getCharacteristic(BLE_TX_CHAR);
      await tx.startNotifications();
      tx.addEventListener('characteristicvaluechanged', (e) => {
        const text = new TextDecoder().decode(e.target.value);
        document.getElementById('ble-last-ack').textContent = text;
      });
    } catch (e) {
      document.getElementById('ble-last-ack').textContent = 'no reply channel (send-only)';
    }
    appState.bleConnected = true;
    appState.bleLinkPending = false;
    updateSoundOwner();
    bleReconnectTries = 0;
    bleQueueDepth = 0;
    bleQueue = Promise.resolve();
    bleLast.interventions = null;   // resend current state to the new connection
    bleLast.score = null;
    setBLEStatus('Linked ✓', true);
    logEvent(`Bluetooth module linked: ${bleDevice.name || 'unnamed device'}.`);
    showToast(`DRIFTS module linked over Bluetooth (${bleDevice.name || 'device'}).`);
    // Bring the module up to date right away
    if (appState.visionActive && document.getElementById('ble-opt-camera').checked) bleSend('C1:M');
    if (appState.lockoutActive) bleSend('L1', { force: true });
  } catch (e) {
    appState.bleConnected = false;
    appState.bleLinkPending = false;   // phone takes the alarm sound back until the module reconnects
    updateSoundOwner();
    setBLEStatus('Failed', false);
    logEvent('Bluetooth connection failed: ' + e.message, 'warn');
    scheduleBLEReconnect();
  }
}

function onBLEDisconnected() {
  const was = appState.bleConnected;
  appState.bleConnected = false;
  appState.bleLinkPending = false;   // module gone: the phone sounds alarms again
  updateSoundOwner();
  bleRx = null;
  if (was) logEvent('Bluetooth module disconnected.', appState.bleWantConnected ? 'warn' : 'normal');
  if (appState.bleWantConnected) {
    setBLEStatus('Reconnecting…', false);
    scheduleBLEReconnect();
  } else {
    setBLEStatus('Unlinked', false);
  }
}

function scheduleBLEReconnect() {
  if (!appState.bleWantConnected || !bleDevice) return;
  if (bleReconnectTries >= 5) {
    setBLEStatus('Lost', false);
    showToast('Lost the Bluetooth module. Tap Link Module to reconnect.');
    appState.bleWantConnected = false;
    return;
  }
  const delay = 1000 * Math.pow(2, bleReconnectTries++); // 1s, 2s, 4s, 8s, 16s
  setTimeout(() => {
    if (appState.bleWantConnected && !appState.bleConnected) openBLEConnection();
  }, delay);
}

function disconnectBLE(userInitiated) {
  appState.bleWantConnected = false;
  const finish = () => {
    if (bleDevice && bleDevice.gatt.connected) bleDevice.gatt.disconnect();
    appState.bleConnected = false;
    appState.bleLinkPending = false;
    bleRx = null;
    updateSoundOwner();
    setBLEStatus('Unlinked', false);
    if (userInitiated) logEvent('Bluetooth module unlinked. Alarm sound back on this phone.');
  };
  // Let the module switch its outputs off before the link drops
  if (appState.bleConnected) bleSend('R', { force: true }).finally(finish); else finish();
}

function setBLEStatus(text, linked) {
  const pill = document.getElementById('ble-status-pill');
  pill.textContent = text;
  pill.classList.toggle('connected', linked);
  const lbl = document.getElementById('ble-source-lbl');
  lbl.textContent = linked ? 'Live Output' : (appState.bleWantConnected ? text : 'Not Linked');
  lbl.style.color = linked ? '#34C759' : '#8E8E93';
  if (bleDevice && bleDevice.name) document.getElementById('ble-device-name').textContent = bleDevice.name;
  document.getElementById('ble-connect-btn').disabled = linked;
  document.getElementById('ble-test-btn').disabled = !linked;
  document.getElementById('ble-disconnect-btn').disabled = !linked && !appState.bleWantConnected;
  document.getElementById('ble-header-lbl').textContent = linked ? `BLE • ${bleDevice?.name || 'Module'}` : 'DRIFTS Prototype';  // shown in Developer mode
}

// Queue writes: GATT only allows one operation at a time.
function bleSend(msg, opts = {}) {
  if (!appState.bleConnected || !bleRx) return Promise.resolve(false);
  if (opts.droppable && bleQueueDepth > 2) return Promise.resolve(false);
  bleQueueDepth++;
  const data = new TextEncoder().encode(msg);
  bleQueue = bleQueue
    .then(() => (bleRx.writeValueWithoutResponse ? bleRx.writeValueWithoutResponse(data) : bleRx.writeValue(data)))
    .then(() => {
      if (!opts.quiet) document.getElementById('ble-last-sent').textContent =
        `${msg}  (${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })})`;
      return true;
    })
    .catch((e) => { console.warn('BLE write failed', e); return false; })
    .finally(() => { bleQueueDepth--; });
  return bleQueue;
}

function bleCameraSignal(on, sourceCode = 'M', reasonText = '') {
  if (!appState.bleConnected || !document.getElementById('ble-opt-camera').checked) return;
  if (on) {
    bleSend(`C1:${sourceCode}`);
    logEvent(`[BLE] Camera activation sent to module (source: ${BLE_SOURCE_NAMES[sourceCode] || sourceCode}).`);
  } else {
    bleSend('C0');
    logEvent('[BLE] Camera standby sent to module.');
  }
}

function bleSyncState(now) {
  if (!appState.bleConnected) return;

  if (document.getElementById('ble-opt-interventions').checked) {
    const code = `I${bleOutputs.seat ? 1 : 0}${bleOutputs.audio ? 1 : 0}`;
    if (code !== bleLast.interventions) {
      bleLast.interventions = code;
      bleSend(code);
    }
  }

  if (document.getElementById('ble-opt-score').checked && now - bleLast.scoreAt >= 1000) {
    bleLast.scoreAt = now;
    if (appState.alertnessScore !== bleLast.score) {
      bleLast.score = appState.alertnessScore;
      bleSend(`S${appState.alertnessScore}`, { droppable: true, quiet: true });
    }
  }

  if (now - bleLast.heartbeatAt >= 5000) {
    bleLast.heartbeatAt = now;
    bleSend('P', { droppable: true, quiet: true });
  }
}

function sendBLETest() {
  bleSend('T');
  showToast('Test signal sent. The module should blink its LED and chirp.');
}

window.addEventListener('DOMContentLoaded', () => {
  if (!bleSupported()) {
    const note = document.getElementById('ble-support-note');
    note.textContent = 'This browser has no Web Bluetooth. Use Chrome/Edge (Android, Windows, macOS) or the Bluefy browser on iPhone.';
    note.style.color = '#FF9500';
    document.getElementById('ble-connect-btn').disabled = true;
  }
});
