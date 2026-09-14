// ==========================================================================
// ТРОПИНКА — front-end logic
// Handles: WhatsApp CTA link generation, mobile nav, lead form submission
// ==========================================================================

(function () {
  'use strict';

  // Single source of truth for the WhatsApp number.
  // Format required by wa.me: digits only, country code, no "+".
  var WHATSAPP_NUMBER = '77771960989';

  /**
   * Build every WhatsApp CTA link on the page.
   * Each element with class "wa-cta" carries its own contextual
   * pre-filled message in data-msg, so every hook/CTA on the page
   * opens WhatsApp with copy relevant to where the visitor clicked.
   */
  function buildWhatsAppLinks() {
    var links = document.querySelectorAll('.wa-cta');
    links.forEach(function (el) {
      var message = el.getAttribute('data-msg') || 'Здравствуйте! Хочу узнать подробнее о центре «Тропинка».';
      var url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(message);
      el.setAttribute('href', url);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener');
    });
  }

  /**
   * Mobile navigation toggle.
   */
  function initMobileNav() {
    var btn = document.getElementById('menuBtn');
    var nav = document.getElementById('mobileNav');
    if (!btn || !nav) return;

    btn.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(isOpen));
    });

    // Close the mobile menu after tapping any link inside it.
    // Each link also gets a --i custom property so the CSS stagger
    // (.mobile-nav a transition-delay) fans the links in one by one.
    nav.querySelectorAll('a').forEach(function (a, index) {
      a.style.setProperty('--i', String(index));
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /**
   * Lead form submission — posts to the Cloudflare Pages Function
   * at /api/submit, which relays the message to Telegram.
   */
  function initLeadForm() {
    var form = document.getElementById('leadForm');
    var status = document.getElementById('formStatus');
    var submitBtn = document.getElementById('leadSubmit');
    if (!form || !status || !submitBtn) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Basic honeypot check on the client too (server re-checks it).
      var honeypot = form.querySelector('#website');
      if (honeypot && honeypot.value) {
        // Silently drop likely bot submissions.
        return;
      }

      var originalLabel = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправляем…';
      status.className = 'form-status';
      status.textContent = '';

      var formData = new FormData(form);

      fetch('/api/submit', {
        method: 'POST',
        body: formData
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok) {
            status.classList.add('show', 'ok');
            status.textContent = 'Спасибо! Заявка отправлена, мы свяжемся с вами в ближайшее время.';
            form.reset();
          } else {
            throw new Error((result.data && result.data.error) || 'Request failed');
          }
        })
        .catch(function () {
          status.classList.add('show', 'err');
          status.textContent = 'Не получилось отправить заявку. Напишите нам сразу в WhatsApp — кнопка выше.';
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        });
    });
  }

  function initYear() {
    var el = document.getElementById('year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /**
   * Gallery lightbox — click a bubble photo to open it full-size,
   * close via the close button, backdrop click, or Escape.
   */
  function initLightbox() {
    var lightbox = document.getElementById('lightbox');
    var lightboxImg = document.getElementById('lightboxImg');
    var closeBtn = document.getElementById('lightboxClose');
    var bubbles = document.querySelectorAll('.bubble');
    if (!lightbox || !lightboxImg || !bubbles.length) return;

    // Tracks whichever bubble opened the lightbox, so keyboard focus can
    // return to it on close instead of falling back to <body>.
    var lastTrigger = null;

    function open(src, alt, trigger) {
      lightboxImg.setAttribute('src', src);
      lightboxImg.setAttribute('alt', alt || '');
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      lastTrigger = trigger || null;
      // Move focus into the dialog so keyboard/screen-reader users land
      // somewhere meaningful instead of staying "behind" the overlay.
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      if (lastTrigger) lastTrigger.focus();
      // Clear the src after the fade-out so the closed state carries no image.
      window.setTimeout(function () {
        if (!lightbox.classList.contains('open')) lightboxImg.setAttribute('src', '');
      }, 200);
    }

    bubbles.forEach(function (bubble) {
      bubble.addEventListener('click', function () {
        open(bubble.getAttribute('data-full'), bubble.getAttribute('data-alt'), bubble);
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', close);

    // Click on the backdrop (not the image itself) closes the lightbox.
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) close();
    });

    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') {
        close();
        return;
      }
      // Minimal focus trap: only the close button is interactive inside the
      // dialog, so Tab/Shift+Tab both simply keep focus on it.
      if (e.key === 'Tab' && closeBtn) {
        e.preventDefault();
        closeBtn.focus();
      }
    });
  }

  // ========================================================================
  // Motion design — scroll reveal, number counters, card tilt, magnetic
  // buttons, a subtle hero parallax, and an optional custom cursor.
  // Every effect here degrades to "nothing happens, content stays visible"
  // if JS fails, and every hover/pointer effect is gated so it never runs
  // on touch devices or when the user has asked the OS for reduced motion.
  // ========================================================================

  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasFinePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /**
   * Fades/slides sections and cards in as they scroll into view.
   * Adds .reveal (+ a staggered --i index per group) to a fixed list of
   * selectors, then flips .in-view via IntersectionObserver the first time
   * each element is ~15% visible. If IntersectionObserver isn't supported,
   * elements are left at their default (fully visible) styling.
   */
  function initScrollReveal() {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) return;

    var groups = [
      '.section-head',
      '.develop-item',
      '.stat-box',
      '.approach-item',
      '.program-card',
      '.trust-card',
      '.review-card',
      '.teacher-card',
      '.location-info',
      '.location-map',
      '.lead-form',
      '.final-cta'
    ];

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    groups.forEach(function (selector) {
      var items = document.querySelectorAll(selector);
      items.forEach(function (el, index) {
        el.classList.add('reveal');
        el.style.setProperty('--i', String(index % 5));
        observer.observe(el);
      });
    });
  }

  /**
   * Counts a stat number up from 0 once it scrolls into view. Only targets
   * numbers that are a clean integer (e.g. "860") — ranges like "10–18" or
   * "2–5 мин" are left as static text since there is nothing to count up.
   */
  function initCounters() {
    var nums = document.querySelectorAll('.stat-box .num');
    if (!nums.length || !('IntersectionObserver' in window)) return;

    function animateCount(el, target) {
      if (prefersReducedMotion) { el.textContent = String(target); return; }
      var start = null;
      var duration = 1200;
      function step(timestamp) {
        if (start === null) start = timestamp;
        var progress = Math.min((timestamp - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        el.textContent = String(Math.round(eased * target));
        if (progress < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = parseInt(el.textContent, 10);
        if (!isNaN(target) && /^\d+$/.test(el.textContent.trim())) {
          animateCount(el, target);
        }
        observer.unobserve(el);
      });
    }, { threshold: 0.6 });

    nums.forEach(function (el) { observer.observe(el); });
  }

  /**
   * Subtle 3D tilt on program/trust/teacher cards, following the pointer.
   * Desktop-only (fine pointer + hover capable) and capped to a small
   * rotation so it reads as "responsive surface", not a gimmick.
   */
  function initTilt() {
    if (prefersReducedMotion || !hasFinePointer) return;
    var cards = document.querySelectorAll('.program-card, .trust-card, .teacher-card');
    var MAX_TILT = 5; // degrees

    cards.forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = 'perspective(800px) rotateX(' + (-y * MAX_TILT).toFixed(2) + 'deg) rotateY(' + (x * MAX_TILT).toFixed(2) + 'deg) translateZ(0)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      });
    });
  }

  /**
   * Primary/secondary buttons drift a few pixels toward the cursor while
   * hovered, then spring back — a "magnetic" micro-interaction that makes
   * the main CTA feel responsive without moving far enough to mis-click.
   */
  function initMagnetic() {
    if (prefersReducedMotion || !hasFinePointer) return;
    var buttons = document.querySelectorAll('.btn-primary, .btn-secondary');
    var MAX_PULL = 8; // px

    buttons.forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        btn.style.transform = 'translate(' + (x * MAX_PULL).toFixed(1) + 'px, ' + (y * MAX_PULL).toFixed(1) + 'px)';
      });
      btn.addEventListener('mouseleave', function () {
        btn.style.transform = '';
      });
    });
  }

  /**
   * A few pixels of vertical drift on the hero illustration as the page
   * scrolls — cheap, rAF-batched, and skipped entirely on touch/coarse
   * pointers where scroll-linked transforms tend to feel janky.
   */
  function initParallax() {
    if (prefersReducedMotion || !hasFinePointer) return;
    var card = document.querySelector('.hero-media-card');
    var hero = document.querySelector('.hero');
    if (!card || !hero) return;

    var ticking = false;
    function update() {
      var rect = hero.getBoundingClientRect();
      var offset = Math.max(-24, Math.min(24, rect.top * -0.06));
      card.style.transform = 'translateY(' + offset.toFixed(1) + 'px)';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
  }

  /**
   * Optional soft accent-colored cursor ring for precise-pointer desktop
   * visitors — grows over links/buttons, leaves form fields alone (native
   * text caret), and never loads on touch devices. Kept intentionally
   * minimal per the Impeccable "motion clarifies hierarchy, never shows
   * off" principle — see the audit report for the recommendation to A/B
   * this rather than treat it as a given.
   */
  function initCustomCursor() {
    if (prefersReducedMotion || !hasFinePointer) return;

    var dot = document.createElement('div');
    dot.className = 'custom-cursor-dot';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);
    document.body.classList.add('custom-cursor-active');

    var targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    var raf = null;

    function loop() {
      // Light easing so the ring trails the pointer instead of snapping to it.
      currentX += (targetX - currentX) * 0.2;
      currentY += (targetY - currentY) * 0.2;
      dot.style.transform = 'translate3d(' + currentX.toFixed(1) + 'px,' + currentY.toFixed(1) + 'px,0)';
      raf = window.requestAnimationFrame(loop);
    }

    document.addEventListener('mousemove', function (e) {
      targetX = e.clientX;
      targetY = e.clientY;
      if (raf === null) raf = window.requestAnimationFrame(loop);
    }, { passive: true });

    document.addEventListener('mouseover', function (e) {
      var interactive = e.target.closest && e.target.closest('a, button, .btn, input, select, textarea');
      document.body.classList.toggle('cursor-hover', !!interactive && !e.target.closest('.lead-form'));
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    buildWhatsAppLinks();
    initMobileNav();
    initLeadForm();
    initYear();
    initLightbox();
    initScrollReveal();
    initCounters();
    initTilt();
    initMagnetic();
    initParallax();
    initCustomCursor();
  });
})();
