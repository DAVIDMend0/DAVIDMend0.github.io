/* ==========================================================================
   games.js — Playground tabs + three games built on real projects
   - Balance the Robot  (Self-Balancing Robot: inverted pendulum + PID)
   - Logic Gates lives in logic-game.js (tutorial + daily, hard, Verilog)
   - Tune the Satellite (METEOR-M2: track the Doppler drift, decode an image)
   The Reflex game lives in features.js.
   Every game loop runs only while its tab is open and on screen.
   ========================================================================== */
(function () {
    'use strict';

    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const store = {
        get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    };

    // The game pads are always dark instruments, in both site themes
    const C = {
        bg: '#0d0d0f', grid: 'rgba(250,250,250,0.05)', ink: '#fafafa', muted: '#a1a1aa',
        faint: 'rgba(250,250,250,0.28)', red: '#e5372a', blue: '#3a6fd8', yellow: '#f5c518', green: '#22c55e'
    };
    const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

    /* ---------------------------------------------------------------
       Shared helpers
    --------------------------------------------------------------- */

    // Size a canvas to its container (crisp on high-DPI screens)
    function fitCanvas(canvas, height, onResize) {
        const ctx = canvas.getContext('2d');
        const view = { ctx, w: 0, h: height };
        const apply = () => {
            const w = canvas.parentElement.clientWidth;
            // only react to real width changes, so a running game is never reset by
            // unrelated layout shifts (e.g. a phone's address bar showing / hiding)
            if (!w || w === view.w) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            view.w = w;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(height * dpr);
            canvas.style.width = '100%';
            canvas.style.height = height + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            if (onResize) onResize();
        };
        new ResizeObserver(apply).observe(canvas.parentElement);
        apply();
        return view;
    }

    // Run `frame(dt)` only while the panel's tab is open, on screen and the page is visible
    function makeRunner(panel, frame) {
        let raf = null, last = 0, onScreen = false;
        const live = () => panel.classList.contains('active') && onScreen && !document.hidden;
        const tick = now => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            frame(dt);
            raf = live() ? requestAnimationFrame(tick) : null;
        };
        const kick = () => {
            if (!raf && live()) { last = performance.now(); raf = requestAnimationFrame(tick); }
        };
        new IntersectionObserver(e => { onScreen = e[0].isIntersecting; kick(); }).observe(panel);
        document.addEventListener('pg:tab', kick);
        document.addEventListener('visibilitychange', kick);
        return { kick, live };
    }

    // Is this panel the one the visitor is interacting with right now?
    function panelHasFocus(panel, e) {
        if (!panel.classList.contains('active')) return false;
        const t = e && e.target;
        if (t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) && t.type !== 'range')) return false;
        const cs = $('#caseStudy'), term = $('#terminal');
        if ((cs && !cs.hidden) || (term && !term.hidden) || $('.modal.active')) return false;
        if (document.body.classList.contains('menu-open')) return false;
        const r = panel.getBoundingClientRect();
        return r.bottom > 80 && r.top < window.innerHeight - 80;
    }

    function grid(ctx, w, h, step) {
        ctx.strokeStyle = C.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = step; x < w; x += step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
        for (let y = step; y < h; y += step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
        ctx.stroke();
    }

    function overlay(ctx, w, cy, title, sub) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(13,13,15,0.82)';
        ctx.fillRect(0, cy - 34, w, sub ? 66 : 48);
        ctx.fillStyle = C.ink;
        ctx.font = '600 17px Inter, sans-serif';
        ctx.fillText(title, w / 2, cy - 6);
        if (sub) {
            ctx.fillStyle = C.muted;
            ctx.font = '400 11px ' + MONO;
            ctx.fillText(sub, w / 2, cy + 16);
        }
        ctx.restore();
    }

    /* ---------------------------------------------------------------
       Tabs (panels share one grid cell; the active one sets the height)
    --------------------------------------------------------------- */
    function initTabs() {
        const tabs = $$('.pg-tab');
        if (!tabs.length) return;
        const activate = (tab, focus) => {
            tabs.forEach(t => {
                const on = t === tab;
                t.classList.toggle('active', on);
                t.setAttribute('aria-selected', String(on));
                t.tabIndex = on ? 0 : -1;
                const panel = document.getElementById(t.getAttribute('aria-controls'));
                panel.classList.toggle('active', on);
                panel.toggleAttribute('inert', !on);
            });
            if (focus) tab.focus();
            document.dispatchEvent(new CustomEvent('pg:tab', { detail: tab.id }));
        };
        tabs.forEach((t, i) => {
            if (!t.classList.contains('active')) document.getElementById(t.getAttribute('aria-controls')).setAttribute('inert', '');
            t.addEventListener('click', () => activate(t));
            t.addEventListener('keydown', e => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                e.preventDefault();
                e.stopPropagation();
                const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
                activate(next, true);
            });
        });
    }

    /* ---------------------------------------------------------------
       02 · BALANCE THE ROBOT
       Inverted pendulum on a wheel:  θ'' = (g/L)·sinθ − (a/L)·cosθ + disturbance
       Manual: the visitor drives the wheel.  PID: u = P·θ + I·∫θ + D·θ'
    --------------------------------------------------------------- */
    function initBalance() {
        const canvas = $('#balanceCanvas');
        if (!canvas) return;
        const panel = $('#pg-balance');
        const H = window.matchMedia('(max-width: 640px)').matches ? 280 : 320;
        const G = 9.81, L = 2.5, AMAX = 40, PX = 70, MANUAL_U = 6, POS_K = 0.3, VEL_K = 0.8;
        const sliders = { P: $('#gainP'), I: $('#gainI'), D: $('#gainD') };
        let mode = 'manual', running = false, fell = false, falls = 0;
        let th, om, x, v, integ, gust, t, dir = 0, hist = [], autoReset = 0, lastStat = 0;
        let best = store.get('balanceBest');
        if (best) $('#balBest').textContent = best.toFixed(1) + ' s';

        function reset() {
            th = (Math.random() - 0.5) * 0.08;
            om = 0; x = 0; v = 0; integ = 0; gust = 0; t = 0; fell = false; hist = [];
        }
        reset();
        // canvas is set up after the state exists (its first resize draws immediately)
        let view = { w: 0 };

        function physics(dt) {
            const steps = 4, h = dt / steps;
            for (let i = 0; i < steps; i++) {
                gust = gust * 0.97 + (Math.random() - 0.5) * 0.3;
                const strength = mode === 'manual' ? 0.6 + Math.min(t, 30) * 0.05 : 0.35;
                let u;
                if (mode === 'manual') {
                    u = dir * MANUAL_U;
                } else {
                    integ = clamp(integ + th * h, -3, 3);
                    // angle loop (the sliders) + a gentle outer loop that keeps the robot near centre
                    u = +sliders.P.value * th + +sliders.I.value * integ + +sliders.D.value * om
                      + POS_K * x + VEL_K * v;
                }
                const a = clamp(L * u, -AMAX, AMAX);
                const alpha = (G / L) * Math.sin(th) - (a / L) * Math.cos(th) + gust * strength;
                om += alpha * h;
                th += om * h;
                v = (v + a * h) * (1 - 0.8 * h);
                x += v * h;
            }
            const half = view.w / 2 / PX;
            if (x > half + 0.3) x -= 2 * half + 0.6;
            if (x < -half - 0.3) x += 2 * half + 0.6;
            t += dt;
            hist.push(th);
            if (hist.length > 240) hist.shift();

            if (Math.abs(th) > 1.0) {   // fell over
                fell = true;
                falls++;
                $('#balFalls').textContent = falls;
                if (mode === 'manual') {
                    running = false;
                    if (!best || t > best) {
                        best = t;
                        store.set('balanceBest', best);
                        $('#balBest').textContent = best.toFixed(1) + ' s';
                    }
                    $('#balStart').textContent = 'Try again';
                } else {
                    autoReset = 1.4;
                }
            }
        }

        function draw() {
            const { ctx, w, h } = view;
            if (!w || th === undefined) return;
            ctx.fillStyle = C.bg;
            ctx.fillRect(0, 0, w, h);
            grid(ctx, w, h, 40);

            const groundY = h - 74;
            ctx.fillStyle = C.ink;
            ctx.fillRect(0, groundY, w, 2);

            // θ strip chart under the ground line
            const cTop = groundY + 14, cH = h - cTop - 12, cMid = cTop + cH / 2;
            ctx.strokeStyle = C.faint;
            ctx.setLineDash([3, 4]);
            ctx.beginPath(); ctx.moveTo(14, cMid + 0.5); ctx.lineTo(w - 14, cMid + 0.5); ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = C.blue;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            hist.forEach((a, i) => {
                const px = 14 + (i / 239) * (w - 28);
                const py = cMid - clamp(a / 1.0, -1, 1) * (cH / 2);
                i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            });
            ctx.stroke();
            ctx.fillStyle = C.muted;
            ctx.font = '400 10px ' + MONO;
            ctx.textAlign = 'left';
            ctx.fillText('TILT, LAST 4 s', 14, cTop + 2);

            // robot
            const r = 15, cx = w / 2 + x * PX, cy = groundY - r;
            ctx.lineWidth = 2;
            ctx.strokeStyle = C.ink;
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
            const spin = (x * PX) / r;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(spin) * r, cy + Math.sin(spin) * r); ctx.stroke();
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(th);
            ctx.fillStyle = C.bg;
            ctx.fillRect(-11, -122, 22, 112);
            ctx.strokeRect(-11, -122, 22, 112);
            ctx.fillStyle = C.yellow; ctx.fillRect(-10, -66, 20, 24);
            ctx.fillStyle = C.red; ctx.fillRect(-10, -121, 20, 18);
            ctx.restore();

            // HUD
            ctx.fillStyle = C.muted;
            ctx.font = '400 11px ' + MONO;
            ctx.fillText(`TILT ${(th * 180 / Math.PI >= 0 ? '+' : '') + (th * 180 / Math.PI).toFixed(1)}°`, 14, 22);
            ctx.fillText(`TIME ${t.toFixed(1)} s`, 14, 38);
            ctx.textAlign = 'right';
            ctx.fillStyle = mode === 'pid' ? C.yellow : C.muted;
            ctx.fillText(mode === 'pid' ? 'PID CONTROL' : 'MANUAL', w - 14, 22);

            if (mode === 'manual' && !running) {
                overlay(ctx, w, groundY / 2 + 6,
                    fell ? `It fell after ${t.toFixed(1)} s` : 'Press Start',
                    'Hold ◀ ▶ (or the arrow keys) to drive under it');
            } else if (mode === 'pid' && fell) {
                overlay(ctx, w, groundY / 2 + 6, 'It fell over', 'Try more P to push back, more D to calm the wobble');
            }
        }

        view = fitCanvas(canvas, H, () => draw());

        const runner = makeRunner(panel, dt => {
            if (mode === 'pid' && fell) {
                autoReset -= dt;
                if (autoReset <= 0) reset();
            } else if (running || mode === 'pid') {
                physics(dt);
            }
            draw();
            const now = performance.now();
            if (now - lastStat > 100) { $('#balTime').textContent = t.toFixed(1) + ' s'; lastStat = now; }
        });

        // Mode switch
        $$('[data-bal-mode]').forEach(b => b.addEventListener('click', () => {
            mode = b.dataset.balMode;
            $$('[data-bal-mode]').forEach(x2 => x2.classList.toggle('active', x2 === b));
            $('.bal-manual').hidden = mode !== 'manual';
            $('.bal-pid').hidden = mode !== 'pid';
            $('#balMode').textContent = mode === 'pid' ? 'PID' : 'Manual';
            running = false; dir = 0;
            $('#balStart').textContent = 'Start';
            reset();
            draw();
            runner.kick();
        }));

        $('#balStart').addEventListener('click', () => {
            reset();
            running = true;
            $('#balStart').textContent = 'Restart';
            runner.kick();
        });

        // Hold-to-drive buttons (touch + mouse)
        $$('[data-bal-push]').forEach(b => {
            const d = +b.dataset.balPush;
            const on = e => { e.preventDefault(); dir = d; b.classList.add('held'); if (!running && mode === 'manual') { reset(); running = true; $('#balStart').textContent = 'Restart'; runner.kick(); } };
            const off = () => { if (dir === d) dir = 0; b.classList.remove('held'); };
            b.addEventListener('pointerdown', on);
            ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, off));
            b.addEventListener('contextmenu', e => e.preventDefault());
        });

        // Arrow keys / A, D while the game is on screen
        document.addEventListener('keydown', e => {
            if (mode !== 'manual' || !panelHasFocus(panel, e)) return;
            if (e.target && e.target.classList && e.target.classList.contains('pg-tab')) return;
            const d = (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') ? -1
                    : (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') ? 1 : 0;
            if (!d) return;
            e.preventDefault();
            dir = d;
            if (!running && !e.repeat) { reset(); running = true; $('#balStart').textContent = 'Restart'; runner.kick(); }
        });
        document.addEventListener('keyup', e => {
            if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(e.key)) dir = 0;
        });

        // PID controls
        Object.entries(sliders).forEach(([k, s]) => {
            const out = $(`#gain${k}Out`);
            const sync = () => { out.textContent = (+s.value).toFixed(k === 'D' ? 2 : 1); };
            s.addEventListener('input', sync);
            sync();
        });
        $('#balPush').addEventListener('click', () => { if (!fell) om += (Math.random() < 0.5 ? -1 : 1) * 1.4; });
        $('#balReset').addEventListener('click', () => { reset(); draw(); });
    }

    /* ---------------------------------------------------------------
       04 · TUNE THE SATELLITE
       The carrier drifts along a Doppler S-curve during a 36 s pass.
       Keep the receiver on it; each image line decodes cleanly only
       while you are locked on, otherwise it fills with noise.
    --------------------------------------------------------------- */
    function initTune() {
        const canvas = $('#tuneCanvas');
        if (!canvas) return;
        const panel = $('#pg-tune');
        const small = window.matchMedia('(max-width: 640px)').matches;
        const H = small ? 340 : 380;
        const PASS = 36, RANGE = 4000, LOCK_HZ = 150, LOSE_HZ = 600;
        const SPEC_TOP = 30, SPEC_BOT = 108, WF_TOP = 122, WF_H = 50, IMG_TOP = WF_TOP + WF_H + 14;
        const slider = $('#tuneSlider');
        let tune = 0, running = false, finished = false, stopped = false, t = 0, rowsDone = 0, qSum = 0, lockRows = 0, lastStat = 0;
        let best = store.get('tuneBest');
        if (best != null) $('#tuneBest').textContent = Math.round(best * 100) + '%';

        let src = null, srcData = null, out = null, outCtx = null, rows = 0, imgW = 0, imgH = 0;
        const wf = document.createElement('canvas');
        const wfCtx = wf.getContext('2d');
        const img = new Image();
        img.src = 'assets/projects/meteor-m2/Met_Sat.webp';

        let view = { w: 0 };

        function prepare() {
            if (!view.w) return;
            imgW = Math.max(10, Math.floor(view.w - 32));
            imgH = Math.max(10, Math.floor(H - IMG_TOP - 14));
            rows = Math.floor(imgH / 2);
            wf.width = view.w; wf.height = WF_H;
            wfCtx.fillStyle = C.bg; wfCtx.fillRect(0, 0, wf.width, wf.height);
            out = document.createElement('canvas');
            out.width = imgW; out.height = imgH;
            outCtx = out.getContext('2d');
            outCtx.fillStyle = '#08080a';
            outCtx.fillRect(0, 0, imgW, imgH);
            if (img.complete && img.naturalWidth) {
                src = document.createElement('canvas');
                src.width = imgW; src.height = imgH;
                const sctx = src.getContext('2d');
                const s = Math.max(imgW / img.naturalWidth, imgH / img.naturalHeight);
                const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
                sctx.drawImage(img, (imgW - dw) / 2, (imgH - dh) / 2, dw, dh);
                srcData = sctx.getImageData(0, 0, imgW, imgH).data;
            }
            running = false; finished = false; stopped = false; t = 0; rowsDone = 0; qSum = 0; lockRows = 0;
            $('#tuneStart').textContent = 'Start pass';
            $('#tuneStop').disabled = true;
        }
        img.onload = () => { prepare(); draw(); };

        // Doppler S-curve over the pass, plus a little wobble
        const signalHz = time => {
            const xs = -10 + 20 * clamp(time / PASS, 0, 1);
            return 3500 * (-xs / Math.sqrt(xs * xs + 9)) + 70 * Math.sin(time * 1.3);
        };
        const quality = err => err <= LOCK_HZ ? 1 : clamp(1 - (err - LOCK_HZ) / (LOSE_HZ - LOCK_HZ), 0, 1);
        const fx = f => 16 + ((f + RANGE) / (2 * RANGE)) * (view.w - 32);
        const fromX = px => clamp(((px - 16) / (view.w - 32)) * 2 * RANGE - RANGE, -RANGE, RANGE);

        function decodeRow(r, q) {
            if (!srcData) return;
            const y0 = r * 2, row = outCtx.createImageData(imgW, 2), d = row.data;
            for (let yy = 0; yy < 2; yy++) {
                for (let x = 0; x < imgW; x++) {
                    const si = ((y0 + yy) * imgW + x) * 4, di = (yy * imgW + x) * 4;
                    const n = Math.random() * 200;
                    d[di] = srcData[si] * q + n * (1 - q);
                    d[di + 1] = srcData[si + 1] * q + n * (1 - q);
                    d[di + 2] = srcData[si + 2] * q + n * (1 - q);
                    d[di + 3] = 255;
                }
            }
            outCtx.putImageData(row, 0, y0);
        }

        function spectrumAmp(f, sig) {
            const peak = Math.exp(-Math.pow((f - sig) / 110, 2) / 2);
            return 0.08 + Math.random() * 0.1 + peak * 0.85;
        }

        function draw(stepped) {
            const { ctx, w, h } = view;
            if (!w) return;
            const sig = signalHz(t);
            const err = Math.abs(tune - sig);
            const q = quality(err);

            ctx.fillStyle = C.bg;
            ctx.fillRect(0, 0, w, h);
            grid(ctx, w, h, 40);

            // spectrum
            ctx.strokeStyle = C.ink;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            const amps = [];
            for (let px = 16; px <= w - 16; px += 3) {
                const a = spectrumAmp(fromX(px), sig);
                amps.push(a);
                const py = SPEC_BOT - a * (SPEC_BOT - SPEC_TOP);
                px === 16 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.fillStyle = C.faint;
            ctx.fillRect(16, SPEC_BOT, w - 32, 1);

            // receiver passband
            const bx0 = fx(tune - LOCK_HZ), bx1 = fx(tune + LOCK_HZ);
            ctx.fillStyle = 'rgba(229,55,42,0.16)';
            ctx.fillRect(bx0, SPEC_TOP - 6, bx1 - bx0, WF_TOP + WF_H - SPEC_TOP + 6);
            ctx.fillStyle = C.red;
            ctx.fillRect(Math.round(fx(tune)) - 1, SPEC_TOP - 6, 2, WF_TOP + WF_H - SPEC_TOP + 6);

            // waterfall (scrolls down one pixel per frame)
            if (stepped) {
                wfCtx.drawImage(wf, 0, 1);
                wfCtx.fillStyle = C.bg;               // clear the new top row before painting it
                wfCtx.fillRect(0, 0, wf.width, 1);
                amps.forEach((a, i) => {
                    wfCtx.fillStyle = `rgba(250,250,250,${clamp((a - 0.12) * 1.1, 0, 1).toFixed(3)})`;
                    wfCtx.fillRect(16 + i * 3, 0, 3, 1);
                });
            }
            ctx.drawImage(wf, 0, WF_TOP, w, WF_H);

            // axis labels + readouts
            ctx.font = '400 10px ' + MONO;
            ctx.fillStyle = C.muted;
            ctx.textAlign = 'left'; ctx.fillText('−4 kHz', 16, SPEC_BOT + 11);
            ctx.textAlign = 'center'; ctx.fillText('137.900 MHz', w / 2, SPEC_BOT + 11);
            ctx.textAlign = 'right'; ctx.fillText('+4 kHz', w - 16, SPEC_BOT + 11);
            ctx.textAlign = 'left';
            ctx.font = '400 11px ' + MONO;
            ctx.fillText(`RX ${(137.9 + tune / 1e6).toFixed(5)} MHz`, 16, 18);
            ctx.textAlign = 'right';
            if (running) {
                const locked = q >= 0.95;
                ctx.fillStyle = locked ? C.yellow : C.muted;
                ctx.fillText(locked ? '■ LOCKED' : `OFF BY ${Math.round(err)} Hz`, w - 16, 18);
            } else {
                ctx.fillText('IDLE', w - 16, 18);
            }

            // decoded image
            ctx.strokeStyle = C.faint;
            ctx.lineWidth = 1;
            ctx.strokeRect(15.5, IMG_TOP - 0.5, imgW + 1, imgH + 1);
            if (out) ctx.drawImage(out, 16, IMG_TOP);
            if (running && rowsDone < rows) {
                ctx.fillStyle = C.red;
                ctx.fillRect(16, IMG_TOP + rowsDone * 2, imgW, 1);
            }
            ctx.textAlign = 'left';
            ctx.fillStyle = C.muted;
            ctx.font = '400 10px ' + MONO;
            if (!rowsDone) ctx.fillText('DECODED IMAGE · WAITING FOR SIGNAL', 24, IMG_TOP + 16);

            const cyImg = IMG_TOP + imgH / 2;
            if (stopped) overlay(ctx, w, cyImg, 'Pass stopped', 'Start a new pass to try again from the beginning');
            else if (!running && !finished) overlay(ctx, w, cyImg, 'Press Start pass', 'Then keep the red tuner on the peak');
            if (finished) {
                const qa = rows ? qSum / rows : 0;
                overlay(ctx, w, cyImg, `Pass complete · ${Math.round(qa * 100)}% image quality`, 'Start another pass to beat it');
            }
        }

        view = fitCanvas(canvas, H, () => { prepare(); draw(); });

        const runner = makeRunner(panel, dt => {
            if (running) {
                t += dt;
                const q = quality(Math.abs(tune - signalHz(t)));
                const target = Math.min(rows, Math.floor((t / PASS) * rows));
                while (rowsDone < target) {
                    decodeRow(rowsDone, q);
                    qSum += q;
                    if (q >= 0.95) lockRows++;
                    rowsDone++;
                }
                if (t >= PASS) {
                    running = false;
                    finished = true;
                    const qa = rows ? qSum / rows : 0;
                    if (best == null || qa > best) { best = qa; store.set('tuneBest', best); $('#tuneBest').textContent = Math.round(best * 100) + '%'; }
                    $('#tuneStart').textContent = 'Start pass';
                    $('#tuneStop').disabled = true;
                }
            }
            draw(true);
            const now = performance.now();
            if (now - lastStat > 120) {
                lastStat = now;
                $('#tuneQuality').textContent = rowsDone ? Math.round((qSum / rowsDone) * 100) + '%' : '—';
                $('#tuneLock').textContent = rowsDone ? Math.round((lockRows / rowsDone) * 100) + '%' : '—';
                const left = Math.max(0, Math.ceil(PASS - t));
                $('#tuneTime').textContent = `0:${String(left).padStart(2, '0')}`;
            }
        });

        function setTune(hz) {
            tune = clamp(Math.round(hz / 10) * 10, -RANGE, RANGE);
            slider.value = tune;
            $('#tuneOut').textContent = (tune >= 0 ? '+' : '') + tune + ' Hz';
        }
        slider.addEventListener('input', () => setTune(+slider.value));

        // Drag on the spectrum / waterfall to tune
        let dragging = false;
        const pointTune = e => {
            const r = canvas.getBoundingClientRect();
            if (e.clientY - r.top > IMG_TOP) return false;
            setTune(fromX(e.clientX - r.left));
            return true;
        };
        canvas.addEventListener('pointerdown', e => { if (pointTune(e)) { dragging = true; canvas.setPointerCapture(e.pointerId); } });
        canvas.addEventListener('pointermove', e => { if (dragging) pointTune(e); });
        ['pointerup', 'pointercancel'].forEach(ev => canvas.addEventListener(ev, () => { dragging = false; }));

        // Arrow keys nudge the tuner during a pass
        document.addEventListener('keydown', e => {
            if (!running || !panelHasFocus(panel, e) || e.target === slider) return;
            if (e.target && e.target.classList && e.target.classList.contains('pg-tab')) return;
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            setTune(tune + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 250 : 60));
        });

        // Start always begins a fresh pass; Stop ends the current one
        $('#tuneStart').addEventListener('click', () => {
            prepare();
            running = true;
            stopped = false;
            $('#tuneStart').textContent = 'Restart pass';
            $('#tuneStop').disabled = false;
            runner.kick();
        });
        $('#tuneStop').addEventListener('click', () => {
            if (!running) return;
            running = false;
            stopped = true;
            $('#tuneStart').textContent = 'Start new pass';
            $('#tuneStop').disabled = true;
            draw();
        });
        setTune(0);
    }

    document.addEventListener('DOMContentLoaded', () => {
        initTabs();
        initBalance();
        initTune();
    });
})();
