// Clock, screen navigation, toasts, event log, rest stop / SOS, night mode.

// Live Real-Time Clock in Statusbar
function updateRealClock() {
  const now = new Date();
  document.getElementById('clock-text').textContent = now.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
}

// Toggle collapsible camera dropdown
function toggleCameraDropdown() {
  document.getElementById('vision-card').classList.toggle('collapsed');
}

// Navigation & Toast Helpers
function showScreen(name) {
  if (name !== 'home' && isDrivingMode()) return;   // only Monitor while driving (js/drivemode.js)
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  document.getElementById('nav-' + name).classList.add('active');
  if (name === 'garage') renderMaintenance();   // due dates move with the calendar
}

let toastTimer = null;
function showToast(msg) {
  const banner = document.getElementById('toast-banner');
  document.getElementById('toast-text').textContent = msg;
  banner.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => banner.classList.remove('show'), 4200);
}
function hideToast() {
  document.getElementById('toast-banner').classList.remove('show');
}

function logEvent(msg, level = 'normal') {
  const list = document.getElementById('event-log-list');
  const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const item = document.createElement('div');
  item.className = 'log-entry ' + (level !== 'normal' ? level : '');
  item.textContent = `[${time}] ${msg}`;
  list.prepend(item);
}

// navigateRestStop() and triggerSOS() live in js/sos.js

function toggleNightMode() {
  document.getElementById('phone-root').classList.toggle('dark-mode', document.getElementById('chk-darkmode').checked);
}
