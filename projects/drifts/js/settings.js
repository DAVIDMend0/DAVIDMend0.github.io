// Remembers Profile settings on this device: dark mode, camera auto-sleep, alarm
// threshold, routine face checks, siren volume & tone, and the emergency contact.

const SETTINGS_KEY = 'drifts:settings:v1';
let settings = {};

function loadSettings() {
  try { settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { settings = {}; }
  if (typeof settings !== 'object' || settings === null) settings = {};
}

function writeSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}

// Reads the Profile controls and stores them (called from their onchange handlers)
function saveSettings() {
  settings.darkMode = document.getElementById('chk-darkmode').checked;
  settings.autoSleep = document.getElementById('chk-autosleep').checked;
  settings.lockoutAlerts = document.getElementById('sel-lockout-alerts').value;
  settings.faceCheckMin = document.getElementById('sel-facecheck').value;
  settings.sirenVolume = document.getElementById('slider-siren-vol').value;
  settings.sirenFreq = appState.sirenFreq;
  settings.sirenWave = appState.sirenWave;
  writeSettings();
}

// Puts the saved values back into the controls when the app opens
function applySettings() {
  const setSelect = (id, v) => {
    const el = document.getElementById(id);
    if (v != null && [...el.options].some(o => o.value === String(v))) el.value = String(v);
  };
  if (typeof settings.darkMode === 'boolean') {
    document.getElementById('chk-darkmode').checked = settings.darkMode;
    toggleNightMode();
  }
  if (typeof settings.autoSleep === 'boolean') document.getElementById('chk-autosleep').checked = settings.autoSleep;
  setSelect('sel-lockout-alerts', settings.lockoutAlerts);
  setSelect('sel-facecheck', settings.faceCheckMin);
  if (settings.sirenVolume != null) {
    document.getElementById('slider-siren-vol').value = settings.sirenVolume;
    updateSirenSettings();
  }
  if (settings.sirenFreq) {
    appState.sirenFreq = settings.sirenFreq;
    appState.sirenWave = settings.sirenWave || appState.sirenWave;
    document.getElementById('lbl-siren-hz').textContent = `${settings.sirenFreq}Hz`;
    document.querySelectorAll('.tone-pill').forEach(b => {
      b.classList.toggle('selected', (b.getAttribute('onclick') || '').includes(`setSirenTone(${settings.sirenFreq},`));
    });
  }
  document.getElementById('contact-name').value = settings.contactName || '';
  document.getElementById('contact-phone').value = settings.contactPhone || '';
  updateContactStatus();
}

// ---------- Emergency contact (used by js/sos.js) ----------
function saveEmergencyContact() {
  const name = document.getElementById('contact-name').value.trim().slice(0, 40);
  const phone = document.getElementById('contact-phone').value.trim();
  if (!name) return showToast('Add a name for your emergency contact.');
  const problem = contactPhoneProblem(phone);
  if (problem) return showToast(problem);
  settings.contactName = name;
  settings.contactPhone = phone;
  writeSettings();
  updateContactStatus();
  showToast(`${name} saved as your emergency contact.`);
}

function clearEmergencyContact() {
  delete settings.contactName;
  delete settings.contactPhone;
  writeSettings();
  document.getElementById('contact-name').value = '';
  document.getElementById('contact-phone').value = '';
  updateContactStatus();
}

function updateContactStatus() {
  const el = document.getElementById('contact-status');
  const has = !!(settings.contactName && settings.contactPhone);
  document.getElementById('contact-clear-btn').disabled = !has;
  el.textContent = has
    ? `SOS will call or text ${settings.contactName}. DRIFTS never contacts emergency services.`
    : 'The SOS button on the Monitor tab will call or text this person. DRIFTS never contacts emergency services.';
}

function initSettings() {
  loadSettings();
  applySettings();
}
