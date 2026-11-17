# DRIFTS — Driver Monitoring

A static web app (no build step) hosted on GitHub Pages and installable on phones.

## Files

| Path | What it is |
|---|---|
| `index.html` | All the screens' markup. Loads the CSS and JS below. |
| `v3-bluetooth.html` | The old address. Redirects to `index.html` so existing links keep working. |
| `manifest.webmanifest` | App name, icon and colors for "Add to Home Screen" / "Install app". |
| `sw.js` | Service worker: fast startup and offline use. |
| `logo.webp` | The DRIFTS logo (browser tab icon). |
| `icons/` | App icons made from the logo (Android, iPhone, browser tab). |
| `css/` | Styles, one file per area. Colors for light and night mode are variables at the top of `base.css`. **Order in `index.html` matters**: later files override earlier ones, and `preflight.css` must stay last. |
| `js/` | App code, one file per feature (see below). |
| `portfolio-wrapper.js` | Portfolio safety notice (phones) and "Back to portfolio" link (computers). Shared with `versions/`, and cached by `sw.js`. |

### `js/` files (loaded in this order)

`state.js` (shared state/config) → `audio.js` → `ui.js` → `sensors.js` → `session.js` → `wheel.js` → `ats.js` → `ble.js` → `trips.js` → `vision.js` → `fusion.js` → `devmode.js` → `maintenance.js` (Garage tab) → `gps.js` (speed + odometer miles) → `settings.js` (saved Profile settings + emergency contact) → `sheet.js` (pop-up panel) → `sos.js` (SOS + rest stops) → `drivemode.js` (Monitor-only tabs + screen awake) → `facecheck.js` (routine camera checks) → `garage-backup.js` (save/load Garage file) → `main.js` (startup, keep last) → `pwa.js`

They are ordinary scripts that share one global scope, so a function in one file can call a function in another. Code that runs immediately belongs in `main.js`'s startup block, not at the top of a file.

## Safety rule: SOS

SOS only opens a call or text to the driver's **personal** emergency contact. It never contacts emergency services: numbers under 7 digits (911, 112, 999…) are refused in `js/sos.js`, and nothing is dialed without the driver confirming on the phone's own screen.

## Developer mode

Profile → Developer Mode reveals prototype hardware (G29 wheel, ATS simulator, Bluetooth module, seat vibration). To hide anything else behind it, add `dev-only` to its `class` in `index.html`.

## Adding a feature

1. Create `js/<feature>.js` (e.g. `js/maintenance.js`) and, if needed, `css/<feature>.css`.
2. Add a `<script>` tag before `main.js` (and a `<link>` for the CSS) in `index.html`.
3. Add the new files to `APP_FILES` in `sw.js` and bump `CACHE_VERSION` (e.g. `drifts-v2`).
4. If it needs setup on load, call it from `main.js`.

## Testing locally

Service workers don't run from a double-clicked file, so serve the folder:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Publishing

Copy everything **except** `backup/` and `.claude/` into the app's folder on your site, together with a copy of `portfolio-wrapper.js`.

After deploying, phones get the new version the *next* time they open the app.
