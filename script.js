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
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';

        const videos = modal.querySelectorAll('video');
        videos.forEach(v => v.pause());

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
});