// Developer mode (Profile tab): shows prototype hardware controls that everyday drivers
// don't need. Anything with class="dev-only" in index.html is hidden until it's on.
// The choice is remembered on this device.
const DEV_MODE_KEY = 'drifts:devMode';

function setDeveloperMode(on) {
  document.getElementById('phone-root').classList.toggle('dev-mode', on);
  document.getElementById('chk-devmode').checked = on;
  try { localStorage.setItem(DEV_MODE_KEY, on ? '1' : '0'); } catch (e) {}
}

function initDeveloperMode() {
  let on = false;
  try { on = localStorage.getItem(DEV_MODE_KEY) === '1'; } catch (e) {}
  setDeveloperMode(on);
}
