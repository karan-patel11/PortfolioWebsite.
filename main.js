// ============================================================================
// Theme Toggle: Light/Dark Mode
// Saves user preference, syncs with system, updates icon.
// ============================================================================
function setupThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    const icon = document.querySelector('.theme-icon');
    if (!toggle || !icon) return;

    // Load saved theme or use system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    applyTheme(currentTheme);

    // Click to toggle theme
    toggle.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(currentTheme);
        localStorage.setItem('theme', currentTheme);
    });

    // Respond to system theme changes (if no user preference)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!savedTheme) {
            currentTheme = e.matches ? 'dark' : 'light';
            applyTheme(currentTheme);
        }
    });

    // Apply selected theme to the page
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        icon.textContent = theme === 'dark' ? '🌞' : '🌙';
        // Small hack to avoid flash of black on theme switch
        if (theme === 'dark' && document.body.style.backgroundColor === 'rgb(0, 0, 0)') {
            setTimeout(() => (document.body.style.backgroundColor = ''), 200);
        }
    }
}

// ============================================================================
// Navbar: Glass Effect on Scroll
// Adds a glass effect to the navbar when user scrolls down.
// ============================================================================
function setupNavbarGlassScroll() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;
    let ticking = false;
    const threshold = 10;

    // Add/remove 'scrolled' class based on scroll position
    function updateNavState(scrollY) {
        nav.classList.toggle('scrolled', scrollY > threshold);
    }
    function handleScroll() {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateNavState(window.scrollY);
                ticking = false;
            });
            ticking = true;
        }
    }
    // Update nav after anchor link scroll
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            setTimeout(() => updateNavState(window.scrollY), 100);
        });
    });
    // Listen for scroll and update
    window.addEventListener('scroll', handleScroll, { passive: true });
    updateNavState(window.scrollY);
}

// ============================================================================
// Smooth Anchor Scroll
// Smoothly scrolls to in-page anchors, accounting for fixed navbar height.
// ============================================================================
function setupSmoothAnchorScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        if (anchor.getAttribute('href') === '#') return;
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const nav = document.getElementById('mainNav');
                const navHeight = nav ? nav.offsetHeight : 0;
                const scrollTop = target.getBoundingClientRect().top + window.pageYOffset - navHeight;
                window.scrollTo({ top: scrollTop, behavior: 'smooth' });
            }
        });
    });
}

// ============================================================================
// Skill Tags: Bounce Animation
// Interactive effect on skill tags (click to stop, mouseleave to restart).
// ============================================================================
function setupSkillTagBounce() {
    const skillList = document.querySelector('.skill-list');
    if (!skillList) return;

    // Click to pause the animation
    skillList.addEventListener('click', () => {
        skillList.classList.add('stopped');
    });

    // Uncomment to restart animation on mouse leave
    // skillList.addEventListener('mouseleave', () => {
    //     skillList.classList.remove('stopped');
    // });
}

// ============================================================================
// Skill Cards: Toggle Effect
// Interactive click-to-toggle for each featured skill card.
// ============================================================================
function setupSkillCardToggle() {
    document.querySelectorAll('.glass-skill-card').forEach(card => {
        card.addEventListener('click', function (e) {
            // Only toggle if not clicking the progress bar or percent label
            if (
                !e.target.classList.contains('glass-bar') &&
                !e.target.classList.contains('glass-skill-percent')
            ) {
                card.classList.toggle('toggled');
            }
        });
    });
}

// ============================================================================
// Skill Bars: Animate on Scroll
// Progress bars animate when scrolled into view.
// ============================================================================
function setupSkillsBarAnimation() {
    let started = false;
    function animateGlassSkills() {
        document.querySelectorAll('.glass-skill-card').forEach(card => {
            const bar = card.querySelector('.glass-bar');
            const percentLabel = card.querySelector('.glass-skill-percent');
            const val = parseInt(bar.getAttribute('data-value'), 10);
            let curr = 0;
            const run = setInterval(() => {
                curr += 1;
                bar.style.width = curr + '%';
                percentLabel.textContent = curr + '%';
                if (curr >= val) {
                    clearInterval(run);
                    bar.style.width = val + '%';
                    percentLabel.textContent = val + '%';
                }
            }, 12);
        });
    }
    window.addEventListener('scroll', function trigger() {
        const section = document.getElementById('featured-skills');
        if (!started && section && section.getBoundingClientRect().top < window.innerHeight - 42) {
            animateGlassSkills();
            started = true;
        }
    }, { passive: true });
}

// ============================================================================
// Loading Screen: Dynamic Progress
// Shows progress bar and percent while "loading" the portfolio.
// ============================================================================
function setupLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const loadingBar = document.getElementById('loading-bar');
    const loadingPercent = document.getElementById('loading-percent');
    const enterBtn = document.getElementById('loading-enter');
    const portfolio = document.getElementById('portfolio-content');
    if (!loadingScreen || !loadingBar || !loadingPercent || !enterBtn) return;
    if (portfolio) portfolio.style.display = 'none';

    loadingBar.style.width = '0%';
    loadingPercent.textContent = '0%';
    enterBtn.disabled = false;

    let percent = 0, duration = 1460, stepTime = 14;

    // Click to start loading animation
    enterBtn.addEventListener('click', function () {
        enterBtn.disabled = true;
        enterBtn.style.opacity = 0.7;
        percent = 0;
        loadingBar.style.transition = "width 1.48s cubic-bezier(.37,1.17,.37,.98)";
        loadingBar.style.width = '100%';
        loadingPercent.textContent = '0%';

        // Animate the progress bar and percentage
        const start = Date.now();
        const timer = setInterval(() => {
            const elapsed = Date.now() - start;
            percent = Math.min(100, Math.round((elapsed / duration) * 100));
            loadingPercent.textContent = percent + "%";
            if (percent >= 100) {
                clearInterval(timer);
                loadingBar.style.width = '100%';
                loadingPercent.textContent = "100%";
                setTimeout(() => {
                    loadingScreen.classList.add('hidden');
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                        if (portfolio) portfolio.style.display = 'block';
                        document.body.style.overflow = 'auto';
                    }, 600);
                }, 320);
            }
        }, stepTime);
    });
}

// ============================================================================
// About Flip Card: Interactive Toggle
// Click to flip the card, focus management for accessibility.
// ============================================================================
function setupAboutFlipCard() {
    const flipCard = document.getElementById('aboutFlipCard');
    const toggleBtn = document.getElementById('aboutToggleBtn');
    const closeBtn = document.getElementById('aboutCloseBtn');
    // Disable flip on phones (matches CSS: max-width:768 portrait)
    const isPhonePortrait = () => window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches;

    if (toggleBtn && flipCard && !isPhonePortrait()) {
        toggleBtn.addEventListener('click', () => {
            flipCard.classList.add('flipped');
            setTimeout(() => closeBtn && closeBtn.focus(), 330);
            requestAnimationFrame(() => adjustAboutCardHeight());
        });
    }
    if (closeBtn && flipCard && !isPhonePortrait()) {
        closeBtn.addEventListener('click', () => {
            flipCard.classList.remove('flipped');
            setTimeout(() => toggleBtn && toggleBtn.focus(), 330);
            requestAnimationFrame(() => adjustAboutCardHeight());
        });
    }
}

// ============================================================================
// About Card: Auto-height to fit tallest face (prevents overflow on mobile)
// ============================================================================
function adjustAboutCardHeight() {
    const flipCard = document.getElementById('aboutFlipCard');
    if (!flipCard) return;
    const front = flipCard.querySelector('.about-flip-front');
    const back = flipCard.querySelector('.about-flip-back');
    if (!front || !back) return;
    // Measure natural heights of both faces
    const prevStyle = flipCard.style.height;
    flipCard.style.height = 'auto';
    const frontHeight = front.scrollHeight;
    const backHeight = back.scrollHeight;
    const target = Math.max(frontHeight, backHeight);
    flipCard.style.height = target + 'px';
}

function setupAboutCardAutoSize() {
    const flipCard = document.getElementById('aboutFlipCard');
    if (!flipCard) return;
    // Observe size changes in content
    const ro = new ResizeObserver(() => adjustAboutCardHeight());
    ro.observe(flipCard);
    flipCard.querySelectorAll('.about-flip-face').forEach(face => ro.observe(face));
    // Recalculate on orientation change and window resize
    window.addEventListener('resize', adjustAboutCardHeight, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(adjustAboutCardHeight, 150));
    // Initial calculation
    setTimeout(adjustAboutCardHeight, 200);
}

// ============================================================================
// Initialize Everything on DOM Load
// Sets up all interactive elements when the page is ready.
// ============================================================================
document.addEventListener('DOMContentLoaded', function () {
    setupThemeToggle();
    setupNavbarGlassScroll();
    setupSmoothAnchorScroll();
    setupSkillTagBounce();
    setupSkillCardToggle();
    setupSkillsBarAnimation();
    setupLoadingScreen();
    setupAboutFlipCard();
    setupAboutCardAutoSize();
});
