// Stage 1c: American Truck Simulator telemetry over WebSocket (ats_bridge.py).

// ============================================================================
// STAGE 1c: AMERICAN TRUCK SIMULATOR TELEMETRY (WebSocket from ats_bridge.py)
// ============================================================================
let atsSocket = null;
let atsReconnectTimer = null;

const OFFENCE_LABELS = {
  crash: 'Crash', avoid_sleeping: 'Driving while fatigued', wrong_way: 'Wrong way',
  red_signal: 'Ran red light', speeding: 'Speeding', speeding_camera: 'Speed camera',
  no_lights: 'No headlights', hard_shoulder_violation: 'Hard shoulder', avoid_weighing: 'Skipped weigh station',
  illegal_trailer: 'Illegal trailer', avoid_inspection: 'Skipped inspection',
  illegal_border_crossing: 'Illegal border crossing', damaged_vehicle_usage: 'Damaged vehicle', generic: 'Traffic offence'
};

function addAnomaly(impulse, reason, level) {
  if (impulse <= 0) return;
  appState.drivingAnomalyScore = Math.min(100, appState.drivingAnomalyScore + impulse);
  appState.lastAnomalyReason = reason;
  appState.lastAnomalySource = 'A';
  logEvent(`${reason} (+${impulse} anomaly)`, level || (impulse >= 50 ? 'danger' : 'warn'));
}

function connectATS() {
  appState.atsWanted = true;
  if (atsReconnectTimer) { clearTimeout(atsReconnectTimer); atsReconnectTimer = null; }
  if (atsSocket && (atsSocket.readyState === WebSocket.OPEN || atsSocket.readyState === WebSocket.CONNECTING)) return;

  const url = document.getElementById('ats-url').value.trim() || 'ws://localhost:8765';
  setATSStatus('Connecting…', false);
  try {
    atsSocket = new WebSocket(url);
  } catch (e) {
    setATSStatus('Bad URL', false);
    showToast('Could not open the ATS bridge URL.');
    return;
  }

  atsSocket.onopen = () => {
    appState.atsConnected = true;
    setATSStatus('Bridge Linked', true);
    logEvent(`Connected to ATS telemetry bridge at ${url}.`);
    showToast('ATS bridge connected. Waiting for game telemetry…');
  };
  atsSocket.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    handleATSMessage(msg);
  };
  atsSocket.onclose = () => {
    const wasConnected = appState.atsConnected;
    appState.atsConnected = false;
    appState.atsGameLive = false;
    atsSocket = null;
    if (appState.atsWanted) {
      setATSStatus('Retrying…', false);
      if (wasConnected) logEvent('ATS bridge connection lost. Retrying…', 'warn');
      atsReconnectTimer = setTimeout(connectATS, ATS_CONFIG.reconnectMs);
    } else {
      setATSStatus('Offline', false);
    }
  };
  atsSocket.onerror = () => {
    document.getElementById('ats-overlay-sub').textContent = 'Bridge not reachable. Is ats_bridge.py running?';
  };
}

function disconnectATS() {
  appState.atsWanted = false;
  if (atsReconnectTimer) { clearTimeout(atsReconnectTimer); atsReconnectTimer = null; }
  if (atsSocket) atsSocket.close();
  atsSocket = null;
  appState.atsConnected = false;
  appState.atsGameLive = false;
  setATSStatus('Offline', false);
}

function setATSStatus(text, linked) {
  const pill = document.getElementById('ats-status-pill');
  pill.textContent = linked ? `${text} ✓` : text;
  pill.classList.toggle('connected', linked);
  document.getElementById('ats-wrap').classList.toggle('unlinked', !linked);
  document.getElementById('ats-overlay').classList.toggle('hidden', linked);
  if (!linked) document.getElementById('ats-overlay-sub').textContent = 'Run ats_bridge.py on the PC, then tap';
  const lbl = document.getElementById('ats-source-lbl');
  if (!linked) { lbl.textContent = 'Bridge Offline'; lbl.style.color = '#8E8E93'; }
  document.getElementById('home-collision-line').style.display = linked ? 'block' : 'none';
}

function handleATSMessage(msg) {
  const lbl = document.getElementById('ats-source-lbl');
  switch (msg.type) {
    case 'status': {
      appState.atsGameLive = msg.game === 'connected';
      lbl.textContent = appState.atsGameLive ? (msg.demo ? 'Demo Telemetry' : 'Live Game Telemetry') : 'Waiting for ATS…';
      lbl.style.color = appState.atsGameLive ? '#34C759' : '#FF9500';
      if (appState.atsGameLive) logEvent(msg.demo ? 'ATS bridge running in DEMO mode.' : 'ATS game telemetry live.');
      break;
    }
    case 'telemetry': {
      appState.speedMph = Math.round(msg.speedMph);
      appState.speedAt = Date.now();     // shown in the header speed pill
      const d = msg.damage || {};
      appState.atsDamagePct = Math.max(d.cabin || 0, d.chassis || 0);
      document.getElementById('ats-speed').textContent = `${Math.round(msg.speedMph)} mph`;
      const dmgEl = document.getElementById('ats-damage');
      dmgEl.textContent = `${appState.atsDamagePct.toFixed(1)}%`;
      dmgEl.style.color = appState.atsDamagePct >= 20 ? '#FF3B30' : appState.atsDamagePct >= 5 ? '#FF9500' : '';
      document.getElementById('ats-damage-sub').textContent =
        `Cab ${(d.cabin || 0).toFixed(0)}% • Chas ${(d.chassis || 0).toFixed(0)}%`;
      if (msg.paused) lbl.textContent = 'Game Paused';
      else if (appState.atsGameLive && lbl.textContent === 'Game Paused') lbl.textContent = 'Live Game Telemetry';
      break;
    }
    case 'collision': {
      appState.atsCollisions++;
      const dmg = msg.damageDelta || 0;
      const penalty = Math.min(ATS_CONFIG.scorePenaltyMax,
        ATS_CONFIG.scorePenaltyBase + dmg * ATS_CONFIG.scorePenaltyPerDamagePct);
      appState.atsCollisionScore = Math.max(0, Math.round(appState.atsCollisionScore - penalty));
      const desc = dmg > 0
        ? `ATS collision at ${Math.round(msg.speedMph)} mph (+${dmg.toFixed(1)}% damage)`
        : `ATS collision at ${Math.round(msg.speedMph)} mph (police crash fine)`;
      addAnomaly(ATS_CONFIG.collisionImpulse, desc);
      tripEvent('collision', desc.replace(/^ATS collision/, 'Collision'));
      setATSLastEvent(`💥 ${desc}`);
      updateATSScore();
      playAlertChime(appState.sirenFreq, 0.18, true);
      break;
    }
    case 'fine': {
      appState.atsFines++;
      const name = OFFENCE_LABELS[msg.offence] || msg.offence;
      const impulse = ATS_CONFIG.fineImpulse[msg.offence] ?? ATS_CONFIG.fineImpulse.default;
      const desc = `ATS fine: ${name}${msg.amount ? ` ($${msg.amount})` : ''}`;
      addAnomaly(impulse, desc, impulse >= 50 ? 'danger' : 'warn');
      if (impulse <= 0) logEvent(desc, 'warn');
      tripEvent('fine', desc.replace(/^ATS fine: /, ''));
      setATSLastEvent(`🚨 ${desc}`);
      document.getElementById('ats-fines').textContent = `${appState.atsFines} fine${appState.atsFines === 1 ? '' : 's'}`;
      break;
    }
  }
}

function setATSLastEvent(text) {
  const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  document.getElementById('ats-last-event').textContent = `${time} • ${text}`;
}

function updateATSScore() {
  const s = appState.atsCollisionScore;
  const color = s >= 80 ? '#34C759' : s >= 50 ? '#FF9500' : '#FF3B30';
  const scoreEl = document.getElementById('ats-score');
  scoreEl.textContent = s;
  scoreEl.style.color = color;
  const hits = appState.atsCollisions;
  document.getElementById('ats-collisions').textContent = `${hits} collision${hits === 1 ? '' : 's'}`;
  const home = document.getElementById('home-collision-line');
  home.textContent = `ATS Collision Score ${s} • ${hits} hit${hits === 1 ? '' : 's'}`;
  home.style.color = color;
}

function resetATSTrip() {
  appState.atsCollisions = 0;
  appState.atsFines = 0;
  appState.atsCollisionScore = 100;
  updateATSScore();
  document.getElementById('ats-fines').textContent = '0 fines';
  document.getElementById('ats-last-event').textContent = 'No events yet';
}
