// UFAS trip log: last 7 trips saved in localStorage.

// UFAS TRIP LOG — last 7 driving sessions with their important events
// ----------------------------------------------------------------------------
// Each trip records its LOWEST UFAS (the safety-relevant number), the score it
// ended on, and a timeline of important events. Stored in this browser only.
// ============================================================================
const TRIP_LOG_KEY = 'drifts:tripLog:v1';
const TRIP_LOG_MAX = 7;
const TRIP_EVENT_META = {
  start:     { icon: '▶', color: '#34C759', label: 'Trip started' },
  camera:    { icon: '◉', color: '#FF9500', label: 'Camera alert' },
  clear:     { icon: '✓', color: '#34C759', label: 'Driver verified' },
  eyes:      { icon: '◐', color: '#FF3B30', label: 'Eyes closed' },
  distract:  { icon: '↗', color: '#FF9500', label: 'Looking away' },
  alarm:     { icon: '!', color: '#FF3B30', label: 'Full-screen alarm' },
  safe:      { icon: '✔', color: '#007AFF', label: 'I am safe' },
  collision: { icon: '✱', color: '#FF3B30', label: 'ATS collision' },
  fine:      { icon: '$', color: '#FF9500', label: 'ATS fine' },
  routine:   { icon: '◎', color: '#007AFF', label: 'Routine face check' },
  sos:       { icon: '✆', color: '#FF3B30', label: 'SOS contact' },
  end:       { icon: '■', color: '#5856D6', label: 'Trip ended' }
};

let tripLog = [];
let currentTrip = null;
let openTripId = null;
let tripSavedAt = 0;
let tripRenderedAt = 0;
let tripClearArmed = false;

function loadTripLog() {
  try {
    const raw = localStorage.getItem(TRIP_LOG_KEY);
    tripLog = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(tripLog)) tripLog = [];
  } catch (e) { tripLog = []; }
  // A trip without an end means the app was closed mid-drive
  tripLog.forEach(t => {
    if (!t.end) {
      t.end = t.events.length ? t.events[t.events.length - 1].t : t.start;
      t.interrupted = true;
    }
  });
}

function saveTripLog() {
  tripSavedAt = Date.now();
  try { localStorage.setItem(TRIP_LOG_KEY, JSON.stringify(tripLog)); } catch (e) {}
}

function beginTripLog() {
  currentTrip = {
    id: Date.now().toString(36),
    start: Date.now(), end: null,
    lowest: 100, final: null, alerts: 0, alarms: 0,
    miles: 0, maxMph: 0,     // from GPS (js/gps.js)
    events: []
  };
  tripLog.unshift(currentTrip);
  tripLog = tripLog.slice(0, TRIP_LOG_MAX);
  openTripId = currentTrip.id;
  tripEvent('start', `Monitoring with ${describeInputs()}. Alarm after ${lockoutThreshold()} camera alerts.`);
}

function describeInputs() {
  const parts = [];
  if (appState.hardwareSensorsBound) parts.push('phone sensors');
  if (appState.wheelBound) parts.push('G29 wheel');
  if (appState.atsConnected) parts.push('ATS telemetry');
  if (appState.bleConnected) parts.push('Bluetooth module');
  return parts.length ? parts.join(', ') : 'phone sensors (linking)';
}

function tripEvent(type, text) {
  if (!currentTrip) return;
  currentTrip.events.push({ t: Date.now(), type, text, ufas: appState.alertnessScore });
  if (type === 'camera') currentTrip.alerts++;
  if (type === 'alarm') currentTrip.alarms++;
  saveTripLog();
  renderTripLog();
}

function endTripLog() {
  if (!currentTrip) return;
  currentTrip.final = appState.alertnessScore;
  const mins = Math.max(0, Math.round((Date.now() - currentTrip.start) / 60000));
  const dist = currentTrip.miles >= 0.1 ? ` Drove ${currentTrip.miles.toFixed(1)} mi, top speed ${currentTrip.maxMph} mph.` : '';
  tripEvent('end', `Arrived after ${mins} min. Ended at UFAS ${currentTrip.final}, lowest ${currentTrip.lowest}.${dist}`);
  currentTrip.end = Date.now();
  currentTrip = null;
  saveTripLog();
  renderTripLog();
}

// Called every frame from the fusion loop
function trackTripScore() {
  if (!currentTrip) return;
  if (appState.alertnessScore < currentTrip.lowest) currentTrip.lowest = appState.alertnessScore;
  const now = Date.now();
  if (appState.speedAt && now - appState.speedAt < 8000 && appState.speedMph > (currentTrip.maxMph || 0)) {
    currentTrip.maxMph = appState.speedMph;
  }
  if (now - tripSavedAt > 5000) saveTripLog();
  if (now - tripRenderedAt > 2000 && document.getElementById('screen-history').classList.contains('active')) renderTripLog();
}

function tripAddMiles(miles) {
  if (currentTrip) currentTrip.miles = (currentTrip.miles || 0) + miles;
}

function ufasBandColor(v) {
  return v >= 75 ? '#34C759' : v >= 50 ? '#FF9500' : '#FF3B30';
}

function fmtTripDate(ms) {
  const d = new Date(ms), today = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  const y = new Date(today); y.setDate(today.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

function fmtDuration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toggleTripDetails(id) {
  openTripId = openTripId === id ? null : id;
  renderTripLog();
  // Scroll inside the Logs screen only (never the page around the phone frame)
  const el = document.getElementById(`trip-${id}`);
  const screen = document.getElementById('screen-history');
  if (el && openTripId === id && screen.classList.contains('active')) {
    const top = el.getBoundingClientRect().top - screen.getBoundingClientRect().top + screen.scrollTop - 8;
    screen.scrollTo({ top, behavior: 'smooth' });
  }
}

function clearTripLog() {
  const btn = document.getElementById('trip-clear-btn');
  if (!tripClearArmed) {
    tripClearArmed = true;
    btn.textContent = 'Tap again to clear';
    setTimeout(() => { tripClearArmed = false; if (btn) btn.textContent = 'Clear'; }, 3000);
    return;
  }
  tripClearArmed = false;
  tripLog = currentTrip ? [currentTrip] : [];
  openTripId = currentTrip ? currentTrip.id : null;
  saveTripLog();
  renderTripLog();
  btn.textContent = 'Clear';
}

function renderTripLog() {
  tripRenderedAt = Date.now();
  const chart = document.getElementById('trip-chart');
  const list = document.getElementById('trip-list');
  if (!chart || !list) return;
  document.getElementById('trip-count-lbl').textContent = `${tripLog.length} of ${TRIP_LOG_MAX}`;

  // Bar chart: oldest on the left, newest (or live) on the right
  const ordered = tripLog.slice().reverse();
  let bars = '';
  for (let i = 0; i < TRIP_LOG_MAX; i++) {
    const t = ordered[i];
    if (!t) { bars += '<div class="trip-bar-slot empty"><div class="trip-bar-track"></div><div class="trip-bar-date">—</div></div>'; continue; }
    const live = t === currentTrip;
    const v = t.lowest;
    const d = new Date(t.start);
    bars += `<button class="trip-bar-slot${openTripId === t.id ? ' selected' : ''}${live ? ' live' : ''}" onclick="toggleTripDetails('${t.id}')"
        aria-label="Trip ${fmtTripDate(t.start)}, lowest UFAS ${v}${live ? ', in progress' : ''}">
        <div class="trip-bar-val" style="color:${ufasBandColor(v)}">${v}</div>
        <div class="trip-bar-track"><div class="trip-bar-fill" style="height:${Math.max(4, v)}%;background:${ufasBandColor(v)}"></div></div>
        <div class="trip-bar-date">${live ? 'Live' : `${d.getMonth() + 1}/${d.getDate()}`}</div>
      </button>`;
  }
  chart.innerHTML = bars;

  if (!tripLog.length) {
    list.innerHTML = '<div class="trip-empty">No trips yet. Tap <b>Start Driving</b> on the Monitor tab and each drive\'s UFAS will be logged here.</div>';
    return;
  }

  list.innerHTML = tripLog.map(t => {
    const live = t === currentTrip;
    const open = openTripId === t.id;
    const dur = fmtDuration((t.end || Date.now()) - t.start);
    const endTxt = live ? `now ${appState.alertnessScore}` : (t.final !== null ? `ended ${t.final}` : 'not ended');
    const meta = [dur, `${t.alerts} camera alert${t.alerts === 1 ? '' : 's'}`, endTxt];
    if (t.alarms) meta.splice(2, 0, `${t.alarms} alarm${t.alarms === 1 ? '' : 's'}`);
    if (t.miles >= 0.1) meta.splice(1, 0, `${t.miles.toFixed(1)} mi`, `top ${t.maxMph} mph`);
    const events = open ? t.events.slice().reverse().map(e => {
      const m = TRIP_EVENT_META[e.type] || { icon: '•', color: '#8E8E93', label: e.type };
      const time = new Date(e.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
      return `<li class="trip-ev">
          <span class="trip-ev-icon" style="background:${m.color}" aria-hidden="true">${m.icon}</span>
          <div class="trip-ev-body">
            <div class="trip-ev-head"><b>${m.label}</b><span class="mono">${time}</span></div>
            <div class="trip-ev-text">${escapeHTML(e.text)}</div>
          </div>
          <span class="trip-ev-ufas mono" style="color:${ufasBandColor(e.ufas)}" title="UFAS at this moment">${e.ufas}</span>
        </li>`;
    }).join('') : '';
    return `<div class="trip-card${open ? ' open' : ''}" id="trip-${t.id}">
        <button class="trip-head" onclick="toggleTripDetails('${t.id}')" aria-expanded="${open}">
          <div class="trip-score" title="Lowest UFAS this trip" style="border-color:${ufasBandColor(t.lowest)};color:${ufasBandColor(t.lowest)}">
            <span>${t.lowest}</span>
          </div>
          <div class="trip-head-text">
            <div class="trip-title">${fmtTripDate(t.start)}${live ? ' <span class="trip-live">LIVE</span>' : ''}${t.interrupted ? ' <span class="trip-warn">app closed</span>' : ''}</div>
            <div class="trip-meta">${meta.join(' • ')}</div>
          </div>
          <svg class="trip-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        ${open ? `<div class="trip-events"><div class="trip-ev-title">Important Events</div><ul>${events}</ul></div>` : ''}
      </div>`;
  }).join('');
}
