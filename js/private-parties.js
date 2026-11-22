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

  function crmSubmissionId() {
    const field = $('#party-crm-submission-id');
    if (!field) return '';
    if (!field.value) {
      field.value = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `mockingbird-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return field.value;
  }

  function formDataObject(formData) {
    const result = {};
    formData.forEach((value, key) => {
      const normalized = typeof value === 'string' ? value : value?.name || '';
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        result[key] = Array.isArray(result[key])
          ? [...result[key], normalized]
          : [result[key], normalized];
      } else {
        result[key] = normalized;
      }
    });
    return result;
  }

  async function sendCrmIntake(formData) {
    const endpoint = window.MOCKINGBIRD_CRM_INTAKE_URL || form.dataset.crmIntakeUrl;
    if (!endpoint || !formData) return;
    const submissionId = crmSubmissionId();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'mockingbird_website',
          source_submission_id: submissionId,
          submitted_at: $('#party-submitted-at')?.value || new Date().toISOString(),
          payload: formDataObject(formData)
        })
      });
      if (!response.ok) throw new Error(`CRM intake failed with ${response.status}`);
      track('crm_lead_intake_success');
    } catch (error) {
      console.warn('CRM lead intake failed; Formspree submission remains authoritative.', error);
      track('crm_lead_intake_error');
    }
  }

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

  const prettyDate = (value) => {
    const [y, m, d] = String(value || '').split('-').map(Number);
    if (!y || !m || !d) return value;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };
  const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0);

  function summaryItems() {
    const items = [];
    const add = (label, value) => { if (value) items.push({ label, value }); };
    const plan = window.PrivateEventPlanner?.getHeadline?.() || {};
    add('Event type', valueOf('#party-event-type'));
    add('Preferred date', prettyDate(valueOf('#party-date')));
    add('Alternate date', prettyDate(valueOf('#party-alternate-date')));
    add('Guests', valueOf('#party-size') || (plan.guestCount ? String(plan.guestCount) : ''));
    add('Menu', plan.menuLabel ? `${plan.menuLabel}${plan.itemCount ? ` · ${plan.itemCount} item${plan.itemCount === 1 ? '' : 's'}` : ''}` : '');
    add('Drinks', plan.beverageMethod);
    add('Extras', selectedEnhancements().join(', '));
    add('Space', valueOf('#party-space') !== 'Flexible / not sure yet' ? valueOf('#party-space') : '');
    if (Number.isFinite(plan.total)) add('Estimated total', `${money(plan.total)} (preliminary)`);
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
      summaryView.innerHTML = '<p class="note">Nothing planned yet. You can send a request without an estimate, or go back to step 1 for a price.</p>';
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
    crmSubmissionId();
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
      [$('#party-email'), 'Please enter your email so we can reply.'],
      [$('#party-event-type'), 'Please select an event type.'],
      [$('#party-date'), 'Please choose a preferred date.'],
      [$('#party-size'), 'Please enter an approximate guest count.']
    ];
    required.forEach(([input, message]) => { if (!input.value.trim()) invalid.push(showError(input, message)); });
    const email = $('#party-email');
    const phone = $('#party-phone');
    if (email.value.trim() && !email.validity.valid) invalid.push(showError(email, 'Please enter a valid email address.'));
    if (phone.value.trim() && phone.value.replace(/\D/g, '').length < 7) invalid.push(showError(phone, 'Please enter a complete phone number.'));
    if ($('#party-size').value && Number($('#party-size').value) <= 0) invalid.push(showError($('#party-size'), 'Guest count must be greater than zero.'));
    const dateValue = $('#party-date').value;
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (dateValue && dateValue < todayKey) invalid.push(showError($('#party-date'), 'Please choose a date that hasn’t passed.'));
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

  // ---------- Two steps: plan & estimate, then date & details ----------
  const grid = $('#event-estimate');
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function showStep(step, { focus = true, scroll = true } = {}) {
    if (!grid) return;
    const next = step === 'request' ? 'request' : 'plan';
    grid.dataset.step = next;
    document.body.classList.toggle('pp-on-request', next === 'request');
    document.body.classList.toggle('pp-on-plan', next === 'plan');
    $$('.pp-step[data-goto-step]').forEach((button) => {
      if (button.dataset.gotoStep === next) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    if (location.hash !== `#${next}`) history.replaceState(null, '', `#${next}`);
    renderSummary();
    if (scroll) $('.pp-steps')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    if (focus) window.setTimeout(() => (next === 'request' ? $('#event-summary-title') : $('#planner-food-heading'))?.focus?.({ preventScroll: true }), reduceMotion() ? 0 : 400);
    track(next === 'request' ? 'step_request_viewed' : 'step_plan_viewed');
  }
  $('#event-summary-title')?.setAttribute('tabindex', '-1');
  $('#planner-food-heading')?.setAttribute('tabindex', '-1');
  $$('[data-goto-step]').forEach((button) => button.addEventListener('click', () => showStep(button.dataset.gotoStep)));
  window.addEventListener('hashchange', () => { if (['#plan', '#request'].includes(location.hash)) showStep(location.hash.slice(1), { scroll: false }); });
  showStep(location.hash === '#request' ? 'request' : 'plan', { focus: false, scroll: false });

  $('[data-calculator-to-form]')?.addEventListener('click', () => {
    calculatorUsed = true;
    track('calculator_completed');
    track('calculator_to_form');
    showStep('request');
  });

  // One guest count: the plan and the request form stay the same.
  const plannerGuests = $('#private-guest-count');
  const formGuests = $('#party-size');
  if (plannerGuests && formGuests) {
    plannerGuests.addEventListener('input', () => { formGuests.value = plannerGuests.value; renderSummary(); });
    plannerGuests.addEventListener('blur', () => { formGuests.value = plannerGuests.value; });
    formGuests.addEventListener('input', () => {
      plannerGuests.value = formGuests.value;
      plannerGuests.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

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
  form.addEventListener('formspree:success', (event) => {
    track('inquiry_submit_success');
    void sendCrmIntake(event.detail?.formData);
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
