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

        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
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

    // --- 5. Reaction Timer Game ---
    const gameStartBtn = document.getElementById('game-start-btn');
    if (gameStartBtn) {
        const gameStopBtn = document.getElementById('game-stop-btn');
        const gameLights = document.querySelectorAll('.react-light');
        const displayContainer = document.querySelector('.seven-segment-display');
        const seg1 = document.getElementById('seg-1');
        const seg2 = document.getElementById('seg-2');
        const seg3 = document.getElementById('seg-3');
        const gameMessage = document.getElementById('game-message');

        let gameState = 'idle'; 
        let startTime = 0;
        let timerInterval = null;
        let sequenceTimeouts = [];

        function updateDisplay(ms) {
            let clampedMs = Math.min(ms, 999);
            let formatted = clampedMs.toString().padStart(3, '0');
            if (seg1) seg1.textContent = formatted[0];
            if (seg2) seg2.textContent = formatted[1];
            if (seg3) seg3.textContent = formatted[2];
            return clampedMs;
        }

        function clearSequence() {
            sequenceTimeouts.forEach(timeout => clearTimeout(timeout));
            sequenceTimeouts = [];
            clearInterval(timerInterval);
        }

        function resetGameUI() {
            gameLights.forEach(light => {
                light.classList.remove('red', 'green', 'blinking');
            });
            updateDisplay(0);
            if (displayContainer) displayContainer.classList.remove('dimmed');
            gameStartBtn.textContent = "Start Sequence";
            gameStartBtn.disabled = false;
            if (gameStopBtn) gameStopBtn.disabled = true;
            if (gameMessage) {
                gameMessage.textContent = "";
                gameMessage.style.color = "";
            }
            gameState = 'idle';
        }

        function triggerTimeout() {
            clearInterval(timerInterval);
            gameState = 'finished';
            if (gameMessage) {
                gameMessage.textContent = "Too Slow! Try Again?";
                gameMessage.style.color = "#ef4444";
            }
            if (displayContainer) displayContainer.classList.add('dimmed');
            gameLights.forEach(light => {
                light.classList.remove('green');
                light.classList.add('red', 'blinking');
            });
            gameStartBtn.textContent = "Try Again";
            gameStartBtn.disabled = false;
            if (gameStopBtn) gameStopBtn.disabled = true;
        }

        function goGreen() {
            gameState = 'waiting';
            if (gameMessage) gameMessage.textContent = "GO!";
            gameLights.forEach(light => {
                light.classList.remove('red');
                light.classList.add('green');
            });
            startTime = Date.now();
            timerInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                if (elapsed >= 999) {
                    updateDisplay(999);
                    triggerTimeout();
                } else {
                    updateDisplay(elapsed);
                }
            }, 10);
        }

        gameStartBtn.addEventListener('click', () => {
            if (gameState !== 'idle') { resetGameUI(); }
            gameState = 'sequence';
            if (gameMessage) gameMessage.textContent = "Watch the lights...";
            gameStartBtn.disabled = true;
            if (gameStopBtn) gameStopBtn.disabled = false; 
            clearSequence();

            let delay = 1000; 
            gameLights.forEach((light) => {
                let t = setTimeout(() => {
                    light.classList.add('red');
                }, delay);
                sequenceTimeouts.push(t);
                delay += 1000; 
            });

            const randomWait = Math.random() * 2500 + 1000; 
            let finalT = setTimeout(() => {
                if (gameState !== 'falseStart') { goGreen(); }
            }, delay + randomWait);
            sequenceTimeouts.push(finalT);
        });

        if (gameStopBtn) {
            gameStopBtn.addEventListener('click', () => {
                if (gameState === 'sequence') {
                    gameState = 'falseStart';
                    clearSequence();
                    if (gameMessage) {
                        gameMessage.textContent = "FALSE START!";
                        gameMessage.style.color = "#ef4444";
                    }
                    if (seg1) seg1.textContent = "F";
                    if (seg2) seg2.textContent = "A";
                    if (seg3) seg3.textContent = "L";
                    gameStartBtn.textContent = "Try Again";
                    gameStartBtn.disabled = false;
                    gameStopBtn.disabled = true;
                } else if (gameState === 'waiting') {
                    clearInterval(timerInterval);
                    gameState = 'finished';
                    const finalTime = Date.now() - startTime;
                    updateDisplay(finalTime);
                    if (gameMessage) {
                        gameMessage.textContent = `Reaction Time: ${finalTime}ms`;
                        gameMessage.style.color = "#10b981";
                    }
                    gameStartBtn.textContent = "Play Again";
                    gameStartBtn.disabled = false;
                    gameStopBtn.disabled = true;
                }
            });
        }
    }

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

        function drawSimulation(xPos, isLight) {
            ctxSim.clearRect(0, 0, simW, simH);

            // Palette
            const skyBg = isLight ? '#f1f5f9' : '#060b19';
            const groundColor = isLight ? '#86efac' : '#064e3b';
            const stationColor = isLight ? '#1e293b' : '#38bdf8';
            const orbitColor = isLight ? '#94a3b8' : '#334155';
            const satBodyColor = '#f97316';
            const solarColor = isLight ? '#0284c7' : '#38bdf8';
            const waveColor = isLight ? 'rgba(37, 99, 235, 0.55)' : 'rgba(56, 189, 248, 0.65)';

            // Background
            ctxSim.fillStyle = skyBg;
            ctxSim.fillRect(0, 0, simW, simH);

            // Ground
            ctxSim.fillStyle = groundColor;
            ctxSim.fillRect(0, simH - 35, simW, 35);

            // Ground Station Base & Mast
            const stationX = simW / 2;
            const stationY = simH - 35;
            ctxSim.fillStyle = stationColor;
            ctxSim.beginPath();
            ctxSim.moveTo(stationX - 12, stationY);
            ctxSim.lineTo(stationX + 12, stationY);
            ctxSim.lineTo(stationX, stationY - 26);
            ctxSim.fill();

            // Antenna Dish / Reflector
            ctxSim.beginPath();
            ctxSim.arc(stationX, stationY - 26, 14, Math.PI, 2 * Math.PI);
            ctxSim.strokeStyle = stationColor;
            ctxSim.lineWidth = 3;
            ctxSim.stroke();

            // Ground station label
            ctxSim.fillStyle = isLight ? '#475569' : '#94a3b8';
            ctxSim.font = '600 11px Plus Jakarta Sans, sans-serif';
            ctxSim.textAlign = 'center';
            ctxSim.fillText('RTL-SDR Ground Station', stationX, simH - 12);

            // Calculate Satellite Position
            const satScreenX = stationX + (xPos * (simW / 22));
            const orbitH = 165;
            const satScreenY = (simH - 35) - Math.sqrt(Math.max(0, 1 - Math.pow(xPos / 12, 2))) * orbitH;

            // Draw Orbit Path (Dotted Arc)
            ctxSim.beginPath();
            ctxSim.setLineDash([5, 5]);
            for (let i = -11; i <= 11; i += 0.2) {
                let px = stationX + (i * (simW / 22));
                let py = (simH - 35) - Math.sqrt(Math.max(0, 1 - Math.pow(i / 12, 2))) * orbitH;
                if (i === -11) ctxSim.moveTo(px, py);
                else ctxSim.lineTo(px, py);
            }
            ctxSim.strokeStyle = orbitColor;
            ctxSim.lineWidth = 1.5;
            ctxSim.stroke();
            ctxSim.setLineDash([]);

            // Calculate Frequency and Shift for Wave Compression
            const currentFreq = calculateFrequency(xPos);
            const shiftRatio = (currentFreq - BASE_FREQ) / MAX_SHIFT; // 1 (approaching) to -1 (receding)

            // Draw RF Waves radiating towards ground station
            const dx = stationX - satScreenX;
            const dy = stationY - satScreenY;
            const distToStation = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);

            ctxSim.save();
            ctxSim.translate(satScreenX, satScreenY);
            ctxSim.rotate(angle);

            // Wave spacing adjusts: compressed when approaching, expanded when receding
            const baseWavelength = 28;
            const wavelength = Math.max(12, baseWavelength - (shiftRatio * 13));

            ctxSim.strokeStyle = waveColor;
            ctxSim.lineWidth = 2.5;
            for (let r = wavelength; r < distToStation; r += wavelength) {
                ctxSim.beginPath();
                ctxSim.arc(0, 0, r, -0.35, 0.35);
                ctxSim.stroke();
            }
            ctxSim.restore();

            // Draw Satellite Body & Solar Arrays
            ctxSim.fillStyle = satBodyColor;
            ctxSim.fillRect(satScreenX - 14, satScreenY - 9, 28, 18);
            ctxSim.strokeStyle = '#ffffff';
            ctxSim.lineWidth = 1.5;
            ctxSim.strokeRect(satScreenX - 14, satScreenY - 9, 28, 18);

            // Left Solar Panel
            ctxSim.fillStyle = solarColor;
            ctxSim.fillRect(satScreenX - 25, satScreenY - 5, 9, 10);
            // Right Solar Panel
            ctxSim.fillRect(satScreenX + 16, satScreenY - 5, 9, 10);

            // Satellite label
            ctxSim.fillStyle = isLight ? '#1e293b' : '#f8fafc';
            ctxSim.font = '700 11px Plus Jakarta Sans, sans-serif';
            ctxSim.textAlign = 'center';
            ctxSim.fillText('Meteor-M2 (LEO)', satScreenX, satScreenY - 14);
        }

        function drawGraph(currentX, isLight) {
            ctxGraph.clearRect(0, 0, graphW, graphH);

            const graphBg = isLight ? '#f1f5f9' : '#060b19';
            const gridColor = isLight ? '#cbd5e1' : '#1e293b';
            const textColor = isLight ? '#475569' : '#94a3b8';
            const curveColor = isLight ? '#2563eb' : '#38bdf8';
            const pointColor = '#f97316';

            // Background
            ctxGraph.fillStyle = graphBg;
            ctxGraph.fillRect(0, 0, graphW, graphH);

            // Center Reference Grid Line (Nominal 137.900 MHz)
            ctxGraph.strokeStyle = gridColor;
            ctxGraph.lineWidth = 1;
            ctxGraph.beginPath();
            ctxGraph.moveTo(0, graphH / 2);
            ctxGraph.lineTo(graphW, graphH / 2);
            ctxGraph.stroke();

            // Boundary Grid Lines
            ctxGraph.setLineDash([3, 3]);
            ctxGraph.beginPath();
            ctxGraph.moveTo(0, 20);
            ctxGraph.lineTo(graphW, 20);
            ctxGraph.moveTo(0, graphH - 20);
            ctxGraph.lineTo(graphW, graphH - 20);
            ctxGraph.stroke();
            ctxGraph.setLineDash([]);

            // Frequency Axis Labels
            ctxGraph.fillStyle = textColor;
            ctxGraph.font = '600 11px Courier New, monospace';
            ctxGraph.textAlign = 'left';
            ctxGraph.fillText('+3.5 kHz (137.9035 MHz)', 12, 16);
            ctxGraph.fillText('Nominal 137.9000 MHz (Zenith)', 12, graphH / 2 - 6);
            ctxGraph.fillText('-3.5 kHz (137.8965 MHz)', 12, graphH - 8);

            // S-Curve (Doppler Frequency Response)
            ctxGraph.beginPath();
            ctxGraph.strokeStyle = curveColor;
            ctxGraph.lineWidth = 3;

            for (let screenX = 0; screenX <= graphW; screenX++) {
                let logicX = (screenX / graphW) * 20 - 10;
                let freq = calculateFrequency(logicX);
                let yNorm = (freq - (BASE_FREQ - MAX_SHIFT)) / (2 * MAX_SHIFT);
                let screenY = graphH - (yNorm * (graphH - 40) + 20);

                if (screenX === 0) ctxGraph.moveTo(screenX, screenY);
                else ctxGraph.lineTo(screenX, screenY);
            }
            ctxGraph.stroke();

            // Current Operating Point Marker
            const currentFreq = calculateFrequency(currentX);
            const pX = ((currentX + 10) / 20) * graphW;
            const yNorm = (currentFreq - (BASE_FREQ - MAX_SHIFT)) / (2 * MAX_SHIFT);
            const pY = graphH - (yNorm * (graphH - 40) + 20);

            ctxGraph.beginPath();
            ctxGraph.arc(pX, pY, 7, 0, Math.PI * 2);
            ctxGraph.fillStyle = pointColor;
            ctxGraph.fill();
            ctxGraph.strokeStyle = '#ffffff';
            ctxGraph.lineWidth = 2.5;
            ctxGraph.stroke();

            // Point readout overlay
            ctxGraph.fillStyle = isLight ? '#0f172a' : '#ffffff';
            ctxGraph.font = '700 11px Courier New, monospace';
            ctxGraph.textAlign = pX > graphW - 100 ? 'right' : 'left';
            const offset = pX > graphW - 100 ? -12 : 12;
            ctxGraph.fillText(`${currentFreq.toFixed(5)} MHz`, pX + offset, pY - 8);
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