document.addEventListener("DOMContentLoaded", function() {
    
    // --- 1. Navbar, Hamburger & Scrollspy Logic ---
    const navbar = document.getElementById("navbar");
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-links");
    const sections = document.querySelectorAll("header[id], section[id]");
    const navLinks = document.querySelectorAll(".nav-links a[href^='#']");

    let lastScrollY = window.scrollY;
    let ticking = false;

    function updateActiveNav() {
        let currentId = "";
        const scrollPosition = window.scrollY + 120;

        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            if (scrollPosition >= top && scrollPosition < top + height) {
                currentId = section.getAttribute("id");
            }
        });

        navLinks.forEach(link => {
            const href = link.getAttribute("href");
            if (href === `#${currentId}`) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });
    }

    function handleScroll() {
        if (lastScrollY > 20) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
        updateActiveNav();
        ticking = false;
    }

    window.addEventListener("scroll", function() {
        lastScrollY = window.scrollY;
        if (!ticking) {
            window.requestAnimationFrame(handleScroll);
            ticking = true;
        }
    }, { passive: true });
    handleScroll(); // Initial check

    if (hamburger && navMenu) {
        function toggleHamburger(open) {
            const isActive = open !== undefined ? open : !hamburger.classList.contains("active");
            hamburger.classList.toggle("active", isActive);
            navMenu.classList.toggle("active", isActive);
            hamburger.setAttribute("aria-expanded", String(isActive));
        }

        hamburger.addEventListener("click", () => toggleHamburger());

        // Close menu when clicking any nav link
        document.querySelectorAll(".nav-links a").forEach(link => {
            link.addEventListener("click", () => toggleHamburger(false));
        });

        // Close menu on click outside
        document.addEventListener("click", (e) => {
            if (navMenu.classList.contains("active") && !navbar.contains(e.target)) {
                toggleHamburger(false);
            }
        });
    }

    // --- 2. Theme Toggle ---
    const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
    const rootEl = document.documentElement;
    const bodyEl = document.body;

    const isCurrentlyLight = rootEl.classList.contains("light-mode");
    if (isCurrentlyLight) {
        bodyEl.classList.add("light-mode");
    } else {
        bodyEl.classList.remove("light-mode");
    }

    if (toggleSwitch) {
        toggleSwitch.checked = !isCurrentlyLight;

        toggleSwitch.addEventListener("change", function(e) {
            if (e.target.checked) {
                rootEl.classList.remove("light-mode");
                bodyEl.classList.remove("light-mode");
                localStorage.setItem("theme", "dark");
            } else {
                rootEl.classList.add("light-mode");
                bodyEl.classList.add("light-mode");
                localStorage.setItem("theme", "light");
            }
            if (typeof updateDopplerSim === 'function') {
                updateDopplerSim();
            }
        });
    }

    // --- 3. Carousel Controllers Registry ---
    const carouselControllers = new Map();

    const carousels = document.querySelectorAll('.carousel');
    carousels.forEach(carousel => {
        const track = carousel.querySelector('.carousel-track');
        if (!track) return;

        const slides = Array.from(track.children);
        const nextButton = carousel.querySelector('.carousel-button--right');
        const prevButton = carousel.querySelector('.carousel-button--left');
        let currentIndex = 0;
        let autoPlayInterval = null;

        // Create Navigation Dots
        const nav = document.createElement('div');
        nav.classList.add('carousel-nav');
        carousel.appendChild(nav);

        if (slides.length <= 1) {
            if (nextButton) nextButton.style.display = 'none';
            if (prevButton) prevButton.style.display = 'none';
            nav.style.display = 'none';
        }

        slides.forEach((_, index) => {
            const indicator = document.createElement('button');
            indicator.classList.add('carousel-indicator');
            indicator.setAttribute('aria-label', `Go to slide ${index + 1}`);
            if (index === 0) indicator.classList.add('current-slide');
            nav.appendChild(indicator);
            indicator.addEventListener('click', () => {
                moveToSlide(index);
                resetTimer();
            });
        });

        const dots = Array.from(nav.children);

        const moveToSlide = (targetIndex) => {
            slides.forEach((slide, idx) => {
                if (idx === targetIndex) {
                    slide.classList.add('current-slide');
                    slide.style.display = 'flex';
                    slide.style.opacity = '1';
                } else {
                    slide.classList.remove('current-slide');
                    slide.style.display = 'none';
                    slide.style.opacity = '0';
                    const video = slide.querySelector('video');
                    if (video) video.pause();
                }
            });
            dots.forEach((dot, idx) => {
                dot.classList.toggle('current-slide', idx === targetIndex);
            });
            currentIndex = targetIndex;
        };

        const startTimer = () => {
            clearInterval(autoPlayInterval);
            if (slides.length > 1) {
                autoPlayInterval = setInterval(() => {
                    const newIndex = (currentIndex + 1) % slides.length;
                    moveToSlide(newIndex);
                }, 30000); // 30 seconds
            }
        };

        const stopTimer = () => {
            clearInterval(autoPlayInterval);
            autoPlayInterval = null;
        };

        const resetTimer = () => {
            stopTimer();
            startTimer();
        };

        moveToSlide(0);

        if (nextButton) {
            nextButton.addEventListener('click', () => {
                const newIndex = (currentIndex + 1) % slides.length;
                moveToSlide(newIndex);
                resetTimer();
            });
        }

        if (prevButton) {
            prevButton.addEventListener('click', () => {
                const newIndex = (currentIndex - 1 + slides.length) % slides.length;
                moveToSlide(newIndex);
                resetTimer();
            });
        }

        // Touch / Swipe Logic
        let touchStartX = 0;
        let touchEndX = 0;

        track.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        track.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            if (slides.length <= 1) return;
            if (touchStartX - touchEndX > 50) {
                moveToSlide((currentIndex + 1) % slides.length);
                resetTimer();
            } else if (touchEndX - touchStartX > 50) {
                moveToSlide((currentIndex - 1 + slides.length) % slides.length);
                resetTimer();
            }
        }

        carouselControllers.set(carousel, {
            start: startTimer,
            stop: stopTimer,
            reset: () => moveToSlide(0)
        });
    });

    // --- 4. Modal Logic (with Keyboard Accessibility & Focus Trap) ---
    const openModalButtons = document.querySelectorAll('.open-modal-btn');
    const closeModalButtons = document.querySelectorAll('.modal-close-btn');
    const overlay = document.getElementById('modal-overlay');
    let lastFocusedElement = null;

    function getFocusableElements(container) {
        return container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
    }

    function openModal(modal) {
        if (!modal) return;
        lastFocusedElement = document.activeElement;

        modal.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        const modalCarousels = modal.querySelectorAll('.carousel');
        modalCarousels.forEach(c => {
            const controller = carouselControllers.get(c);
            if (controller) {
                controller.reset();
                controller.start();
            }
        });

        const closeBtn = modal.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.focus();
        } else {
            modal.focus();
        }

        if (modal.id === 'modal-meteor' && typeof updateDopplerSim === 'function') {
            requestAnimationFrame(() => updateDopplerSim());
        }
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';

        const videos = modal.querySelectorAll('video');
        videos.forEach(v => v.pause());

        const iframes = modal.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            const currentSrc = iframe.src;
            iframe.src = currentSrc;
        });

        const modalCarousels = modal.querySelectorAll('.carousel');
        modalCarousels.forEach(c => {
            const controller = carouselControllers.get(c);
            if (controller) controller.stop();
        });

        if (modal.id === 'modal-dms') {
            const dmsContainer = modal.querySelector('#dmsSimEmbedContainer');
            if (dmsContainer) dmsContainer.classList.add('mobile-warning-active');
        }

        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
    }

    // DMS Simulation Mobile Advisory Agreement
    const simAdvisoryBtn = document.getElementById('simAdvisoryBtn');
    const dmsSimEmbedContainer = document.getElementById('dmsSimEmbedContainer');
    if (simAdvisoryBtn && dmsSimEmbedContainer) {
        simAdvisoryBtn.addEventListener('click', function() {
            dmsSimEmbedContainer.classList.remove('mobile-warning-active');
        });
    }

    openModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modalId = button.getAttribute('data-modal-target');
            const modal = document.querySelector(modalId);
            openModal(modal);
        });
    });

    closeModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            closeModal(modal);
        });
    });

    if (overlay) {
        overlay.addEventListener('click', () => {
            const activeModals = document.querySelectorAll('.modal.active');
            activeModals.forEach(m => closeModal(m));
        });
    }

    // Keyboard support: Close on Escape key & Focus Trap
    document.addEventListener('keydown', function(e) {
        const activeModal = document.querySelector('.modal.active');
        if (!activeModal) return;

        if (e.key === 'Escape' || e.key === 'Esc') {
            closeModal(activeModal);
            return;
        }

        if (e.key === 'Tab') {
            const focusables = Array.from(getFocusableElements(activeModal));
            if (focusables.length === 0) return;

            const firstElement = focusables[0];
            const lastElement = focusables[focusables.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        }
    });

    // (Reaction timer lives in features.js)

    // --- 6. METEOR-M2 DOPPLER SHIFT SIMULATION ---
    const dopplerSimCanvas = document.getElementById('dopplerSimCanvas');
    const dopplerGraphCanvas = document.getElementById('dopplerGraphCanvas');
    const dopplerSlider = document.getElementById('dopplerSatSlider');
    const dopplerFreqOutput = document.getElementById('dopplerFreqOutput');

    if (dopplerSimCanvas && dopplerGraphCanvas && dopplerSlider && dopplerFreqOutput) {
        const ctxSim = dopplerSimCanvas.getContext('2d');
        const ctxGraph = dopplerGraphCanvas.getContext('2d');

        // Physics Constants matching Meteor-M2 LEO Pass
        const BASE_FREQ = 137.900; // MHz nominal carrier
        const MAX_SHIFT = 0.0035;  // MHz (+/- 3.5 kHz maximum Doppler shift)
        const ALTITUDE = 3;        // Relative orbital scale

        const simW = dopplerSimCanvas.width;
        const simH = dopplerSimCanvas.height;
        const graphW = dopplerGraphCanvas.width;
        const graphH = dopplerGraphCanvas.height;

        function calculateFrequency(x) {
            const distance = Math.sqrt(x * x + ALTITUDE * ALTITUDE);
            const radialVelocityFactor = -x / distance; // Positive approaching, negative receding
            return BASE_FREQ + (MAX_SHIFT * radialVelocityFactor);
        }

        // Palette follows the site theme: monochrome ink + Mondrian primaries for the key objects.
        function dopplerPalette(isLight) {
            return isLight ? {
                bg: '#fafaf9', grid: 'rgba(9, 9, 11, 0.07)', ink: '#09090b', muted: '#71717a',
                faint: 'rgba(9, 9, 11, 0.28)', wave: 'rgba(9, 9, 11, 0.55)',
                red: '#d62718', blue: '#1f4fa3', yellow: '#f2c200'
            } : {
                bg: '#0d0d0f', grid: 'rgba(250, 250, 250, 0.05)', ink: '#fafafa', muted: '#a1a1aa',
                faint: 'rgba(250, 250, 250, 0.3)', wave: 'rgba(250, 250, 250, 0.6)',
                red: '#e5372a', blue: '#3a6fd8', yellow: '#f5c518'
            };
        }
        const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

        function drawGrid(ctx, w, h, color, step) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = step; x < w; x += step) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
            for (let y = step; y < h; y += step) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
            ctx.stroke();
        }

        function drawSimulation(xPos, isLight) {
            const c = dopplerPalette(isLight);
            ctxSim.clearRect(0, 0, simW, simH);
            ctxSim.fillStyle = c.bg;
            ctxSim.fillRect(0, 0, simW, simH);
            drawGrid(ctxSim, simW, simH, c.grid, 40);

            // Ground: one heavy rule, Mondrian-style
            const groundY = simH - 35;
            ctxSim.fillStyle = c.ink;
            ctxSim.fillRect(0, groundY, simW, 3);

            // Ground station: mast + dish in ink, a small red block as the receiver
            const stationX = simW / 2;
            ctxSim.strokeStyle = c.ink;
            ctxSim.lineWidth = 2;
            ctxSim.beginPath();
            ctxSim.moveTo(stationX, groundY);
            ctxSim.lineTo(stationX, groundY - 24);
            ctxSim.stroke();
            ctxSim.beginPath();
            ctxSim.arc(stationX, groundY - 24, 13, Math.PI, 2 * Math.PI);
            ctxSim.stroke();
            ctxSim.fillStyle = c.red;
            ctxSim.fillRect(stationX - 4, groundY - 28, 8, 8);

            ctxSim.fillStyle = c.muted;
            ctxSim.font = '500 10px ' + MONO;
            ctxSim.textAlign = 'center';
            ctxSim.fillText('RTL-SDR GROUND STATION', stationX, simH - 12);

            // Orbit path
            const satScreenX = stationX + (xPos * (simW / 22));
            const orbitH = 165;
            const satScreenY = groundY - Math.sqrt(Math.max(0, 1 - Math.pow(xPos / 12, 2))) * orbitH;

            ctxSim.beginPath();
            ctxSim.setLineDash([3, 5]);
            for (let i = -11; i <= 11; i += 0.2) {
                const px = stationX + (i * (simW / 22));
                const py = groundY - Math.sqrt(Math.max(0, 1 - Math.pow(i / 12, 2))) * orbitH;
                if (i === -11) ctxSim.moveTo(px, py); else ctxSim.lineTo(px, py);
            }
            ctxSim.strokeStyle = c.faint;
            ctxSim.lineWidth = 1;
            ctxSim.stroke();
            ctxSim.setLineDash([]);

            // RF wavefronts: compressed while approaching, stretched while receding
            const currentFreq = calculateFrequency(xPos);
            const shiftRatio = (currentFreq - BASE_FREQ) / MAX_SHIFT;
            const dx = stationX - satScreenX;
            const dy = (groundY - 24) - satScreenY;
            const distToStation = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            const wavelength = Math.max(12, 28 - (shiftRatio * 13));

            ctxSim.save();
            ctxSim.translate(satScreenX, satScreenY);
            ctxSim.rotate(angle);
            ctxSim.strokeStyle = c.wave;
            ctxSim.lineWidth = 1.5;
            for (let r = wavelength; r < distToStation - 8; r += wavelength) {
                ctxSim.beginPath();
                ctxSim.arc(0, 0, r, -0.32, 0.32);
                ctxSim.stroke();
            }
            ctxSim.restore();

            // Satellite: yellow body, blue panels, ink outlines
            ctxSim.lineWidth = 2;
            ctxSim.strokeStyle = c.ink;
            ctxSim.fillStyle = c.yellow;
            ctxSim.fillRect(satScreenX - 12, satScreenY - 8, 24, 16);
            ctxSim.strokeRect(satScreenX - 12, satScreenY - 8, 24, 16);
            ctxSim.fillStyle = c.blue;
            ctxSim.fillRect(satScreenX - 30, satScreenY - 5, 14, 10);
            ctxSim.strokeRect(satScreenX - 30, satScreenY - 5, 14, 10);
            ctxSim.fillRect(satScreenX + 16, satScreenY - 5, 14, 10);
            ctxSim.strokeRect(satScreenX + 16, satScreenY - 5, 14, 10);

            ctxSim.fillStyle = c.ink;
            ctxSim.font = '500 10px ' + MONO;
            ctxSim.textAlign = 'center';
            ctxSim.fillText('METEOR-M2 (LEO)', satScreenX, satScreenY - 16);
        }

        function drawGraph(currentX, isLight) {
            const c = dopplerPalette(isLight);
            ctxGraph.clearRect(0, 0, graphW, graphH);
            ctxGraph.fillStyle = c.bg;
            ctxGraph.fillRect(0, 0, graphW, graphH);
            drawGrid(ctxGraph, graphW, graphH, c.grid, 30);

            // Nominal carrier (solid) and +/- limits (dashed)
            ctxGraph.strokeStyle = c.faint;
            ctxGraph.lineWidth = 1;
            ctxGraph.beginPath();
            ctxGraph.moveTo(0, graphH / 2 + 0.5);
            ctxGraph.lineTo(graphW, graphH / 2 + 0.5);
            ctxGraph.stroke();
            ctxGraph.setLineDash([3, 4]);
            ctxGraph.beginPath();
            ctxGraph.moveTo(0, 20.5); ctxGraph.lineTo(graphW, 20.5);
            ctxGraph.moveTo(0, graphH - 19.5); ctxGraph.lineTo(graphW, graphH - 19.5);
            ctxGraph.stroke();
            ctxGraph.setLineDash([]);

            // Axis labels, right-aligned so they never sit under the start of the curve
            ctxGraph.fillStyle = c.muted;
            ctxGraph.font = '400 10px ' + MONO;
            ctxGraph.textAlign = 'right';
            ctxGraph.fillText('+3.5 kHz  137.9035 MHz', graphW - 12, 15);
            ctxGraph.fillText('NOMINAL  137.9000 MHz', graphW - 12, graphH / 2 - 6);
            ctxGraph.fillText('-3.5 kHz  137.8965 MHz', graphW - 12, graphH - 6);

            // S-curve
            const yFor = freq => graphH - (((freq - (BASE_FREQ - MAX_SHIFT)) / (2 * MAX_SHIFT)) * (graphH - 40) + 20);
            ctxGraph.beginPath();
            ctxGraph.strokeStyle = c.ink;
            ctxGraph.lineWidth = 2;
            for (let sx = 0; sx <= graphW; sx++) {
                const sy = yFor(calculateFrequency((sx / graphW) * 20 - 10));
                if (sx === 0) ctxGraph.moveTo(sx, sy); else ctxGraph.lineTo(sx, sy);
            }
            ctxGraph.stroke();

            // Operating point: a red square with a vertical cursor
            const currentFreq = calculateFrequency(currentX);
            const pX = ((currentX + 10) / 20) * graphW;
            const pY = yFor(currentFreq);
            ctxGraph.strokeStyle = c.red;
            ctxGraph.lineWidth = 1;
            ctxGraph.beginPath();
            ctxGraph.moveTo(pX + 0.5, 0);
            ctxGraph.lineTo(pX + 0.5, graphH);
            ctxGraph.stroke();
            ctxGraph.fillStyle = c.red;
            ctxGraph.fillRect(pX - 5, pY - 5, 10, 10);
            ctxGraph.strokeStyle = c.ink;
            ctxGraph.lineWidth = 1.5;
            ctxGraph.strokeRect(pX - 5, pY - 5, 10, 10);

            // Readout next to the point; flips side near the right edge, drops below near the top
            ctxGraph.fillStyle = c.ink;
            ctxGraph.font = '500 11px ' + MONO;
            const right = pX > graphW - 140;
            ctxGraph.textAlign = right ? 'right' : 'left';
            const ty = pY < 40 ? pY + 20 : pY - 10;
            ctxGraph.fillText(`${currentFreq.toFixed(5)} MHz`, pX + (right ? -12 : 12), ty);
        }

        updateDopplerSim = function() {
            const isLight = document.documentElement.classList.contains('light-mode') || document.body.classList.contains('light-mode');
            const xVal = parseFloat(dopplerSlider.value);
            const freq = calculateFrequency(xVal);

            dopplerFreqOutput.textContent = freq.toFixed(5);
            drawSimulation(xVal, isLight);
            drawGraph(xVal, isLight);
        };

        dopplerSlider.addEventListener('input', updateDopplerSim);
        updateDopplerSim();
    }
});