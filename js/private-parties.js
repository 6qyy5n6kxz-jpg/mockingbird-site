(function () {
  'use strict';

  const form = document.getElementById('party-form');
  if (!form) return;

  const track = (eventName, parameters) => {
    if (typeof window.gtag === 'function') window.gtag('event', eventName, parameters || {});
    else if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: eventName, ...(parameters || {}) });
  };

  document.querySelectorAll('[data-track]').forEach((element) => {
    element.addEventListener('click', () => track(element.dataset.track, {
      enhancement: element.dataset.enhancement || undefined,
      link_text: element.textContent.trim()
    }));
  });

  document.querySelectorAll('[data-enhancement]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.enhancement;
      const checkbox = Array.from(form.querySelectorAll('input[name="Event enhancements"]'))
        .find((input) => input.value === value);
      if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
      form.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      window.setTimeout(() => {
        if (checkbox) checkbox.focus({ preventScroll: true });
      }, 500);
    });
  });

  let formStarted = false;
  form.addEventListener('input', () => {
    if (formStarted) return;
    formStarted = true;
    track('inquiry_form_begin');
  });

  form.addEventListener('submit', () => track('inquiry_form_submit'));
  const observer = new MutationObserver(() => {
    const status = form.querySelector('.form-status.is-success');
    if (status && status.textContent.trim() && !status.dataset.tracked) {
      status.dataset.tracked = 'true';
      track('inquiry_form_success');
    }
  });
  observer.observe(form, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });

  const estimateBuilder = document.getElementById('private-menu-builder');
  if (estimateBuilder) {
    let estimateTracked = false;
    const markEstimateComplete = (event) => {
      if (estimateTracked || !event.isTrusted || !event.target.closest('button, input')) return;
      estimateTracked = true;
      track('event_estimate_complete');
    };
    estimateBuilder.addEventListener('click', markEstimateComplete);
    estimateBuilder.addEventListener('input', markEstimateComplete);
  }

  document.querySelectorAll('a[href^="mailto:"]').forEach((link) => link.addEventListener('click', () => track('email_click')));
})();
