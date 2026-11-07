/* ==========================================================================
   games.js — Playground tabs + three games built on real projects
   - Balance the Robot  (Self-Balancing Robot: inverted pendulum + PID)
   - Logic Gate Puzzle  (FPGA / digital logic: 7 levels up to a full adder)
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
       Tabs (panels are stacked in one grid cell, so switching tabs
       never changes the section's height)
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
       03 · LOGIC GATE PUZZLE
       Each level has a fixed circuit with empty gate slots. Tap a slot
       to cycle its gate type until every truth-table row matches.
    --------------------------------------------------------------- */
    const GATES = {
        AND: (a, b) => a & b, OR: (a, b) => a | b, XOR: (a, b) => a ^ b,
        NAND: (a, b) => 1 - (a & b), NOR: (a, b) => 1 - (a | b), XNOR: (a, b) => 1 - (a ^ b)
    };
    const GATE_ORDER = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'];

    const LEVELS = [
        { name: 'Both or nothing', inputs: [['A', 0], ['B', 1]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }],
          outputs: [{ name: 'Y', from: 'g1', row: 0.5 }],
          target: { Y: i => i.A & i.B } },
        { name: 'One or the other, never both', inputs: [['A', 0], ['B', 1]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }],
          outputs: [{ name: 'Y', from: 'g1', row: 0.5 }],
          target: { Y: i => i.A ^ i.B } },
        { name: 'Anything but both', inputs: [['A', 0], ['B', 1]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }],
          outputs: [{ name: 'Y', from: 'g1', row: 0.5 }],
          target: { Y: i => 1 - (i.A & i.B) } },
        { name: 'Half adder', inputs: [['A', 0], ['B', 1]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0 }, { id: 'g2', in: ['A', 'B'], col: 1, row: 1 }],
          outputs: [{ name: 'S', from: 'g1', row: 0 }, { name: 'Cout', from: 'g2', row: 1 }],
          target: { S: i => i.A ^ i.B, Cout: i => i.A & i.B } },
        { name: 'Odd number of ones (parity)', inputs: [['A', 0], ['B', 1], ['C', 2]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }, { id: 'g2', in: ['g1', 'C'], col: 2, row: 1.25 }],
          outputs: [{ name: 'Y', from: 'g2', row: 1.25 }],
          target: { Y: i => i.A ^ i.B ^ i.C } },
        { name: 'Alarm: both sensors, or the override', inputs: [['A', 0], ['B', 1], ['C', 2]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }, { id: 'g2', in: ['g1', 'C'], col: 2, row: 1.25 }],
          outputs: [{ name: 'Y', from: 'g2', row: 1.25 }],
          target: { Y: i => (i.A & i.B) | i.C } },
        { name: 'Full adder', inputs: [['A', 0], ['B', 1], ['Cin', 2.4]],
          gates: [
              { id: 'g1', in: ['A', 'B'], col: 1, row: 0.1 },
              { id: 'g2', in: ['A', 'B'], col: 1, row: 1.3 },
              { id: 'g3', in: ['g1', 'Cin'], col: 2, row: 0.5 },
              { id: 'g4', in: ['g1', 'Cin'], col: 2, row: 1.9 },
              { id: 'g5', in: ['g4', 'g2'], col: 3, row: 1.6 }],
          outputs: [{ name: 'S', from: 'g3', row: 0.5 }, { name: 'Cout', from: 'g5', row: 1.6 }],
          target: { S: i => i.A ^ i.B ^ i.Cin, Cout: i => (i.A & i.B) | (i.Cin & (i.A ^ i.B)) } }
    ];

    /* Daily puzzles ------------------------------------------------------
       Every day, 5 puzzles of rising difficulty are generated from these
       circuit templates with a random generator seeded by the local date,
       so everyone gets the same set that day and a new set tomorrow.
       Each puzzle is built from a hidden solution, so it is always solvable
       (any gate combination that matches the truth table is accepted). */
    const TEMPLATES = [
        { tier: 1, inputs: [['A', 0], ['B', 1]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }],
          outputs: [{ name: 'Y', from: 'g1', row: 0.5 }] },
        { tier: 2, inputs: [['A', 0], ['B', 1]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0 }, { id: 'g2', in: ['A', 'B'], col: 1, row: 1 }],
          outputs: [{ name: 'Y', from: 'g1', row: 0 }, { name: 'Z', from: 'g2', row: 1 }] },
        { tier: 2, inputs: [['A', 0], ['B', 1], ['C', 2]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }, { id: 'g2', in: ['g1', 'C'], col: 2, row: 1.25 }],
          outputs: [{ name: 'Y', from: 'g2', row: 1.25 }] },
        { tier: 3, inputs: [['A', 0], ['B', 1], ['C', 2]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.4 }, { id: 'g2', in: ['B', 'C'], col: 1, row: 1.7 },
                  { id: 'g3', in: ['g1', 'g2'], col: 2, row: 1.05 }],
          outputs: [{ name: 'Y', from: 'g3', row: 1.05 }] },
        { tier: 3, inputs: [['A', 0], ['B', 1], ['C', 2]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.5 }, { id: 'g2', in: ['g1', 'C'], col: 2, row: 0.3 },
                  { id: 'g3', in: ['g1', 'C'], col: 2, row: 1.7 }],
          outputs: [{ name: 'Y', from: 'g2', row: 0.3 }, { name: 'Z', from: 'g3', row: 1.7 }] },
        { tier: 4, inputs: [['A', 0], ['B', 1], ['C', 2]],
          gates: [{ id: 'g1', in: ['A', 'B'], col: 1, row: 0.3 }, { id: 'g2', in: ['B', 'C'], col: 1, row: 1.8 },
                  { id: 'g3', in: ['g1', 'C'], col: 2, row: 0.7 }, { id: 'g4', in: ['g3', 'g2'], col: 3, row: 1.25 }],
          outputs: [{ name: 'Y', from: 'g4', row: 1.25 }] }
    ];
    const DAILY_SLOTS = [
        { name: 'Warm-up', tiers: [1] },
        { name: 'Two at once', tiers: [2] },
        { name: 'Chain reaction', tiers: [2, 3] },
        { name: 'Junction', tiers: [3] },
        { name: 'Boss level', tiers: [4] }
    ];
    const DAILY_EPOCH = Date.UTC(2026, 10, 1);   // Daily #1 = 1 Nov 2026

    function seededRandom(seed) {   // mulberry32
        return function () {
            seed = (seed + 0x6D2B79F5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function hashString(s) {
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }
    function dateKey(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function dailyNumber(key) {
        const [y, m, d] = key.split('-').map(Number);
        return Math.round((Date.UTC(y, m - 1, d) - DAILY_EPOCH) / 86400000) + 1;
    }

    // Evaluate any level for one input vector with a given set of gate types
    function evalCircuit(lv, types, vec) {
        const val = Object.assign({}, vec);
        lv.gates.forEach(g => {
            const a = val[g.in[0]], b = val[g.in[1]];
            val[g.id] = (types[g.id] && a != null && b != null) ? GATES[types[g.id]](a, b) : null;
        });
        const out = {};
        lv.outputs.forEach(o => { out[o.name] = val[o.from]; });
        return { val, out };
    }
    function allVectors(names) {
        const n = names.length, out = [];
        for (let r = 0; r < (1 << n); r++) {
            const v = {};
            names.forEach((name, k) => { v[name] = (r >> (n - 1 - k)) & 1; });
            out.push(v);
        }
        return out;
    }

    // Reject boring puzzles: constant outputs, outputs that just copy (or invert)
    // an input, duplicate outputs, or inputs that never affect anything.
    function isInteresting(tpl, sol) {
        const names = tpl.inputs.map(i => i[0]);
        const vecs = allVectors(names);
        const tables = tpl.outputs.map(o => vecs.map(v => evalCircuit(tpl, sol, v).out[o.name]).join(''));
        for (const t of tables) {
            if (/^0+$|^1+$/.test(t)) return false;
            for (const n of names) {
                const col = vecs.map(v => v[n]).join('');
                const inv = vecs.map(v => 1 - v[n]).join('');
                if (t === col || t === inv) return false;
            }
        }
        if (new Set(tables).size !== tables.length) return false;
        return names.every(n => vecs.some(v => {
            const flipped = Object.assign({}, v, { [n]: 1 - v[n] });
            return tpl.outputs.some(o => evalCircuit(tpl, sol, v).out[o.name] !== evalCircuit(tpl, sol, flipped).out[o.name]);
        }));
    }

    function makeDailySet(key) {
        const rand = seededRandom(hashString('logic-daily-' + key));
        return DAILY_SLOTS.map((slot, i) => {
            for (let tries = 0; tries < 400; tries++) {
                const tier = slot.tiers[Math.floor(rand() * slot.tiers.length)];
                const pool = TEMPLATES.filter(t => t.tier === tier);
                const tpl = pool[Math.floor(rand() * pool.length)];
                const sol = {};
                tpl.gates.forEach(g => { sol[g.id] = GATE_ORDER[Math.floor(rand() * GATE_ORDER.length)]; });
                if (!isInteresting(tpl, sol)) continue;
                const target = {};
                tpl.outputs.forEach(o => { target[o.name] = v => evalCircuit(tpl, sol, v).out[o.name]; });
                return { name: slot.name, inputs: tpl.inputs, gates: tpl.gates, outputs: tpl.outputs, target };
            }
            return LEVELS[Math.min(i, LEVELS.length - 1)];   // safety net (never expected)
        });
    }

    /* ---------------------------------------------------------------
       Logic game: Classic (7 fixed levels) + Daily (5 generated puzzles)
       Nothing is revealed until you Submit; each submit is an attempt.
       A level only unlocks once the one before it is solved.
    --------------------------------------------------------------- */
    function initLogic() {
        const host = $('#logicCircuit');
        if (!host) return;
        const NS = 'http://www.w3.org/2000/svg';

        let mode = 'classic', levels = LEVELS, idx = 0;
        let types = {}, revealed = false, attempts = 0, live = {}, countdown = null;
        let todayKey = dateKey(new Date());

        // ---- persistence ----
        function loadClassic() { return store.get('logicClassic') || { solved: {} }; }
        function loadDaily() {
            const d = store.get('logicDaily');
            return d && d.key === todayKey ? d : { key: todayKey, solved: {} };
        }
        let progress = loadClassic();
        const save = () => store.set(mode === 'classic' ? 'logicClassic' : 'logicDaily', progress);
        const streak = () => {
            const s = store.get('logicStreak');
            if (!s) return 0;
            const y = new Date(); y.setDate(y.getDate() - 1);
            return (s.last === todayKey || s.last === dateKey(y)) ? s.count : 0;
        };
        function bumpStreak() {
            const s = store.get('logicStreak') || { last: null, count: 0 };
            if (s.last === todayKey) return;
            const y = new Date(); y.setDate(y.getDate() - 1);
            s.count = s.last === dateKey(y) ? s.count + 1 : 1;
            s.last = todayKey;
            store.set('logicStreak', s);
        }

        const lv = () => levels[idx];
        const inputNames = () => lv().inputs.map(i => i[0]);
        const isSolved = i => !!progress.solved[i];
        const unlockedUpTo = () => { let i = 0; while (i < levels.length - 1 && isSolved(i)) i++; return i; };
        const allSet = () => lv().gates.every(g => types[g.id]);
        const results = () => {
            const outs = lv().outputs.map(o => o.name);
            return allVectors(inputNames()).map(r => {
                const got = evalCircuit(lv(), types, r).out;
                return { r, got, ok: outs.every(o => got[o] === lv().target[o](r)) };
            });
        };

        function setMode(m) {
            mode = m;
            todayKey = dateKey(new Date());
            $$('[data-logic-mode]').forEach(b => b.classList.toggle('active', b.dataset.logicMode === m));
            levels = m === 'classic' ? LEVELS : makeDailySet(todayKey);
            progress = m === 'classic' ? loadClassic() : loadDaily();
            open(unlockedUpTo());
        }

        function open(i) {
            idx = clamp(i, 0, unlockedUpTo());
            const done = progress.solved[idx];
            types = done ? Object.assign({}, done.types) : {};
            attempts = done ? done.attempts : 0;
            revealed = !!done;
            live = {};
            inputNames().forEach(n => { live[n] = 0; });
            render();
        }

        function submit() {
            if (!allSet() || revealed) return;
            attempts++;
            revealed = true;
            const res = results();
            const firstWrong = res.find(x => !x.ok);
            live = Object.assign({}, (firstWrong || res[0]).r);
            if (!firstWrong) {
                progress.solved[idx] = { types: Object.assign({}, types), attempts };
                save();
                if (mode === 'daily' && levels.every((_, i) => isSolved(i))) bumpStreak();
            }
            render();
        }

        // ---- drawing ----
        function svgEl(tag, attrs, parent) {
            const el = document.createElementNS(NS, tag);
            Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
            if (parent) parent.appendChild(el);
            return el;
        }

        function renderCircuit() {
            const L = lv(), solved = isSolved(idx);
            const state = evalCircuit(L, types, live);
            const colW = 118, rowH = 62, padX = 14, padY = 16;
            const maxCol = Math.max(...L.gates.map(g => g.col)) + 1;
            const maxRow = Math.max(...L.inputs.map(i => i[1]), ...L.gates.map(g => g.row), ...L.outputs.map(o => o.row));
            const W = padX * 2 + maxCol * colW + 70, Hh = padY * 2 + (maxRow + 1) * rowH;
            const cy = row => padY + row * rowH + rowH / 2;
            const pos = {};
            L.inputs.forEach(([n, r]) => { pos[n] = { x: padX, y: cy(r), w: 46, h: 30, kind: 'in' }; });
            L.gates.forEach(g => { pos[g.id] = { x: padX + g.col * colW, y: cy(g.row), w: 72, h: 44, kind: 'gate' }; });
            L.outputs.forEach(o => { pos['out:' + o.name] = { x: padX + maxCol * colW, y: cy(o.row), w: 62, h: 30, kind: 'out' }; });

            const svg = svgEl('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'logic-svg', role: 'img', 'aria-label': 'Circuit diagram' });
            const wires = svgEl('g', {}, svg);
            // before submitting, wires are neutral: no free simulation
            const color = v => !revealed ? 'rgba(250,250,250,0.32)' : v === 1 ? C.red : v === 0 ? 'rgba(250,250,250,0.35)' : 'rgba(245,197,24,0.5)';
            const wire = (from, x2, y2, v, k) => {
                const p = pos[from];
                const x1 = p.x + p.w, y1 = p.y;
                const mx = x1 + (x2 - x1) * (0.45 + 0.1 * k);
                svgEl('path', { d: `M${x1} ${y1} H${mx} V${y2} H${x2}`, fill: 'none', stroke: color(v),
                    'stroke-width': revealed && v === 1 ? 2.5 : 1.5 }, wires);
            };
            L.gates.forEach(g => { const p = pos[g.id]; g.in.forEach((src, k) => wire(src, p.x, p.y + (k ? 11 : -11), state.val[src], k)); });
            L.outputs.forEach((o, k) => { const p = pos['out:' + o.name]; wire(o.from, p.x, p.y, state.val[o.from], k); });

            Object.entries(pos).forEach(([id, p]) => {
                const g = svgEl('g', { class: 'logic-node ' + p.kind + (revealed && p.kind === 'in' ? ' live' : '') + (solved && p.kind === 'gate' ? ' locked' : ''), transform: `translate(${p.x} ${p.y - p.h / 2})` }, svg);
                if (p.kind === 'in') {
                    const v = live[id];
                    if (revealed) {
                        g.setAttribute('role', 'button');
                        g.setAttribute('tabindex', '0');
                        g.setAttribute('aria-label', `Input ${id} is ${v}. Toggle to trace the circuit.`);
                        g.dataset.input = id;
                    }
                    const on = revealed && v === 1;
                    svgEl('rect', { width: p.w, height: p.h, rx: 3, fill: on ? C.red : C.bg, stroke: on ? C.red : C.ink, 'stroke-width': 1.5 }, g);
                    svgEl('text', { x: p.w / 2, y: p.h / 2 + 4, 'text-anchor': 'middle', fill: C.ink }, g).textContent = revealed ? `${id}=${v}` : id;
                } else if (p.kind === 'gate') {
                    const type = types[id];
                    if (!solved) {
                        g.setAttribute('role', 'button');
                        g.setAttribute('tabindex', '0');
                        g.setAttribute('aria-label', `Gate ${type || 'unset'}. Change type.`);
                        g.dataset.gate = id;
                    }
                    svgEl('rect', { width: p.w, height: p.h, rx: 4, fill: C.bg, stroke: type ? C.ink : C.yellow,
                        'stroke-width': 1.5, 'stroke-dasharray': type ? '' : '4 3' }, g);
                    svgEl('text', { x: p.w / 2, y: p.h / 2 + 5, 'text-anchor': 'middle', fill: type ? C.ink : C.yellow, class: 'gate-label' }, g).textContent = type || '?';
                } else {
                    const name = id.slice(4), v = state.out[name];
                    const want = L.target[name](live);
                    svgEl('rect', { width: p.w, height: p.h, rx: 3, fill: C.bg,
                        stroke: !revealed ? C.faint : v === want ? C.yellow : C.red, 'stroke-width': 1.5 }, g);
                    svgEl('text', { x: p.w / 2, y: p.h / 2 + 4, 'text-anchor': 'middle', fill: C.ink }, g).textContent =
                        revealed ? `${name}=${v === null ? '–' : v}` : name;
                }
            });
            host.replaceChildren(svg);
        }

        function renderTable(res) {
            const L = lv(), outs = L.outputs.map(o => o.name);
            const isLive = r => inputNames().every(n => r[n] === live[n]);
            const head = `<tr>${inputNames().map(n => `<th>${n}</th>`).join('')}
                ${outs.map(o => `<th class="want">${o}</th>${revealed ? '<th>yours</th>' : ''}`).join('')}
                ${revealed ? '<th></th>' : ''}</tr>`;
            const body = res.map(({ r, got, ok }) => `
                <tr class="${revealed && isLive(r) ? 'live' : ''}${revealed ? ' clickable' : ''}" data-row='${JSON.stringify(r)}'>
                    ${inputNames().map(n => `<td>${r[n]}</td>`).join('')}
                    ${outs.map(o => `<td class="want">${L.target[o](r)}</td>${revealed ? `<td class="got">${got[o] === null ? '–' : got[o]}</td>` : ''}`).join('')}
                    ${revealed ? `<td class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'}</td>` : ''}
                </tr>`).join('');
            $('#logicTable').innerHTML = `<caption>Target</caption><thead>${head}</thead><tbody>${body}</tbody>`;
        }

        function msToMidnight() {
            const now = new Date(), mid = new Date(now);
            mid.setHours(24, 0, 0, 0);
            const s = Math.max(0, Math.floor((mid - now) / 1000));
            return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
        }

        function render() {
            const L = lv(), res = results();
            const solved = isSolved(idx), wrong = res.filter(x => !x.ok).length;
            const solvedCount = levels.filter((_, i) => isSolved(i)).length;
            const allDone = solvedCount === levels.length;
            renderCircuit();
            renderTable(res);

            $('#logicLevelNum').textContent = mode === 'classic'
                ? `Level ${idx + 1} of ${levels.length}`
                : `Daily #${dailyNumber(todayKey)} · ${idx + 1} of ${levels.length}`;
            $('#logicLevelName').textContent = L.name;

            const unlocked = unlockedUpTo();
            $('#logicDots').innerHTML = levels.map((_, i) => {
                const locked = i > unlocked;
                return `<button class="logic-dot${i === idx ? ' current' : ''}${isSolved(i) ? ' solved' : ''}${locked ? ' locked' : ''}"
                    data-level="${i}" ${locked ? 'disabled' : ''} aria-label="${mode === 'classic' ? 'Level' : 'Puzzle'} ${i + 1}${isSolved(i) ? ' (solved)' : locked ? ' (locked)' : ''}">${locked ? '<i class="fas fa-lock"></i>' : i + 1}</button>`;
            }).join('');

            const setCount = L.gates.filter(g => types[g.id]).length;
            let msg;
            clearInterval(countdown);
            if (solved && mode === 'daily' && allDone) {
                msg = `<b class="win">All ${levels.length} solved!</b> New puzzles in <span id="logicCountdown">${msToMidnight()}</span>.`;
                countdown = setInterval(() => {
                    const el = $('#logicCountdown');
                    if (!el) return clearInterval(countdown);
                    if (dateKey(new Date()) !== todayKey) { clearInterval(countdown); setMode('daily'); return; }
                    el.textContent = msToMidnight();
                }, 1000);
            } else if (solved) {
                msg = `<b class="win">Solved in ${attempts} attempt${attempts === 1 ? '' : 's'}!</b>${idx < levels.length - 1 ? ' The next one is unlocked.' : mode === 'classic' ? ' That’s a full adder, built from gates. Try the Daily puzzles next.' : ''}`;
            } else if (revealed) {
                msg = `Attempt ${attempts}: <b>${wrong} of ${res.length} rows wrong.</b> Tap a row to trace it, then change a gate.`;
            } else if (!allSet()) {
                msg = `Set every gate (<b>${setCount} of ${L.gates.length}</b>), then submit.`;
            } else {
                msg = `Ready? <b>Submit</b> to check all ${res.length} rows${attempts ? ` (attempt ${attempts + 1})` : ''}.`;
            }
            $('#logicStatus').innerHTML = msg;

            const submitBtn = $('#logicSubmit'), nextBtn = $('#logicNext'), shareBtn = $('#logicShare');
            submitBtn.hidden = solved;
            submitBtn.disabled = !allSet() || revealed;
            nextBtn.hidden = !(solved && idx < levels.length - 1);
            shareBtn.hidden = !(mode === 'daily' && allDone);

            $('#logicStatLevelLabel').textContent = mode === 'classic' ? 'Level' : 'Puzzle';
            $('#logicStatLevel').textContent = `${idx + 1} / ${levels.length}`;
            $('#logicStatTries').textContent = attempts;
            $('#logicStatSolved').textContent = `${solvedCount} / ${levels.length}`;
            $('#logicStatStreak').textContent = streak();
        }

        // ---- interaction ----
        const act = target => {
            const gate = target.closest('[data-gate]'), input = target.closest('[data-input]');
            if (gate && !isSolved(idx)) {
                const id = gate.dataset.gate;
                types[id] = GATE_ORDER[(GATE_ORDER.indexOf(types[id]) + 1) % GATE_ORDER.length];
                revealed = false;               // any change hides the results again
                render();
                const again = host.querySelector(`[data-gate="${id}"]`);
                if (again) again.focus();
            } else if (input && revealed) {
                const id = input.dataset.input;
                live[id] = 1 - live[id];
                render();
                const again = host.querySelector(`[data-input="${id}"]`);
                if (again) again.focus();
            }
        };
        host.addEventListener('click', e => act(e.target));
        host.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(e.target); } });
        $('#logicTable').addEventListener('click', e => {
            const tr = e.target.closest('tr[data-row]');
            if (!tr || !revealed) return;
            live = JSON.parse(tr.dataset.row);
            render();
        });
        $('#logicDots').addEventListener('click', e => { const b = e.target.closest('[data-level]'); if (b && !b.disabled) open(+b.dataset.level); });
        $('#logicSubmit').addEventListener('click', submit);
        $('#logicNext').addEventListener('click', () => open(idx + 1));
        $$('[data-logic-mode]').forEach(b => b.addEventListener('click', () => { if (b.dataset.logicMode !== mode) setMode(b.dataset.logicMode); }));

        $('#logicShare').addEventListener('click', async () => {
            const marks = levels.map((_, i) => {
                const s = progress.solved[i];
                return !s ? '⬛' : s.attempts === 1 ? '🟩' : s.attempts <= 3 ? '🟨' : '🟥';
            }).join('');
            const total = levels.reduce((n, _, i) => n + (progress.solved[i] ? progress.solved[i].attempts : 0), 0);
            const text = `Logic Gates Daily #${dailyNumber(todayKey)}: ${total} attempts\n${marks}\n${location.origin}${location.pathname}#playground`;
            const btn = $('#logicShare');
            try {
                if (navigator.share && window.matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
                else { await navigator.clipboard.writeText(text); btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Share result'; }, 2000); }
            } catch (e) { /* user cancelled the share sheet */ }
        });

        setMode('classic');
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
        initLogic();
        initTune();
    });
})();
