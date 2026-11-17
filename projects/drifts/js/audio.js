// Siren settings, tones and alert chimes (WebAudio + vibration).

// Audio Context for non-blocking cabin alert chimes
let audioCtx = null;
let lastBeep = 0;

function updateSirenSettings() {
  const val = parseInt(document.getElementById('slider-siren-vol').value, 10);
  appState.sirenVolume = val / 100;
  document.getElementById('lbl-siren-vol').textContent = `${val}%`;
}

function setSirenTone(freq, wave, btnEl) {
  appState.sirenFreq = freq;
  appState.sirenWave = wave;
  document.getElementById('lbl-siren-hz').textContent = `${freq}Hz`;
  document.querySelectorAll('.tone-pill').forEach(b => b.classList.remove('selected'));
  if (btnEl) btnEl.classList.add('selected');
  playAlertChime(freq, 0.16, true, { preview: true });
}

// Plays one tone on the phone speaker (no vibration, no rate limit)
function playTone(freq, dur, volume = appState.sirenVolume) {
  if (volume <= 0.01) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = appState.sirenWave || 'sawtooth';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(Math.max(0.002, volume * 0.18), audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}

// Alert chime + phone haptics. When the Bluetooth module owns the alarm sound,
// the phone stays silent (only tone previews in Profile still play).
function playAlertChime(freq = appState.sirenFreq, dur = 0.16, forceTest = false, opts = {}) {
  const now = performance.now();
  if (!forceTest && now - lastBeep < 650) return;
  lastBeep = now;
  if (opts.preview || !moduleOwnsSound()) playTone(freq, dur);
  // Trigger mobile haptic vibration if supported
  if (!opts.preview && navigator.vibrate) navigator.vibrate([160, 80, 160]);
}
