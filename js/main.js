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
    nav.querySelectorAll('a').forEach(function (a) {
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

    function open(src, alt) {
      lightboxImg.setAttribute('src', src);
      lightboxImg.setAttribute('alt', alt || '');
      lightbox.classList.add('open');
    }

    function close() {
      lightbox.classList.remove('open');
      // Clear the src after the fade-out so the closed state carries no image.
      window.setTimeout(function () {
        if (!lightbox.classList.contains('open')) lightboxImg.setAttribute('src', '');
      }, 200);
    }

    bubbles.forEach(function (bubble) {
      bubble.addEventListener('click', function () {
        open(bubble.getAttribute('data-full'), bubble.getAttribute('data-alt'));
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', close);

    // Click on the backdrop (not the image itself) closes the lightbox.
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightbox.classList.contains('open')) close();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    buildWhatsAppLinks();
    initMobileNav();
    initLeadForm();
    initYear();
    initLightbox();
  });
})();
