// SOS button: lets the driver call or text THEIR OWN emergency contact (set in Profile).
//
// IMPORTANT: DRIFTS never calls emergency services. Numbers shorter than 7 digits
// (every emergency number worldwide: 911, 112, 999, 000, 110, 119, ...) are refused,
// both when saving and again when SOS is pressed. Nothing is dialed automatically:
// the buttons open the phone's own call / message screen and the driver confirms there.

const SOS_MIN_DIGITS = 7;
const SOS_MAX_DIGITS = 15;          // longest possible international number
const SOS_LOCATION_MAX_AGE_MS = 2 * 60 * 1000;

// Returns a message explaining what's wrong, or null if the number is OK
function contactPhoneProblem(phone) {
  if (!phone) return 'Add a phone number for your emergency contact.';
  if (!/^\+?[\d\s().-]+$/.test(phone)) return 'Use only digits, spaces, dashes, brackets and a leading +.';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < SOS_MIN_DIGITS) {
    return 'DRIFTS doesn’t contact emergency services. Enter a personal contact’s full phone number.';
  }
  if (digits.length > SOS_MAX_DIGITS) return 'That phone number is too long.';
  return null;
}

function sosDialString(phone) {
  return (phone.trim().startsWith('+') ? '+' : '') + phone.replace(/\D/g, '');
}

function sosMapsLink(lat, lon) {
  return `https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}`;
}

function sosSmsHref(dial, name, coords) {
  const where = coords ? `My location: ${sosMapsLink(coords.lat, coords.lon)}` : 'My location isn’t available right now.';
  const body = `DRIFTS alert: ${name ? name + ', ' : ''}I may need help while driving. ${where}`;
  // "?&body=" works on both iPhone and Android
  return `sms:${dial}?&body=${encodeURIComponent(body)}`;
}

function sosRecentFix() {
  const f = gpsState.last;
  return f && Date.now() - f.t < SOS_LOCATION_MAX_AGE_MS ? f : null;
}

function triggerSOS() {
  const name = settings.contactName;
  const phone = settings.contactPhone;

  if (!name || !phone || contactPhoneProblem(phone)) {
    openSheet(`
      <div class="sheet-title">No emergency contact yet</div>
      <p class="sheet-text">Add a family member or friend in <b>Profile → Emergency Contact</b>${isDrivingMode() ? ' once you’ve arrived' : ''}. The SOS button will then call or text them.</p>
      <p class="sheet-note">DRIFTS never contacts emergency services.</p>
      <div class="sheet-actions">
        ${isDrivingMode() ? '' : '<button class="ble-btn primary" onclick="closeSheet(); showScreen(\'profile\'); document.getElementById(\'contact-name\').focus()">Add Contact</button>'}
        <button class="ble-btn" onclick="closeSheet()">Close</button>
      </div>`);
    return;
  }

  const dial = sosDialString(phone);
  const safeName = escapeHTML(name);
  openSheet(`
    <div class="sheet-title">Contact ${safeName}</div>
    <p class="sheet-text">Opens your phone’s call or message screen. Nothing is sent until you confirm there.</p>
    <div class="sheet-actions sheet-actions-stack">
      <a class="ble-btn primary sheet-link" href="tel:${dial}" onclick="sosLog('call')">Call ${safeName}</a>
      <a class="ble-btn sheet-link" id="sos-sms-link" href="${sosSmsHref(dial, name, sosRecentFix())}" onclick="sosLog('text')">Text my location to ${safeName}</a>
      <button class="ble-btn" onclick="closeSheet()">Cancel</button>
    </div>
    <p class="sheet-note" id="sos-location-note">${sosRecentFix() ? 'Your current location will be included in the text.' : 'Finding your location for the text…'}</p>`);

  // No recent GPS fix: ask for one so the text can include a map link
  if (!sosRecentFix() && 'geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const link = document.getElementById('sos-sms-link');
        const note = document.getElementById('sos-location-note');
        if (!link) return;
        link.href = sosSmsHref(dial, name, { lat: pos.coords.latitude, lon: pos.coords.longitude });
        if (note) note.textContent = 'Your current location will be included in the text.';
      },
      () => {
        const note = document.getElementById('sos-location-note');
        if (note) note.textContent = 'Location unavailable. The text will be sent without it.';
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  } else if (!('geolocation' in navigator)) {
    document.getElementById('sos-location-note').textContent = 'Location unavailable. The text will be sent without it.';
  }
}

function sosLog(kind) {
  logEvent(kind === 'call' ? `SOS: opened a call to ${settings.contactName}.` : `SOS: opened a text to ${settings.contactName}.`, 'danger');
  tripEvent('sos', kind === 'call' ? `Called ${settings.contactName}.` : `Texted location to ${settings.contactName}.`);
  setTimeout(closeSheet, 300);
}

// ---------- Rest stops: open Maps searching around the driver ----------
function navigateRestStop() {
  const f = sosRecentFix();
  const url = f
    ? `https://www.google.com/maps/search/rest+area/@${f.lat.toFixed(5)},${f.lon.toFixed(5)},12z`
    : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('rest area near me');
  logEvent(f ? 'Opened Maps: rest areas near your location.' : 'Opened Maps: rest areas near you.');
  window.open(url, '_blank');
}

function updateRestCard() {
  const el = document.getElementById('rest-meta');
  if (el) el.textContent = sosRecentFix() ? 'Searches around your current GPS location' : 'Opens Maps with rest stops around your location';
}
