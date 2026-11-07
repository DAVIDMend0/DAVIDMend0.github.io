/* ==========================================================================
   features.js — interactive layer for the portfolio
   - Oscilloscope hero background (calm by default, "lab mode" via terminal)
   - Scroll reveal
   - DRIFTS live prototype boot
   - Projects reel + selected tray, filters, skill linking
   - One-button reaction timer
   - Copy-to-clipboard + toast
   - Terminal easter egg (press ~)
   ========================================================================== */
(function () {
    'use strict';

    document.documentElement.classList.add('js');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    document.addEventListener('DOMContentLoaded', () => {
        const yearEl = $('#year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();

        initScope();
        initScrollbar();
        initReveal();
        initDrifts();
        initProjects();
        initReflex();
        initCopy();
        initModalJumpLinks();
        initTerminal();

        console.log(
            '%c DM %c Hey, fellow engineer. Press ~ on the page for a terminal, or just email me: 9davemend@gmail.com',
            'background:#38bdf8;color:#04121f;font-weight:800;border-radius:4px;padding:2px 6px',
            'color:#94a3b8'
        );
    });

    /* ---------------------------------------------------------------
       Mondrian scrollbar: html[data-sb] follows the section in view,
       cycling red -> blue -> yellow like the section headers (theme.css 16, 19)
       --------------------------------------------------------------- */
    function initScrollbar() {
        const colours = ['red', 'blue', 'yellow'];
        const sections = $$('main > section');
        const root = document.documentElement;
        let ticking = false;

        const update = () => {
            ticking = false;
            const line = window.innerHeight * 0.4;
            let colour = 'red'; // hero
            sections.forEach((sec, i) => {
                if (sec.getBoundingClientRect().top <= line) colour = colours[i % 3];
            });
            if (root.dataset.sb !== colour) root.dataset.sb = colour;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        window.addEventListener('resize', update);
        update();
    }

    /* ---------------------------------------------------------------
       Toast
    --------------------------------------------------------------- */
    let toastTimer = null;
    function toast(msg) {
        const el = $('#toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
    }

    /* ---------------------------------------------------------------
       Oscilloscope hero background
       "calm" (default): faint graticule + one slow trace. Professional first.
       "lab" (opt-in via the terminal's `scope` command): three live
       channels with readouts that react to the mouse.
    --------------------------------------------------------------- */
    let scopeCtl = { setMode() {}, mode: 'calm' };

    function initScope() {
        const canvas = $('#scopeCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const hero = $('#hero');
        let w = 0, h = 0, t = 0, running = true, rafId = null, mode = 'calm';
        let mouseX = 0.5, mouseY = 0.5, targetX = 0.5, targetY = 0.5;

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = hero.clientWidth;
            h = hero.clientHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        // Ink colour follows the site theme: white lines on dark, black on light.
        const ink = () => document.documentElement.classList.contains('light-mode') ? '9, 9, 11' : '250, 250, 250';

        function grid(alpha, rgb = ink()) {
            const div = 64;
            ctx.lineWidth = 1;
            ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
            ctx.beginPath();
            for (let x = (w / 2) % div; x < w; x += div) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
            for (let y = (h / 2) % div; y < h; y += div) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
            ctx.stroke();
        }

        function trace(color, glow, width, fn) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.shadowColor = glow;
            ctx.shadowBlur = glow ? 12 : 0;
            ctx.beginPath();
            for (let x = 0; x <= w; x += 3) {
                const y = fn(x);
                x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.restore();
        }

        function noise(x) {
            return Math.sin(x * 0.091 + t * 3.1) * 0.5 + Math.sin(x * 0.237 - t * 4.3) * 0.3 + Math.sin(x * 0.53 + t * 7) * 0.2;
        }

        function drawCalm() {
            grid(0.05);
            trace(`rgba(${ink()}, 0.22)`, null, 1,
                x => h * 0.5 + Math.sin(x * 0.0045 + t * 0.35) * h * 0.08);
        }

        function drawLab() {
            mouseX += (targetX - mouseX) * 0.05;
            mouseY += (targetY - mouseY) * 0.05;
            grid(0.07, '56, 189, 248');
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
            ctx.beginPath();
            ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
            ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
            ctx.stroke();

            const amp = h * (0.06 + mouseY * 0.05);
            const freq = 0.006 + mouseX * 0.006;
            trace('rgba(56, 189, 248, 0.6)', 'rgba(56, 189, 248, 0.9)', 1.6,
                x => h * 0.30 + Math.sin(x * freq + t * 1.6) * amp);

            const period = 90;
            trace('rgba(52, 211, 153, 0.45)', 'rgba(52, 211, 153, 0.8)', 1.4, x => {
                const phase = ((x + t * 60) % period + period) % period;
                const bit = Math.floor((x + t * 60) / period);
                const data = (bit * 2654435761 >>> 0) % 3 === 0;
                return h * 0.80 + ((phase < period / 2) === data ? -1 : 1) * h * 0.025;
            });

            trace('rgba(167, 139, 250, 0.4)', 'rgba(167, 139, 250, 0.8)', 1.2, x => {
                const env = Math.exp(-Math.pow((x - ((t * 140) % (w + 400)) + 200) / 160, 2));
                return h * 0.62 + (Math.sin(x * 0.18) * env * amp * 0.9) + noise(x) * 3;
            });

            ctx.font = '500 11px "JetBrains Mono", monospace';
            ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
            ctx.fillText('CH1  ' + (137.9 + (mouseX - 0.5) * 0.01).toFixed(4) + ' MHz', 18, h - 46);
            ctx.fillText('CH2  CLK 50.000 MHz', 18, h - 30);
            ctx.fillText('CH3  QPSK burst', 18, h - 14);
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            mode === 'lab' ? drawLab() : drawCalm();
            t += 0.016;
            if (running && !reduceMotion) rafId = requestAnimationFrame(draw);
        }

        resize();
        draw();
        window.addEventListener('resize', () => { resize(); if (reduceMotion) draw(); });
        hero.addEventListener('pointermove', e => {
            const r = hero.getBoundingClientRect();
            targetX = (e.clientX - r.left) / r.width;
            targetY = (e.clientY - r.top) / r.height;
        });

        if ('IntersectionObserver' in window && !reduceMotion) {
            new IntersectionObserver(entries => {
                const visible = entries[0].isIntersecting;
                if (visible && !running) { running = true; draw(); }
                if (!visible) { running = false; cancelAnimationFrame(rafId); }
            }).observe(hero);
        }

        scopeCtl = {
            get mode() { return mode; },
            setMode(m) {
                mode = m;
                hero.classList.toggle('lab-mode', m === 'lab');
                if (reduceMotion || !running) draw();
            }
        };
    }

    /* ---------------------------------------------------------------
       Scroll reveal
    --------------------------------------------------------------- */
    function initReveal() {
        const items = $$('.reveal');
        if (!('IntersectionObserver' in window) || reduceMotion) {
            items.forEach(el => el.classList.add('in-view'));
            return;
        }
        const io = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    io.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
        items.forEach(el => io.observe(el));
    }

    /* ---------------------------------------------------------------
       DRIFTS live prototype (boots on demand to keep the page light)
    --------------------------------------------------------------- */
    function bootDrifts() {
        const frame = $('#driftsFrame');
        const boot = $('#driftsBoot');
        if (!frame || frame.getAttribute('src')) return;
        const done = () => boot.classList.add('gone');
        frame.loading = 'eager';
        frame.addEventListener('load', done, { once: true });
        frame.src = frame.dataset.src;
        boot.classList.add('booting');
        boot.querySelector('span').textContent = 'Booting…';
        setTimeout(done, 8000); // never leave the overlay stuck on slow networks
    }
    function initDrifts() {
        const boot = $('#driftsBoot');
        if (boot) boot.addEventListener('click', bootDrifts);
    }

    /* ---------------------------------------------------------------
       Projects: auto-advancing reel + "selected" tray
       The tray has a fixed footprint, so picking a project or a filter
       never moves the page. Only the reel scrolls (horizontally).
    --------------------------------------------------------------- */
    const reelState = { cat: 'all', skill: null, skillLabel: '' };
    let reelApi = null;

    function initProjects() {
        const track = $('#reelTrack');
        if (!track) return;
        const reel = $('#reel');
        const cards = $$('.reel-card', track);
        const trayEl = $('#projectTray');
        const trayImg = $('#trayImg');
        const progress = $('#reelProgress');
        const pauseBtn = $('#reelPause');
        const INTERVAL = 4500;
        const behavior = reduceMotion ? 'auto' : 'smooth';
        const pad = n => String(n).padStart(2, '0');
        let selected = null;
        let swapTimer = null;

        const visibleCards = () => cards.filter(c => !c.hidden);

        function updateCount() {
            const vc = visibleCards();
            const i = vc.indexOf(selected);
            $('#trayCount').textContent = i >= 0 ? `${pad(i + 1)} / ${pad(vc.length)}` : `${pad(vc.length)} shown`;
        }

        function fillTray(card) {
            const img = card.querySelector('img');
            trayImg.src = img.src;
            trayImg.alt = img.alt;
            $('#trayBadge').textContent = card.querySelector('.reel-badge').textContent;
            $('#trayTitle').textContent = card.querySelector('.reel-title').textContent;
            const detail = $('#trayDetail');
            detail.innerHTML = '';
            detail.appendChild(card.querySelector('template.reel-detail').content.cloneNode(true));
            $('#trayOpen').dataset.caseOpen = card.dataset.project;
            $('#trayCta').textContent = card.dataset.cta;
            updateCount();
        }

        function select(card, opts = {}) {
            if (!card) return;
            if (selected) {
                selected.classList.remove('selected');
                selected.setAttribute('aria-pressed', 'false');
            }
            const changed = card !== selected;
            selected = card;
            card.classList.add('selected');
            card.setAttribute('aria-pressed', 'true');
            if (!changed) return;

            if (opts.instant || reduceMotion) {
                fillTray(card);
            } else {
                clearTimeout(swapTimer);
                trayEl.classList.add('swapping');
                swapTimer = setTimeout(() => {
                    fillTray(card);
                    trayEl.classList.remove('swapping');
                }, 180);
            }

            // On phones the tray sits just below the reel. Nudge it into view
            // only if it is almost entirely off-screen; never on desktop.
            if (opts.revealTray) {
                const r = trayEl.getBoundingClientRect();
                if (r.top > window.innerHeight * 0.8) {
                    window.scrollBy({ top: r.top - window.innerHeight * 0.45, behavior });
                }
            }
        }

        /* --- two auto modes ---
           1. Showcase (default): the big tray steps through every visible
              project every 7 s and the reel follows along.
           2. Browse (after a visitor picks a card): the tray stays on their
              pick and only the reel keeps sliding every 4.5 s.
           Choosing a filter switches back to showcase. */
        const SHOWCASE_MS = 7000;
        let showcase = !reduceMotion;
        let trayElapsed = 0;
        const trayTimer = $('#trayTimer');

        function setShowcase(on) {
            showcase = on && !reduceMotion;
            trayElapsed = 0;
            elapsed = 0;
            trayEl.classList.toggle('cycling', showcase);
        }

        // Scroll the reel (horizontally only) so a card is in view.
        function revealCard(card) {
            const t = track.getBoundingClientRect();
            const c = card.getBoundingClientRect();
            if (c.left < t.left || c.right > t.right - 56) {
                track.scrollTo({ left: track.scrollLeft + (c.left - t.left) - 2, behavior });
            }
        }

        function advanceTray(dir = 1) {
            const vc = visibleCards();
            if (vc.length < 2) return;
            const i = vc.indexOf(selected);
            const next = vc[(i + dir + vc.length) % vc.length];
            select(next);
            revealCard(next);
            trayElapsed = 0;
        }

        cards.forEach(card => {
            card.setAttribute('aria-pressed', 'false');
            card.addEventListener('click', () => {
                setShowcase(false); // the visitor chose; stop cycling the tray
                select(card, { revealTray: true });
                hold();
            });
        });

        /* --- auto-advance --- */
        let paused = reduceMotion;
        let hovering = false;
        let hoverTray = false;
        let kbFocus = false;
        let onScreen = false;
        let holdUntil = 0;
        let elapsed = 0;
        let last = performance.now();

        function hold(ms = 7000) { holdUntil = performance.now() + ms; elapsed = 0; }

        function step(dir) {
            const vc = visibleCards();
            if (!vc.length) return;
            const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
            const cardW = vc[0].offsetWidth + gap;
            const max = track.scrollWidth - track.clientWidth;
            if (max <= 2) return;
            if (dir > 0 && track.scrollLeft >= max - 4) track.scrollTo({ left: 0, behavior });
            else if (dir < 0 && track.scrollLeft <= 4) track.scrollTo({ left: max, behavior });
            else track.scrollBy({ left: dir * cardW, behavior });
        }

        function loop(now) {
            const dt = now - last;
            last = now;
            const scrollable = track.scrollWidth - track.clientWidth > 2;
            const active = !paused && !kbFocus && onScreen && !document.hidden && now > holdUntil;
            if (showcase) {
                if (active && !hovering && !hoverTray && visibleCards().length > 1) {
                    trayElapsed += dt;
                    if (trayElapsed >= SHOWCASE_MS) advanceTray(1);
                }
                trayTimer.style.transform = `scaleX(${paused ? 0 : trayElapsed / SHOWCASE_MS})`;
                progress.style.transform = 'scaleX(0)';
            } else {
                if (active && !hovering && scrollable) {
                    elapsed += dt;
                    if (elapsed >= INTERVAL) { elapsed = 0; step(1); }
                }
                progress.style.transform = `scaleX(${scrollable && !paused ? elapsed / INTERVAL : 0})`;
            }
            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);

        reel.addEventListener('mouseenter', () => { hovering = true; });
        reel.addEventListener('mouseleave', () => { hovering = false; });
        trayEl.addEventListener('mouseenter', () => { hoverTray = true; });
        trayEl.addEventListener('mouseleave', () => { hoverTray = false; });
        reel.addEventListener('focusin', e => { kbFocus = e.target.matches(':focus-visible'); });
        reel.addEventListener('focusout', () => { kbFocus = false; });
        ['wheel', 'touchstart', 'pointerdown'].forEach(ev =>
            track.addEventListener(ev, () => hold(), { passive: true }));

        if ('IntersectionObserver' in window) {
            // Only run while the projects area is actually being looked at
            new IntersectionObserver(entries => { onScreen = entries[0].isIntersecting; }, { threshold: 0.35 }).observe($('#projects .container'));
        } else {
            onScreen = true;
        }

        // In showcase mode the arrows step the big tray; in browse mode they slide the reel.
        $('#reelPrev').addEventListener('click', () => { showcase ? advanceTray(-1) : (step(-1), hold()); });
        $('#reelNext').addEventListener('click', () => { showcase ? advanceTray(1) : (step(1), hold()); });

        function setPaused(p) {
            paused = p;
            elapsed = 0;
            trayElapsed = 0;
            pauseBtn.setAttribute('aria-pressed', String(p));
            pauseBtn.setAttribute('aria-label', p ? 'Resume auto-play' : 'Pause auto-play');
            pauseBtn.innerHTML = p ? '<i class="fas fa-play"></i>' : '<i class="fas fa-pause"></i>';
        }
        pauseBtn.addEventListener('click', () => setPaused(!paused));
        setPaused(paused);

        /* --- filters --- */
        function applyFilter() {
            cards.forEach(card => {
                const cats = card.dataset.cat.split(' ');
                const stack = card.dataset.stack.split(' ');
                card.hidden = !((reelState.cat === 'all' || cats.includes(reelState.cat)) &&
                                (!reelState.skill || stack.includes(reelState.skill)));
            });
            $$('.filter-btn[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === reelState.cat && !reelState.skill));
            const pill = $('#skillPill');
            pill.hidden = !reelState.skill;
            pill.classList.toggle('active', !!reelState.skill);
            $('#skillPillName').textContent = reelState.skillLabel;

            const vc = visibleCards();
            $('#reelEmpty').hidden = vc.length > 0;
            track.scrollTo({ left: 0 });
            // A filter choice restarts the showcase from the first match.
            setShowcase(true);
            if (vc.length) select(vc[0]);
            updateCount();
        }

        $$('.filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                reelState.cat = btn.dataset.filter;
                reelState.skill = null;
                applyFilter();
            });
        });
        $('#skillPill').addEventListener('click', () => {
            reelState.skill = null;
            applyFilter();
        });

        // Skill chips: show the matching projects (a deliberate jump, since
        // the visitor asked to see them).
        $$('.skill-chip.linked').forEach(chip => {
            chip.addEventListener('click', () => {
                if (chip.dataset.jump) {
                    $(chip.dataset.jump).scrollIntoView({ behavior });
                    return;
                }
                reelState.skill = chip.dataset.match;
                reelState.skillLabel = chip.textContent.trim();
                reelState.cat = 'all';
                applyFilter();
                const first = visibleCards()[0];
                if (first) select(first, { instant: true });
                hold(9000);
                trayEl.scrollIntoView({ behavior, block: 'start' });
            });
        });

        // Lock the tray to its tallest project so switching never resizes the page.
        function lockTrayHeight() {
            const body = trayEl.querySelector('.tray-body');
            trayEl.style.removeProperty('--tray-min');
            body.style.minHeight = '0px';
            let tallest = 0;
            cards.forEach(c => { fillTray(c); tallest = Math.max(tallest, body.scrollHeight); });
            body.style.minHeight = '';
            trayEl.style.setProperty('--tray-min', Math.ceil(tallest) + 'px');
            if (selected) fillTray(selected);
        }

        fillTray(cards[0]);
        lockTrayHeight();
        let resizeTimer;
        window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(lockTrayHeight, 200); });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(lockTrayHeight); // re-measure once web fonts land
        select(cards[0], { instant: true });
        setShowcase(showcase);
        reelApi = { select: id => select(cards.find(c => c.dataset.project === id), { instant: true }) };
    }

    /* ---------------------------------------------------------------
       Playground: one-button reaction timer
       Click / tap / Space anywhere on the pad. The pad tells you
       exactly what to do next at every step.
    --------------------------------------------------------------- */
    function initReflex() {
        const padEl = $('#reflexPad');
        if (!padEl) return;
        const lights = $$('.react-light', padEl);
        const display = $('#reflexDisplay');
        const status = $('#reflexStatus');
        const sub = $('#reflexSub');
        let state = 'idle';
        let timers = [];
        let raf = null;
        let t0 = 0;
        let lockedUntil = 0;
        let tries = 0;
        let best = null;
        try { best = parseInt(localStorage.getItem('reactionBest'), 10) || null; } catch (e) {}
        if (best) $('#statBest').textContent = best + ' ms';

        function setState(s, main, detail) {
            state = s;
            padEl.dataset.state = s;
            status.textContent = main;
            sub.textContent = detail;
        }
        function clearAll() {
            timers.forEach(clearTimeout);
            timers = [];
            cancelAnimationFrame(raf);
        }
        function resetLights() { lights.forEach(l => l.classList.remove('red', 'green', 'blinking')); }
        function show(ms) { display.textContent = String(Math.min(ms, 999)).padStart(3, '0'); }

        function arm() {
            clearAll();
            resetLights();
            show(0);
            setState('arming', 'Wait for green…', 'Clicking before the lights change is a false start');
            lights.forEach((l, i) => timers.push(setTimeout(() => l.classList.add('red'), 700 * (i + 1))));
            const holdMs = 700 * lights.length + 600 + Math.random() * 2200;
            timers.push(setTimeout(go, holdMs));
        }
        function go() {
            lights.forEach(l => { l.classList.remove('red'); l.classList.add('green'); });
            setState('go', 'Click!', 'Now!');
            t0 = performance.now();
            const tick = () => {
                const ms = performance.now() - t0;
                if (ms >= 999) { show(999); tooSlow(); return; }
                show(Math.round(ms));
                raf = requestAnimationFrame(tick);
            };
            tick();
        }
        function verdict(ms) {
            if (ms < 120) return 'Under 120 ms? Either you guessed, or you drive in Formula 1.';
            if (ms < 200) return 'Elite reflexes. My FPGA is mildly concerned.';
            if (ms < 260) return 'Right around the human average. Solid.';
            if (ms < 350) return 'Respectable. Coffee might shave off 30 ms.';
            return 'A little slow. Warm up and try again.';
        }
        function stop() {
            const ms = Math.round(performance.now() - t0);
            clearAll();
            show(ms);
            tries++;
            $('#statLast').textContent = ms + ' ms';
            $('#statTries').textContent = tries;
            if (!best || ms < best) {
                best = ms;
                const el = $('#statBest');
                el.textContent = ms + ' ms';
                el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
                try { localStorage.setItem('reactionBest', ms); } catch (e) {}
            }
            setState('result', ms + ' ms', verdict(ms) + ' Click to go again.');
            lockedUntil = performance.now() + 450;
        }
        function tooSlow() {
            clearAll();
            lights.forEach(l => { l.classList.remove('green'); l.classList.add('red', 'blinking'); });
            setState('false', 'Too slow', 'Over a full second. Click to try again.');
            lockedUntil = performance.now() + 450;
        }
        function falseStart() {
            clearAll();
            resetLights();
            lights.forEach(l => l.classList.add('red', 'blinking'));
            display.textContent = 'FAL';
            setState('false', 'False start', 'You clicked before green. Click to try again.');
            lockedUntil = performance.now() + 450;
        }
        function press() {
            if (performance.now() < lockedUntil) return;
            if (state === 'arming') falseStart();
            else if (state === 'go') stop();
            else arm();
        }

        // pointerdown (not click) so the measured time doesn't include the button release
        padEl.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            e.preventDefault();
            press();
        });
        padEl.addEventListener('keydown', e => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (!e.repeat) press();
            }
        });

        // Space also works while the pad is on screen, without focusing it first
        document.addEventListener('keydown', e => {
            if (e.code !== 'Space' || e.repeat || isTyping(e.target) || e.target === padEl) return;
            if ($('.modal.active') || !$('#terminal').hidden) return;
            if (e.target.closest && e.target.closest('button, a')) return;
            const r = padEl.getBoundingClientRect();
            if (r.bottom < 80 || r.top > window.innerHeight - 80) return;
            e.preventDefault();
            press();
        });
    }

    function isTyping(el) {
        return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    }

    /* ---------------------------------------------------------------
       Copy to clipboard
    --------------------------------------------------------------- */
    function initCopy() {
        $$('[data-copy]').forEach(btn => {
            btn.addEventListener('click', async e => {
                e.preventDefault();
                try {
                    await navigator.clipboard.writeText(btn.dataset.copy);
                    toast('Copied ' + btn.dataset.copy);
                } catch (err) {
                    toast(btn.dataset.copy);
                }
            });
        });
    }

    /* ---------------------------------------------------------------
       Links inside modals that jump to a page section
    --------------------------------------------------------------- */
    function initModalJumpLinks() {
        $$('[data-close-modal]').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const modal = link.closest('.modal');
                const close = modal && modal.querySelector('.modal-close-btn');
                if (close) close.click();
                const target = $(link.getAttribute('href'));
                requestAnimationFrame(() => target && target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }));
            });
        });
    }

    function openModalById(id) {
        const btn = $(`.open-modal-btn[data-modal-target="#${id}"]`);
        if (btn) btn.click();
    }

    /* ---------------------------------------------------------------
       Terminal easter egg
    --------------------------------------------------------------- */
    function initTerminal() {
        const term = $('#terminal');
        const body = $('#terminalBody');
        const form = $('#terminalForm');
        const input = $('#terminalInput');
        if (!term) return;
        const history = [];
        let hIndex = 0;
        let booted = false;
        let lastFocus = null;

        const projects = {
            drifts:   { modal: null,            name: 'DRIFTS — sensor-gated driver monitoring (current)' },
            meteor:   { modal: null, name: 'METEOR-M2 satellite ground station' },
            lerobot:  { modal: null, name: 'AI robotic arm with LeRobot' },
            aircraft: { modal: null, name: 'ADS-B aircraft tracker' },
            balance:  { modal: null, name: 'Self-balancing robot (TIVA, PID)' },
            fpga:     { modal: null, name: 'FPGA reaction timer (Verilog)' },
            water:    { modal: null, name: 'Water monitoring IoT system' },
            parking:  { modal: null, name: 'Smart parking system' },
            line:     { modal: null, name: 'Line-following robot' },
            laser:    { modal: null, name: 'Analog laser security system' },
            vgg:      { modal: null, name: 'Tiny-VGG image classifier' },
            worldcup: { modal: null, name: 'FIFA World Cup 2026 broadcast ops' }
        };

        function print(html, cls) {
            const line = document.createElement('div');
            line.className = 'tline' + (cls ? ' ' + cls : '');
            line.innerHTML = html;
            body.appendChild(line);
            body.scrollTop = body.scrollHeight;
        }
        const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

        function goto(sel) {
            close();
            $(sel).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
        }

        const commands = {
            help() {
                print('<span class="t-accent">Available commands</span>');
                [
                    ['whoami', 'the short version'],
                    ['projects', 'list everything I\'ve built'],
                    ['open &lt;name&gt;', 'open a project, e.g. <em>open meteor</em>'],
                    ['drifts', 'boot the app I\'m building right now'],
                    ['drifts --versions', 'earlier builds of DRIFTS'],
                    ['skills', 'what I work with'],
                    ['play', 'jump to the playground games'],
                    ['scope', 'switch the hero into lab mode'],
                    ['resume', 'open my resume'],
                    ['contact', 'how to reach me'],
                    ['theme light|dark', 'switch the site theme'],
                    ['clear / exit', 'tidy up or leave']
                ].forEach(([c, d]) => print(`  <span class="t-cmd">${c.padEnd(18, ' ')}</span>${d}`));
                print('<span class="t-dim">There may be a few undocumented ones too.</span>');
            },
            whoami() {
                print('David Mendoza — Computer Engineering @ University of Houston.');
                print('Embedded systems, FPGA, RF/SDR, robotics and edge AI.');
                print('Summer 2026: TOC/CIR Assistant, FIFA Host Broadcast Services.');
                print('<span class="t-ok">Status: open to full-time roles.</span>');
            },
            projects() {
                Object.entries(projects).forEach(([k, v]) => print(`  <span class="t-cmd">${k.padEnd(10, ' ')}</span>${v.name}`));
                print('<span class="t-dim">Try: open meteor</span>');
            },
            ls() { commands.projects(); },
            open(arg) {
                const key = (arg || '').toLowerCase();
                if (!key) return print('usage: open &lt;name&gt;  (see <span class="t-cmd">projects</span>)');
                if (key === 'drifts') return commands.drifts();
                const p = projects[key];
                if (!p) return print(`open: no such project: ${esc(key)}`, 't-err');
                close();
                if (p.modal) openModalById(p.modal);
                else if (window.CaseStudy) window.CaseStudy.open(key);
            },
            drifts(arg) {
                const versions = {
                    v1:     { url: 'projects/drifts/versions/v1-vision-tester.html', date: 'Oct 07 2026', desc: 'Vision tester: FaceMesh + MobileNetV2' },
                    v2:     { url: 'projects/drifts/versions/v2-sensor-gated.html',  date: 'Oct 14 2026', desc: 'Phone sensors decide when the camera wakes' },
                    v3:     { url: 'projects/drifts/versions/v3-bluetooth.html',     date: 'Oct 22 2026', desc: 'Adds Bluetooth alert module + G29 test rig' },
                    latest: { url: 'projects/drifts/',                               date: 'current',     desc: 'Current build (live on this page)' }
                };
                const args = (arg || '').toLowerCase().split(/\s+/).filter(Boolean);
                if (!args.length) {
                    goto('#drifts');
                    setTimeout(bootDrifts, 600);
                    return;
                }
                if (['--versions', '-v', 'versions', 'ls', 'log'].includes(args[0])) {
                    print('<span class="t-accent">DRIFTS version history</span>');
                    Object.entries(versions).forEach(([k, v]) =>
                        print(`  <span class="t-cmd">${k.padEnd(8, ' ')}</span><span class="t-dim">${v.date.padEnd(13, ' ')}</span>${v.desc}`));
                    print('<span class="t-dim">Open one with: drifts open v2</span>');
                    return;
                }
                const id = args[0] === 'open' ? args[1] : args[0];
                const v = versions[id];
                if (!v) {
                    print(`drifts: unknown version '${esc(id || '')}'. Try <span class="t-cmd">drifts --versions</span>.`, 't-err');
                    return;
                }
                window.open(v.url, '_blank', 'noopener');
                print(`Opening DRIFTS ${esc(id)} in a new tab…`, 't-ok');
            },
            skills() {
                print('<span class="t-accent">lang</span>    C/C++, Python, Verilog HDL, MATLAB, JS');
                print('<span class="t-accent">hw</span>      TIVA (Cortex-M4), Intel FPGA, Arduino, RTL-SDR, sensors');
                print('<span class="t-accent">ai</span>      PyTorch, CUDA, LeRobot, OpenCV, MediaPipe');
                print('<span class="t-accent">tools</span>   Quartus, Keil, LabVIEW, Multisim, scopes, logic analyzers, git');
            },
            play() { goto('#playground'); },
            scope(arg) {
                const want = (arg || '').toLowerCase();
                const next = want === 'on' ? 'lab' : want === 'off' ? 'calm' : (scopeCtl.mode === 'lab' ? 'calm' : 'lab');
                scopeCtl.setMode(next);
                if (next === 'lab') {
                    print('<span class="t-ok">Lab mode on.</span> CH1 sine, CH2 50 MHz clock, CH3 QPSK burst. Move your mouse over the hero.');
                    setTimeout(() => goto('#hero'), 900);
                } else {
                    print('Lab mode off. Back to business.', 't-ok');
                }
            },
            resume() {
                window.open('assets/docs/David_Mendoza_Resume.pdf', '_blank', 'noopener');
                print('Opening resume in a new tab…', 't-ok');
            },
            contact() {
                print('email     <a href="mailto:9davemend@gmail.com">9davemend@gmail.com</a>');
                print('linkedin  <a href="https://www.linkedin.com/in/davidmendo/" target="_blank" rel="noopener noreferrer">linkedin.com/in/davidmendo</a>');
                print('github    <a href="https://github.com/DAVIDMend0" target="_blank" rel="noopener noreferrer">github.com/DAVIDMend0</a>');
            },
            email() { commands.contact(); },
            theme(arg) {
                const box = $('#checkbox');
                const want = (arg || '').toLowerCase();
                if (!['light', 'dark'].includes(want)) return print('usage: theme light|dark');
                const isDark = !document.documentElement.classList.contains('light-mode');
                if ((want === 'dark') !== isDark) box.click();
                print(`theme set to ${want}`, 't-ok');
            },
            sudo(arg, raw) {
                if (/hire\s+david/i.test(raw)) {
                    print('[sudo] password for recruiter: ********');
                    setTimeout(() => {
                        print('<span class="t-ok">✔ Permission granted.</span> Great choice.');
                        print('Next step: <a href="mailto:9davemend@gmail.com?subject=Let%27s%20talk">send David an email</a>');
                    }, 650);
                } else {
                    print('Nice try. This incident will be reported. (Try: <em>sudo hire david</em>)', 't-err');
                }
            },
            ping() { print('PONG — 1 ms. FPGA-grade latency.'); },
            date() { print(new Date().toString()); },
            echo(arg, raw) { print(esc(raw.replace(/^echo\s*/i, ''))); },
            pwd() { print('/home/david/portfolio'); },
            cat(arg) {
                if (/resume/i.test(arg || '')) return print('cat: resume.pdf: binary file. Try <span class="t-cmd">resume</span>.');
                print(`cat: ${esc(arg || '')}: No such file or directory`, 't-err');
            },
            rm() { print('Permission denied. These projects took too long to build.', 't-err'); },
            clear() { body.innerHTML = ''; },
            exit() { close(); }
        };

        function run(raw) {
            const line = raw.trim();
            print(`<span class="t-prompt">david@portfolio:~$</span> ${esc(line)}`);
            if (!line) return;
            history.push(line);
            hIndex = history.length;
            const [cmd, ...rest] = line.split(/\s+/);
            const fn = commands[cmd.toLowerCase()];
            if (fn) fn(rest.join(' '), line);
            else print(`command not found: ${esc(cmd)}. Type <span class="t-cmd">help</span>.`, 't-err');
        }

        function open() {
            lastFocus = document.activeElement;
            term.hidden = false;
            requestAnimationFrame(() => term.classList.add('open'));
            document.body.style.overflow = 'hidden';
            if (!booted) {
                booted = true;
                print('<span class="t-accent">DM-OS 1.0</span> — portfolio shell');
                print('Type <span class="t-cmd">help</span> to see what this can do.');
            }
            setTimeout(() => input.focus(), 50);
        }
        function close() {
            term.classList.remove('open');
            term.hidden = true;
            document.body.style.overflow = '';
            if (lastFocus && lastFocus.focus) lastFocus.focus();
        }

        form.addEventListener('submit', e => {
            e.preventDefault();
            run(input.value);
            input.value = '';
        });
        input.addEventListener('keydown', e => {
            if (e.key === 'ArrowUp' && hIndex > 0) { hIndex--; input.value = history[hIndex]; e.preventDefault(); }
            else if (e.key === 'ArrowDown') { hIndex = Math.min(hIndex + 1, history.length); input.value = history[hIndex] || ''; e.preventDefault(); }
            else if (e.key === 'Tab') {
                e.preventDefault();
                const match = Object.keys(commands).find(c => c.startsWith(input.value.trim()));
                if (match && input.value.trim()) input.value = match + ' ';
            }
        });

        $('#terminalClose').addEventListener('click', close);
        term.addEventListener('click', e => { if (e.target === term) close(); });
        const footerBtn = $('#footerTerminalBtn');
        if (footerBtn) footerBtn.addEventListener('click', open);

        document.addEventListener('keydown', e => {
            if (!term.hidden && e.key === 'Escape') { close(); return; }
            if (term.hidden && (e.key === '~' || e.key === '`') && !isTyping(e.target) && !$('.modal.active')) {
                e.preventDefault();
                open();
            }
        });
    }
})();
