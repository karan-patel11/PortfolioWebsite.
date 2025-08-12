/**
 * 🍏 Karan Patel — Apple Portfolio
 * 🌗 Theme Toggle | 🧭 Nav Glass | 🚀 Smooth Scroll | 💥 Skill Tag Bounce
 * All modern, encapsulated, lean, and ready for production.
 */

(function () {
    'use strict';
  
    // =====================================================
    // 🌗 Theme Toggle (Light/Dark)
    // =====================================================
    function setupThemeToggle() {
      const toggle = document.getElementById('theme-toggle');
      const icon = document.querySelector('.theme-icon');
      if (!toggle || !icon) return;
  
      // Get current theme (localStorage × system)
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      let currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
      applyTheme(currentTheme);
  
      // Handle button click
      toggle.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(currentTheme);
        localStorage.setItem('theme', currentTheme);
      });
  
      // System theme changes
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', (e) => {
          if (!savedTheme) {
            currentTheme = e.matches ? 'dark' : 'light';
            applyTheme(currentTheme);
          }
        });
  
      function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        icon.textContent = theme === 'dark' ? '🌞' : '🌙';
        if (theme === 'dark' && document.body.style.backgroundColor === 'rgb(0, 0, 0)') {
          setTimeout(() => (document.body.style.backgroundColor = ''), 200);
        }
      }
    }
  
    // =====================================================
    // 🧭 Floating Glass Navbar on Scroll
    // =====================================================
    function setupNavbarGlassScroll() {
      const nav = document.getElementById('mainNav');
      if (!nav) return;
  
      let ticking = false;
      const threshold = 10;
  
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
  
      // Update nav after section hash jumps
      document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
          setTimeout(() => updateNavState(window.scrollY), 100);
        });
      });
  
      window.addEventListener('scroll', handleScroll, { passive: true });
      updateNavState(window.scrollY); // Init
    }
  
    // =====================================================
    // 🚀 Smooth Scroll for Anchor Links (Navbar-Responsive)
    // =====================================================
    function setupSmoothAnchorScroll() {
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        if (anchor.getAttribute('href') === '#') return;
        anchor.addEventListener('click', function (e) {
          e.preventDefault();
          const target = document.querySelector(this.getAttribute('href'));
          if (target) {
            // Account for navbar height in scroll offset
            const nav = document.getElementById('mainNav');
            const navHeight = nav ? nav.offsetHeight : 0;
            const scrollTop = target.getBoundingClientRect().top + window.pageYOffset - navHeight;
            window.scrollTo({ top: scrollTop, behavior: 'smooth' });
          }
        });
      });
    }
  
    // =====================================================
    // 💥 Skill Tag Animation — Click to Pause, Responsive
    // =====================================================
    function setupSkillTagBounce() {
      const skillList = document.querySelector('.skill-list');
      if (!skillList) return;
  
      skillList.addEventListener('click', () => {
        skillList.classList.add('stopped');
      });
  
      // Uncomment below to restart bounce when mouse leaves
      // skillList.addEventListener('mouseleave', () => {
      //   skillList.classList.remove('stopped');
      // });
    }
  
    // =====================================================
    // 🚀 Initialize All
    // =====================================================
    document.addEventListener('DOMContentLoaded', function () {
      setupThemeToggle();
      setupNavbarGlassScroll();
      setupSmoothAnchorScroll();
      setupSkillTagBounce();
    });
  
  })();
  