(function () {
  /**
   * Base path detection for GitHub Pages project sites.
   * - Custom domains, localhost, and user/organization roots => ''.
   * - Project pages on *.github.io => '/<repo>'.
   */
  function getBasePath() {
  const { hostname, pathname } = window.location;

  // Only relevant on GitHub Pages domains
  if (!hostname.endsWith('github.io')) return '';

  // If you host on a custom domain later, hostname won't end with github.io, so '' is correct.

  // Heuristic:
  // - If path has at least 2 segments and the first segment is not a known route,
  //   it's probably the repo name.
  // - If path has 1 segment and it matches a known route, base should be '' (user site).
  const knownRoutes = new Set([
    'menu', 'specials', 'events', 'private-parties', 'reserve-date', 'wine-club', 'gift-cards', 'contact', 'drinks'
  ]);

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return '';

  // If we're at /repo/... then parts[0] is repo and parts[1] is route
  if (parts.length >= 2) return `/${parts[0]}`;

  // parts.length === 1: could be /menu/ on a user site OR /repo/ on a project site homepage
  // If it matches a known route, treat as user site (no base)
  if (knownRoutes.has(parts[0])) return '';

  // Otherwise, treat it as repo name (project site homepage like /repo/)
  return `/${parts[0]}`;
}

  function withBase(path) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path; // Leave absolute URLs untouched.
    const base = getBasePath();
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalized}`;
  }

  function isPlaceholderUrl(url, isPlaceholderFlag) {
    if (isPlaceholderFlag === true) return true;
    if (!url) return true;
    const lower = url.toLowerCase();
    return lower.includes('replace_me') || lower.includes('stripe-link-placeholder') || lower.includes('example.com');
  }

  function isValidPaymentLink(url, isPlaceholderFlag) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    if (isPlaceholderFlag === true) return false;
    if (lower.includes('replace_me') || lower.includes('placeholder') || lower.includes('example.com') || lower.includes('test_')) return false;
    return true;
  }

  function fillTemplate(template, tokens) {
    if (!template) return '';
    return template.replace(/{{\s*([\w.-]+)\s*}}/g, (match, key) => {
      const val = tokens && Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : '';
      return val === undefined || val === null ? '' : String(val);
    });
  }

  const __debug = typeof window.isDebugEnabled === 'function'
    ? window.isDebugEnabled()
    : !!window.__debug;
  const DEBUG = __debug === true;
  function dbg(...args) {
    if (DEBUG) console.log('[dbg]', ...args);
  }

  function ticketsRemaining(ticketing) {
    if (!ticketing) return 0;
    const capacity = Number(ticketing.capacity) || 0;
    const sold = Number(ticketing.sold) || 0;
    return Math.max(0, capacity - sold);
  }

  function buildSubmissionLink(submission, tokens, fallbackSubject = '', fallbackBody = '') {
    if (!submission) return null;
    if (submission.method === 'external_url' && submission.url) {
      return { url: fillTemplate(submission.url, tokens), target: '_blank' };
    }
    const to = fillTemplate(submission.to || tokens?.site_contact_email || tokens?.siteEmail || '', tokens).trim();
    if (!to) return null;
    const subject = fillTemplate(submission.subject_template || fallbackSubject, tokens);
    const body = fillTemplate(submission.body_template || fallbackBody, tokens);
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return { url: mailto };
  }

  function createForm(fields, submission, tokens, submitLabel, instructions, fallbackSubject, fallbackBody, context, options = {}) {
    if (!submission) return null;
    const opts = options || {};
    const paidLabel = opts.paidLabel || 'I’ve already paid';
    const preFieldsNote = typeof opts.preFieldsNote === 'string' ? opts.preFieldsNote.trim() : '';
    const hiddenFields = opts.hiddenFields && typeof opts.hiddenFields === 'object' ? opts.hiddenFields : null;
    const ajaxSubmit = opts.ajax === true;
    const formAction = typeof opts.action === 'string' ? opts.action.trim() : '';
    const requirePaidCheckbox = opts.requirePaidCheckbox === true;
    const successMessageRaw = typeof opts.successMessage === 'string' ? opts.successMessage.trim() : '';
    const successMessage = successMessageRaw || 'Thanks! We received your seating details.';
    const defaultIntro = context === 'event_ticketed' ? 'This form completes your reservation.' : '';
    const defaultSubnote = context === 'event_ticketed' ? 'This form emails us your seating details — it doesn’t process payment.' : '';
    const introText = typeof opts.introNote === 'string' ? opts.introNote : defaultIntro;
    const subnoteText = typeof opts.subnote === 'string' ? opts.subnote : defaultSubnote;

    function coerceFields(list) {
      const defaults = {
        name: { id: 'name', label: 'Name', type: 'text' },
        email: { id: 'email', label: 'Email', type: 'email' },
        phone: { id: 'phone', label: 'Phone number', type: 'tel', placeholder: '(555) 555-5555' },
        quantity: { id: 'quantity', label: 'Quantity', type: 'select', options: ['1', '2', '3', '4', '5', '6'] },
        notes: { id: 'notes', label: 'Notes', type: 'textarea', rows: 3, placeholder: 'Attendee names + any seating notes' },
        date: { id: 'date', label: 'Date', type: 'text' },
        plan: { id: 'plan', label: 'Plan', type: 'select' },
        paid: { id: 'paid', label: paidLabel, type: 'checkbox', required: false }
      };
      const arr = Array.isArray(list) ? list : [];
      return arr.map((entry) => {
        if (entry && typeof entry === 'object' && entry.id) return entry;
        if (typeof entry === 'string') {
          const lower = entry.toLowerCase();
          if (defaults[lower]) return { ...defaults[lower] };
          const titled = entry.charAt(0).toUpperCase() + entry.slice(1);
          return { id: entry, label: titled, type: 'text' };
        }
        return entry;
      }).filter(Boolean);
    }

    const wrap = document.createElement('div');
    wrap.className = opts.compact ? 'form-card compact' : 'form-card';
    const form = document.createElement('form');
    form.className = opts.compact ? 'note compact-form' : 'note';
    if (opts.formClass) form.classList.add(opts.formClass);
    if (ajaxSubmit && formAction) {
      form.action = formAction;
      form.method = 'POST';
    }
    const intro = document.createElement('p');
    intro.className = 'note';
    if (introText) {
      intro.textContent = introText;
      form.appendChild(intro);
    }
    if (subnoteText) {
      const subnote = document.createElement('p');
      subnote.className = 'note';
      subnote.textContent = subnoteText;
      form.appendChild(subnote);
    }
    if (preFieldsNote) {
      const reinforce = document.createElement('p');
      reinforce.className = 'note event-help';
      reinforce.textContent = preFieldsNote;
      form.appendChild(reinforce);
    }
    if (hiddenFields) {
      Object.entries(hiddenFields).forEach(([key, value]) => {
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = key;
        hidden.value = value == null ? '' : String(value);
        form.appendChild(hidden);
      });
    }
    if (ajaxSubmit) {
      const honeypot = document.createElement('input');
      honeypot.type = 'text';
      honeypot.name = '_gotcha';
      honeypot.autocomplete = 'off';
      honeypot.tabIndex = -1;
      honeypot.className = 'sr-only';
      form.appendChild(honeypot);
    }
    const fieldList = coerceFields(fields);
    const hasPaid = fieldList.some((f) => f.id === 'paid');
    if (!hasPaid && requirePaidCheckbox) {
      fieldList.push({ id: 'paid', label: paidLabel, type: 'checkbox', required: true });
    }
    if (requirePaidCheckbox) {
      fieldList.forEach((field) => {
        if (field.id === 'paid') field.required = true;
      });
    }

    function normalizeRequired(list, ctx) {
      const requiredMap = {
        event_ticketed: ['name', 'email', 'quantity'],
        deposit: ['name', 'email', 'phone', 'date'],
        wineclub: ['plan', 'name', 'email']
      };
      const required = requiredMap[ctx] || [];
      return list.map((f) => {
        if (required.includes(f.id)) return { ...f, required: true };
        return f;
      });
    }

    function isEmailValid(val) {
      if (!val || typeof val !== 'string') return false;
      const at = val.indexOf('@');
      const dot = val.lastIndexOf('.');
      return at > 0 && dot > at + 1 && dot < val.length - 1;
    }

    const normalizedFields = normalizeRequired(fieldList, context);
    let renderFields = normalizedFields;
    if (context === 'event_ticketed') {
      renderFields = normalizedFields
        .filter((f) => f.required || ['notes', 'paid', 'name', 'email', 'phone', 'quantity'].includes(f.id))
        .map((f) => {
          if (f.id === 'quantity') return { ...f, type: 'select', options: ['1', '2', '3', '4', '5', '6'] };
          if (f.id === 'notes') return { ...f, placeholder: 'Attendee names + any seating notes' };
          return f;
        });
    }
    dbg('createForm fields', {
      context,
      incomingType: Array.isArray(fields) ? typeof fields[0] : typeof fields,
      renderFields: renderFields.map((f) => ({ id: f.id, type: f.type }))
    });

    const fieldErrors = {};
    renderFields.forEach((field) => {
      const wrapField = document.createElement('div');
      wrapField.style.marginBottom = '8px';
      let label;
      if (field.type === 'checkbox') {
        label = document.createElement('label');
        label.className = 'check-row';
      } else {
        label = document.createElement('label');
        label.setAttribute('for', `field-${field.id}`);
        label.textContent = field.label;
        wrapField.appendChild(label);
      }
      let input;
      if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = field.rows || 3;
        input.placeholder = field.placeholder || 'Attendee names + any seating notes';
      } else if (field.type === 'checkbox') {
        input = document.createElement('input');
        input.type = 'checkbox';
      } else if (field.type === 'select') {
        input = document.createElement('select');
        let optsList = Array.isArray(field.options) ? field.options : [];
// Hard guarantee: quantity always has choices
if (field.id === 'quantity' && (!optsList || !optsList.length)) {
  optsList = ['1', '2', '3', '4', '5', '6'];
}
        const builtOptions = [];
        if (field.required || field.id === 'quantity') {
          const placeholder = document.createElement('option');
          placeholder.value = '';
          placeholder.textContent = 'Select…';
          placeholder.selected = true;
          builtOptions.push(placeholder);
        }
        optsList.forEach((opt) => {
          const o = document.createElement('option');
          if (opt && typeof opt === 'object') {
            o.value = opt.value ?? opt.label ?? '';
            o.textContent = opt.label ?? opt.value ?? '';
          } else {
            o.value = opt;
            o.textContent = opt;
          }
          builtOptions.push(o);
        });
        if (!builtOptions.length) {
          console.warn('Select rendered with no options', field.id, field);
          const none = document.createElement('option');
          none.value = '';
          none.textContent = 'No options available';
          none.disabled = true;
          none.selected = true;
          builtOptions.push(none);
        }
        builtOptions.forEach((o) => input.appendChild(o));
        if (__debug) dbg('select options built', field.id, input.options.length, optsList);
      } else {
        input = document.createElement('input');
        input.type = field.type || 'text';
      }
      input.id = `field-${field.id}`;
      input.name = field.id === 'paid' ? 'already_paid' : field.id;
      if (field.type === 'checkbox') input.value = 'yes';
      if (field.required) input.required = true;
      if (field.placeholder && field.type !== 'textarea') input.placeholder = field.placeholder;
      if (field.type === 'checkbox') {
        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${field.label}`));
        if (field.required) {
          const required = document.createElement('span');
          required.className = 'required';
          required.textContent = ' *';
          label.appendChild(required);
          input.setAttribute('aria-required', 'true');
        }
        wrapField.appendChild(label);
      } else {
        if (field.required) {
          const required = document.createElement('span');
          required.className = 'required';
          required.textContent = ' *';
          label.appendChild(required);
          input.setAttribute('aria-required', 'true');
        }
        wrapField.appendChild(input);
      }
      if (field.id === 'name') input.autocomplete = 'name';
      if (field.id === 'email') input.autocomplete = 'email';
      if (field.id === 'phone') {
        input.autocomplete = 'tel';
        input.inputMode = 'tel';
      }
      if (field.id === 'quantity') input.autocomplete = 'off';
      if (field.id === 'notes') input.autocomplete = 'off';
      if (field.id === 'phone') {
        const fieldError = document.createElement('p');
        fieldError.className = 'field-error';
        fieldError.style.display = 'none';
        wrapField.appendChild(fieldError);
        fieldErrors.phone = fieldError;
        input.addEventListener('input', () => {
          if (fieldErrors.phone) {
            fieldErrors.phone.textContent = '';
            fieldErrors.phone.style.display = 'none';
          }
        });
      }
      form.appendChild(wrapField);
    });
    const status = document.createElement('p');
    status.className = 'form-status';
    status.style.display = 'none';
    status.tabIndex = -1;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    form.appendChild(status);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'btn btn-secondary btn-small';
    const defaultLabel = submitLabel || 'Send Details';
    btn.textContent = defaultLabel;
    actions.appendChild(btn);
    form.appendChild(actions);
    const paidInput = form.querySelector('#field-paid');
    const updateSubmitState = () => {
      if (!requirePaidCheckbox || !paidInput) {
        btn.disabled = false;
        return;
      }
      btn.disabled = !paidInput.checked;
    };
    updateSubmitState();
    if (paidInput) {
      if (requirePaidCheckbox) paidInput.required = true;
      paidInput.addEventListener('change', updateSubmitState);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const setStatus = (type, message) => {
        status.textContent = message || '';
        status.classList.remove('is-success', 'is-error');
        if (type) status.classList.add(type === 'success' ? 'is-success' : 'is-error');
        status.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
        status.style.display = message ? 'block' : 'none';
        if (message) status.focus();
      };
      if (btn.dataset.submitting === 'true') return;
      const dataTokens = { ...(tokens || {}) };
      renderFields.forEach((field) => {
        const el = form.querySelector(`#field-${field.id}`);
        if (!el) return;
        let value = '';
        if (field.type === 'checkbox') {
          value = el.checked ? 'Yes' : '';
        } else {
          value = el.value || '';
        }
        dataTokens[field.id] = value;
      });
      const requiredMissing = renderFields.some((f) => f.required && !dataTokens[f.id]);
      const emailField = renderFields.find((f) => f.id === 'email');
      const emailValue = emailField ? dataTokens[emailField.id] : '';
      const emailBad = emailField && !isEmailValid(emailValue);
      const phoneEl = form.querySelector('#field-phone');
      if (phoneEl) {
        const rawPhone = String(phoneEl.value || '').trim();
        if (rawPhone) {
          const invalidChars = /[^0-9()\s+\-]/.test(rawPhone);
          const digits = rawPhone.replace(/\D/g, '');
          if (invalidChars || digits.length < 10) {
            if (fieldErrors.phone) {
              fieldErrors.phone.textContent = 'Please enter a valid phone number.';
              fieldErrors.phone.style.display = 'block';
            }
            return;
          }
        }
      }
      if (requiredMissing) {
        setStatus('error', 'Please fill all required fields.');
        return;
      }
      if (emailBad) {
        setStatus('error', 'Please enter a valid email.');
        return;
      }
      setStatus('', '');
      if (ajaxSubmit && formAction) {
        btn.dataset.submitting = 'true';
        btn.disabled = true;
        btn.textContent = 'Sending...';
        const formData = new FormData(form);
        fetch(formAction, {
          method: 'POST',
          body: formData,
          headers: { Accept: 'application/json' }
        }).then((res) => {
          if (!res.ok) throw new Error('Formspree error');
          setStatus('success', successMessage);
          form.reset();
          btn.textContent = defaultLabel;
          btn.dataset.submitting = 'false';
          updateSubmitState();
        }).catch(() => {
          setStatus('error', 'Something went wrong. Please try again.');
          btn.dataset.submitting = 'false';
          updateSubmitState();
          btn.textContent = defaultLabel;
        });
        return;
      }
      const link = buildSubmissionLink(submission, dataTokens, fallbackSubject, fallbackBody);
      if (!link || !link.url) return;
      if (link.target === '_blank') {
        window.open(link.url, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = link.url;
      }
    });

    if (opts.defaultCollapsed) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'btn btn-ghost btn-small';
      const formId = `form-${Math.random().toString(36).slice(2, 8)}`;
      form.id = formId;
      toggle.setAttribute('aria-controls', formId);
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = opts.collapseLabel || 'Send seating details';
      const container = document.createElement('div');
      container.className = wrap.className;
      container.classList.add('is-hidden');
      container.appendChild(form);
      toggle.addEventListener('click', () => {
        const isHidden = container.classList.contains('is-hidden');
        container.classList.toggle('is-hidden');
        toggle.setAttribute('aria-expanded', String(!isHidden));
        if (__debug) dbg('form toggle', { containerHidden: container.classList.contains('is-hidden'), formHidden: form.classList.contains('is-hidden') });
      });
      const outer = document.createElement('div');
      outer.appendChild(toggle);
      outer.appendChild(container);
      return outer;
    }
    wrap.appendChild(form);
    return wrap;
  }

  const state = { site: null, payments: null };
  const debugSummary = {
    menuItems: 0,
    menuPriced: 0,
    menuMissing: 0,
    menuPdf: false,
    giftMode: '',
    giftOnline: false,
    missingBySection: []
  };

  function validateSiteHours(site) {
    if (!DEBUG) return;
    const hours = site?.hours;
    if (!Array.isArray(hours)) {
      dbg('site hours schema mismatch', hours);
      return;
    }
    if (hours.length !== 7) dbg('site hours schema mismatch', { length: hours.length, hours });
    hours.forEach((row) => {
      if (!row || !row.label || row.value === undefined) {
        dbg('site hours schema mismatch', row);
      }
    });
  }

  function validateEvents(data) {
    if (!DEBUG) return;
    (data?.events || []).forEach((ev) => {
      if (!ev) return;
      if (ev.event_type !== 'ticketed' && ev.event_type !== 'rsvp') {
        dbg('event_type invalid', ev.title, ev.event_type);
      }
    });
  }

  function updateDebugSummaryDisplay() {
    if (!DEBUG) return;
    const body = document.body || document.documentElement;
    if (!body) return;
    let panel = document.getElementById('debug-summary');
    const lines = [
      `Menu items: ${debugSummary.menuItems}`,
      `Menu priced: ${debugSummary.menuPriced}`,
      `Menu PDF: ${debugSummary.menuPdf ? 'yes' : 'no'}`,
      `Gift cards: mode=${debugSummary.giftMode || 'unknown'}, onlineCTA=${debugSummary.giftOnline ? 'yes' : 'no'}`
    ];
    if (Array.isArray(debugSummary.missingBySection) && debugSummary.missingBySection.length) {
      const capped = debugSummary.missingBySection.slice(0, 10);
      lines.push(`Missing prices: ${capped.join(' | ')}`);
    }
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'debug-summary';
      body.appendChild(panel);
    }
    panel.textContent = lines.join(' · ');
  }

  async function fetchJSON(filename, fallback) {
    const url = withBase(`/data/${filename}`);
    try {
      if (DEBUG && filename === 'menu.json') dbg('fetchJSON start', { filename, url });
      const res = await fetch(url);
      if (DEBUG) dbg('fetchJSON', { filename, url, ok: res.ok, status: res.status });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = await res.json();
      if (DEBUG && filename === 'drinks.json') {
        dbg('drinks payload', { keys: Object.keys(json || {}), sectionIds: (json?.sections || []).map((s) => s.id) });
      }
      if (DEBUG && filename === 'menu.json') {
        const categories = Array.isArray(json?.categories) ? json.categories.length : 0;
        dbg('menu payload', { keys: Object.keys(json || {}), categories });
      }
      return json;
    } catch (err) {
      console.warn(`Data load error for ${filename}`, err);
      if (DEBUG && filename === 'menu.json') dbg('menu data load failed', err?.message || err);
      return fallback;
    }
  }

  const sitePromise = fetchJSON('site.json', {});

  function applyText(selector, text) {
    if (!text) return;
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = text;
    });
  }

  function setHref(selector, href) {
    if (!href) return;
    document.querySelectorAll(selector).forEach((el) => {
      el.setAttribute('href', href);
    });
  }

  function resolveImage(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') return { src: withBase(entry), alt: '' };
    const src = entry.src || entry.fallback;
    if (!src) return null;
    return { src: withBase(src), alt: entry.alt || '' };
  }

  function setImage(selector, pathOrEntry, alt) {
    const resolved = resolveImage(pathOrEntry);
    if (!resolved) return;
    document.querySelectorAll(selector).forEach((el) => {
      el.setAttribute('src', resolved.src);
      if (alt || resolved.alt) el.setAttribute('alt', alt || resolved.alt);
    });
  }

  function populateSite(site) {
    if (!site) return;
    const email = site.email ? String(site.email).trim() : '';
    applyText('[data-fill="name"]', site.name || site.shortName);
    applyText('[data-fill="tagline"]', site.tagline);
    applyText('[data-fill="hero-headline"]', site.heroHeadline);
    applyText('[data-fill="hero-subhead"]', site.heroSubhead || site.heroLede);
    applyText('[data-fill="hero-lede"]', site.heroLede || site.heroSubhead);
    applyText('[data-fill="location-short"]', site.locationShort);
    applyText('[data-fill="phone"]', site.phone);
    applyText('[data-fill="phone-link"]', site.phone);
    if (email) applyText('[data-fill="email-link"]', email);
    applyText('[data-fill="address"]', site.address?.line1 || '');
    applyText('[data-fill="city"]', `${site.address?.city || ''}, ${site.address?.state || ''} ${site.address?.zip || ''}`.trim());
    applyText('[data-fill="full-address"]', site.address?.full || '');
    if (email) applyText('[data-fill="email-text"]', email);
    const hoursFooter = site.footer?.hours_summary || site.footer?.hoursSummary || site.footerHoursSummary;
    if (hoursFooter) {
      applyText('[data-fill="hours"]', hoursFooter);
      if (DEBUG) dbg('footer hours mode', 'summary');
    } else if (site.hours?.length) {
      const hoursText = site.hours.map((h) => `${h.label} ${h.value}`).join(' · ');
      applyText('[data-fill="hours"]', hoursText);
      if (DEBUG) dbg('footer hours mode', 'full');
    }
    if (site.seasonalHoursNote) {
      applyText('[data-fill="seasonal-hours"]', site.seasonalHoursNote);
    }

    setHref('[data-fill="phone-link"]', site.phone ? `tel:${site.phone}` : null);
    setHref('[data-fill="map"]', site.mapsUrl || site.mapLink);
    setHref('[data-fill="email-link"]', email ? `mailto:${email}` : null);
    if (!email) {
      document.querySelectorAll('[data-fill="email-link"], [data-fill="email-text"]').forEach((el) => {
        const parent = el.parentElement;
        const prev = el.previousSibling;
        if (prev && prev.nodeType === Node.TEXT_NODE && prev.textContent.includes('•')) {
          prev.remove();
        }
        el.remove();
        if (parent && !parent.textContent.trim()) parent.remove();
      });
    }
    const socials = site.socials || site.social;
    setHref('[data-fill="facebook"]', socials?.facebook);
    setHref('[data-fill="instagram"]', socials?.instagram);
    if (socials) {
      const fb = socials.facebook;
      const ig = socials.instagram;
      document.querySelectorAll('footer .social').forEach((wrap) => {
        wrap.innerHTML = '';
        const icons = [];
        if (fb) {
          const a = document.createElement('a');
          a.href = fb;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.setAttribute('aria-label', 'Facebook');
          a.className = 'footer-icon';
          a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M13 10.5V8.75c0-.6.4-1 .9-1H14.9V6h-1.1c-1.8 0-3.25 1.4-3.25 3.1V10.5H9v1.8h1.55V18h2.05v-5.7h1.9l.25-1.8H12.6Z" fill="currentColor"/></svg>';
          icons.push(a);
        }
        if (ig) {
          const a = document.createElement('a');
          a.href = ig;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.setAttribute('aria-label', 'Instagram');
          a.className = 'footer-icon';
          a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm0 2A2 2 0 0 0 5 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7Zm5 3.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5Zm0 2A1.5 1.5 0 1 0 13.5 12 1.5 1.5 0 0 0 12 10.5Zm4-3.75a.75.75 0 1 1-.75.75.75.75 0 0 1 .75-.75Z" fill="currentColor"/></svg>';
          icons.push(a);
        }
        if (icons.length) {
          const holder = document.createElement('div');
          holder.className = 'footer-social-icons';
          icons.forEach((el) => holder.appendChild(el));
          wrap.appendChild(holder);
        }
        if (DEBUG) dbg('footer social icons rendered', { fb: !!fb, ig: !!ig });
      });
    }

    setHref('[data-cta="call"]', site.phone ? `tel:${site.phone}` : '#');
    setHref('[data-cta="directions"]', site.mapsUrl || site.mapLink || '#');

    if (DEBUG) {
      const from = site.heroHeadline || site.tagline ? 'site.json' : 'index.html';
      dbg('home tagline source', { from });
      dbg('home sections', { why: (site.whyBullets || []).length, testimonials: (site.trust?.quotes || []).length });
    }
  }

  function pruneFooterLinks() {
    document.querySelectorAll('footer .footer-links').forEach((wrap) => {
      wrap.querySelectorAll('a[data-nav="gallery"], a[data-nav="specials"]').forEach((a) => a.remove());
      const explore = Array.from(wrap.querySelectorAll('div')).find((div) => {
        const k = div.querySelector('.kicker');
        return k && k.textContent.toLowerCase().includes('explore');
      });
      if (explore) {
        const inline = explore.querySelector('.inline-links') || explore;
        const existingAbout = inline.querySelector('a[data-nav="about"]');
        if (!existingAbout) {
          const a = document.createElement('a');
          a.setAttribute('data-nav', 'about');
          a.textContent = 'About';
          a.href = withBase('/about/');
          inline.appendChild(a);
        }
      }
        if (DEBUG) {
          const links = Array.from(wrap.querySelectorAll('a[data-nav]')).map((a) => a.getAttribute('data-nav'));
          dbg('footer links', links);
        }
      if (DEBUG) {
        const hrefs = Array.from(wrap.querySelectorAll('a[data-nav]')).map((a) => a.href);
        const seen = new Set();
        const dups = [];
        hrefs.forEach((h) => {
          if (seen.has(h)) dups.push(h);
          else seen.add(h);
        });
        if (dups.length) dbg('Footer duplicate links detected', dups);
      }
    });
  }

  function populateWhyBullets(site) {
    if (!site?.whyBullets?.length && !site?.whyBodies?.length) {
      const section = document.querySelector('[data-section="why"]');
      if (section) section.remove();
      return;
    }
    const bullets = site.whyBullets || [];
    const bodies = site.whyBodies || bullets;
    document.querySelectorAll('[data-why]').forEach((el) => {
      const idx = Number(el.getAttribute('data-why'));
      if (!Number.isNaN(idx) && bullets[idx]) el.textContent = bullets[idx];
    });
    document.querySelectorAll('[data-why-body]').forEach((el) => {
      const idx = Number(el.getAttribute('data-why-body'));
      if (!Number.isNaN(idx) && bodies[idx]) el.textContent = bodies[idx];
    });
  }

  function populateImages(site) {
    const imgs = site?.images || {};
    setImage('[data-img="hero"]', imgs.hero || site.heroImage, site.heroHeadline || site.name);
    setImage('[data-img="interior1"]', imgs.interior1 || site.gallery?.[0], imgs.interior1?.alt || 'Dining room');
    setImage('[data-img="interior2"]', imgs.interior2 || site.gallery?.[1], imgs.interior2?.alt || 'Bar');
    setImage('[data-img="interior3"]', imgs.interior3 || site.gallery?.[2], imgs.interior3?.alt || 'Patio');
  }

  function populateTrust(site) {
    const trust = site?.trust;
    if (!trust) return;
    if (Array.isArray(trust.quotes) && !trust.quotes.length && (!trust.bullets || !trust.bullets.length)) {
      const section = document.getElementById('trust-bullets');
      if (section && section.parentElement) section.parentElement.remove();
    }
    applyText('[data-fill="trust-heading"]', trust.heading);
    const bullets = trust.bullets || [];
    document.querySelectorAll('[data-trust]').forEach((el) => {
      const idx = Number(el.getAttribute('data-trust'));
      if (!Number.isNaN(idx) && bullets[idx]) el.textContent = bullets[idx];
    });
    const review = document.getElementById('trust-review');
    if (review && trust.reviewLink) {
      review.innerHTML = `<a class="btn btn-secondary btn-small" href="${trust.reviewLink}">Read reviews</a>`;
    }
  }

  function setupAnnouncement(site) {
    const bar = document.querySelector('.announcement');
    if (!bar) return;
    const announce = site?.announcementBar || site?.announcement;
    if (announce?.enabled) {
      bar.classList.add('active');
      const link = announce.link ? withBase(announce.link) : null;
      bar.innerHTML = link ? `<a href="${link}">${announce.message}</a>` : announce.message;
      bar.querySelectorAll('a[href^="/"]').forEach((a) => {
        a.href = withBase(a.getAttribute('href'));
      });
    }
  }

  function setupNav() {
    const toggle = document.querySelector('.mobile-nav-toggle');
    const nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    const focusableSelector = 'a[href], button:not([disabled])';

    function getFocusables() {
      return nav.querySelectorAll(focusableSelector);
    }

    function closeNav({ restoreFocus = false } = {}) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', handleKey);
      if (restoreFocus) toggle.focus();
    }

    function openNav() {
      nav.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      document.addEventListener('keydown', handleKey);
      const first = nav.querySelector('a');
      if (first) first.focus();
    }

    function handleKey(event) {
      if (!nav.classList.contains('open')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeNav({ restoreFocus: true });
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = Array.from(getFocusables());
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.contains('open');
      if (isOpen) {
        closeNav();
      } else {
        openNav();
      }
    });

    document.addEventListener('click', (event) => {
      if (!nav.classList.contains('open')) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      closeNav();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth >= 960) closeNav();
    });
  }

  function renderHeader() {
    const header = document.getElementById('site-header');
    if (!header) return;
    header.innerHTML = `
      <div class="container navbar">
        <a class="logo" data-fill="name" data-nav="home">The Mockingbird on Mill Road</a>
        <button class="mobile-nav-toggle" aria-label="Toggle navigation" aria-controls="site-nav" aria-expanded="false">☰</button>
        <nav id="site-nav" class="nav-menu" aria-label="Primary">
          <ul class="nav-primary">
            <li><a data-nav="menu">Menu</a></li>
            <li><a data-nav="drinks">Drinks</a></li>
            <li><a data-nav="specials">Specials</a></li>
            <li><a data-nav="events">Events</a></li>
            <li><a data-nav="private-parties">Private Parties</a></li>
          </ul>
          <div class="nav-divider" aria-hidden="true"></div>
          <ul class="nav-secondary" aria-label="Explore">
            <li><a data-nav="wine-club">Wine Club</a></li>
            <li><a data-nav="gift-cards">Gift Cards</a></li>
            <li><a data-nav="gallery">Gallery</a></li>
            <li><a data-nav="contact">Contact</a></li>
          </ul>
          <div class="nav-call-mobile">
            <a class="btn btn-ghost btn-small" data-cta="call" aria-label="Call">Call</a>
          </div>
        </nav>
        <div class="nav-cta">
          <a class="btn btn-ghost btn-small call-desktop" data-cta="call" aria-label="Call">Call</a>
          <a class="btn btn-primary btn-small" data-cta="directions" aria-label="Get directions">Directions</a>
        </div>
      </div>
    `;
  }

  function setNavLinks() {
    document.querySelectorAll('[data-nav]').forEach((link) => {
      const target = link.getAttribute('data-nav');
      const path = target === 'home' ? '/' : `/${target}/`;
      link.setAttribute('href', withBase(path));
    });
  }

  function setupBottomBar() {
    const bar = document.querySelector('.sticky-cta-bar');
    if (!bar) return;
    const phoneLink = bar.querySelector('[data-cta="call"]');
    const directionsLink = bar.querySelector('[data-cta="directions"]');
    const menuLink = bar.querySelector('[data-cta="menu"]');
    if (menuLink) menuLink.href = withBase('/menu/');
    if (phoneLink && state.site?.phone) phoneLink.href = `tel:${state.site.phone}`;
    if (directionsLink && state.site?.mapLink) directionsLink.href = state.site.mapLink;
  }

  function setupBackToTop() {
    const btn = document.querySelector('.back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', () => {
      if (window.scrollY > 260) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    });
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function enableFadeIn() {
    const els = document.querySelectorAll('.fade-in');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    els.forEach((el) => observer.observe(el));
  }

  function renderHoursTable(site, targetId) {
    const table = document.getElementById(targetId);
    if (!table || !site?.hours) return;
    if (!site.hours.length) {
      table.innerHTML = '<tr><td colspan="2">Hours coming soon.</td></tr>';
      return;
    }
    const rows = site.hours.map((row) => `<tr><td>${row.label}</td><td>${row.value}</td></tr>`);
    table.innerHTML = rows.join('');
    if (DEBUG) dbg('hours days rendered', rows.length);
  }

  function formatMenuPriceValue(val) {
    if (val === null || val === undefined) return '';
    const formatNumber = (num) => {
      if (!Number.isFinite(num)) return '';
      return num % 1 === 0 ? `$${num.toFixed(0)}` : `$${num.toFixed(2)}`;
    };
    const parseNum = (str) => {
      const cleaned = str.replace(/\$/g, '').trim();
      const num = Number(cleaned);
      return Number.isFinite(num) ? num : null;
    };
    if (typeof val === 'number') return formatNumber(val);
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return '';
      const rangeMatch = trimmed.split(/[–-]/).map((p) => p.trim()).filter(Boolean);
      if (rangeMatch.length === 2 && rangeMatch.every((p) => /\d/.test(p))) {
        const [a, b] = rangeMatch.map((p) => parseNum(p));
        if (a !== null && b !== null) return `${formatNumber(a)}–${formatNumber(b)}`;
      }
      const slashMatch = trimmed.split('/').map((p) => p.trim()).filter(Boolean);
      if (slashMatch.length === 2 && slashMatch.every((p) => /\d/.test(p))) {
        const [a, b] = slashMatch.map((p) => parseNum(p));
        if (a !== null && b !== null) return `${formatNumber(a)} / ${formatNumber(b)}`;
      }
      const num = parseNum(trimmed);
      if (num !== null) return formatNumber(num);
      if (/^\$\d/.test(trimmed)) return trimmed;
      return '';
    }
    return '';
  }

  function formatCurrency(value) {
    if (!Number.isFinite(value)) return '—';
    return value % 1 === 0 ? `$${value.toFixed(0)}` : `$${value.toFixed(2)}`;
  }

  function getDisplayPrice(item) {
    if (!item || typeof item !== 'object') return '';
    const raw = item.price;
    const direct = formatMenuPriceValue(raw);
    if (direct) return direct;
    if (DEBUG && raw !== null && raw !== undefined) dbg('Invalid price format', { name: item.name || item.title || '(no name)', price: raw });
    const alt = item.price_display ?? item.priceDisplay;
    const altVal = formatMenuPriceValue(alt);
    if (altVal) return altVal;
    if (Array.isArray(item.prices)) {
      const joined = item.prices.map((p) => formatMenuPriceValue(p)).filter(Boolean).join(' / ');
      if (joined) return joined;
    }
    if (Array.isArray(item.variants)) {
      const variants = item.variants
        .map((v) => {
          const val = formatMenuPriceValue(v?.price);
          if (!val) return '';
          const label = v?.label || v?.name;
          return label ? `${label}: ${val}` : val;
        })
        .filter(Boolean)
        .join(' / ');
      if (variants) return variants;
    }
    if (item.size_prices && typeof item.size_prices === 'object') {
      const sizes = Object.entries(item.size_prices)
        .map(([size, val]) => {
          const clean = formatMenuPriceValue(val);
          return clean ? `${size}: ${clean}` : '';
        })
        .filter(Boolean)
        .join(' / ');
      if (sizes) return sizes;
    }
    return '';
  }

  function renderMenu(menuData) {
    const container = document.getElementById('menu-container');
    if (!container) return;
    dbg('renderMenu start', { hasData: !!menuData, categories: menuData?.categories?.length || 0 });
    const specialPlaceholders = new Set([
      'Soup of the Week',
      'Weekly Pressed Sandwich',
      'Chef’s Weekly Side',
      'Sweet Bite of the Day',
      'Hot Side of the Week',
      'Cold Side of the Week'
    ]);
    if (!menuData?.categories?.length) {
      const phone = state.site?.phone ? `tel:${state.site.phone}` : null;
      const call = phone ? `<a href="${phone}">call us</a>` : 'call us';
      container.innerHTML = `<p class="note">Menu coming soon—please ${call} for today’s offerings.</p>`;
      debugSummary.menuItems = 0;
      debugSummary.menuPriced = 0;
      updateDebugSummaryDisplay();
      dbg('renderMenu end', { rendered: false, reason: 'no categories' });
      return;
    }
    container.innerHTML = '';
    let totalItems = 0;
    let pricedItems = 0;
    const missingBySection = new Map();
    const addMissing = (sectionName) => {
      const key = sectionName || 'Uncategorized';
      missingBySection.set(key, (missingBySection.get(key) || 0) + 1);
    };
    menuData.categories.forEach((cat) => {
      const section = document.createElement('section');
      section.className = 'menu-category fade-in';
      section.innerHTML = `<div class="inline-links"><span class="kicker">${cat.name}</span>${cat.description ? `<span class="note">${cat.description}</span>` : ''}</div>`;
      const list = document.createElement('div');
      cat.items?.forEach((item) => {
        totalItems += 1;
        const priceText = getDisplayPrice(item);
        if (priceText) pricedItems += 1;
        if (!priceText) addMissing(cat.name);
        const row = document.createElement('div');
        row.className = 'menu-item';
        const tags = Array.isArray(item.tags) && item.tags.length
          ? `<div class="inline-links">${item.tags.map((t) => `<span class="badge">${t}</span>`).join('')}</div>`
          : '';
        const right = priceText ? `<span class="price note">${priceText}</span>` : '';
        row.innerHTML = `<div><h4>${item.name}</h4><p>${item.description || ''}</p>${tags}</div>${right ? `<div>${right}</div>` : ''}`;
        const specialLabel = item.specialLabel || (specialPlaceholders.has(item.name) ? item.name : null);
        if (specialLabel) {
          row.setAttribute('data-special-label', specialLabel);
          const nameEl = row.querySelector('h4');
          const descEl = row.querySelector('p');
          if (nameEl) nameEl.setAttribute('data-special-name', 'true');
          if (descEl) descEl.setAttribute('data-special-description', 'true');
        }
        list.appendChild(row);
      });
      section.appendChild(list);
      if (cat.footer) {
        const foot = document.createElement('p');
        foot.className = 'note';
        foot.textContent = cat.footer;
        section.appendChild(foot);
      }
      container.appendChild(section);
    });
    if (menuData.notes?.length) {
      const noteBlock = document.createElement('div');
      noteBlock.className = 'note';
      noteBlock.innerHTML = menuData.notes.map((n) => `<div>${n}</div>`).join('');
      container.appendChild(noteBlock);
    }
    enableFadeIn();
    debugSummary.menuItems = totalItems;
    debugSummary.menuPriced = pricedItems;
    debugSummary.menuMissing = totalItems - pricedItems;
    debugSummary.missingBySection = Array.from(missingBySection.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, v]) => `${k}: ${v}`);
    updateDebugSummaryDisplay();
    dbg('renderMenu end', { rendered: true, categories: menuData.categories.length, totalItems, pricedItems });
    if (!pricedItems) dbg('Menu items missing price fields; nothing to display');
  }

  function applySpecialsToMenu(specialsData) {
    const container = document.getElementById('menu-container');
    if (!container) return;
    const rows = container.querySelectorAll('[data-special-label]');
    if (!rows.length) return;
    const specials = new Map();
    (specialsData?.items || []).forEach((item) => {
      const key = item && item.label && String(item.label).trim();
      if (key) specials.set(key, item);
    });
    rows.forEach((row) => {
      const label = row.getAttribute('data-special-label');
      const match = label ? specials.get(label) : null;
      if (!match) return;
      const nameEl = row.querySelector('[data-special-name]');
      const descEl = row.querySelector('[data-special-description]');
      if (nameEl && match.name) nameEl.textContent = match.name;
      if (descEl && match.description) descEl.textContent = match.description;
    });
  }

  function resolveMenuPdfUrl(site) {
    const candidates = [
      site?.menu_pdf_url,
      site?.menuPdfUrl,
      site?.menuPdf,
      site?.menu_pdf,
      site?.menu?.pdf
    ].filter(Boolean);
    if (candidates.length) return withBase(candidates[0]);
    return '';
  }

  function setupMenuPdfLink(site) {
    const container = document.getElementById('menu-container');
    if (!container) return;
    const parent = container.parentElement;
    if (!parent) return;
    const url = resolveMenuPdfUrl(site);
    debugSummary.menuPdf = !!url;
    dbg('menu pdf resolved', Boolean(url), url || '');
    const existing = document.getElementById('menu-pdf');
    if (existing && !url && DEBUG) {
      dbg('Menu PDF placeholder present in markup; consider removing');
    }
    if (!url) {
      if (existing) existing.remove();
      updateDebugSummaryDisplay();
      return;
    }
    let holder = existing;
    if (!holder) {
      holder = document.createElement('div');
      holder.id = 'menu-pdf';
      holder.className = 'inline-links';
      parent.insertBefore(holder, container);
    }
    holder.innerHTML = `<a class="download" href="${url}" target="_blank" rel="noopener noreferrer">Download PDF</a>`;
    holder.hidden = false;
    updateDebugSummaryDisplay();
  }

  function formatPrices(prices) {
    if (!prices) return '';
    if (typeof prices === 'string') return prices.trim();
    if (typeof prices !== 'object') return '';
    const labels = {
      fullPour: 'Full Pour',
      bottle: 'Bottle',
      pour: 'Pour',
      pitcher: 'Pitcher',
      glass: 'Glass',
      can: 'Can'
    };
    const formatted = [];
    Object.entries(prices).forEach(([key, val]) => {
      let displayValue = '';
      if (typeof val === 'string') {
        displayValue = val.trim();
      } else if (typeof val === 'number' && Number.isFinite(val)) {
        displayValue = `$${val.toFixed(2)}`;
      }
      if (!displayValue) return;
      formatted.push(`${labels[key] || key}: ${displayValue}`);
    });
    return formatted.join(' | ');
  }

  function renderDrinks(drinks, site) {
    let container = document.getElementById('drinks-container');
    let anchors = document.getElementById('drink-anchors');
    let note = document.getElementById('drinks-note');
    const main = document.getElementById('main');
    dbg('renderDrinks start', {
      hasContainer: !!container,
      sectionCount: drinks?.sections?.length || 0,
      sectionIds: (drinks?.sections || []).map((s) => s.id),
      fnName: renderDrinks.name,
      exportedName: window.Mockingbird?.renderDrinks?.name
    });
    const ids = (drinks?.sections || []).map((s) => s.id);
    if (__debug && !ids.includes('bottled-wine')) console.warn('bottled-wine missing from runtime drinks.sections', ids, drinks);
    if (!container && main) {
      console.warn('Drinks containers missing; creating fallbacks');
      const ctaWrap = document.createElement('div');
      ctaWrap.className = 'inline-links';
      ctaWrap.id = 'drink-anchors';
      anchors = ctaWrap;
      const grid = document.createElement('div');
      grid.id = 'drinks-container';
      grid.className = 'table-grid';
      grid.style.marginTop = '20px';
      container = grid;
      const noteEl = document.createElement('p');
      noteEl.className = 'note';
      noteEl.id = 'drinks-note';
      note = noteEl;
      const inner = document.createElement('div');
      inner.className = 'container';
      inner.appendChild(ctaWrap);
      inner.appendChild(grid);
      inner.appendChild(noteEl);
      main.appendChild(inner);
    }
    if (!container) return;
    if (!drinks?.sections?.length) {
      const phone = site?.phone ? `tel:${site.phone}` : null;
      const call = phone ? `<a href="${phone}">call us</a>` : 'call us';
      container.innerHTML = `<p class="note">Drinks menu is temporarily unavailable—please ${call} for today’s list.</p>`;
      return;
    }

    if (anchors) {
      const anchorLinks = [];
      const allowedSections = new Set(['wine-flights', 'on-tap', 'beer-cans', 'bottled-wine']);
      drinks.sections.forEach((sec) => {
        if (sec.id && sec.title && allowedSections.has(sec.id)) anchorLinks.push({ id: sec.id, title: sec.title });
        (sec.subsections || []).forEach((sub) => {
          if (sub.title && sub.title.toLowerCase().startsWith('non-alcoholic')) {
            const slug = sub.id || sub.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            anchorLinks.push({ id: slug, title: sub.title });
          }
        });
      });
      anchors.innerHTML = anchorLinks
        .map((a) => `<a class="btn btn-ghost btn-small" href="#${a.id}">${a.title}</a>`)
        .join('');
    }

    const helperCopy = [
      'Flights: Flight Board (any 4) $15 · Half Pour $5 · Taste $4',
      'Notes: Flights are available only from Wine Flights (On Pour). Bottles/cans aren’t eligible. Prices reflect a 4% cash discount.'
    ];
    if (anchors && container) {
      let helper = document.getElementById('drinks-helper');
      if (!helper) {
        helper = document.createElement('div');
        helper.id = 'drinks-helper';
        helper.className = 'drinks-helper';
        anchors.insertAdjacentElement('afterend', helper);
      }
      helper.innerHTML = helperCopy.map((line) => `<p class="note">${line}</p>`).join('');
    }

    if (!drinks?.sections?.length) {
      if (container.childElementCount && __debug) dbg('renderDrinks skip clear: empty sections but content exists');
    } else {
      container.innerHTML = '';
    }
    drinks.sections.forEach((section) => {
      const secEl = document.createElement('section');
      secEl.className = 'menu-category fade-in';
      secEl.id = section.id || '';
      try {
        if (__debug && container.childElementCount > 0 && section.id === 'bottled-wine') {
          dbg('renderDrinks bottled-wine pre-append existing children', container.childElementCount);
        }
        let extraNote = '';
        if (section.id === 'bottled-wine') {
          const note = document.createElement('div');
          note.className = 'note';
          note.textContent = 'Bottled wines are not available for flights.';
          secEl.appendChild(note);
        }
        const header = document.createElement('div');
        header.className = 'inline-links';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'kicker';
        titleSpan.textContent = section.title || '';
        header.appendChild(titleSpan);
        if (section.description) {
          const descSpan = document.createElement('span');
          descSpan.className = 'note';
          descSpan.textContent = section.description;
          header.appendChild(descSpan);
        }
        secEl.appendChild(header);

        const subsections = Array.isArray(section.subsections)
          ? section.subsections
          : Array.isArray(section.items)
            ? [{ title: '', items: section.items }]
            : [];

        if (section.id === 'bottled-wine') {
          const allItems = subsections.reduce((sum, sub) => sum + ((sub.items || []).length), 0);
          dbg('bottled-wine counts', { subsections: subsections.length, items: allItems, sample: subsections[0]?.items?.[0] });
          if (__debug) secEl.style.outline = '2px dashed #999';
        }

        if (!subsections.length) {
          if (section.id === 'bottled-wine') {
            const emptyNote = document.createElement('p');
            emptyNote.className = 'note';
            emptyNote.textContent = 'Cooler list is being updated — ask your server for what’s available tonight.';
            secEl.appendChild(emptyNote);
          }
          container.appendChild(secEl);
          return;
        }

        let appendedRows = 0;
        subsections.forEach((sub) => {
          const subEl = document.createElement('div');
          subEl.className = 'card';
          if (sub.title) {
            subEl.id = sub.id || sub.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const h3 = document.createElement('h3');
            h3.textContent = sub.title;
            subEl.appendChild(h3);
          }
          const hasSubDescription = !!(sub.description && String(sub.description).trim());
          if (hasSubDescription) {
            const p = document.createElement('p');
            p.className = 'note';
            p.textContent = sub.description;
            subEl.appendChild(p);
          } else if (section.id === 'wine-flights') {
            const p = document.createElement('p');
            p.className = 'note';
            p.textContent = 'Full Pour $9 unless noted';
            subEl.appendChild(p);
          }
          const list = document.createElement('div');
          (sub.items || []).forEach((item) => {
            const priceText = formatPrices(item?.prices) || (item?.price != null ? String(item.price) : '');
            if (!item || (!item.name && !priceText)) {
              console.warn('Skipping drinks item with no name/price', item);
              return;
            }
            const row = document.createElement('div');
            row.className = 'menu-item';
            const left = document.createElement('div');
            const h4 = document.createElement('h4');
            h4.textContent = item.name || '';
            left.appendChild(h4);
            const meta = item.meta;
            if (meta) {
              const badge = document.createElement('span');
              badge.className = 'badge';
              badge.textContent = meta;
              h4.appendChild(document.createTextNode(' '));
              h4.appendChild(badge);
            }
            const p = document.createElement('p');
            p.textContent = item.description || '';
            left.appendChild(p);
            const right = document.createElement('div');
            right.className = 'note';
            right.textContent = priceText || '';
            row.appendChild(left);
            row.appendChild(right);
            list.appendChild(row);
            appendedRows += 1;
          });
          subEl.appendChild(list);
          if (sub.footer) {
            const foot = document.createElement('p');
            foot.className = 'note';
            foot.textContent = sub.footer;
            subEl.appendChild(foot);
          }
          secEl.appendChild(subEl);
        });
        if (section.id === 'bottled-wine') {
          dbg('bottled-wine rows appended', appendedRows);
          if (appendedRows === 0) {
            const fallback = document.createElement('p');
            fallback.className = 'note';
            fallback.textContent = 'Cooler list is temporarily unavailable — please ask your server for what’s available tonight.';
            secEl.appendChild(fallback);
            if (__debug) console.warn('bottled-wine rendered zero rows despite data');
          }
        }
        container.appendChild(secEl);
      } catch (err) {
        console.error('Drinks section render error', section.id, err);
        const fallback = document.createElement('p');
        fallback.className = 'note';
        fallback.textContent = 'This list is temporarily unavailable — please ask your server for tonight’s selection.';
        secEl.appendChild(fallback);
        container.appendChild(secEl);
      }
    });
    if (note) {
      note.textContent = '';
      note.style.display = 'none';
    }
    enableFadeIn();
    if (container.id === 'drinks-container') {
      const drinkSections = container.querySelectorAll('.menu-category.fade-in');
      drinkSections.forEach((el) => el.classList.add('visible'));
      const bw = container.querySelector('#bottled-wine');
      if (__debug) {
        dbg('renderDrinks appended sections', { count: container.querySelectorAll('section.menu-category').length });
        dbg('bottled-wine DOM check', {
          exists: !!bw,
          menuItems: bw ? bw.querySelectorAll('.menu-item').length : 0,
          cards: bw ? bw.querySelectorAll('.card').length : 0,
          rect: bw ? bw.getBoundingClientRect() : null,
          style: bw
            ? {
                display: getComputedStyle(bw).display,
                visibility: getComputedStyle(bw).visibility,
                opacity: getComputedStyle(bw).opacity
              }
            : null
        });
        if (bw) bw.style.outline = '2px dashed #999';
      }
    }
  }

  function renderSpecials(data) {
    const container = document.getElementById('specials-list');
    if (!container) return;
    if (!data?.items?.length) {
      const phone = state.site?.phone ? `tel:${state.site.phone}` : null;
      const call = phone ? `<a href="${phone}">please call us</a>` : 'please call us';
      container.innerHTML = `<p class="note">Specials will post soon—${call} for tonight’s menu.</p>`;
      return;
    }
    container.innerHTML = '';
    data.items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'card fade-in';
      const pillText = (item.label && String(item.label).trim()) ? item.label : 'Weekly special';
      const notes = Array.isArray(item.notes) && item.notes.length
        ? `<div class="note">${item.notes.join(' · ')}</div>`
        : '';
      card.innerHTML = `
        <div class="inline-links"><span class="badge">${pillText}</span>${item.pairing ? `<span class="badge">Pairing: ${item.pairing}</span>` : ''}</div>
        <h3>${item.name}</h3>
        <p>${item.description}</p>
        ${notes}
        ${item.price ? `<strong>${item.price}</strong>` : ''}
      `;
      container.appendChild(card);
    });
    enableFadeIn();
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function renderEvents(data, emailFallback) {
    const container = document.getElementById('events-list');
    if (!container) return;
    validateEvents(data);
    const now = new Date();
    const events = (data?.events || []).filter((ev) => new Date(ev.date) >= now);
    if (!events.length) {
      container.innerHTML = '<p class="note">New events coming soon.</p>';
      return;
    }
    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    container.innerHTML = '';
    events.forEach((ev) => {
      const card = document.createElement('div');
      card.className = 'card fade-in';

      let img = '';
      if (ev.image_url) {
        const src = withBase(ev.image_url);
        const alt = ev.image_alt || '';
        img = `<div class="event-thumb"><img src="${src}" alt="${alt}" loading="lazy" onerror="this.parentElement.remove();"></div>`;
      }

      const ticketing = ev.ticketing;
      const remaining = ticketing ? ticketsRemaining(ticketing) : null;
      const soldOut = ticketing ? remaining === 0 : false;
      const capacityDisplayMode = ev.capacity_display || 'default';
      dbg('capacity display', { title: ev.title, mode: capacityDisplayMode });
      const availabilityLabel = soldOut
        ? 'Sold out'
        : (capacityDisplayMode === 'limited' ? 'Limited seating available' : `${remaining} remaining`);
      const availabilityBadge = ticketing
        ? `<span class="badge">${availabilityLabel}</span>`
        : '';
      const priceBadge = (ticketing && ticketing.price_display) ? `<span class="badge">${ticketing.price_display}</span>` : (ev.price ? `<span class="badge">${ev.price}</span>` : '');
      const typeBadge = ev.type ? `<span class="badge badge-soft">${ev.type}</span>` : '';
      const eventTypeBadge = ev.event_type === 'ticketed'
        ? '<span class="badge badge-soft">Ticketed Event</span>'
        : ev.event_type === 'rsvp'
          ? '<span class="badge badge-soft">RSVP</span>'
          : '';
      const isTicketed = ev.event_type === 'ticketed';
      const paymentOverride = !!(ev.payment_url && ev.payment_label);
      const paymentProvider = ev.payment_provider || (paymentOverride ? 'vendor' : 'clover');
      const isVendorPayment = paymentProvider === 'vendor' || paymentProvider === 'venmo';
      if (DEBUG && ev.payment_provider && !['vendor', 'clover', 'venmo'].includes(ev.payment_provider)) {
        dbg('event payment provider unknown', { title: ev.title, provider: ev.payment_provider });
      }
      const paymentMethodLabel = isVendorPayment
        ? ((ev.payment_label || '').replace(/^pay\s+via\s+/i, '').trim() || (paymentProvider === 'venmo' ? 'Venmo' : 'Vendor'))
        : 'Clover';
      const paymentMethodDetail = isVendorPayment && ev.vendor_name
        ? `${paymentMethodLabel} (${ev.vendor_name})`
        : '';
      if (DEBUG && ev.event_type) dbg('render event_type', ev.title, ev.event_type);
      dbg('event payment override', { title: ev.title, payment_provider: ev.payment_provider, payment_url: ev.payment_url });
      dbg('vendor payment ux', { title: ev.title, sold_out_override: !!ev.sold_out_override });

      let button = '';
      const providerKey = ev.payment_provider || (paymentOverride ? 'vendor' : 'clover');
      const paymentUrl = paymentOverride ? ev.payment_url : ticketing?.clover_payment_url;
      const paymentLabel = paymentOverride ? ev.payment_label : 'Pay on Clover';
      const helperProvider = providerKey === 'vendor' && /venmo/i.test(`${paymentLabel} ${paymentUrl || ''}`) ? 'venmo' : providerKey;
      const paymentHelperOverride = typeof ev.payment_helper === 'string' ? ev.payment_helper.trim() : '';
      const paymentHelperDefault = helperProvider === 'clover'
        ? 'You’ll complete payment securely via Clover.'
        : helperProvider === 'venmo'
          ? 'You’ll complete payment via Venmo.'
          : 'You’ll complete payment on the vendor’s ticketing page.';
      const paymentHelper = paymentHelperOverride || paymentHelperDefault;
      const linkValid = ticketing && isValidPaymentLink(paymentUrl, ticketing.isPlaceholder);
      const soldOutOverride = ev.sold_out_override === true;
      const paymentEnabled = ticketing && !soldOut && !soldOutOverride && linkValid;
      if (paymentEnabled) {
        if (paymentOverride) {
          const paymentAttrs = providerKey === 'vendor' || providerKey === 'venmo'
            ? ' target="_blank" rel="noopener noreferrer"'
            : '';
          button = `<a class="btn btn-primary btn-small" href="${paymentUrl}"${paymentAttrs}>${paymentLabel}</a>`;
        } else {
          button = `<a class="btn btn-primary btn-small" href="${paymentUrl}" target="_blank" rel="noopener noreferrer">${paymentLabel}</a>`;
        }
      }
      let vendorPaymentDetails = '';
      if (isVendorPayment && paymentEnabled) {
        const vendorLines = [];
        const vendorPaymentCopy = typeof ev.vendor_payment_copy === 'string' ? ev.vendor_payment_copy.trim() : '';
        const vendorLinkHint = typeof ev.vendor_link_hint === 'string' ? ev.vendor_link_hint.trim() : '';
        const vendorNoteLabel = typeof ev.vendor_note_label === 'string' ? ev.vendor_note_label.trim() : '';
        const vendorNoteValue = typeof ev.vendor_note_value === 'string' ? ev.vendor_note_value.trim() : '';
        const vendorPostPaymentCopy = typeof ev.vendor_post_payment_copy === 'string' ? ev.vendor_post_payment_copy.trim() : '';
        if (vendorPaymentCopy) {
          vendorLines.push(`<p class="note event-help">${vendorPaymentCopy}</p>`);
        }
        if (vendorLinkHint) {
          vendorLines.push(`<p class="note event-help">${vendorLinkHint}</p>`);
        }
        if (vendorNoteLabel && vendorNoteValue) {
          vendorLines.push(`<p class="note event-help"><strong>${vendorNoteLabel}:</strong> ${vendorNoteValue}</p>`);
        }
        if (vendorPostPaymentCopy) {
          vendorLines.push(`<p class="event-info">${vendorPostPaymentCopy}</p>`);
        }
        vendorPaymentDetails = vendorLines.join('');
      }
      const soldOutOverrideNotice = soldOutOverride
        ? '<p class="note event-info">Tickets currently unavailable — please check back or contact us.</p>'
        : '';
      let ticketCopy = '';
      if (ticketing && !linkValid) {
        ticketCopy = '<p class="note">Ticket link coming soon.</p>';
      }
      const paymentHelperLine = (paymentEnabled && !ev.hide_ticketed_helper && paymentHelper)
        ? `<p class="note event-help">${paymentHelper}</p>`
        : '';
      const lowInventory = ticketing && remaining > 0 && remaining <= 5;
      card.innerHTML = `
        ${img}
        <div class="inline-links"><span class="badge">${formatDate(ev.date)}</span>${priceBadge}${availabilityBadge}${typeBadge}${eventTypeBadge}</div>
        <h3>${ev.title}</h3>
        <p>${ev.description}</p>
        ${ticketing?.policy ? `<p class="note">${ticketing.policy}</p>` : ''}
        ${ticketing ? `
        <div class="event-payment">
          <h4 class="event-section-title">Pay for tickets</h4>
          <div class="form-actions">
            ${button || ''}
          </div>
          ${paymentHelperLine}
          ${vendorPaymentDetails}
          ${soldOutOverrideNotice}
          ${ticketCopy}
        </div>` : ''}
        ${lowInventory ? '<p class="note">Limited tickets remain. Availability isn’t held until payment completes.</p>' : ''}
      `;

      const shouldShowSeatingForm = isTicketed && (ticketing?.intake || ev.seating_form?.enabled === true);
      if (shouldShowSeatingForm) {
        dbg('seating form render', { title: ev.title, provider: ev.payment_provider, enabled: !!ev.seating_form?.enabled });
        const seatingIntake = ticketing?.intake || {
          required_fields: ['name', 'email', 'phone', 'quantity', 'notes'],
          submission: { method: 'mailto', to: '{{site_contact_email}}' }
        };
        const tokens = {
          event_title: ev.title || '',
          event_date: formatDate(ev.date),
          event_price: ticketing?.price_display || ev.price || '',
          site_contact_email: state.site?.email || emailFallback || '',
          payment_method: paymentMethodDetail || paymentMethodLabel
        };
        const fields = seatingIntake.required_fields || [];
        const paymentMethodLine = paymentMethodDetail ? `Payment method: ${paymentMethodDetail}\n` : '';
        const paidLineLabel = isVendorPayment ? `Paid via ${paymentMethodLabel}` : 'Paid';
        const fallbackBody = `Event: ${tokens.event_title}\nDate: ${tokens.event_date}\nName: {{name}}\nEmail: {{email}}\nPhone: {{phone}}\nQuantity: {{quantity}}\nNotes: {{notes}}\n${paymentMethodLine}${paidLineLabel}: {{paid}}\n`;
        const paidLabel = 'I’ve already paid';
        dbg('seating paid label', { title: ev.title, label: paidLabel });
        const requirePaidCheckbox = ev.seating_form?.require_paid_checkbox !== false;
        const seatingSuccessMessage = ev.seating_form?.success_message || '';
        dbg('seating form copy', { title: ev.title, provider: ev.payment_provider || 'default' });
        const form = createForm(
          fields,
          seatingIntake.submission,
          tokens,
          'Send Details',
          seatingIntake.instructions,
          seatingIntake.submission?.subject_template || 'Event Details – {{event_title}} – {{event_date}}',
          fallbackBody,
          'event_ticketed',
          {
            defaultCollapsed: true,
            collapseLabel: 'Open seating form',
            compact: true,
            paidLabel,
            introNote: '',
            subnote: '',
            preFieldsNote: undefined,
            ajax: true,
            action: 'https://formspree.io/f/xbddjoek',
            formClass: 'seating-form',
            requirePaidCheckbox,
            successMessage: seatingSuccessMessage,
            hiddenFields: {
              event_title: ev.title || '',
              event_date_display: formatDate(ev.date),
              event_datetime_iso: ev.date || '',
              payment_method: paymentMethodDetail || paymentMethodLabel,
              payment_url: paymentUrl || ''
            }
          }
        );
        if (form) {
          const seatingBlock = document.createElement('div');
          seatingBlock.className = 'event-seating';
          seatingBlock.innerHTML = `
            <h4 class="event-section-title">Send seating details</h4>
            <p class="note event-help">This form completes your reservation.</p>
            <p class="note event-help">Payment is handled separately above.</p>
          `;
          seatingBlock.appendChild(form);
          card.appendChild(seatingBlock);
        }
      }

      container.appendChild(card);
    });
    enableFadeIn();
  }

  function renderFeaturedItems(site, menuData) {
    const container = document.getElementById('featured-items');
    if (!container) return;
    let source = 'none';
    let items = Array.isArray(site?.featuredItems) ? site.featuredItems.slice(0, 4) : [];
    if ((!items || !items.length) && menuData?.categories?.length) {
      const featuredMenu = [];
      menuData.categories.forEach((cat) => {
        (cat.items || []).forEach((item) => {
          if (item.featured) featuredMenu.push(item);
        });
      });
      items = featuredMenu.slice(0, 4);
      source = items.length ? 'menu-featured' : source;
    } else if (items && items.length) {
      source = 'site.json';
    }
    if ((!items || !items.length) && menuData?.categories?.length) {
      const collected = [];
      menuData.categories.slice(0, 2).forEach((cat) => {
        (cat.items || []).forEach((item) => {
          if (collected.length < 4) collected.push(item);
        });
      });
      items = collected;
      source = items.length ? 'menu-derived' : source;
    }
    if (DEBUG) dbg('home featured source', source || 'none');
    if (!items || !items.length) {
      container.innerHTML = '<p class="note">Featured items will be posted soon.</p>';
      return;
    }
    container.innerHTML = '';
    items.slice(0, 4).forEach((item) => {
      const price = getDisplayPrice(item);
      if (DEBUG) dbg('featured price match', item?.name || item?.title || '(no name)', price || 'none');
      const card = document.createElement('div');
      card.className = 'card fade-in';
      card.innerHTML = `<h3>${item.name}</h3><p>${item.description || ''}</p>${price ? `<strong>${price}</strong>` : ''}`;
      container.appendChild(card);
    });
    enableFadeIn();
  }

  function renderSpecialsPreview(data) {
    const container = document.getElementById('specials-preview');
    if (!container) return;
    if (!data?.items?.length) {
      container.innerHTML = '<p class="note">Specials will be posted soon.</p>';
      return;
    }
    container.innerHTML = '';
    data.items.slice(0, 2).forEach((item) => {
      const card = document.createElement('div');
      card.className = 'card fade-in';
      card.innerHTML = `<h4>${item.name}</h4><p>${item.description}</p>${item.pairing ? `<span class="badge">${item.pairing}</span>` : ''}`;
      container.appendChild(card);
    });
    enableFadeIn();
  }

  function renderEventsPreview(data) {
    const container = document.getElementById('events-preview');
    if (!container) return;
    const now = new Date();
    const events = (data?.events || []).filter((ev) => new Date(ev.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (!events.length) {
      container.innerHTML = '<p class="note">Events will be posted soon.</p>';
      return;
    }
    container.innerHTML = '';
    events.slice(0, 3).forEach((ev) => {
      const card = document.createElement('div');
      card.className = 'card fade-in';
      card.innerHTML = `<div class="badge">${formatDate(ev.date)}</div><h4>${ev.title}</h4><p>${ev.description}</p>`;
      container.appendChild(card);
    });
    enableFadeIn();
  }

  function renderGallery(site) {
    const container = document.getElementById('gallery-grid');
    if (!container || !site) return;
    const images = site.images?.gallery || [];
    if (!images.length) {
      container.innerHTML = '<p class="note">Photos coming soon.</p>';
      return;
    }
    container.innerHTML = '';
    images.forEach((img) => {
      const resolved = resolveImage(img);
      if (!resolved) return;
      const item = document.createElement('div');
      item.innerHTML = `<img src="${resolved.src}" alt="${img.alt || resolved.alt || site.name}" loading="lazy" width="1200" height="800">`;
      container.appendChild(item);
    });
  }

  function renderGiftCards(payments) {
    const container = document.getElementById('giftcard-options');
    if (!container) return;
    state.payments = payments || state.payments;
    const giftData = payments?.giftCards || payments?.gift_cards || payments?.payments?.gift_cards;
    if (!giftData) {
      container.innerHTML = '<p class="note">Gift card info coming soon.</p>';
      debugSummary.giftMode = 'missing';
      debugSummary.giftOnline = false;
      updateDebugSummaryDisplay();
      return;
    }
    const sitePhone = state.site?.phone ? `tel:${state.site.phone}` : '';
    const siteEmail = state.site?.email ? `mailto:${state.site.email}` : '';
    const resolveGiftCardLink = (entry) => {
      const link =
        entry?.clover_payment_url ||
        entry?.cloverPaymentUrl ||
        entry?.online_url ||
        entry?.onlineUrl ||
        entry?.url ||
        entry?.payment_link_url ||
        entry?.payment_link ||
        entry?.paymentLink ||
        entry?.link;
      if (!link) return '';
      if (!/^https?:\/\//i.test(link)) {
        if (DEBUG) dbg('gift card link non-http', link);
        return '';
      }
      return isValidPaymentLink(link, entry?.isPlaceholder) ? link : '';
    };
    // New structure: in-person call to action
    if (!Array.isArray(giftData) && giftData.mode === 'in_person') {
      debugSummary.giftMode = 'in_person';
      const onlineUrl = resolveGiftCardLink(giftData);
      debugSummary.giftOnline = !!onlineUrl;
      dbg('gift cards mode', 'in_person', 'onlineCta', Boolean(onlineUrl));
      if (!onlineUrl) dbg('No gift card payment link found; online CTA hidden');
      const phoneHref = giftData.cta_url || sitePhone || '';
      const actions = [];
      if (phoneHref) actions.push(`<a class="btn btn-primary" href="${phoneHref}">${giftData.cta_label || 'Call to purchase'}</a>`);
      if (onlineUrl) actions.push(`<a class="btn btn-secondary" href="${onlineUrl}" target="_blank" rel="noopener noreferrer">Buy Gift Card Online</a>`);
      if (!onlineUrl && siteEmail) actions.push(`<a class="btn btn-ghost" href="${siteEmail}">Email us</a>`);
      container.innerHTML = `<div class="card fade-in"><h3>${giftData.title || 'Gift Cards'}</h3><p>Pick up a physical card at the bar or call to load one for dinner, drinks, specials, or events.</p><p class="note">Redeem at Mockingbird when you visit. Custom amounts available when you call or email.</p>${actions.length ? `<div class="inline-links">${actions.join('')}</div>` : ''}</div>`;
      enableFadeIn();
      updateDebugSummaryDisplay();
      return;
    }
    const list = Array.isArray(giftData) ? giftData : [];
    if (!list.length) {
      container.innerHTML = '<p class="note">Gift card purchasing is temporarily unavailable.</p>';
      debugSummary.giftMode = Array.isArray(giftData) ? 'list-empty' : (giftData.mode || 'unknown');
      debugSummary.giftOnline = false;
      updateDebugSummaryDisplay();
      return;
    }
    container.innerHTML = '';
    let actionableCount = 0;
    list.forEach((item) => {
      const actionable = item.url && !isPlaceholderUrl(item.url, item.isPlaceholder);
      if (actionable) actionableCount += 1;
      const card = document.createElement('div');
      card.className = 'card fade-in';
      const action = actionable
        ? `<a class="btn btn-primary" href="${item.url}" target="_blank" rel="noopener noreferrer">Buy ${item.label || `$${item.amount}`}</a>`
        : `<button class="btn btn-secondary" type="button" disabled>Coming soon</button>`;
      card.innerHTML = `<h3>${item.label || `$${item.amount} Gift Card`}</h3><p>Digital delivery via Clover checkout.</p>${action}`;
      container.appendChild(card);
    });
    debugSummary.giftMode = 'list';
    debugSummary.giftOnline = actionableCount > 0;
    dbg('gift cards mode', 'list', 'onlineCta', actionableCount > 0);
    dbg('Gift card link detection', { mode: 'list', total: list.length, actionable: actionableCount });
    if (payments.policies?.giftCards) {
      const policy = document.createElement('p');
      policy.className = 'note';
      policy.textContent = payments.policies.giftCards;
      container.appendChild(policy);
    }
    enableFadeIn();
    updateDebugSummaryDisplay();
  }

  function renderDeposits(payments, site) {
    const container = document.getElementById('deposit-options');
    if (!container) return;
    const deposit = payments?.private_event_deposit || payments?.payments?.private_event_deposit;
    if (!deposit) {
      container.innerHTML = '<p class="note">Online deposits are temporarily unavailable—please call us.</p>';
      return;
    }
    const actionable = isValidPaymentLink(deposit.clover_payment_url, deposit.isPlaceholder);
    container.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'card fade-in';
    const ctaLabel = deposit.cta_label || 'Pay deposit';
    const action = actionable
      ? `<a class="btn btn-primary btn-small" href="${deposit.clover_payment_url}" target="_blank" rel="noopener noreferrer">${ctaLabel}</a>`
      : `<button class="btn btn-secondary btn-small" type="button" disabled>Link coming soon</button>`;
    card.innerHTML = `<h3>${deposit.title || 'Reservation Deposit'}</h3><p>${deposit.description || ''}</p><p><strong>${deposit.amount_display || ''}</strong></p>${action}${deposit.policy ? `<p class="note">${deposit.policy}</p>` : ''}`;
    if (deposit.intake) {
      const fieldMap = {
        name: { id: 'name', label: 'Name', type: 'text', required: true },
        email: { id: 'email', label: 'Email', type: 'email', required: true },
        phone: { id: 'phone', label: 'Phone', type: 'tel', required: false },
        date: { id: 'date', label: 'Preferred date', type: 'date', required: false },
        notes: { id: 'notes', label: 'Notes', type: 'textarea', required: false }
      };
      const fields = (deposit.intake.required_fields || []).map((f) => fieldMap[f]).filter(Boolean);
      const tokens = { site_contact_email: site?.email || '' };
      const fallbackBody = `Name: {{name}}\nEmail: {{email}}\nPhone: {{phone}}\nPreferred date: {{date}}\nNotes: {{notes}}\nPaid: {{paid}}\n`;
      const form = createForm(
        fields,
        deposit.intake.submission,
        tokens,
        'Send Details',
        deposit.intake.instructions,
        deposit.intake.submission?.subject_template || 'Private Event Request – {{date}} – {{name}}',
        fallbackBody,
        'deposit',
        { compact: true }
      );
      if (form) card.appendChild(form);
    }
    container.appendChild(card);
    enableFadeIn();
  }

  function renderReserveDateDeposit(payments) {
    const card = document.getElementById('reserve-deposit-card');
    if (!card) return;
    const amountEl = card.querySelector('[data-reserve-deposit="amount"]');
    const balanceEl = card.querySelector('[data-reserve-deposit="balance"]');
    const cta = card.querySelector('[data-reserve-deposit="cta"]');
    const deposit = payments?.private_event_deposit || payments?.payments?.private_event_deposit;
    if (!deposit) {
      card.innerHTML = '<p class="note">Deposit information is temporarily unavailable.</p>';
      return;
    }
    if (amountEl && deposit.amount_display) amountEl.textContent = deposit.amount_display;
    if (balanceEl) {
      const balance = deposit.balance_due_day_of_event;
      if (typeof balance === 'number' && Number.isFinite(balance)) {
        balanceEl.textContent = formatCurrency(balance);
      } else if (typeof balance === 'string' && balance.trim()) {
        balanceEl.textContent = balance;
      }
    }
    if (cta) {
      const ctaLabel = deposit.cta_label || 'Pay deposit';
      const linkValid = isValidPaymentLink(deposit.clover_payment_url, deposit.isPlaceholder);
      cta.textContent = ctaLabel;
      if (linkValid) {
        cta.href = deposit.clover_payment_url;
      } else {
        cta.href = '#';
        cta.setAttribute('aria-disabled', 'true');
        cta.addEventListener('click', (event) => event.preventDefault());
      }
    }
  }

  function renderPrivateEventMenu(privateData, pricingModule) {
    const builder = document.getElementById('private-menu-builder');
    if (!builder) return;
    const menuTypes = builder.querySelector('[data-private-menu="types"]');
    const menuSections = builder.querySelector('[data-private-menu="sections"]');
    const menuAddons = builder.querySelector('[data-private-menu="addons"]');
    const guestInput = builder.querySelector('#private-guest-count');
    const estimateEl = builder.querySelector('[data-private-menu="estimate"]');
    const estimateFixed = builder.querySelector('[data-private-menu="estimate-fixed"]');
    const estimatePerGuest = builder.querySelector('[data-private-menu="estimate-perguest"]');
    const summaryField = document.getElementById('party-menu-summary');
    if (!menuTypes || !menuSections || !guestInput || !estimateEl) return;

    const rawMenus = Array.isArray(privateData?.menus) ? privateData.menus : [];
    const rawAddons = Array.isArray(privateData?.beverage_addons) ? privateData.beverage_addons : [];
    const menus = pricingModule?.applyPricing ? pricingModule.applyPricing(rawMenus) : rawMenus;
    const beverageAddons = rawAddons;
    if (!menus.length) {
      builder.innerHTML = '<p class="note">Menu selections are coming soon.</p>';
      return;
    }

    function normalizeMenuItem(item, menuId, sectionTitle) {
      const raw = typeof item === 'string' ? { name: item } : item;
      if (!raw || typeof raw !== 'object') return null;
      const name = raw.name || raw.label || raw.title;
      if (!name) return null;
      const fixedPrice = Number.isFinite(Number(raw.fixed_price)) ? Number(raw.fixed_price) : null;
      const perPerson = Number.isFinite(Number(raw.per_person_price)) ? Number(raw.per_person_price) : null;
      const cogsPerPerson = Number.isFinite(Number(raw.cogs_per_person))
        ? Number(raw.cogs_per_person)
        : (Number.isFinite(Number(raw.ingredient_cost_per_serving)) ? Number(raw.ingredient_cost_per_serving) : null);
      const cogsPerBatch = Number.isFinite(Number(raw.cogs_per_batch)) ? Number(raw.cogs_per_batch) : null;
      const servingsPerBatch = Number.isFinite(Number(raw.servings_per_batch)) ? Number(raw.servings_per_batch) : null;
      const allowQuantity = raw.allow_quantity === true;
      const maxQty = Number.isFinite(Number(raw.max_qty)) ? Number(raw.max_qty) : null;
      const pricingType = raw.pricing_type || raw.pricingType || (Number.isFinite(fixedPrice) ? 'fixed' : 'per_person');
      const normalized = {
        name: String(name),
        fixedPrice,
        perPerson,
        cogsPerPerson,
        cogsPerBatch,
        servingsPerBatch,
        pricingType,
        sectionTitle: sectionTitle || '',
        allowQuantity,
        maxQty
      };
      return normalized;
    }

    const normalizedMenus = menus.map((menu) => ({
      ...menu,
      sections: (menu.sections || []).map((section) => ({
        ...section,
        items: (section.items || [])
          .map((item) => normalizeMenuItem(item, menu.id, section.title))
          .filter(Boolean)
      }))
    }));

    const menuById = new Map(normalizedMenus.map((menu) => [menu.id, menu]));
    const selectionsByMenu = new Map();
    const addonSelections = new Map();
    let currentMenuId = normalizedMenus[0].id;

    function getPerPersonPrice(item) {
      if (Number.isFinite(item.perPerson)) return { value: item.perPerson };
      dbg('missing item pricing', { name: item.name, menuType: currentMenuId });
      return { value: 0 };
    }

    function getSelectionMap() {
      if (!selectionsByMenu.has(currentMenuId)) selectionsByMenu.set(currentMenuId, new Map());
      return selectionsByMenu.get(currentMenuId);
    }

    function getAddonSelectionMap() {
      return addonSelections;
    }

    function getOrderedSelections(menu, selectionMap) {
      if (!menu?.sections?.length || !selectionMap?.size) return [];
      const ordered = [];
      menu.sections.forEach((section) => {
        (section.items || []).forEach((item) => {
          const qty = selectionMap.get(item.name) || 0;
          if (item && qty > 0) ordered.push({ ...item, qty });
        });
      });
      return ordered;
    }

    function getSectionSelections(menu, selectionMap) {
      const grouped = [];
      if (!menu?.sections?.length || !selectionMap?.size) return grouped;
      menu.sections.forEach((section) => {
        const matches = (section.items || []).filter((item) => {
          const qty = selectionMap.get(item.name) || 0;
          return item && qty > 0;
        }).map((item) => ({ ...item, qty: selectionMap.get(item.name) || 0 }));
        if (!matches.length) return;
        grouped.push({ title: section.title || 'Selections', items: matches });
      });
      return grouped;
    }

    function getAddonSelections(selectionMap) {
      return (beverageAddons || []).map((addon) => {
        const qty = selectionMap.get(addon.id) || 0;
        return qty > 0 ? { ...addon, qty } : null;
      }).filter(Boolean);
    }

    function normalizeGuestCount() {
      const min = Number(guestInput.min) || 10;
      const parsed = parseInt(guestInput.value, 10);
      if (!Number.isFinite(parsed)) return min;
      return Math.max(min, parsed);
    }

    function updateSummary(menuLabel, guestCount, groupedSelections, addonSelectionsList, fixedTotal, perGuest, estimate) {
      if (!summaryField) return;
      const lines = [
        'Menu selection (estimate only)',
        `Menu type: ${menuLabel || ''}`,
        `Guests: ${guestCount}`,
        '',
        'Selections:'
      ];
      if (groupedSelections.length) {
        groupedSelections.forEach((group) => {
          lines.push(`${group.title}:`);
          group.items.forEach((item) => {
            const priceParts = [];
            if (Number.isFinite(item.fixedPrice)) {
              priceParts.push(`${formatCurrency(item.fixedPrice)} each`);
            } else {
              const perPersonInfo = getPerPersonPrice(item);
              if (perPersonInfo.value) priceParts.push(`${formatCurrency(perPersonInfo.value)}/guest`);
            }
            const priceLabel = priceParts.length ? ` (${priceParts.join(', ')})` : '';
            const qtyTag = item.qty > 1 ? ` x${item.qty}` : '';
            lines.push(`- ${item.name}${qtyTag}${priceLabel}`);
          });
        });
      } else {
        lines.push('- None selected');
      }
      if (addonSelectionsList.length) {
        lines.push('', 'Beverage add-ons:');
        addonSelectionsList.forEach((addon) => {
          const qtyTag = addon.qty > 1 ? ` x${addon.qty}` : '';
          const priceBits = [];
          if (Number.isFinite(Number(addon.fixed_price))) priceBits.push(`${formatCurrency(addon.fixed_price)} each`);
          if (Number.isFinite(Number(addon.per_person_price))) priceBits.push(`~${formatCurrency(addon.per_person_price)}/guest`);
          const priceLabel = priceBits.length ? ` (${priceBits.join(', ')})` : '';
          lines.push(`- ${addon.label || addon.name || addon.id}${qtyTag}${priceLabel}`);
        });
      }
      lines.push('');
      lines.push('Estimate breakdown:');
      if (fixedTotal > 0) lines.push(`Boards/Stations: ${formatCurrency(fixedTotal)}`);
      if (perGuest > 0) lines.push(`Per-guest subtotal: ~${formatCurrency(perGuest)} x ${guestCount} = ${formatCurrency(perGuest * guestCount)}`);
      lines.push(`Estimated food total: ~${formatCurrency(estimate)}`);
      summaryField.value = lines.join('\n');
    }

    function updateEstimate() {
      const menu = menuById.get(currentMenuId);
      const menuLabel = menu?.label || currentMenuId;
      const guestCount = normalizeGuestCount();
      const selectionMap = getSelectionMap();
      const selectedItems = getOrderedSelections(menu, selectionMap);
      const addonSelectionMap = getAddonSelectionMap();
      const selectedAddons = getAddonSelections(addonSelectionMap);
      let combinedFixedTotal = 0;
      let combinedPerPerson = 0;
      let estimateTotal = 0;
      let foodCostTotal = 0;
      if (pricingModule?.computeEstimate) {
        const estimate = pricingModule.computeEstimate({
          guestCount,
          selections: selectedItems,
          addons: selectedAddons
        });
        combinedFixedTotal = estimate.fixedSellTotal || 0;
        combinedPerPerson = estimate.perPersonSellTotal || 0;
        estimateTotal = estimate.sellTotal || 0;
        foodCostTotal = estimate.foodCostTotal || 0;
      } else {
        const fixedTotal = selectedItems.reduce((sum, item) => (
          Number.isFinite(item.fixedPrice) ? sum + (item.fixedPrice * (item.qty || 1)) : sum
        ), 0);
        const fixedAddonTotal = selectedAddons.reduce((sum, addon) => {
          const price = Number(addon.fixed_price);
          if (!Number.isFinite(price)) return sum;
          return sum + (price * (addon.qty || 1));
        }, 0);
        const perPersonTotal = selectedItems.reduce((sum, item) => {
          if (Number.isFinite(item.fixedPrice)) return sum;
          const perPersonInfo = getPerPersonPrice(item);
          const qty = item.qty || 1;
          return sum + (Number.isFinite(perPersonInfo.value) ? perPersonInfo.value * qty : 0);
        }, 0);
        const perPersonAddonTotal = selectedAddons.reduce((sum, addon) => {
          const price = Number(addon.per_person_price);
          if (!Number.isFinite(price)) return sum;
          const qty = addon.qty || 1;
          return sum + (price * qty);
        }, 0);
        combinedFixedTotal = fixedTotal + fixedAddonTotal;
        combinedPerPerson = perPersonTotal + perPersonAddonTotal;
        estimateTotal = combinedFixedTotal + (guestCount * combinedPerPerson);
      }
      estimateEl.textContent = `Estimated food total: ${formatCurrency(estimateTotal)}`;
      if (estimateFixed) {
        estimateFixed.textContent = combinedFixedTotal > 0
          ? `Boards/stations: ${formatCurrency(combinedFixedTotal)}`
          : '';
      }
      if (estimatePerGuest) {
        estimatePerGuest.textContent = combinedPerPerson > 0
          ? `Selections: ~${formatCurrency(combinedPerPerson)} per guest × ${guestCount} = ${formatCurrency(combinedPerPerson * guestCount)}`
          : '';
      }
      const groupedSelections = getSectionSelections(menu, selectionMap);
      updateSummary(menuLabel, guestCount, groupedSelections, selectedAddons, combinedFixedTotal, combinedPerPerson, estimateTotal);
      const quantities = {};
      selectionMap.forEach((qty, name) => {
        if (qty > 0) quantities[name] = qty;
      });
      addonSelectionMap.forEach((qty, id) => {
        if (qty > 0) quantities[`addon:${id}`] = qty;
      });
      dbg('event estimate qty', {
        guestCount,
        selectedCount: selectedItems.length,
        fixedTotal: combinedFixedTotal,
        perPersonSubtotal: combinedPerPerson,
        estimateTotal,
        foodCostTotal,
        quantities
      });
    }

    function renderMenuTypes() {
      menuTypes.innerHTML = '';
      menus.forEach((menu) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-secondary btn-small menu-toggle';
        const selected = menu.id === currentMenuId;
        btn.classList.toggle('is-selected', selected);
        btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
        btn.dataset.menuId = menu.id;
        btn.textContent = menu.label || menu.id;
        btn.addEventListener('click', () => {
          if (menu.id === currentMenuId) return;
          currentMenuId = menu.id;
          renderMenuTypes();
          renderMenuSections();
          updateEstimate();
        });
        menuTypes.appendChild(btn);
      });
    }

    function renderMenuSections() {
      menuSections.innerHTML = '';
      const menu = menuById.get(currentMenuId);
      if (!menu?.sections?.length) return;
      const selectionMap = getSelectionMap();
      menu.sections.forEach((section) => {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'menu-builder-section';
        if (section.title) {
          const title = document.createElement('h3');
          title.textContent = section.title;
          sectionEl.appendChild(title);
        }
        const itemsWrap = document.createElement('div');
        itemsWrap.className = 'menu-builder-buttons';
        (section.items || []).forEach((item) => {
          const name = item?.name;
          if (!name) return;
          if (item.allowQuantity) {
            const control = document.createElement('div');
            control.className = 'qty-control';
            const label = document.createElement('button');
            label.type = 'button';
            label.className = 'btn btn-ghost btn-small';
            label.textContent = name;
            if (!Number.isFinite(item.fixedPrice) && Number.isFinite(item.perPerson)) {
              const badge = document.createElement('span');
              badge.className = 'badge per-guest-badge is-hidden';
              badge.textContent = 'per guest';
              label.appendChild(badge);
            }
            const minus = document.createElement('button');
            minus.type = 'button';
            minus.className = 'btn btn-secondary btn-small';
            minus.textContent = '–';
            const plus = document.createElement('button');
            plus.type = 'button';
            plus.className = 'btn btn-secondary btn-small';
            plus.textContent = '+';
            const count = document.createElement('span');
            count.className = 'qty-value';
            const maxQty = Number.isFinite(item.maxQty) ? item.maxQty : null;
            const getQty = () => selectionMap.get(name) || 0;
            const setQty = (next) => {
              const bounded = Math.max(0, maxQty ? Math.min(next, maxQty) : next);
              if (bounded === 0) selectionMap.delete(name);
              else selectionMap.set(name, bounded);
              count.textContent = String(bounded);
              const badge = label.querySelector('.per-guest-badge');
              if (badge) badge.classList.toggle('is-hidden', bounded === 0);
              dbg('qty change', { item: name, qty: bounded });
              updateEstimate();
            };
            count.textContent = String(getQty());
            label.addEventListener('click', () => {
              const current = getQty();
              setQty(current > 0 ? 0 : 1);
            });
            minus.addEventListener('click', () => {
              setQty(getQty() - 1);
            });
            plus.addEventListener('click', () => {
              setQty(getQty() + 1);
            });
            control.appendChild(label);
            control.appendChild(minus);
            control.appendChild(count);
            control.appendChild(plus);
            itemsWrap.appendChild(control);
          } else {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-ghost btn-small menu-toggle';
            const isSelected = (selectionMap.get(name) || 0) > 0;
            btn.classList.toggle('is-selected', isSelected);
            btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            btn.dataset.itemName = name;
            btn.textContent = name;
            if (!Number.isFinite(item.fixedPrice) && Number.isFinite(item.perPerson)) {
              const badge = document.createElement('span');
              badge.className = 'badge per-guest-badge';
              badge.textContent = 'per guest';
              badge.classList.toggle('is-hidden', !isSelected);
              btn.appendChild(badge);
            }
            btn.addEventListener('click', () => {
              const next = (selectionMap.get(name) || 0) > 0 ? 0 : 1;
              if (next === 0) selectionMap.delete(name);
              else selectionMap.set(name, next);
              btn.classList.toggle('is-selected', next > 0);
              btn.setAttribute('aria-pressed', next > 0 ? 'true' : 'false');
              const badge = btn.querySelector('.per-guest-badge');
              if (badge) badge.classList.toggle('is-hidden', next === 0);
              updateEstimate();
            });
            itemsWrap.appendChild(btn);
          }
        });
        sectionEl.appendChild(itemsWrap);
        menuSections.appendChild(sectionEl);
      });
    }

    function renderAddons() {
      if (!menuAddons) return;
      menuAddons.innerHTML = '';
      if (!beverageAddons.length) {
        const note = document.createElement('p');
        note.className = 'note';
        note.textContent = 'Beverage service is quoted separately. Ask about bottle and case options.';
        menuAddons.appendChild(note);
        return;
      }
      const heading = document.createElement('h3');
      heading.textContent = 'Beverage add-ons';
      menuAddons.appendChild(heading);
      const wrap = document.createElement('div');
      wrap.className = 'menu-builder-buttons';
      const selectionMap = getAddonSelectionMap();
      beverageAddons.forEach((addon) => {
        const id = addon.id || addon.label;
        if (!id) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-ghost btn-small menu-toggle';
        const isSelected = (selectionMap.get(id) || 0) > 0;
        btn.classList.toggle('is-selected', isSelected);
        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        btn.textContent = addon.label || addon.name || id;
        btn.addEventListener('click', () => {
          const next = (selectionMap.get(id) || 0) > 0 ? 0 : 1;
          if (next === 0) selectionMap.delete(id);
          else selectionMap.set(id, next);
          btn.classList.toggle('is-selected', next > 0);
          btn.setAttribute('aria-pressed', next > 0 ? 'true' : 'false');
          updateEstimate();
        });
        wrap.appendChild(btn);
      });
      menuAddons.appendChild(wrap);
    }

    guestInput.addEventListener('input', updateEstimate);
    guestInput.addEventListener('blur', () => {
      const normalized = normalizeGuestCount();
      if (guestInput.value !== String(normalized)) guestInput.value = normalized;
      updateEstimate();
    });

    renderMenuTypes();
    renderMenuSections();
    renderAddons();
    dbg('pp form sticky mode', { stickyEnabled: window.innerWidth >= 960 });
    updateEstimate();
  }

  function renderWineClub(wineclubData, site) {
    const container = document.getElementById('wineclub-options');
    if (!container) return;
    const plans = wineclubData?.plans || [];
    if (!plans.length) {
      container.innerHTML = '<p class="note">Wine club enrollment is temporarily unavailable.</p>';
      return;
    }
    container.innerHTML = '';
    plans.forEach((plan) => {
      const actionable = plan.clover_payment_url && !isPlaceholderUrl(plan.clover_payment_url, plan.isPlaceholder);
      const action = actionable
        ? `<a class="btn btn-primary" href="${plan.clover_payment_url}" target="_blank" rel="noopener noreferrer">Pay with Clover</a>`
        : `<button class="btn btn-secondary" type="button" disabled>Link coming soon</button>`;
      const note = plan.notes ? `<p class="note">${plan.notes}</p>` : '';
      const card = document.createElement('div');
      card.className = 'card fade-in';
      card.innerHTML = `<h3>${plan.name}</h3><p>${plan.price_display || plan.priceDisplay || ''}</p>${note}${action}`;
      container.appendChild(card);
    });

    const formConfig = wineclubData.preferences_form;
    if (formConfig && formConfig.fields?.length) {
      const holder = document.createElement('div');
      holder.className = 'card';
      const fields = formConfig.fields.map((f) => {
        const field = { ...f };
        if (f.optionsFromPlans) {
          field.options = plans.map((p) => ({
            value: p.id || p.name,
            label: p.price_display ? `${p.name} — ${p.price_display}` : p.name
          }));
        }
        return field;
      });
      const tokens = {
        site_contact_email: site?.email || ''
      };
      const form = createForm(
        fields,
        formConfig.submission,
        tokens,
        'Send Details',
        formConfig.note,
        formConfig.submission?.subject || 'Wine Club Preferences – {{plan}} – {{name}}',
        formConfig.submission?.body_template,
        'wineclub',
        { compact: true }
      );
      holder.innerHTML = '<h3>Preferences</h3>';
      if (form) holder.appendChild(form);
      container.parentElement.appendChild(holder);
    }
    enableFadeIn();
  }

  function attachCopyButtons(defaultEmail) {
    document.querySelectorAll('[data-copy-form]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const formId = btn.getAttribute('data-copy-form');
        const mailto = btn.getAttribute('data-mailto') || defaultEmail || '';
        const form = document.getElementById(formId);
        const subject = btn.dataset.subject || form?.dataset.subject || 'Inquiry';
        copyForm(formId, mailto, subject);
      });
    });
  }

  async function copyForm(formId, email, subject) {
    const form = document.getElementById(formId);
    if (!form) return;
    const menuSummary = form.querySelector('[data-menu-summary]');
    const lines = [];
    Array.from(form.elements).forEach((el) => {
      if (!el.name || ['submit', 'button'].includes(el.type)) return;
      if (menuSummary && el === menuSummary) return;
      const label = form.querySelector(`label[for="${el.id}"]`);
      const title = label ? label.textContent.trim() : el.name;
      const value = el.value || '(not provided)';
      lines.push(`${title}: ${value}`);
    });
    if (menuSummary && menuSummary.value.trim()) {
      lines.push('', menuSummary.value.trim());
    }
    const text = lines.join('\n');
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(text);
    } catch (err) {
      console.warn('Clipboard copy failed', err);
    }
    if (DEBUG) dbg('form copied to clipboard', { formId, subject });
  }

  function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    let status = form.querySelector('.form-status');
    if (!status) {
      status = document.createElement('p');
      status.className = 'form-status';
      status.style.display = 'none';
      form.appendChild(status);
    }
    status.tabIndex = -1;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');

    const setStatus = (type, message) => {
      status.textContent = message || '';
      status.classList.remove('is-success', 'is-error');
      if (type) status.classList.add(type === 'success' ? 'is-success' : 'is-error');
      status.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
      status.style.display = message ? 'block' : 'none';
      if (message) status.focus();
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (button.dataset.submitting === 'true') return;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      setStatus('', '');
      const action = form.getAttribute('action') || 'https://formspree.io/f/xbddjoek';
      const formData = new FormData(form);
      button.dataset.submitting = 'true';
      button.disabled = true;
      const defaultLabel = button.textContent;
      button.textContent = 'Sending...';
      fetch(action, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' }
      }).then((res) => {
        if (!res.ok) throw new Error('Formspree error');
        setStatus('success', 'Thanks — we received your message.');
        form.reset();
      }).catch(() => {
        setStatus('error', 'Something went wrong. Please try again.');
      }).finally(() => {
        button.dataset.submitting = 'false';
        button.disabled = false;
        button.textContent = defaultLabel;
      });
    });
  }

  function injectSchema(site) {
    if (!site?.name) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    if (site.seoDescription) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', site.seoDescription);
      const og = document.querySelector('meta[property="og:description"]');
      if (og) og.setAttribute('content', site.seoDescription);
    }
    const ogImg = resolveImage(site.images?.ogImage || site.defaultSEO?.ogImage || site.openGraphImage || site.heroImage);
    if (ogImg) {
      const ogMeta = document.querySelector('meta[property="og:image"]');
      if (ogMeta) ogMeta.setAttribute('content', ogImg.src);
      const twMeta = document.querySelector('meta[name="twitter:image"]');
      if (twMeta) twMeta.setAttribute('content', ogImg.src);
    }
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: site.name,
      description: site.description,
      telephone: site.phone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: site.address?.line1,
        addressLocality: site.address?.city,
        addressRegion: site.address?.state,
        postalCode: site.address?.zip,
        addressCountry: site.address?.country
      },
      url: window.location.origin,
      image: (site.images && site.images.ogImage) || (site.defaultSEO && site.defaultSEO.ogImage) || site.openGraphImage || site.heroImage,
      servesCuisine: 'Seasonal',
      openingHours: site.hours?.map((h) => `${h.label} ${h.value}`)
    };
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  sitePromise.then((site) => {
    validateSiteHours(site);
    state.site = site;
    populateSite(site);
    populateWhyBullets(site);
    populateImages(site);
    populateTrust(site);
    setupAnnouncement(site);
    setupBottomBar();
    setupMenuPdfLink(site);
    injectSchema(site);
    attachCopyButtons(site?.email);
  });

  document.addEventListener('DOMContentLoaded', () => {
    renderHeader();
    setupNav();
    // Footer links are pruned before nav hrefs are set so any injected/removed links
    // get base-path normalization (GitHub Pages friendly) and stay deterministic.
    pruneFooterLinks();
    setNavLinks();
    setupBackToTop();
    enableFadeIn();
    initContactForm();
    if (document.getElementById('private-menu-builder')) {
      const pricingModule = window.PrivateMenuPricing;
      if (pricingModule?.MENUS) {
        renderPrivateEventMenu({ menus: pricingModule.MENUS, beverage_addons: pricingModule.BEVERAGE_ADDONS }, pricingModule);
      } else {
        fetchJSON('private-events.json', {}).then((data) => renderPrivateEventMenu(data, pricingModule));
      }
    }
  });

  window.Mockingbird = {
    getBasePath,
    withBase,
    isPlaceholderUrl,
    state,
    sitePromise,
    fetchJSON,
    renderHoursTable,
    renderMenu,
    renderSpecials,
    renderEvents,
    renderFeaturedItems,
    renderSpecialsPreview,
    renderEventsPreview,
    applySpecialsToMenu,
    renderGiftCards,
    renderDeposits,
    renderReserveDateDeposit,
    renderWineClub,
    renderGallery,
    renderDrinks
  };
})();
