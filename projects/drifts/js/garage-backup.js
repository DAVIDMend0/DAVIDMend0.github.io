// Garage backup: save the maintenance data to a file on the phone, and load it back
// (e.g. after deleting and reinstalling DRIFTS).
//
// Loading a backup when this phone already has Garage data asks what to do:
//   • Merge both (recommended):
//       - odometer: the higher reading (odometers only go up)
//       - service items: matched by id, then by name; the most recent "last done"
//         wins, intervals and names come from this phone; items only in one side are kept
//       - history: everything from both, duplicates removed, newest first
//       - car name and the GPS-miles switch: this phone's, unless it has none
//   • Use backup only: replace this phone's Garage with the file
//   • Keep this phone's data: cancel

const BACKUP_FORMAT = { app: 'DRIFTS', type: 'garage-backup', version: 1 };
let pendingBackup = null;   // { data, exportedAt } while the conflict sheet is open

// ---------- Save ----------
async function exportGarageBackup() {
  const payload = { ...BACKUP_FORMAT, exportedAt: new Date().toISOString(), data: maint };
  const json = JSON.stringify(payload, null, 2);
  const filename = `drifts-garage-${maintToday()}.json`;
  const file = new File([json], filename, { type: 'application/json' });

  // On phones, the share sheet is the way to "Save to Files" / Drive; on computers, download
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'DRIFTS Garage backup' });
      markBackupSaved();
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;   // the driver closed the share sheet
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  markBackupSaved();
}

function markBackupSaved() {
  maint.lastBackupAt = maintToday();
  saveMaintenance();
  updateBackupNote();
  showToast('Garage backup saved. Keep the file somewhere safe.');
}

function updateBackupNote() {
  const el = document.getElementById('garage-backup-note');
  if (!el || !maint) return;
  el.textContent = maint.lastBackupAt
    ? `Last backup: ${maintFmtDate(maint.lastBackupAt)}. If you delete DRIFTS, load the file after reinstalling to get everything back.`
    : 'Saves your Garage to a file on your phone. If you delete DRIFTS, load the file after reinstalling to get everything back.';
}

// ---------- Load ----------
function importGarageBackup(input) {
  const file = input.files && input.files[0];
  input.value = '';   // lets the same file be picked again later
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return showToast('That file is too big to be a DRIFTS backup.');

  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try { parsed = JSON.parse(reader.result); } catch (e) { return showToast('That file isn’t a DRIFTS backup.'); }
    const data = cleanBackupData(parsed);
    if (!data) return showToast('That file isn’t a DRIFTS Garage backup.');

    if (maintIsPristine()) {
      applyBackup(data, 'restored');
    } else {
      pendingBackup = { data, exportedAt: parsed.exportedAt };
      showBackupConflict();
    }
  };
  reader.onerror = () => showToast('Couldn’t read that file.');
  reader.readAsText(file);
}

// Validates a parsed file and rebuilds it with only known fields and safe values
function cleanBackupData(parsed) {
  if (!parsed || parsed.app !== BACKUP_FORMAT.app || parsed.type !== BACKUP_FORMAT.type) return null;
  const d = parsed.data;
  if (!d || !Array.isArray(d.items)) return null;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  const date = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const id = (v) => (typeof v === 'string' && /^[a-z0-9]{1,24}$/i.test(v) ? v : maintNewId());

  const items = d.items
    .filter(i => i && typeof i.name === 'string' && i.name.trim())
    .slice(0, 100)
    .map(i => ({
      id: id(i.id),
      name: str(i.name, 40),
      intervalMiles: Math.round(num(i.intervalMiles) || 0),
      intervalMonths: Math.round(num(i.intervalMonths) || 0),
      lastDate: date(i.lastDate),
      lastMiles: num(i.lastMiles)
    }));
  const history = (Array.isArray(d.history) ? d.history : [])
    .filter(h => h && typeof h.name === 'string' && date(h.date))
    .slice(0, MAINT_HISTORY_MAX)
    .map(h => ({ id: id(h.id), name: str(h.name, 40), date: h.date, miles: num(h.miles) }));

  return {
    vehicle: str(d.vehicle, 40),
    odometer: num(d.odometer),
    odometerAt: date(d.odometerAt),
    autoMiles: typeof d.autoMiles === 'boolean' ? d.autoMiles : true,
    lastBackupAt: date(d.lastBackupAt),
    items,
    history
  };
}

// True when this phone's Garage has nothing worth keeping (fresh install)
function maintIsPristine() {
  if (maint.vehicle || maint.odometer != null || maint.history.length) return false;
  if (maint.items.some(i => i.lastDate || i.lastMiles != null)) return false;
  // Unchanged default schedule?
  if (maint.items.length !== MAINT_DEFAULT_ITEMS.length) return false;
  return maint.items.every((i, k) => {
    const d = MAINT_DEFAULT_ITEMS[k];
    return i.name === d.name && i.intervalMiles === d.intervalMiles && i.intervalMonths === d.intervalMonths;
  });
}

function showBackupConflict() {
  const b = pendingBackup.data;
  const when = pendingBackup.exportedAt ? new Date(pendingBackup.exportedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown date';
  const odo = (v) => (v != null ? maintFmtMiles(v) : '—');
  const logged = (d) => d.items.filter(i => i.lastDate || i.lastMiles != null).length;
  const row = (label, phone, backup) => `<tr><th>${label}</th><td>${phone}</td><td>${backup}</td></tr>`;

  openSheet(`
    <div class="sheet-title">This phone already has Garage data</div>
    <p class="sheet-text">Choose how to combine it with the backup from <b>${escapeHTML(when)}</b>.</p>
    <table class="sheet-compare">
      <thead><tr><th></th><td>This phone</td><td>Backup</td></tr></thead>
      <tbody>
        ${row('Car', escapeHTML(maint.vehicle || '—'), escapeHTML(b.vehicle || '—'))}
        ${row('Odometer', odo(maint.odometer), odo(b.odometer))}
        ${row('Service items', maint.items.length, b.items.length)}
        ${row('Logged', logged(maint), logged(b))}
        ${row('History', maint.history.length, b.history.length)}
      </tbody>
    </table>
    <div class="sheet-actions sheet-actions-stack">
      <button class="ble-btn primary sheet-choice" onclick="resolveBackupConflict('merge')">Merge both (recommended)
        <small>Keeps the higher odometer, the latest service of each item and all history</small></button>
      <button class="ble-btn sheet-choice" onclick="resolveBackupConflict('replace')">Use backup only
        <small>Replaces what’s on this phone with the file</small></button>
      <button class="ble-btn" onclick="resolveBackupConflict('cancel')">Keep this phone’s data</button>
    </div>`);
}

function resolveBackupConflict(choice) {
  const backup = pendingBackup && pendingBackup.data;
  pendingBackup = null;
  closeSheet();
  if (!backup || choice === 'cancel') return;
  if (choice === 'replace') applyBackup(backup, 'replaced');
  else applyBackup(mergeGarage(maint, backup), 'merged');
}

function mergeGarage(phone, backup) {
  const newer = (a, b) => {   // which of two copies of an item was serviced more recently
    if ((a.lastDate || '') !== (b.lastDate || '')) return (a.lastDate || '') > (b.lastDate || '') ? a : b;
    return (a.lastMiles || 0) >= (b.lastMiles || 0) ? a : b;
  };

  const items = phone.items.map(i => ({ ...i }));
  for (const bi of backup.items) {
    const match = items.find(i => i.id === bi.id) ||
      items.find(i => i.name.trim().toLowerCase() === bi.name.trim().toLowerCase());
    if (!match) { items.push({ ...bi }); continue; }
    const latest = newer(match, bi);
    match.lastDate = latest.lastDate;
    match.lastMiles = latest.lastMiles;
  }

  const seen = new Set();
  const history = [...phone.history, ...backup.history]
    .filter(h => {
      const key = `${h.name.toLowerCase()}|${h.date}|${h.miles != null ? Math.round(h.miles) : ''}`;
      if (seen.has(h.id) || seen.has(key)) return false;
      seen.add(h.id); seen.add(key);
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, MAINT_HISTORY_MAX);

  const phoneOdo = phone.odometer, backupOdo = backup.odometer;
  const useBackupOdo = backupOdo != null && (phoneOdo == null || backupOdo > phoneOdo);
  return {
    vehicle: phone.vehicle || backup.vehicle,
    odometer: useBackupOdo ? backupOdo : phoneOdo,
    odometerAt: useBackupOdo ? backup.odometerAt : phone.odometerAt,
    autoMiles: phone.autoMiles,
    lastBackupAt: phone.lastBackupAt || backup.lastBackupAt,
    items,
    history
  };
}

function applyBackup(data, how) {
  maint = data;
  maintOpenId = null;
  maintEditId = null;
  maintOdoEditing = false;
  saveMaintenance();
  renderMaintenance();
  updateBackupNote();
  const msg = { restored: 'Garage restored from backup.', replaced: 'Garage replaced with the backup.', merged: 'Backup merged into your Garage.' }[how];
  showToast(msg);
  logEvent(msg);
}
