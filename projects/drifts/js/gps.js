// GPS: live speed for the header pill, and trip miles for the Garage odometer.
//
// Positions arrive from the watchPosition() started in sensors.js. Phones usually
// report speed directly; when they don't, it's worked out from the distance between
// fixes. GPS drifts a few meters even when parked, so miles are only counted while
// actually moving, with a reasonably accurate fix, during a driving session.

const GPS_CONFIG = {
  maxAccuracyM: 35,        // ignore fixes less accurate than this for distance
  minMovingMps: 1.5,       // ~3.4 mph: slower than this counts as stopped (GPS jitter)
  maxPlausibleMps: 60,     // ~134 mph: anything faster between fixes is a GPS jump
  staleMs: 8000,           // no update for this long: show "--"
  mpsToMph: 2.23694,
  metersPerMile: 1609.344
};

const gpsState = { last: null };   // last accurate fix: { lat, lon, t }

function gpsDistanceM(a, b) {
  // Haversine distance between two lat/lon points, in meters
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function handleGPSPosition(pos) {
  const c = pos.coords;
  const fix = { lat: c.latitude, lon: c.longitude, t: pos.timestamp || Date.now() };
  const accurate = c.accuracy == null || c.accuracy <= GPS_CONFIG.maxAccuracyM;
  const last = gpsState.last;

  let dist = 0, dt = 0;
  if (last) {
    dist = gpsDistanceM(last, fix);
    dt = (fix.t - last.t) / 1000;
  }

  // Speed: trust the phone's reading; otherwise derive it (only if the move beats the noise)
  let mps = (c.speed != null && c.speed >= 0) ? c.speed : null;
  if (mps == null) {
    mps = (last && dt > 0 && dist > Math.max(5, c.accuracy || 0)) ? dist / dt : 0;
  }
  if (mps < GPS_CONFIG.minMovingMps) mps = 0;
  if (mps <= GPS_CONFIG.maxPlausibleMps) {
    appState.speedMph = Math.round(mps * GPS_CONFIG.mpsToMph);
    appState.speedAt = Date.now();
    updateSpeedDisplay();
  }
  updateRestCard();

  // Distance for the odometer
  if (!accurate) return;              // keep the previous anchor until a good fix arrives
  if (last && dt > 0) {
    const moving = mps >= GPS_CONFIG.minMovingMps;
    const plausible = dist / dt <= GPS_CONFIG.maxPlausibleMps;
    if (moving && plausible && appState.sessionActive) {
      const miles = dist / GPS_CONFIG.metersPerMile;
      maintAddGPSMiles(miles);   // Garage odometer (if enabled)
      tripAddMiles(miles);       // trip log distance (always)
    }
  }
  gpsState.last = fix;
}

function updateSpeedDisplay() {
  const fresh = appState.speedAt && Date.now() - appState.speedAt < GPS_CONFIG.staleMs;
  document.getElementById('speed-val').textContent = fresh ? appState.speedMph : '--';
  document.getElementById('speed-pill').classList.toggle('idle', !fresh);
}

// Called when the trip ends and GPS stops
function resetGPS() {
  gpsState.last = null;
  appState.speedAt = 0;
  updateSpeedDisplay();
}

function initGPS() {
  updateSpeedDisplay();
  setInterval(updateSpeedDisplay, 1000);   // fades back to "--" when updates stop
}
