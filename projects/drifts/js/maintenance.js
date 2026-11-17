// Garage tab: car maintenance tracker.
// Keeps the odometer, a service schedule (each item repeats every X miles and/or
// Y months) and a history of completed services. Saved on this device only.
//
// While driving, GPS miles are added to the odometer automatically (js/gps.js), unless
// the driver turns that off on the vehicle card. The odometer is kept with decimals
// internally so short trips add up, and shown rounded.
//
// An item is "due soon" once 85% of its interval is used up, or within 500 mi / 30 days,
// and "overdue" once either limit is passed, whichever comes first.

const MAINT_KEY = 'drifts:maintenance:v1';
const MAINT_SOON_FRACTION = 0.85;
const MAINT_SOON_MILES = 500;
const MAINT_SOON_DAYS = 30;
const MAINT_HISTORY_MAX = 50;
const MAINT_DAY_MS = 86400000;

// Starting schedule for a new user (typical intervals; edit them to match the owner's manual)
const MAINT_DEFAULT_ITEMS = [
  { name: 'Oil & filter change', intervalMiles: 5000, intervalMonths: 6 },
  { name: 'Tire rotation', intervalMiles: 7500, intervalMonths: 6 },
  { name: 'Brake inspection', intervalMiles: 12000, intervalMonths: 12 },
  { name: 'Engine air filter', intervalMiles: 15000, intervalMonths: 12 },
  { name: 'Cabin air filter', intervalMiles: 15000, intervalMonths: 12 },
  { name: 'Wiper blades', intervalMiles: 0, intervalMonths: 12 },
  { name: 'Battery check', intervalMiles: 0, intervalMonths: 12 }
];

const MAINT_COLORS = { overdue: '#FF3B30', soon: '#FF9500', ok: '#34C759', unknown: '#8E8E93' };

let maint = null;               // { vehicle, odometer, odometerAt, items: [], history: [] }
let maintOpenId = null;         // item expanded in the list
let maintEditId = null;         // item whose edit form is open ('new' = adding one)
let maintOdoEditing = false;
let maintClearArmed = false;
let maintTripMiles = 0;         // GPS miles added during the current trip
let maintGpsSavedAt = 0;        // last time GPS miles were written to storage
const MAINT_GPS_SAVE_MS = 15000;

// ---------- storage ----------
function maintNewId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function loadMaintenance() {
  try {
    const raw = localStorage.getItem(MAINT_KEY);
    if (raw) maint = JSON.parse(raw);
  } catch (e) { maint = null; }
  if (!maint || !Array.isArray(maint.items)) {
    maint = {
      vehicle: '',
      odometer: null,
      odometerAt: null,
      items: MAINT_DEFAULT_ITEMS.map(d => ({ id: maintNewId(), ...d, lastDate: null, lastMiles: null })),
      history: []
    };
  }
  if (!Array.isArray(maint.history)) maint.history = [];
  if (typeof maint.autoMiles !== 'boolean') maint.autoMiles = true;
}

function saveMaintenance() {
  try { localStorage.setItem(MAINT_KEY, JSON.stringify(maint)); } catch (e) {}
}

// ---------- dates & formatting ----------
function maintToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function maintParseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function maintAddMonths(date, n) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < day) d.setDate(0);   // Jan 31 + 1 month -> Feb 28/29, not Mar 3
  return d;
}
function maintFmtDate(s) {
  return maintParseDate(s).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
function maintFmtMiles(n) {
  return Math.round(n).toLocaleString() + ' mi';
}
function maintFmtDays(n) {
  if (n < 14) return n + (n === 1 ? ' day' : ' days');
  if (n < 60) return Math.round(n / 7) + ' wk';
  return Math.round(n / 30.4) + ' mo';
}
function maintFmtInterval(item) {
  const parts = [];
  if (item.intervalMiles > 0) parts.push(maintFmtMiles(item.intervalMiles));
  if (item.intervalMonths > 0) parts.push(item.intervalMonths + (item.intervalMonths === 1 ? ' month' : ' months'));
  return 'Every ' + parts.join(' or ');
}

// ---------- status ----------
function maintStatus(item) {
  const byMiles = item.intervalMiles > 0 && item.lastMiles != null && maint.odometer != null;
  const byTime = item.intervalMonths > 0 && !!item.lastDate;

  if (!byMiles && !byTime) {
    const logged = item.lastDate || item.lastMiles != null;
    return { level: 'unknown', frac: 0, text: logged ? 'Update your odometer to track this' : 'Not logged yet • tap to set' };
  }

  let milesLeft = null, daysLeft = null;
  const fracs = [];
  if (byMiles) {
    const used = maint.odometer - item.lastMiles;
    milesLeft = item.intervalMiles - used;
    fracs.push(used / item.intervalMiles);
  }
  if (byTime) {
    const start = maintParseDate(item.lastDate);
    const due = maintAddMonths(start, item.intervalMonths);
    const today = maintParseDate(maintToday());
    daysLeft = Math.round((due - today) / MAINT_DAY_MS);
    fracs.push((today - start) / (due - start));
  }
  const frac = Math.max(0, ...fracs);
  const milesOver = milesLeft != null && milesLeft < 0;
  const daysOver = daysLeft != null && daysLeft < 0;

  if (milesOver || daysOver) {
    const over = [];
    if (milesOver) over.push(maintFmtMiles(-milesLeft));
    if (daysOver) over.push(maintFmtDays(-daysLeft));
    return { level: 'overdue', frac, text: 'Overdue by ' + over.join(' • ') };
  }
  const left = [];
  if (milesLeft != null) left.push(maintFmtMiles(milesLeft));
  if (daysLeft != null) left.push(daysLeft === 0 ? 'today' : maintFmtDays(daysLeft));
  const soon = frac >= MAINT_SOON_FRACTION ||
    (milesLeft != null && milesLeft <= MAINT_SOON_MILES) ||
    (daysLeft != null && daysLeft <= MAINT_SOON_DAYS);
  return { level: soon ? 'soon' : 'ok', frac, text: 'Due in ' + left.join(' or ') };
}

function maintSorted() {
  const rank = { overdue: 0, soon: 1, ok: 2, unknown: 3 };
  return maint.items
    .map(item => ({ item, st: maintStatus(item) }))
    .sort((a, b) => rank[a.st.level] - rank[b.st.level] || b.st.frac - a.st.frac);
}

// ---------- rendering ----------
function renderMaintenance() {
  if (!maint) return;
  const rows = maintSorted();
  const count = (lvl) => rows.filter(r => r.st.level === lvl).length;
  const overdue = count('overdue'), soon = count('soon'), ok = count('ok');

  // Bottom-bar badge
  const badge = document.getElementById('nav-garage-badge');
  const attention = overdue + soon;
  badge.hidden = attention === 0;
  badge.textContent = attention;
  badge.style.background = overdue ? MAINT_COLORS.overdue : MAINT_COLORS.soon;

  renderMaintVehicle(overdue, soon, ok);
  renderMaintItems(rows);
  renderMaintHistory();
}

function renderMaintVehicle(overdue, soon, ok) {
  const odo = maint.odometer;
  const odoBlock = maintOdoEditing
    ? `<div class="maint-odo-edit">
         <input class="maint-input mono" id="maint-odo-input" type="number" inputmode="numeric" min="0" step="1"
           placeholder="Current mileage" value="${odo != null ? Math.round(odo) : ''}" onkeydown="if(event.key==='Enter')saveOdometer()">
         <button class="ble-btn primary" onclick="saveOdometer()">Save</button>
         <button class="ble-btn" onclick="cancelOdometer()">Cancel</button>
       </div>`
    : `<div class="maint-odo-row">
         <div>
           <div class="tele-lbl">Odometer</div>
           <div class="maint-odo-val mono">${odo != null ? maintFmtMiles(odo) : '— mi'}</div>
           <div class="tele-sub">${maint.odometerAt ? 'Updated ' + maintFmtDate(maint.odometerAt) : 'Enter your mileage to track services'}${maintTripMiles >= 0.1 ? ` • +${maintTripMiles.toFixed(1)} mi this trip` : ''}</div>
         </div>
         <button class="ble-btn primary maint-odo-btn" onclick="editOdometer()">${odo != null ? 'Update' : 'Set'}</button>
       </div>`;

  document.getElementById('garage-vehicle').innerHTML = `
    <input class="maint-vehicle-name" id="maint-vehicle-name" value="${escapeHTML(maint.vehicle)}"
      placeholder="Name your car (e.g. 2019 Honda Civic)" maxlength="40" onchange="saveVehicleName(this.value)" aria-label="Vehicle name">
    ${odoBlock}
    <label class="maint-auto-row">
      <span>Add GPS miles automatically<small>${odo != null ? 'Trips you drive with DRIFTS add to the odometer' : 'Set your odometer first'}</small></span>
      <input type="checkbox" id="maint-auto-miles" ${maint.autoMiles ? 'checked' : ''} onchange="setAutoMiles(this.checked)" aria-label="Add GPS miles automatically">
    </label>
    <div class="telemetry-grid maint-summary">
      <div class="tele-box"><div class="tele-lbl">Overdue</div><div class="tele-val mono" style="color:${overdue ? MAINT_COLORS.overdue : ''}">${overdue}</div></div>
      <div class="tele-box"><div class="tele-lbl">Due Soon</div><div class="tele-val mono" style="color:${soon ? MAINT_COLORS.soon : ''}">${soon}</div></div>
      <div class="tele-box"><div class="tele-lbl">Up to Date</div><div class="tele-val mono" style="color:${ok ? MAINT_COLORS.ok : ''}">${ok}</div></div>
    </div>`;

  if (maintOdoEditing) {
    const input = document.getElementById('maint-odo-input');
    input.focus();
    input.select();
  }
}

function maintEditForm(item) {
  const isNew = !item;
  const v = item || { name: '', intervalMiles: '', intervalMonths: '', lastDate: '', lastMiles: '' };
  const val = (x) => (x == null || x === 0 && isNew) ? '' : escapeHTML(x);
  return `
    <div class="maint-form">
      <label class="maint-field maint-field-wide"><span>Service</span>
        <input class="maint-input" id="maint-f-name" maxlength="40" placeholder="e.g. Coolant flush" value="${val(v.name)}"></label>
      <label class="maint-field"><span>Every (miles)</span>
        <input class="maint-input mono" id="maint-f-miles" type="number" inputmode="numeric" min="0" step="100" placeholder="—" value="${v.intervalMiles || ''}"></label>
      <label class="maint-field"><span>Every (months)</span>
        <input class="maint-input mono" id="maint-f-months" type="number" inputmode="numeric" min="0" step="1" placeholder="—" value="${v.intervalMonths || ''}"></label>
      <label class="maint-field"><span>Last done</span>
        <input class="maint-input mono" id="maint-f-date" type="date" max="${maintToday()}" value="${v.lastDate || ''}"></label>
      <label class="maint-field"><span>At mileage</span>
        <input class="maint-input mono" id="maint-f-last-miles" type="number" inputmode="numeric" min="0" step="1" placeholder="—" value="${v.lastMiles != null ? v.lastMiles : ''}"></label>
      <div class="maint-actions maint-field-wide">
        <button class="ble-btn primary" onclick="saveMaintItem('${isNew ? 'new' : item.id}')">${isNew ? 'Add' : 'Save'}</button>
        <button class="ble-btn" onclick="cancelMaintEdit()">Cancel</button>
        ${isNew ? '' : `<button class="ble-btn maint-delete" onclick="deleteMaintItem('${item.id}')">Delete</button>`}
      </div>
    </div>`;
}

function renderMaintItems(rows) {
  const chev = '<svg class="trip-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
  let html = maintEditId === 'new'
    ? `<div class="maint-item open"><div class="maint-new-title">New service item</div>${maintEditForm(null)}</div>`
    : '';

  html += rows.map(({ item, st }) => {
    const open = maintOpenId === item.id;
    const color = MAINT_COLORS[st.level];
    const pct = Math.min(100, Math.round(st.frac * 100));
    let body = '';
    if (open && maintEditId === item.id) {
      body = maintEditForm(item);
    } else if (open) {
      const last = item.lastDate || item.lastMiles != null
        ? [item.lastDate ? maintFmtDate(item.lastDate) : null, item.lastMiles != null ? maintFmtMiles(item.lastMiles) : null].filter(Boolean).join(' • ')
        : 'Never logged';
      body = `
        <div class="maint-body">
          <div class="maint-facts">
            <div><span>Last done</span><b>${last}</b></div>
            <div><span>Interval</span><b>${maintFmtInterval(item)}</b></div>
          </div>
          <div class="maint-actions">
            <button class="ble-btn primary" onclick="markMaintDone('${item.id}')">Done Today</button>
            <button class="ble-btn" onclick="editMaintItem('${item.id}')">Edit</button>
          </div>
        </div>`;
    }
    return `
      <div class="maint-item${open ? ' open' : ''}">
        <button class="maint-head" onclick="toggleMaintItem('${item.id}')" aria-expanded="${open}">
          <span class="maint-dot" style="background:${color}"></span>
          <span class="maint-main">
            <span class="maint-name">${escapeHTML(item.name)}</span>
            <span class="maint-status" style="color:${color}">${st.text}</span>
            <span class="maint-bar"><span class="maint-bar-fill" style="width:${st.level === 'unknown' ? 0 : pct}%;background:${color}"></span></span>
          </span>
          ${chev}
        </button>
        ${body}
      </div>`;
  }).join('');

  if (!rows.length && maintEditId !== 'new') {
    html = '<div class="card maint-empty">No service items. Tap “+ Add” to create one.</div>';
  }
  document.getElementById('garage-items').innerHTML = html;
}

function renderMaintHistory() {
  const list = document.getElementById('garage-history');
  document.getElementById('maint-clear-btn').style.display = maint.history.length ? '' : 'none';
  if (!maint.history.length) {
    list.innerHTML = '<div class="card maint-empty">Services you mark as done will appear here.</div>';
    return;
  }
  list.innerHTML = '<div class="card maint-history">' + maint.history.map(h => `
    <div class="maint-history-row">
      <div>
        <div class="maint-history-name">${escapeHTML(h.name)}</div>
        <div class="tele-sub">${maintFmtDate(h.date)}${h.miles != null ? ' • ' + maintFmtMiles(h.miles) : ''}</div>
      </div>
      <button class="maint-history-del" onclick="deleteMaintHistory('${h.id}')" aria-label="Remove this entry">✕</button>
    </div>`).join('') + '</div>';
}

// ---------- GPS miles (called from js/gps.js and the end of a trip) ----------
function maintAddGPSMiles(miles) {
  if (!maint || !maint.autoMiles || maint.odometer == null || !(miles > 0)) return;
  maint.odometer += miles;
  maintTripMiles += miles;
  const now = Date.now();
  if (now - maintGpsSavedAt > MAINT_GPS_SAVE_MS) {   // save now and then, not on every fix
    maintGpsSavedAt = now;
    maint.odometerAt = maintToday();
    saveMaintenance();
    maintRefreshIfIdle();
  }
}

// Returns the GPS miles added this trip (for the "You have arrived" message)
function maintTripEnded() {
  const miles = maintTripMiles;
  if (miles > 0) {
    maint.odometerAt = maintToday();
    saveMaintenance();
    logEvent(`Added ${miles.toFixed(1)} mi to the odometer from GPS (now ${maintFmtMiles(maint.odometer)}).`);
  }
  maintTripMiles = 0;
  maintRefreshIfIdle();
  return miles;
}

// Re-render the Garage only if the driver isn't in the middle of typing in it
function maintRefreshIfIdle() {
  if (!maintOdoEditing && !maintEditId) renderMaintenance();
}

function setAutoMiles(on) {
  maint.autoMiles = on;
  saveMaintenance();
}

// ---------- actions ----------
function saveVehicleName(name) {
  maint.vehicle = name.trim().slice(0, 40);
  saveMaintenance();
}

function editOdometer() {
  maintOdoEditing = true;
  renderMaintenance();
}
function cancelOdometer() {
  maintOdoEditing = false;
  renderMaintenance();
}
function saveOdometer() {
  const raw = document.getElementById('maint-odo-input').value.trim();
  const n = Math.round(Number(raw));
  if (raw === '' || !Number.isFinite(n) || n < 0) {
    showToast('Enter your current mileage as a number.');
    return;
  }
  maint.odometer = n;
  maint.odometerAt = maintToday();
  maintOdoEditing = false;
  saveMaintenance();
  renderMaintenance();
  showToast(`Odometer set to ${maintFmtMiles(n)}.`);
}

function toggleMaintItem(id) {
  maintOpenId = maintOpenId === id ? null : id;
  if (maintEditId !== 'new') maintEditId = null;
  renderMaintenance();
}

function markMaintDone(id) {
  const item = maint.items.find(i => i.id === id);
  if (!item) return;
  if (item.intervalMiles > 0 && maint.odometer == null) {
    showToast('Set your odometer first, so DRIFTS knows when this is due next.');
    editOdometer();
    return;
  }
  item.lastDate = maintToday();
  item.lastMiles = maint.odometer;
  maint.history.unshift({ id: maintNewId(), name: item.name, date: item.lastDate, miles: maint.odometer });
  maint.history = maint.history.slice(0, MAINT_HISTORY_MAX);
  maintOpenId = null;
  saveMaintenance();
  renderMaintenance();
  showToast(`${item.name} logged${maint.odometer != null ? ' at ' + maintFmtMiles(maint.odometer) : ''}.`);
}

function addMaintItem() {
  maintEditId = 'new';
  maintOpenId = null;
  renderMaintenance();
  document.getElementById('maint-f-name').focus();
}

function editMaintItem(id) {
  maintEditId = id;
  maintOpenId = id;
  renderMaintenance();
}

function cancelMaintEdit() {
  maintEditId = null;
  renderMaintenance();
}

function saveMaintItem(id) {
  const num = (elId) => {
    const raw = document.getElementById(elId).value.trim();
    if (raw === '') return null;
    const n = Math.round(Number(raw));
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };
  const name = document.getElementById('maint-f-name').value.trim();
  const miles = num('maint-f-miles');
  const months = num('maint-f-months');
  const lastDate = document.getElementById('maint-f-date').value || null;
  const lastMiles = num('maint-f-last-miles');

  if (!name) return showToast('Give the service a name.');
  if ([miles, months, lastMiles].some(Number.isNaN)) return showToast('Miles and months must be whole numbers.');
  const intervalMiles = miles || 0;
  const intervalMonths = months || 0;
  if (!intervalMiles && !intervalMonths) return showToast('Set how often it repeats: miles, months or both.');
  if (lastDate && lastDate > maintToday()) return showToast('“Last done” can’t be in the future.');

  const data = { name: name.slice(0, 40), intervalMiles, intervalMonths, lastDate, lastMiles };
  if (id === 'new') {
    maint.items.push({ id: maintNewId(), ...data });
  } else {
    const item = maint.items.find(i => i.id === id);
    if (!item) return;
    Object.assign(item, data);
  }
  // The odometer can't read lower than a service that was already logged
  if (lastMiles != null && (maint.odometer == null || lastMiles > maint.odometer)) {
    maint.odometer = lastMiles;
    maint.odometerAt = maintToday();
  }
  maintEditId = null;
  maintOpenId = null;
  saveMaintenance();
  renderMaintenance();
  showToast(id === 'new' ? `${data.name} added.` : `${data.name} saved.`);
}

function deleteMaintItem(id) {
  const item = maint.items.find(i => i.id === id);
  if (!item) return;
  maint.items = maint.items.filter(i => i.id !== id);
  maintEditId = null;
  maintOpenId = null;
  saveMaintenance();
  renderMaintenance();
  showToast(`${item.name} removed.`);
}

function deleteMaintHistory(id) {
  maint.history = maint.history.filter(h => h.id !== id);
  saveMaintenance();
  renderMaintHistory();
}

function clearMaintHistory() {
  const btn = document.getElementById('maint-clear-btn');
  if (!maintClearArmed) {
    maintClearArmed = true;
    btn.textContent = 'Tap again to clear';
    setTimeout(() => { maintClearArmed = false; btn.textContent = 'Clear'; }, 3000);
    return;
  }
  maintClearArmed = false;
  btn.textContent = 'Clear';
  maint.history = [];
  saveMaintenance();
  renderMaintHistory();
}

function initMaintenance() {
  loadMaintenance();
  renderMaintenance();
}
