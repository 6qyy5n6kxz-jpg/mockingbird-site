(function () {
  'use strict';

  const form = document.getElementById('party-form');
  if (!form) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const summaryView = $('[data-event-summary]');
  const calculatorSummary = $('[data-menu-summary]', form);
  const inquirySummary = $('#party-inquiry-summary');
  const enhancementSummary = $('#party-enhancements-summary');
  const successPanel = $('[data-inquiry-success]');
  const estimateBuilder = $('#private-menu-builder');
  let calculatorUsed = false;
  let formStarted = false;
  let submittedSummaryText = '';

  const track = (eventName, parameters) => {
    if (typeof window.gtag === 'function') window.gtag('event', eventName, parameters || {});
    else if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: eventName, ...(parameters || {}) });
  };

  const valueOf = (id) => ($(id)?.value || '').trim();
  const selectedEnhancements = () => $$('[data-enhancement-option]:checked', form).map((input) => input.value);
  const estimateText = () => (calculatorUsed ? (calculatorSummary?.value || '').trim() : '');

  $$('[data-track]').forEach((element) => {
    element.addEventListener('click', () => track(element.dataset.track));
  });

  function summaryItems() {
    const items = [];
    const add = (label, value) => { if (value) items.push({ label, value }); };
    add('Event type', valueOf('#party-event-type'));
    add('Preferred date', valueOf('#party-date'));
    add('Alternate date', valueOf('#party-alternate-date'));
    add('Guest count', valueOf('#party-size'));
    add('Space', valueOf('#party-space'));
    add('Food interests', valueOf('#party-food'));
    add('Beverage interests', valueOf('#party-beverages'));
    add('Enhancements', selectedEnhancements().join(', '));
    const estimate = estimateText();
    if (estimate) add('Preliminary estimate', estimate);
    return items;
  }

  function ownerSummary() {
    const lines = ['PRIVATE EVENT INQUIRY'];
    const add = (label, value) => lines.push(`${label}: ${value || 'Not provided'}`);
    add('Customer name', valueOf('#party-name'));
    add('Email', valueOf('#party-email'));
    add('Phone', valueOf('#party-phone'));
    add('Event type', valueOf('#party-event-type'));
    add('Preferred date', valueOf('#party-date'));
    add('Alternate date', valueOf('#party-alternate-date'));
    add('Preferred start time', valueOf('#party-time-window'));
    add('Guest count', valueOf('#party-size'));
    add('Indoor/outdoor preference', valueOf('#party-space'));
    add('Food interests', valueOf('#party-food'));
    add('Beverage interests', valueOf('#party-beverages'));
    add('Dietary or accessibility needs', valueOf('#party-dietary'));
    add('Selected enhancements', selectedEnhancements().join(', '));
    add('What they are celebrating', valueOf('#party-occasion'));
    add('Desired atmosphere or experience', valueOf('#party-special'));
    add('Questions or notes', valueOf('#party-notes'));
    lines.push('', estimateText() || 'Calculator estimate: Not created');
    add('Page URL', window.location.href.split('#')[0]);
    add('Submission timestamp', new Date().toISOString());
    return lines.join('\n');
  }

  function renderSummary() {
    const items = summaryItems();
    if (!summaryView) return;
    if (!items.length) {
      summaryView.innerHTML = '<p class="note">You can submit an inquiry without using the estimator, or create an estimate first to give us a better starting point.</p>';
    } else {
      const list = document.createElement('dl');
      items.forEach(({ label, value }) => {
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = label;
        dd.textContent = value;
        list.append(dt, dd);
      });
      summaryView.replaceChildren(list);
    }
    if (enhancementSummary) enhancementSummary.value = selectedEnhancements().join(', ') || 'None selected';
  }

  function prepareSubmission() {
    renderSummary();
    const timestamp = new Date().toISOString();
    const pageUrl = window.location.href.split('#')[0];
    const name = valueOf('#party-name') || 'Name not provided';
    const eventType = valueOf('#party-event-type') || 'Event type not provided';
    const date = valueOf('#party-date') || 'Date not provided';
    submittedSummaryText = ownerSummary();
    if (inquirySummary) inquirySummary.value = submittedSummaryText;
    $('#party-calculator-submission').value = estimateText() || 'Not created';
    $('#party-page-url').value = pageUrl;
    $('#party-submitted-at').value = timestamp;
    $('#party-subject').value = `Private Event Inquiry — ${eventType} — ${date} — ${name}`;
  }

  function showError(input, message) {
    input.setAttribute('aria-invalid', 'true');
    const error = $(`#${input.id}-error`);
    if (error) error.textContent = message;
    return input;
  }

  function validateInquiry(event) {
    $$('.field-error', form).forEach((error) => { error.textContent = ''; });
    $$('[aria-invalid]', form).forEach((input) => input.removeAttribute('aria-invalid'));
    const invalid = [];
    const required = [
      [$('#party-name'), 'Please enter your name.'],
      [$('#party-event-type'), 'Please select an event type.'],
      [$('#party-date'), 'Please choose a preferred date.'],
      [$('#party-size'), 'Please enter an approximate guest count.']
    ];
    required.forEach(([input, message]) => { if (!input.value.trim()) invalid.push(showError(input, message)); });
    const email = $('#party-email');
    const phone = $('#party-phone');
    if (!email.value.trim() && !phone.value.trim()) {
      invalid.push(showError(email, 'Please provide an email address or phone number.'));
      showError(phone, 'Please provide an email address or phone number.');
    }
    if (email.value.trim() && !email.validity.valid) invalid.push(showError(email, 'Please enter a valid email address.'));
    if (phone.value.trim() && phone.value.replace(/\D/g, '').length < 7) invalid.push(showError(phone, 'Please enter a complete phone number.'));
    if ($('#party-size').value && Number($('#party-size').value) <= 0) invalid.push(showError($('#party-size'), 'Guest count must be greater than zero.'));
    if (invalid.length) {
      event.preventDefault();
      track('inquiry_validation_error', { invalid_field_count: invalid.length });
      invalid[0].focus();
      return;
    }
    prepareSubmission();
  }

  document.querySelectorAll('[data-enhancement]').forEach((button) => {
    button.addEventListener('click', () => {
      const requested = button.dataset.enhancement === 'Something else' ? 'Custom event enhancement' : button.dataset.enhancement;
      const checkbox = $$('[data-enhancement-option]', form).find((input) => input.value === requested);
      if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
      renderSummary();
      form.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      window.setTimeout(() => { if (checkbox) checkbox.focus({ preventScroll: true }); }, 500);
    });
  });

  $('[data-calculator-to-form]')?.addEventListener('click', () => {
    calculatorUsed = true;
    const calculatorGuests = $('#private-guest-count');
    const formGuests = $('#party-size');
    if (calculatorGuests?.value && !formGuests.value) formGuests.value = calculatorGuests.value;
    renderSummary();
    track('calculator_completed');
    track('calculator_to_form');
    form.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(() => $('#party-event-type')?.focus({ preventScroll: true }), 500);
  });

  if (estimateBuilder) {
    let calculatorStarted = false;
    const onCalculatorChange = (event) => {
      if (!event.target.closest('button, input')) return;
      calculatorUsed = true;
      if (!calculatorStarted && event.isTrusted) {
        calculatorStarted = true;
        track('calculator_started');
      }
      renderSummary();
    };
    estimateBuilder.addEventListener('click', onCalculatorChange);
    estimateBuilder.addEventListener('input', onCalculatorChange);
  }

  form.addEventListener('input', () => {
    if (!formStarted) { formStarted = true; track('inquiry_form_started'); }
    renderSummary();
  });
  form.addEventListener('change', renderSummary);
  form.addEventListener('submit', () => track('inquiry_submit_attempt'));
  form.addEventListener('formspree:validate', validateInquiry);
  form.addEventListener('formspree:success', () => {
    track('inquiry_submit_success');
    const submitted = $('[data-submitted-summary]');
    if (submitted) {
      const pre = document.createElement('pre');
      pre.textContent = submittedSummaryText;
      submitted.replaceChildren(pre);
    }
    form.hidden = true;
    successPanel.hidden = false;
    successPanel.focus();
  });
  form.addEventListener('formspree:error', () => {
    $('[data-error-phone]').hidden = false;
    track('inquiry_submit_error');
  });

  $$('[data-phone-fallback]').forEach((link) => link.addEventListener('click', () => track('inquiry_phone_fallback_click')));
  $('[data-inquiry-menu]')?.addEventListener('click', () => track('inquiry_menu_click'));
  $('[data-copy-inquiry]')?.addEventListener('click', async () => {
    const status = $('[data-copy-status]');
    try {
      await navigator.clipboard.writeText(submittedSummaryText);
      status.textContent = 'Inquiry summary copied.';
      track('inquiry_summary_copy');
    } catch (error) {
      status.textContent = 'Copy was unavailable. You can select the summary above and copy it manually.';
    }
  });

  renderSummary();
})();
