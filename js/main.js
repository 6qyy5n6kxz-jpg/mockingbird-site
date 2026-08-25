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
    'menu', 'specials', 'events', 'private-parties', 'reserve-date', 'gift-cards', 'contact', 'drinks'
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

  function resolveLink(url) {
    if (!url) return '';
    if (/^(https?:|mailto:|tel:|#)/i.test(url)) return url;
    return withBase(url);
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

  function injectLocalBusinessSchema() {
    if (typeof document === 'undefined') return;
    const head = document.head || document.querySelector('head');
    if (!head || document.getElementById('localbusiness-schema')) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'localbusiness-schema';
    script.textContent = `{
  "@context": "https://schema.org",
  "@type": ["CafeOrCoffeeShop", "WineBar"],
  "name": "The Mockingbird on Mill Road",
  "url": "https://themockingbirdonmillroad.com/",
  "image": {
    "@type": "ImageObject",
    "url": "https://themockingbirdonmillroad.com/assets/images/og.jpg"
  },
  "description": "The Mockingbird on Mill Road is a cozy wine café and event space in Graytown, OH featuring live music, trivia nights, book club, private parties, and seasonal food and drinks.",
  "priceRange": "$$",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "4408 N Elliston-Trowbridge Rd",
    "addressLocality": "Graytown",
    "addressRegion": "OH",
    "postalCode": "43432",
    "addressCountry": "US"
  },
  "areaServed": [
    { "@type": "City", "name": "Graytown" },
    { "@type": "City", "name": "Toledo" },
    { "@type": "City", "name": "Oregon" },
    { "@type": "City", "name": "Port Clinton" },
    { "@type": "City", "name": "Genoa" }
  ],
  "sameAs": [
    "https://www.facebook.com/themockingbirdonmillroad/",
    "https://www.instagram.com/mockingbirdonmillroad/"
  ],
  "hasMenu": "https://themockingbirdonmillroad.com/menu/",
  "acceptsReservations": true
}`;
    head.appendChild(script);
  }

  injectLocalBusinessSchema();

  function ticketsRemaining(ticketing) {
    if (!ticketing) return 0;
    const capacity = Number(ticketing.capacity) || 0;
    const sold = Number(ticketing.sold) || 0;
    return Math.max(0, capacity - sold);
  }

  function formatCurrency(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return value ? String(value) : '';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(num);
  }

  function formatCountdown(targetDate) {
    const target = new Date(targetDate);
    if (Number.isNaN(target.getTime())) return null;
    const diff = target.getTime() - Date.now();
    if (diff <= 0) {
      return {
        complete: true,
        text: 'Event is live or has ended.'
      };
    }
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
      complete: false,
      text: `${days}d ${hours}h ${minutes}m ${seconds}s`
    };
  }

  function startCountdown(el, targetDate, options = {}) {
    if (!el || !targetDate) return;
    const completeText = options.completeText || 'Thanks for supporting Mockingbird Jam.';
    const prefix = options.prefix || '';
    const tick = () => {
      const value = formatCountdown(targetDate);
      if (!value) {
        el.textContent = '';
        return;
      }
      el.textContent = value.complete ? completeText : `${prefix}${value.text}`.trim();
    };
    tick();
    window.setInterval(tick, 1000);
  }

  function buildActionLinks(actions, className = 'hero-cta') {
    const list = Array.isArray(actions) ? actions.filter((item) => item && item.label && item.url) : [];
    if (!list.length) return '';
    const links = list.map((item) => {
      const href = resolveLink(item.url);
      const buttonClass = item.style === 'secondary'
        ? 'btn btn-secondary'
        : item.style === 'ghost'
          ? 'btn btn-ghost'
          : 'btn btn-primary';
      const targetAttrs = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
      const disabledClass = item.disabled ? ' is-disabled-link' : '';
      const ariaDisabled = item.disabled ? ' aria-disabled="true"' : '';
      const note = item.description ? `<span class="action-microcopy">${item.description}</span>` : '';
      return `<div class="action-link-wrap"><a class="${buttonClass}${disabledClass}" href="${href}"${targetAttrs}${ariaDisabled}>${item.label}</a>${note}</div>`;
    });
    return `<div class="${className}">${links.join('')}</div>`;
  }

  function getFundraisingCtas(auctionData) {
    const event = auctionData?.event || {};
    const configured = Array.isArray(event.ctas) ? event.ctas.slice() : [];
    if (event.auction_visible === false) {
      configured.unshift({
        label: 'Auction Coming Soon',
        url: '#auction-coming-soon',
        style: 'ghost',
        disabled: true,
        description: 'Online bidding opens soon.'
      });
    }
    return configured;
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

  const state = { site: null, payments: null, auction: null, sponsors: null };
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
    if (site.kitchenNote) {
      applyText('[data-fill="kitchen-note"]', site.kitchenNote);
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
      if (section && !site?.trust?.bullets?.length) section.remove();
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

  function renderExperience(site) {
    const container = document.getElementById('experience-grid');
    if (!container) return;
    const images = site?.images?.experience || [];
    container.innerHTML = '';
    images.slice(0, 6).forEach((entry) => {
      const resolved = resolveImage(entry);
      if (!resolved) return;
      const figure = document.createElement('figure');
      const img = document.createElement('img');
      img.src = resolved.src;
      img.alt = entry.alt || resolved.alt || '';
      img.loading = 'lazy';
      img.width = entry.width || 1200;
      img.height = entry.height || 800;
      figure.appendChild(img);
      if (entry.caption) {
        const caption = document.createElement('figcaption');
        caption.textContent = entry.caption;
        figure.appendChild(caption);
      }
      container.appendChild(figure);
    });
  }

  function renderTestimonials(site) {
    const section = document.getElementById('guest-testimonials');
    const container = document.getElementById('testimonial-grid');
    if (!section || !container) return;
    // Owner-editable source: only approved testimonials belong in data/site.json.
    const testimonials = Array.isArray(site?.testimonials) ? site.testimonials : [];
    if (!testimonials.length) {
      section.hidden = true;
      return;
    }
    container.innerHTML = '';
    testimonials.slice(0, 3).forEach((entry) => {
      if (!entry?.quote || !entry?.name) return;
      const article = document.createElement('article');
      article.className = 'testimonial-card';
      const quote = document.createElement('blockquote');
      quote.textContent = entry.quote;
      article.appendChild(quote);
      const attribution = document.createElement('footer');
      attribution.className = 'testimonial-attribution';
      const name = document.createElement('cite');
      name.textContent = entry.name;
      attribution.appendChild(name);
      if (entry.source) attribution.append(` · ${entry.source}`);
      article.appendChild(attribution);
      container.appendChild(article);
    });
    if (!container.children.length) return;
    const links = document.getElementById('testimonial-links');
    const reviewLink = site?.trust?.reviewLink;
    if (links && reviewLink) {
      const read = document.createElement('a');
      read.className = 'btn btn-secondary btn-small';
      read.href = reviewLink;
      read.target = '_blank';
      read.rel = 'noopener noreferrer';
      read.textContent = 'Read More Guest Recommendations';
      links.appendChild(read);
    }
    section.hidden = false;
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
            <li><a data-nav="jam">Jam</a></li>
            <li><a data-nav="private-parties">Private Parties</a></li>
          </ul>
          <div class="nav-divider" aria-hidden="true"></div>
          <ul class="nav-secondary" aria-label="Explore">
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
    const rows = site.hours.map((row) => {
      const note = row.note ? `<td class="hours-note-cell"><span class="hours-secondary">${row.note}</span></td>` : '<td class="hours-note-cell"></td>';
      return `<tr class="hours-row"><td class="hours-day">${row.label}</td><td class="hours-time"><span class="hours-primary">${row.value}</span></td>${note}</tr>`;
    });
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

  function menuSectionId(name) {
    return `menu-${String(name || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')}`;
  }

  function renderMenu(menuData) {
    const container = document.getElementById('menu-container');
    if (!container) return;
    dbg('renderMenu start', { hasData: !!menuData, categories: menuData?.categories?.length || 0 });
    const specialPlaceholders = new Set([
      'Soup of the Day',
      'Featured Pressed Sandwich',
      'Featured Side',
      'Seasonal Salad',
      'Sweet Bite of the Day',
      'Hot Side of the Week'
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
      section.id = menuSectionId(cat.name);
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
          if (nameEl && !item.suppressSpecialName) nameEl.setAttribute('data-special-name', 'true');
          if (descEl && !item.suppressSpecialDescription) descEl.setAttribute('data-special-description', 'true');
        }
        list.appendChild(row);
      });
      section.appendChild(list);
      if (cat.footer) {
        const footerLines = Array.isArray(cat.footer)
          ? cat.footer
          : String(cat.footer).split('\n');
        const comboPrefix = 'MAKE IT A COMBO →';
        const sidePrefixes = ['Featured Side:', 'This week’s Featured Side:'];
        const comboLine = footerLines.find((line) => String(line || '').trim().startsWith(comboPrefix));
        const sideLine = footerLines.find((line) => {
          const trimmed = String(line || '').trim();
          return sidePrefixes.some((prefix) => trimmed.startsWith(prefix));
        });
        const addLine = footerLines.find((line) => String(line || '').trim().toLowerCase().startsWith('add:'));
        const detailsLine = footerLines.find((line) => {
          const trimmed = String(line || '').trim();
          const lower = trimmed.toLowerCase();
          return lower.startsWith('choose your sides:') ||
            lower.startsWith('sides you can choose from') ||
            lower.startsWith('choose 2 or 3 sides:') ||
            lower.startsWith('choose 2 or 3 additional sides:');
        });
        const noteLine = footerLines.find((line) => String(line || '').toLowerCase().includes('counts as 2 sides'));
        const includesLine = footerLines.find((line) => String(line || '').trim().toLowerCase().startsWith('includes:'));
        if (comboLine && sideLine) {
          const callout = document.createElement('div');
          callout.className = 'menu-combo-callout';
          const title = document.createElement('div');
          title.className = 'menu-combo-title';
          title.textContent = 'Make it a combo';
          const pricing = document.createElement('div');
          pricing.className = 'menu-combo-pricing';
          const details = document.createElement('div');
          details.className = 'menu-combo-details';
          const comboBody = String(comboLine).slice(comboPrefix.length).trim();
          if (comboBody) pricing.textContent = comboBody;
          const servedIdx = comboBody.toLowerCase().indexOf('served with');
          const addPart = servedIdx >= 0 ? comboBody.slice(0, servedIdx).trim() : comboBody.trim();
          const includesPart = servedIdx >= 0 ? comboBody.slice(servedIdx).trim() : '';
          const addText = addPart.replace(/^\s*add\s+/i, '').replace(/\.$/, '');
          const detailsSource = detailsLine || addLine;
          if (detailsSource) {
            details.textContent = String(detailsSource || '').trim();
          } else {
            details.textContent = addText ? `Add: ${addText}` : 'Add: Cup of Soup • 1/2 Seasonal Salad • Both';
          }
          const includes = document.createElement('div');
          includes.className = 'menu-combo-includes';
          const includesText = includesPart.replace(/^served with\s*/i, '').replace(/\.$/, '');
          if (includesLine) {
            const rawIncludes = String(includesLine || '').trim();
            includes.innerHTML = rawIncludes.includes('<') ? rawIncludes : rawIncludes.replace(/\n/g, '<br>');
          } else if (cat.name === 'Pressed Sandwiches') {
            includes.textContent = 'Includes: half a pressed sandwich, a pickle + Featured Side';
          } else {
            includes.textContent = includesText ? `Includes: ${includesText}` : 'Includes: a pickle + Featured Side';
          }
          const note = document.createElement('div');
          note.className = 'menu-combo-note note';
          if (noteLine) note.textContent = String(noteLine || '').trim();
          const side = document.createElement('div');
          side.className = 'menu-combo-side';
          side.textContent = String(sideLine).trim();
          callout.appendChild(title);
          if (pricing.textContent) callout.appendChild(pricing);
          callout.appendChild(includes);
          callout.appendChild(details);
          if (note.textContent) callout.appendChild(note);
          callout.appendChild(side);
          section.appendChild(callout);
        } else {
          const foot = document.createElement('div');
          foot.className = 'note';
          footerLines.forEach((line) => {
            const row = document.createElement('div');
            row.textContent = String(line || '').trim();
            foot.appendChild(row);
          });
          section.appendChild(foot);
        }
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
    const featuredSide = specials.get('Featured Side');
    if (featuredSide?.name) {
      const comboSection = Array.from(container.querySelectorAll('section.menu-category'))
        .find((section) => section.querySelector('.kicker')?.textContent?.trim() === 'Combos');
      const note = comboSection?.querySelector('.note');
      if (note) {
        const rawName = String(featuredSide.name || '').trim();
        const cleanedName = rawName.replace(/^featured side[:\s-]*/i, '').replace(/\.$/, '').trim();
        const lineText = cleanedName ? `This week’s Featured Side: ${cleanedName}.` : 'This week’s Featured Side:';
        const rows = note.querySelectorAll('div');
        if (rows.length) {
          rows.forEach((row) => {
            const text = row.textContent || '';
            if (text.toLowerCase().includes('featured side')) row.textContent = lineText;
          });
        } else {
          note.textContent = lineText;
        }
      }
    }
    rows.forEach((row) => {
      const label = row.getAttribute('data-special-label');
      const match = label ? specials.get(label) : null;
      if (!match) return;
      const nameEl = row.querySelector('[data-special-name]');
      const descEl = row.querySelector('[data-special-description]');
      if (nameEl && match.name) nameEl.textContent = match.name;
      if (descEl) {
        const section = row.closest('section.menu-category');
        const sectionName = section?.querySelector('.kicker')?.textContent?.trim() || '';
        if (sectionName === 'Snack Starters' && label === 'Featured Side') {
          descEl.textContent = '';
          return;
        }
        let prefix = '';
        if (label === 'Soup of the Day') {
          const prefixEl = descEl.querySelector('.menu-size-pricing');
          const rawPrefix = descEl.innerHTML.trim();
          prefix = prefixEl ? prefixEl.outerHTML : (rawPrefix ? rawPrefix : '');
        } else if (label === 'Featured Pressed Sandwich') {
          prefix = 'Also available as a flatbread.';
        } else {
          const prefixEl = descEl.querySelector('.menu-size-pricing');
          const rawPrefix = descEl.innerHTML.trim();
          prefix = prefixEl ? prefixEl.outerHTML : (rawPrefix ? rawPrefix : '');
        }
        const parts = [];
        if (prefix) parts.push(prefix);
        if (match.description) parts.push(match.description);
        const notes = Array.isArray(match.notes) ? match.notes.filter(Boolean) : [];
        notes.forEach((note) => parts.push(String(note)));
        if (parts.length) descEl.innerHTML = parts.join('<br>');
      }
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

  const DRINK_PRICE_LABELS = {
    fullPour: 'Full Pour',
    bottle: 'Bottle',
    pour: 'Pour',
    pitcher: 'Pitcher',
    glass: 'Glass',
    can: 'Can',
    draft: 'Draft'
  };

  const DRINK_PRICE_ORDER = [
    'fullPour',
    'bottle',
    'pour',
    'pitcher',
    'glass',
    'can',
    'draft'
  ];

  function normalizeDrinkValue(val) {
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number' && Number.isFinite(val)) return `$${val.toFixed(2)}`;
    return '';
  }

  function stripDrinkLabel(text) {
    const labels = Object.values(DRINK_PRICE_LABELS).join('|');
    const regex = new RegExp(`^\\s*(${labels})\\s*:\\s*`, 'i');
    return text.replace(regex, '').trim();
  }

  function parseDrinkLabelString(text) {
    if (!text) return [];
    const known = Object.values(DRINK_PRICE_LABELS);
    return String(text)
      .split('|')
      .map((part) => {
        const match = String(part).match(/^\s*([^:]+)\s*:/);
        if (!match) return '';
        const label = match[1].trim();
        const knownMatch = known.find((val) => val.toLowerCase() === label.toLowerCase());
        return knownMatch || label;
      })
      .filter(Boolean);
  }

  function parseDrinkPriceString(text) {
    if (!text) return [];
    return String(text)
      .split('|')
      .map((part) => stripDrinkLabel(part))
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function getDrinkHeaderForSubsection(items) {
    const keys = new Set();
    let inferred = [];
    (items || []).forEach((item) => {
      const prices = item?.prices;
      if (prices && typeof prices === 'object') {
        Object.keys(prices).forEach((key) => keys.add(key));
      } else if (typeof prices === 'string' && !inferred.length) {
        inferred = parseDrinkLabelString(prices);
      }
    });
    const orderedKeys = DRINK_PRICE_ORDER.filter((key) => keys.has(key));
    if (orderedKeys.length) {
      const labels = orderedKeys.map((key) => (DRINK_PRICE_LABELS[key] || key));
      return { labels, keys: orderedKeys };
    }
    if (inferred.length > 1) {
      return { labels: inferred.map((label) => label.toUpperCase()), keys: [] };
    }
    if (inferred.length === 1) {
      return { labels: [inferred[0].toUpperCase()], keys: [] };
    }
    return { labels: ['Price'], keys: [] };
  }

  function formatDrinkPrices(prices, orderedKeys) {
    if (!prices) return '';
    if (typeof prices === 'string') {
      const parts = parseDrinkPriceString(prices);
      return parts.join(' | ');
    }
    if (typeof prices !== 'object') return '';
    const keys = orderedKeys && orderedKeys.length
      ? orderedKeys
      : DRINK_PRICE_ORDER.filter((key) => prices[key] != null);
    const parts = keys
      .map((key) => normalizeDrinkValue(prices[key]))
      .filter(Boolean);
    return parts.join(' | ');
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
      const anchorLinks = [
        { id: 'wine-flights', title: 'Flights + Pours' },
        { id: 'beer-cans', title: 'Beer + More' },
        { id: 'bottled-wine', title: 'Bottle Shop' }
      ];
      anchors.innerHTML = anchorLinks
  .map((a) => `<a class="drink-anchor-link" href="#${a.id}">${a.title}</a>`)
  .join('');
    }

    if (!drinks?.sections?.length) {
      if (container.childElementCount && __debug) dbg('renderDrinks skip clear: empty sections but content exists');
    } else {
      container.innerHTML = '';
    }
    drinks.sections.forEach((section) => {
      const secEl = document.createElement('section');
      secEl.className = `drink-section drink-section-${section.id || 'general'} fade-in`;
      if (section.id === 'on-tap') {
        secEl.classList.add('drink-section-flight-continuation');
      }
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
        const titleText = section.id === 'on-tap' ? 'On Tap' : (section.title || '');
        titleSpan.textContent = titleText;
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
          subEl.className = 'drink-subsection';
          if (sub.title) {
            subEl.id = sub.id || sub.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const h3 = document.createElement('h3');
            h3.textContent = sub.title;
            subEl.appendChild(h3);
          }
          const hasSubDescription = !!(sub.description && String(sub.description).trim());
          if (hasSubDescription) {
            if (section.id !== 'wine-flights') {
              const p = document.createElement('p');
              p.className = 'note';
              p.textContent = sub.description;
              subEl.appendChild(p);
            }
          } else if (section.id === 'wine-flights') {
            // Handled by section-level note.
          }
          const headerInfo = section.id === 'wine-flights'
            ? { labels: ['Bottle'], keys: ['bottle'] }
            : getDrinkHeaderForSubsection(sub.items || []);
          if (headerInfo.labels && headerInfo.labels.length) {
            const header = document.createElement('div');
            header.className = 'menu-price-header';
            const spacer = document.createElement('div');
            spacer.className = 'menu-price-spacer';
            const label = document.createElement('div');
            label.className = 'note menu-price-label';
            const headerText = section.id === 'beer-cans' && headerInfo.labels.length === 1
              ? 'PRICE'
              : headerInfo.labels.map((l) => String(l).toUpperCase()).join(' | ');
            label.textContent = headerText;
            header.appendChild(spacer);
            header.appendChild(label);
            subEl.appendChild(header);
          }
          const list = document.createElement('div');
          (sub.items || []).forEach((item) => {
            const priceText = formatDrinkPrices(item?.prices, headerInfo.keys)
              || (item?.price != null ? String(item.price) : '');
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

  function initializeTicketQuantitySelectors() {
    const selectors = document.querySelectorAll('[data-quantity-id]');
    selectors.forEach(selector => {
      const quantityId = selector.getAttribute('data-quantity-id');
      if (!quantityId) return;

      const display = selector.querySelector(`.qty-display[data-qty-id="${quantityId}"]`);
      const minusBtn = selector.querySelector(`[data-qty-action="decrease"][data-qty-id="${quantityId}"]`);
      const plusBtn = selector.querySelector(`[data-qty-action="increase"][data-qty-id="${quantityId}"]`);
      const totalAmount = selector.querySelector(`.ticket-total-amount[data-qty-id="${quantityId}"]`);
      const button = selector.querySelector(`[data-qty-button="true"][data-qty-id="${quantityId}"]`);

      if (!display || !minusBtn || !plusBtn || !totalAmount || !button) return;

      const minQty = parseInt(display.getAttribute('data-min-qty'), 10) || 1;
      const maxQty = parseInt(display.getAttribute('data-max-qty'), 10) || 5;
      const optionsJson = button.getAttribute('data-qty-options');
      const optionsByQty = optionsJson ? JSON.parse(optionsJson) : {};

      const updateUI = (quantity) => {
        display.textContent = quantity;
        
        const option = optionsByQty[quantity];
        if (option) {
          totalAmount.textContent = `$${option.total}`;
          button.href = option.url;
          const ticketWord = quantity === 1 ? 'Ticket' : 'Tickets';
          button.textContent = `Buy ${quantity} ${ticketWord} — $${option.total}`;
        }

        minusBtn.disabled = quantity <= minQty;
        plusBtn.disabled = quantity >= maxQty;
      };

      minusBtn.addEventListener('click', () => {
        let current = parseInt(display.textContent, 10);
        if (current > minQty) {
          current--;
          updateUI(current);
        }
      });

      plusBtn.addEventListener('click', () => {
        let current = parseInt(display.textContent, 10);
        if (current < maxQty) {
          current++;
          updateUI(current);
        }
      });
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
      const paymentOverride = !!(
  (ev.payment_url || ev.payment_link_url) &&
  (ev.payment_label || ev.event_type === 'ticketed')
);

const paymentProvider = ev.payment_provider || 'clover';
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
      const providerKey = ev.payment_provider || 'clover';

const paymentUrl =
  ev.payment_url ||
  ev.payment_link_url ||
  ticketing?.clover_payment_url ||
  '';

const paymentLabel =
  ev.payment_label ||
  (providerKey === 'clover' ? 'Buy tickets' : 'Buy tickets');
      const paymentOptions = Array.isArray(ev.payment_options) ? ev.payment_options.filter((option) => option && option.url && option.label) : [];
      const ticketOptions = Array.isArray(ev.ticket_options) ? ev.ticket_options.filter((option) => option && option.url && typeof option.quantity === 'number' && typeof option.total === 'number') : [];
      const helperProvider = providerKey === 'vendor' && /venmo/i.test(`${paymentLabel} ${paymentUrl || ''}`) ? 'venmo' : providerKey;
      const paymentHelperOverride = typeof ev.payment_helper === 'string' ? ev.payment_helper.trim() : '';
      const paymentCtaHelper = typeof ev.payment_cta_helper === 'string' ? ev.payment_cta_helper.trim() : '';
      const paymentHelperDefault = helperProvider === 'clover'
        ? 'You’ll complete payment securely via Clover.'
        : helperProvider === 'venmo'
          ? 'You’ll complete payment via Venmo.'
          : 'You’ll complete payment on the vendor’s ticketing page.';
      const paymentHelper = paymentHelperOverride || paymentHelperDefault;
      const placeholderFlag = ticketing?.isPlaceholder === true;

const linkValid = isValidPaymentLink(paymentUrl, placeholderFlag);

const optionLinksValid = paymentOptions.some((option) =>
  isValidPaymentLink(option.url, placeholderFlag)
);

const ticketOptionsValid = ticketOptions.length > 0 && ticketOptions.some((option) =>
  isValidPaymentLink(option.url, placeholderFlag)
);

const soldOutOverride = ev.sold_out_override === true;

const paymentEnabled =
  isTicketed &&
  !soldOut &&
  !soldOutOverride &&
  (ticketOptionsValid ? true : (paymentOptions.length ? optionLinksValid : linkValid));
      if (paymentEnabled) {
  if (ticketOptionsValid) {
    const quantitySelectionId = `qty-selector-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sortedTicketOptions = [...ticketOptions].sort((a, b) => a.quantity - b.quantity);
    const minQty = sortedTicketOptions[0]?.quantity || 1;
    const maxQty = sortedTicketOptions[sortedTicketOptions.length - 1]?.quantity || 5;
    const optionsByQty = {};
    sortedTicketOptions.forEach(opt => {
      optionsByQty[opt.quantity] = opt;
    });
    const defaultOption = optionsByQty[1] || sortedTicketOptions[0];
    const defaultQty = defaultOption?.quantity || 1;
    const defaultTotal = defaultOption?.total || (defaultOption?.quantity * 20);

    button = `
    <div class="ticket-quantity-selector" data-quantity-id="${quantitySelectionId}">
      <div class="ticket-qty-controls">
        <div class="ticket-qty-label">Quantity</div>
        <div class="ticket-qty-input">
          <button class="qty-btn qty-btn-minus" data-qty-action="decrease" data-qty-id="${quantitySelectionId}" aria-label="Decrease ticket quantity" ${defaultQty <= minQty ? 'disabled' : ''}>−</button>
          <span class="qty-display" data-qty-id="${quantitySelectionId}" data-min-qty="${minQty}" data-max-qty="${maxQty}">${defaultQty}</span>
          <button class="qty-btn qty-btn-plus" data-qty-action="increase" data-qty-id="${quantitySelectionId}" aria-label="Increase ticket quantity" ${defaultQty >= maxQty ? 'disabled' : ''}>+</button>
        </div>
      </div>
      <div class="ticket-qty-total">
        <div class="ticket-total-label">Total</div>
        <div class="ticket-total-amount" data-qty-id="${quantitySelectionId}">$${defaultTotal}</div>
      </div>
      <a class="btn btn-primary" href="${defaultOption.url}" target="_blank" rel="noopener noreferrer" data-qty-id="${quantitySelectionId}" data-qty-button="true" data-qty-options='${JSON.stringify(optionsByQty)}'>Buy ${defaultQty} ${defaultQty === 1 ? 'Ticket' : 'Tickets'} — $${defaultTotal}</a>
    </div>`;
  } else if (paymentOptions.length) {
    button = paymentOptions.map((option) => {
      if (!isValidPaymentLink(option.url, placeholderFlag)) return '';

      const buttonClass = option.style === 'secondary'
        ? 'btn btn-secondary btn-small'
        : 'btn btn-primary btn-small';

      const badge = option.badge
        ? ` <span class="ticket-option-badge">${option.badge}</span>`
        : '';

      return `<a class="${buttonClass}" href="${option.url}" target="_blank" rel="noopener noreferrer">${option.label}${badge}</a>`;
    }).join('');
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
      const paymentCtaHelperLine = (paymentEnabled && paymentCtaHelper)
        ? `<p class="note event-help">${paymentCtaHelper}</p>`
        : '';
      const paymentHelperLine = (paymentEnabled && !ev.hide_ticketed_helper && paymentHelper)
        ? `<p class="note event-help">${paymentHelper}</p>`
        : '';
      const lowInventory = ticketing && remaining > 0 && remaining <= 5;
      const soldOutNote = soldOut
        ? `<p class="note">${ev.sold_out_note || 'This event is sold out — thank you!'}</p>`
        : '';
      const paymentBlock = isTicketed
  ? (soldOut
    ? `<div class="event-payment">
      <h4 class="event-section-title">Tickets</h4>
      <p class="note event-help">This event is sold out.</p>
    </div>`
    : `
    <div class="event-payment">
      <h4 class="event-section-title">Tickets</h4>
      ${ev.payment_note ? `<p class="note event-help">${ev.payment_note}</p>` : ''}
      ${paymentCtaHelperLine}
      <div class="form-actions event-payment-actions">
        ${button || ''}
      </div>
      ${paymentHelperLine}
      ${vendorPaymentDetails}
      ${soldOutOverrideNotice}
      ${ticketCopy}
    </div>`)
  : '';
      const seatingClosedBlock = (soldOut && isTicketed)
        ? `<div class="event-seating">
          <h4 class="event-section-title">Seating details</h4>
          <p class="note event-help">Seating details are now closed for this event.</p>
        </div>`
        : '';
      const isJamEvent = ev.slug === 'mockingbird-jam-2026' || ev.campaign === 'mockingbird_jam';
      const jamBlock = isJamEvent ? buildJamEventMarkup(state.auction) : '';

      card.innerHTML = `
        ${img}
        <div class="inline-links"><span class="badge">${formatDate(ev.date)}</span>${priceBadge}${availabilityBadge}${typeBadge}${eventTypeBadge}</div>
        <h3>${ev.title}</h3>
        <p>${ev.description}</p>
        ${soldOutNote}
        ${ticketing?.policy ? `<p class="note">${ticketing.policy}</p>` : ''}
        ${jamBlock}
        ${paymentBlock}
        ${lowInventory ? '<p class="note">Limited tickets remain. Availability isn’t held until payment completes.</p>' : ''}
        ${seatingClosedBlock}
      `;

      const shouldShowSeatingForm = !soldOut && isTicketed && (ticketing?.intake || ev.seating_form?.enabled === true);
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

  function renderJamPromo(containerId, auctionData) {
    const container = document.getElementById(containerId);
    const event = auctionData?.event;
    if (!container || !event) return;
    const hero = event.hero || {};
    const heroActions = [];
    if (hero.primary_cta_label && hero.primary_cta_url) {
      heroActions.push({
        label: hero.primary_cta_label,
        url: hero.primary_cta_url,
        style: 'ghost',
        disabled: true,
        description: 'Online bidding opens soon.'
      });
    }
    if (hero.secondary_cta_label && (event.donation_url || hero.secondary_cta_url)) {
      heroActions.push({
        label: hero.secondary_cta_label,
        url: event.donation_url || hero.secondary_cta_url,
        style: 'primary',
        description: event.support_section?.donation_microcopy || 'All proceeds benefit ALS-TDI and local families affected by ALS.'
      });
    }
    container.innerHTML = `
      <div class="final-cta fade-in">
        <div>
          <p class="kicker">${hero.kicker || 'Mockingbird Jam 2026'}</p>
          <h2>${hero.headline || event.title}</h2>
          <p class="note">${hero.subhead || event.subtitle || ''}</p>
        </div>
        ${buildActionLinks(heroActions.length ? heroActions : getFundraisingCtas(auctionData))}
      </div>
    `;
    enableFadeIn();
  }

  function renderEventCountdown(containerId, auctionData, options = {}) {
    const container = document.getElementById(containerId);
    const event = auctionData?.event;
    if (!container || !event?.date) return;
    const label = options.label || event.countdown_label || 'Countdown';
    const message = options.completeText || event.post_event_message || 'Thanks for supporting Mockingbird Jam.';
    container.innerHTML = `
      <div class="countdown-card fade-in">
        <p class="kicker">${label}</p>
        <h2>${event.title}</h2>
        <p class="note">${event.location || ''}</p>
        <p class="countdown-value" data-countdown-target="${event.date}"></p>
        <p class="note">${event.als_mission?.body || ''}</p>
      </div>
    `;
    const target = container.querySelector('[data-countdown-target]');
    startCountdown(target, event.date, { completeText: message });
    enableFadeIn();
  }

  function renderFundraisingCtas(containerId, auctionData, options = {}) {
    const container = document.getElementById(containerId);
    if (!container || !auctionData?.event) return;
    const support = auctionData.event.support_section || {};
    const title = options.title || support.title || 'Support the cause';
    const body = options.body || support.description || auctionData.event.als_mission?.body || '';
    const note = options.note || support.note || '';
    container.innerHTML = `
      <div class="cta-band fade-in">
        <div>
          <p class="kicker">${title}</p>
          <p>${body}</p>
          ${note ? `<p class="note">${note}</p>` : ''}
        </div>
        ${buildActionLinks(getFundraisingCtas(auctionData))}
      </div>
    `;
    enableFadeIn();
  }

  function renderAuctionIntro(containerId, auctionData) {
    const container = document.getElementById(containerId);
    const event = auctionData?.event;
    if (!container || !event) return;
    container.innerHTML = `
      <div class="fade-in">
        <div class="inline-links">
          <span class="badge">${event.auction_intro_badge || 'Coming Soon'}</span>
        </div>
        <h1>${event.auction_intro_heading || 'Mockingbird Jam silent auction'}</h1>
        <p class="lead">${event.auction_intro_copy || event.auction_hidden_message || ''}</p>
        <p class="note">${event.support_section?.note || 'Sponsors and auction donors can get involved now. Online bidding opens soon.'}</p>
        <div class="inline-links" style="margin-top:12px;">
          <a class="btn btn-secondary btn-small" href="${withBase('/events/')}">Back to events</a>
          <a class="btn btn-ghost btn-small" href="#event-updates-signup">Join event updates</a>
        </div>
      </div>
    `;
    enableFadeIn();
  }

  function renderJamSchedule(containerId, auctionData) {
    const container = document.getElementById(containerId);
    const event = auctionData?.event;
    const schedule = Array.isArray(event?.schedule) ? event.schedule : [];
    if (!container || !event || !schedule.length) return;
    const rows = schedule.map((item) => `
      <div class="schedule-row">
        <strong>${item.time}</strong>
        <div>
          <div>${item.title}</div>
          ${item.description ? `<p class="note">${item.description}</p>` : ''}
        </div>
      </div>
    `).join('');
    container.innerHTML = `
      <div class="card fade-in">
        <p class="kicker">Event Day Schedule</p>
        <h2>What’s happening at Mockingbird Jam</h2>
        <div class="schedule-list">${rows}</div>
        <p class="note">${event.als_mission?.body || ''}</p>
      </div>
    `;
    enableFadeIn();
  }

  function renderSponsors(data, containerId, options = {}) {
    const container = document.getElementById(containerId);
    const sponsors = Array.isArray(data?.sponsors) ? data.sponsors : [];
    const tiers = Array.isArray(data?.tiers) ? data.tiers : [];
    if (!container) return;
    if (!sponsors.length) {
      container.innerHTML = '<p class="note">Sponsor details coming soon.</p>';
      return;
    }
    const intro = options.intro || data.intro || '';
    const title = options.title || data.title || 'Sponsors';
    const limit = Number(options.limit) > 0 ? Number(options.limit) : 0;
    const filterTiers = Array.isArray(options.tiers) && options.tiers.length ? new Set(options.tiers) : null;
    const grouped = tiers.map((tier) => {
      const items = sponsors.filter((sponsor) => sponsor.tier === tier.id && (!filterTiers || filterTiers.has(tier.id)));
      if (limit) return { ...tier, items: items.slice(0, limit) };
      return { ...tier, items };
    }).filter((tier) => tier.items.length);

    if (!grouped.length) {
      container.innerHTML = '<p class="note">Sponsor details coming soon.</p>';
      return;
    }

    container.innerHTML = `
      <div class="fade-in">
        <p class="kicker">Sponsors</p>
        <h2>${title}</h2>
        ${intro ? `<p class="lead">${intro}</p>` : ''}
        ${grouped.map((tier) => `
          <div class="sponsor-tier">
            <h3>${tier.label}</h3>
            <div class="sponsor-grid">
              ${tier.items.map((sponsor) => {
                const href = resolveLink(sponsor.url);
                const logoStyle = sponsor.logoBackground ? ` style="--sponsor-logo-bg: ${sponsor.logoBackground};"` : '';
                const logo = sponsor.logo ? `<img src="${withBase(sponsor.logo)}" alt="${sponsor.name} logo" loading="lazy">` : `<div class="sponsor-wordmark">${sponsor.name}</div>`;
                const targetAttrs = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
                const cardInner = `
                    <div class="sponsor-logo"${logoStyle}>${logo}</div>
                    <strong>${sponsor.name}</strong>
                    <span class="badge badge-soft">${tier.label}</span>
                    ${sponsor.blurb ? `<p class="note">${sponsor.blurb}</p>` : ''}
                `;
                if (!href) {
                  return `
                  <div class="sponsor-card">
                    ${cardInner}
                  </div>
                `;
                }
                return `
                  <a class="sponsor-card" href="${href}"${targetAttrs}>
                    ${cardInner}
                  </a>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    enableFadeIn();
  }

  function renderJamSponsors(containerId, data) {
    const container = document.getElementById(containerId);
    const sponsors = Array.isArray(data?.sponsors) ? data.sponsors : [];
    const tiers = Array.isArray(data?.tiers) ? data.tiers : [];
    
    if (!container) return;
    if (!sponsors.length) {
      container.innerHTML = '';
      return;
    }

    // Group sponsors by tier
    const grouped = tiers.map((tier) => {
      const items = sponsors.filter((sponsor) => sponsor.tier === tier.id);
      return { ...tier, items };
    }).filter((tier) => tier.items.length);

    if (!grouped.length) {
      container.innerHTML = '';
      return;
    }

    // Render sponsor wall with tier-based layout
    let html = '<div class="jam-sponsor-wall fade-in">';
    
    grouped.forEach((tier) => {
      const tierClass = tier.id.toLowerCase();
      const logoGridClass = `jam-sponsor-tier-logos-${tierClass}`;
      
      html += `
        <div class="jam-sponsor-tier">
          <h3 class="jam-sponsor-tier-heading">${tier.label}</h3>
          <div class="jam-sponsor-tier-logos ${logoGridClass}">
      `;
      
      tier.items.forEach((sponsor) => {
        const href = resolveLink(sponsor.url);
        const logoSrc = sponsor.logo ? withBase(sponsor.logo) : '';
        const targetAttrs = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
        const logoClass = `jam-sponsor-logo jam-sponsor-logo-${tierClass}`;
        const itemClass = `jam-sponsor-item jam-sponsor-item-${tierClass}`;
        const bgStyle = sponsor.logoBackground ? ` style="background-color: ${sponsor.logoBackground};"` : '';
        
        if (!logoSrc) {
          html += `
            <div class="${itemClass}">
              <div class="${logoClass}"${bgStyle}>
                <span class="sponsor-name">${sponsor.name}</span>
              </div>
            </div>
          `;
        } else if (href) {
          html += `
            <div class="${itemClass}">
              <a class="${logoClass}" href="${href}"${targetAttrs}${bgStyle}>
                <img src="${logoSrc}" alt="${sponsor.name}" loading="lazy">
              </a>
            </div>
          `;
        } else {
          html += `
            <div class="${itemClass}">
              <div class="${logoClass}"${bgStyle}>
                <img src="${logoSrc}" alt="${sponsor.name}" loading="lazy">
              </div>
            </div>
          `;
        }
      });
      
      html += `
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    enableFadeIn();
  }

  function createSignupCheckbox(name, label) {
    return `
      <label class="check-row">
        <input type="checkbox" name="interests" value="${name}">
        <span>${label}</span>
      </label>
    `;
  }

  function renderEmailSignup(containerId, config = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const action = config.action || 'https://formspree.io/f/xbddjoek';
    const title = config.title || 'Join Event Updates';
    const description = config.description || 'Get event updates, auction reminders, sponsor announcements, and donation reminders.';
    container.innerHTML = `
      <form class="fade-in signup-form" action="${action}" method="POST" data-formspree data-success-message="${config.success_message || 'Thanks. You’re signed up.'}" data-error-message="${config.error_message || 'Something went wrong. Please try again.'}">
        <p class="kicker">Join Event Updates</p>
        <h2>${title}</h2>
        <p class="note">${description}</p>
        <label for="${containerId}-first-name">First name</label>
        <input id="${containerId}-first-name" name="first_name" autocomplete="given-name" required>
        <label for="${containerId}-email">Email</label>
        <input id="${containerId}-email" name="email" type="email" autocomplete="email" required>
        <input type="hidden" name="source" value="${config.source || 'mockingbird_jam_updates'}">
        <div class="signup-interests">
          <span class="signup-interests-label">I’m interested in:</span>
          ${createSignupCheckbox('event-updates', 'Event updates')}
          ${createSignupCheckbox('auction', 'Auction')}
          ${createSignupCheckbox('volunteering', 'Volunteering')}
          ${createSignupCheckbox('sponsorship', 'Sponsorship')}
          ${createSignupCheckbox('als-donations', 'ALS donations')}
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Join event updates</button>
        </div>
        <p class="form-status" role="status" aria-live="polite" aria-atomic="true" style="display:none;"></p>
      </form>
    `;
    initFormspreeForm(container.querySelector('form'));
    enableFadeIn();
  }

  function getAuctionFeaturedItems(data, limit = 3) {
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.filter((item) => item.featured).slice(0, limit);
  }

  function renderFeaturedAuctionItems(containerId, auctionData) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (auctionData?.event?.auction_visible === false) {
      container.innerHTML = `
        <div class="card fade-in">
          <p class="kicker">Auction Preview</p>
          <h2>Silent auction items are coming soon</h2>
          <p class="note">${auctionData?.event?.auction_hidden_message || 'Check back soon for the full silent auction lineup.'}</p>
          <div class="form-actions">
            <a class="btn btn-secondary btn-small" href="${withBase('/auction/')}#auction-coming-soon">Auction Coming Soon</a>
          </div>
        </div>
      `;
      enableFadeIn();
      return;
    }
    const items = getAuctionFeaturedItems(auctionData, 3);
    if (!items.length) {
      container.innerHTML = '<p class="note">Featured auction items will be posted soon.</p>';
      return;
    }
    container.innerHTML = `
      <div class="fade-in">
        <p class="kicker">Featured Auction Items</p>
        <h2>Bid on standout packages for the ALS mission</h2>
        <div class="auction-grid">
          ${items.map((item) => `
            <article class="auction-card">
              <img src="${withBase(item.image)}" alt="${item.title}" loading="lazy">
              <div class="auction-card-body">
                <div class="inline-links"><span class="badge">${item.category}</span><span class="badge badge-soft">${item.status}</span></div>
                <h3>${item.title}</h3>
                <p class="note">Donated by ${item.donor}</p>
                <p>${item.description}</p>
                <div class="auction-meta">
                  <span><strong>Current bid:</strong> ${formatCurrency(item.currentBid)}</span>
                  <span><strong>Retail value:</strong> ${formatCurrency(item.retailValue)}</span>
                </div>
                <div class="form-actions">
                  <a class="btn btn-primary btn-small" href="${withBase('/auction/')}">View item</a>
                </div>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
    `;
    enableFadeIn();
  }

  function createBidPanel(item, auctionData) {
    const minBid = Number(item.currentBid) + Number(item.bidIncrement || 0);
    const form = document.createElement('form');
    form.className = 'bid-form';
    form.action = auctionData?.event?.auction_form_action || 'https://formspree.io/f/xbddjoek';
    form.method = 'POST';
    form.innerHTML = `
      <input type="hidden" name="item_id" value="${item.id}">
      <input type="hidden" name="item_title" value="${item.title}">
      <input type="hidden" name="source" value="auction_bid">
      <label for="bidder-name-${item.id}">Name</label>
      <input id="bidder-name-${item.id}" name="bidder_name" autocomplete="name" required>
      <label for="bidder-email-${item.id}">Email</label>
      <input id="bidder-email-${item.id}" name="bidder_email" type="email" autocomplete="email" required>
      <label for="bidder-phone-${item.id}">Phone</label>
      <input id="bidder-phone-${item.id}" name="bidder_phone" type="tel" autocomplete="tel" required>
      <label for="bid-amount-${item.id}">Bid amount</label>
      <input id="bid-amount-${item.id}" name="bid_amount" type="number" min="${minBid}" step="${item.bidIncrement || 1}" value="${minBid}" required>
      <label for="bid-note-${item.id}">Optional note</label>
      <textarea id="bid-note-${item.id}" name="note" rows="3" placeholder="Pickup notes or questions"></textarea>
      <p class="note">Minimum bid for this item is ${formatCurrency(minBid)}.</p>
      <p class="form-status" role="status" aria-live="polite" aria-atomic="true" style="display:none;"></p>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary btn-small">Submit bid</button>
      </div>
    `;

    const status = form.querySelector('.form-status');
    const button = form.querySelector('button[type="submit"]');
    const amountInput = form.querySelector(`#bid-amount-${item.id}`);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const bidValue = Number(amountInput.value);
      if (!Number.isFinite(bidValue) || bidValue < minBid) {
        status.textContent = `Please enter at least ${formatCurrency(minBid)}.`;
        status.classList.remove('is-success');
        status.classList.add('is-error');
        status.style.display = 'block';
        return;
      }

      status.style.display = 'none';
      button.disabled = true;
      const originalLabel = button.textContent;
      button.textContent = 'Sending...';

      const formData = new FormData(form);
      formData.append('minimum_allowed_bid', String(minBid));

      // Future Firebase upgrade path:
      // Replace this Formspree POST with a write to a live bids collection and
      // refresh current bid state from the backend after the write succeeds.
      fetch(form.action, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' }
      }).then((res) => {
        if (!res.ok) throw new Error('Bid submission failed');
        status.textContent = 'Thanks. Your bid was submitted and will be reviewed shortly.';
        status.classList.remove('is-error');
        status.classList.add('is-success');
        status.style.display = 'block';
        form.reset();
        amountInput.value = String(minBid);
      }).catch(() => {
        status.textContent = 'Something went wrong. Please try again.';
        status.classList.remove('is-success');
        status.classList.add('is-error');
        status.style.display = 'block';
      }).finally(() => {
        button.disabled = false;
        button.textContent = originalLabel;
      });
    });

    return form;
  }

  function renderAuction(auctionData) {
    const container = document.getElementById('auction-items');
    const items = Array.isArray(auctionData?.items) ? auctionData.items : [];
    if (!container) return;
    if (auctionData?.event?.auction_visible === false) {
      container.innerHTML = `
        <div class="card fade-in" id="auction-coming-soon">
          <p class="kicker">Auction</p>
          <h2>Silent auction lineup coming soon</h2>
          <p class="note">${auctionData?.event?.auction_hidden_message || 'Check back soon for the full silent auction lineup.'}</p>
          <p class="note">${auctionData?.event?.support_section?.note || 'Sponsors and auction donors can get involved now. Online bidding opens soon.'}</p>
        </div>
      `;
      enableFadeIn();
      return;
    }
    if (!items.length) {
      container.innerHTML = '<p class="note">Auction items will be posted soon.</p>';
      return;
    }

    const sorted = items.slice().sort((a, b) => {
      if (a.featured === b.featured) return String(a.title || '').localeCompare(String(b.title || ''));
      return a.featured ? -1 : 1;
    });
    container.innerHTML = '';

    sorted.forEach((item) => {
      const minBid = Number(item.currentBid) + Number(item.bidIncrement || 0);
      const card = document.createElement('article');
      card.className = 'auction-card fade-in';
      card.innerHTML = `
        <img src="${withBase(item.image)}" alt="${item.title}" loading="lazy">
        <div class="auction-card-body">
          <div class="inline-links">
            <span class="badge">${item.category}</span>
            ${item.featured ? '<span class="badge badge-soft">Featured</span>' : ''}
            <span class="badge badge-soft">${item.status}</span>
          </div>
          <h3>${item.title}</h3>
          <p>${item.description}</p>
          <p class="note">Donated by ${item.donor}</p>
          <div class="auction-meta">
            <span><strong>Retail value:</strong> ${formatCurrency(item.retailValue)}</span>
            <span><strong>Opening bid:</strong> ${formatCurrency(item.openingBid)}</span>
            <span><strong>Current bid:</strong> ${formatCurrency(item.currentBid)}</span>
            <span><strong>Increment:</strong> ${formatCurrency(item.bidIncrement)}</span>
          </div>
          <p class="countdown-inline" data-auction-countdown="${item.auctionEnd}"></p>
          <p class="note">Next valid bid starts at ${formatCurrency(minBid)}.</p>
          <div class="form-actions">
            <button type="button" class="btn btn-primary btn-small" data-bid-toggle="${item.id}">Place Bid</button>
          </div>
          <div class="bid-panel is-hidden" data-bid-panel="${item.id}"></div>
        </div>
      `;

      const countdown = card.querySelector('[data-auction-countdown]');
      startCountdown(countdown, item.auctionEnd, { prefix: 'Ends in ', completeText: 'Bidding closed.' });

      const toggle = card.querySelector(`[data-bid-toggle="${item.id}"]`);
      const panel = card.querySelector(`[data-bid-panel="${item.id}"]`);
      let initialized = false;
      toggle.addEventListener('click', () => {
        const hidden = panel.classList.contains('is-hidden');
        panel.classList.toggle('is-hidden');
        toggle.textContent = hidden ? 'Hide Bid Form' : 'Place Bid';
        if (hidden && !initialized) {
          panel.appendChild(createBidPanel(item, auctionData));
          initialized = true;
        }
      });

      container.appendChild(card);
    });
    enableFadeIn();
  }

  function buildJamEventMarkup(auctionData) {
    const event = auctionData?.event;
    if (!event) return '';
    const schedule = Array.isArray(event.schedule) ? event.schedule.slice(0, 3) : [];
    return `
      <div class="jam-event-block">
        <p class="kicker">Fundraiser Spotlight</p>
        <h4>${event.title}</h4>
        <p class="note">${event.subtitle || ''}</p>
        ${schedule.length ? `<div class="jam-mini-schedule">${schedule.map((item) => `<div><strong>${item.time}</strong> · ${item.title}</div>`).join('')}</div>` : ''}
        ${buildActionLinks(getFundraisingCtas(auctionData), 'hero-cta jam-actions')}
      </div>
    `;
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
    container.innerHTML = `
      <div class="card">
        <p class="note">This week's specials will be posted soon.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  data.items.slice(0, 5).forEach((item) => {
    const card = document.createElement('article');
    card.className = 'card fade-in';

    const label = item.label
      ? `<span class="badge">${item.label}</span>`
      : '';

    const notes = Array.isArray(item.notes) && item.notes.length
      ? `<p class="note">${item.notes.join(' · ')}</p>`
      : '';

    const pairing = item.pairing
      ? `<span class="badge badge-soft">Pairing: ${item.pairing}</span>`
      : '';

    const price = item.price
      ? `<strong>${item.price}</strong>`
      : '';

    card.innerHTML = `
      <div class="inline-links">
        ${label}
        ${pairing}
      </div>

      <h3>${item.name}</h3>

      ${item.description ? `<p>${item.description}</p>` : ''}

      ${notes}

      ${price}
    `;

    container.appendChild(card);
  });

  enableFadeIn();
}

    function renderEventsPreview(data) {
    const container = document.getElementById('events-preview');
    if (!container) return;

    const now = new Date();

    const events = (data?.events || [])
      .filter((ev) => new Date(ev.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (!events.length) {
      container.innerHTML = `
        <div class="home-events-empty">
          <p>More events are coming soon.</p>
          <a data-nav="events">Visit the events page →</a>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    events.slice(0, 3).forEach((ev) => {
      const date = new Date(ev.date);

      const month = date.toLocaleDateString(undefined, {
        month: 'short'
      });

      const day = date.toLocaleDateString(undefined, {
        day: 'numeric'
      });

      const weekday = date.toLocaleDateString(undefined, {
        weekday: 'short'
      });

      const time = date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit'
      });

      const card = document.createElement('article');
      card.className = 'home-event-card fade-in';

      card.innerHTML = `
        <div class="home-event-date" aria-label="${formatDate(ev.date)}">
          <span class="home-event-month">${month}</span>
          <strong>${day}</strong>
          <span>${weekday}</span>
        </div>

        <div class="home-event-details">
          ${ev.type ? `<p class="home-event-type">${ev.type}</p>` : ''}
          <h3>${ev.title}</h3>

          <div class="home-event-meta">
            <span>${time}</span>
            ${ev.price ? `<span>${ev.price}</span>` : ''}
          </div>
        </div>
      `;

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
    const galleryItems = images.map((entry) => {
      const resolved = resolveImage(entry);
      return resolved ? { ...entry, ...resolved, alt: entry.alt || resolved.alt || site.name } : null;
    }).filter(Boolean);
    const groups = new Map();
    galleryItems.forEach((item) => {
      const category = item.category || 'The Mockingbird';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(item);
    });

    groups.forEach((items, category) => {
      const section = document.createElement('section');
      section.className = 'gallery-collection';
      const heading = document.createElement('h2');
      heading.textContent = category;
      section.appendChild(heading);
      const grid = document.createElement('div');
      grid.className = 'gallery-grid';
      items.forEach((item) => {
        const button = document.createElement('button');
        button.className = 'gallery-item';
        button.type = 'button';
        button.setAttribute('aria-label', `View larger image: ${item.alt}`);
        const image = document.createElement('img');
        image.src = item.src;
        image.alt = item.alt;
        image.loading = 'lazy';
        image.width = item.width || 1200;
        image.height = item.height || 800;
        button.appendChild(image);
        button.addEventListener('click', () => openGalleryLightbox(galleryItems, galleryItems.indexOf(item), button));
        grid.appendChild(button);
      });
      section.appendChild(grid);
      container.appendChild(section);
    });
  }

  function openGalleryLightbox(items, startIndex, trigger) {
    const dialog = document.getElementById('gallery-lightbox');
    if (!dialog || !items.length) return;
    const image = dialog.querySelector('img');
    const caption = dialog.querySelector('figcaption');
    const close = dialog.querySelector('.lightbox-close');
    const previous = dialog.querySelector('.lightbox-prev');
    const next = dialog.querySelector('.lightbox-next');
    let current = startIndex;

    function show(index) {
      current = (index + items.length) % items.length;
      image.src = items[current].src;
      image.alt = items[current].alt;
      caption.textContent = items[current].alt;
    }

    function dismiss() {
      dialog.hidden = true;
      document.body.classList.remove('lightbox-open');
      document.removeEventListener('keydown', onKeydown);
      trigger.focus();
    }

    function onKeydown(event) {
      if (event.key === 'Escape') dismiss();
      if (event.key === 'ArrowLeft') show(current - 1);
      if (event.key === 'ArrowRight') show(current + 1);
      if (event.key === 'Tab') {
        const controls = [close, previous, next];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    show(current);
    dialog.hidden = false;
    document.body.classList.add('lightbox-open');
    close.onclick = dismiss;
    previous.onclick = () => show(current - 1);
    next.onclick = () => show(current + 1);
    dialog.onclick = (event) => {
      if (event.target === dialog) dismiss();
    };
    document.addEventListener('keydown', onKeydown);
    close.focus();
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
    let resetButton;

    const MENU_PRESETS = {
      brunch: [
        { name: 'Breakfast Sandwich Bar', qty: 1 },
        { name: 'Cheesy Potatoes', qty: 1 },
        { name: 'Muffin Tin Omelets', qty: 1 }
      ],
      lunch_dinner: [
        { name: 'Soup', qty: 1 },
        { name: 'Shredded Chicken', qty: 1 },
        { name: 'Potato Salad', qty: 1 }
      ],
      picnic: [
        { name: 'Hot Dogs', qty: 1 },
        { name: 'Burgers', qty: 1 },
        { name: 'Cole Slaw', qty: 1 }
      ]
    };

    function getPerPersonPrice(item) {
      if (Number.isFinite(item.perPerson)) return { value: item.perPerson };
      dbg('missing item pricing', { name: item.name, menuType: currentMenuId });
      return { value: 0 };
    }

    function getSelectionMap() {
      if (!selectionsByMenu.has(currentMenuId)) selectionsByMenu.set(currentMenuId, new Map());
      return selectionsByMenu.get(currentMenuId);
    }

    function buildPresetMap(menuId) {
      const preset = MENU_PRESETS[menuId] || [];
      const presetMap = new Map();
      preset.forEach((item) => {
        if (item?.name && item.qty) presetMap.set(item.name, item.qty);
      });
      return presetMap;
    }

    function applyPreset(menuId, force = false) {
      const presetMap = buildPresetMap(menuId);
      if (!presetMap.size) return;
      const existing = selectionsByMenu.get(menuId);
      if (existing && existing.size && !force) return;
      const next = new Map(presetMap);
      selectionsByMenu.set(menuId, next);
    }

    function isPresetMatch(menuId, selectionMap) {
      const presetMap = buildPresetMap(menuId);
      if (!presetMap.size) return selectionMap.size === 0;
      if (selectionMap.size !== presetMap.size) return false;
      for (const [name, qty] of selectionMap.entries()) {
        if (presetMap.get(name) !== qty) return false;
      }
      return true;
    }

    function ensureResetButton() {
      if (resetButton || !menuTypes?.parentElement) return;
      resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.className = 'btn btn-ghost btn-small';
      resetButton.textContent = 'Reset to recommended';
      resetButton.addEventListener('click', () => {
        applyPreset(currentMenuId, true);
        renderMenuSections();
        updateEstimate();
        updateResetButton();
      });
      const wrap = document.createElement('div');
      wrap.className = 'inline-links';
      wrap.style.marginTop = '8px';
      wrap.appendChild(resetButton);
      menuTypes.parentElement.appendChild(wrap);
    }

    function updateResetButton() {
      if (!resetButton) return;
      const selectionMap = getSelectionMap();
      const show = !isPresetMatch(currentMenuId, selectionMap) && selectionMap.size > 0;
      resetButton.style.display = show ? 'inline-flex' : 'none';
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

    function updateSummary(menuLabel, guestCount, groupedSelections, addonSelectionsList, fixedTotal, perGuest, taxAmount, gratuityAmount, estimate) {
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
      lines.push(`Food subtotal: ${formatCurrency(estimate)}`);
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
      let foodSubtotal = 0;
      let taxAmount = 0;
      let gratuityAmount = 0;
      if (pricingModule?.computeEstimate) {
        const estimate = pricingModule.computeEstimate({
          guestCount,
          selections: selectedItems,
          addons: selectedAddons
        });
        combinedFixedTotal = estimate.fixedSellTotal || 0;
        combinedPerPerson = estimate.perPersonSellTotal || 0;
        estimateTotal = estimate.sellTotal || 0;
        foodSubtotal = estimate.subtotal || 0;
        foodCostTotal = estimate.foodCostTotal || 0;
        taxAmount = estimate.taxAmount || 0;
        gratuityAmount = estimate.gratuityAmount || 0;
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
        foodSubtotal = estimateTotal;
      }
      estimateEl.textContent = `Food subtotal: ${formatCurrency(foodSubtotal)}`;
      if (estimateFixed) {
        const parts = [];
        if (combinedFixedTotal > 0) parts.push(`Boards/stations: ${formatCurrency(combinedFixedTotal)}`);
        estimateFixed.textContent = parts.join(' · ');
      }
      if (estimatePerGuest) {
        estimatePerGuest.textContent = combinedPerPerson > 0
          ? `Selections: ~${formatCurrency(combinedPerPerson)} per guest × ${guestCount} = ${formatCurrency(combinedPerPerson * guestCount)}`
          : '';
      }
      const groupedSelections = getSectionSelections(menu, selectionMap);
      updateSummary(
        menuLabel,
        guestCount,
        groupedSelections,
        selectedAddons,
        combinedFixedTotal,
        combinedPerPerson,
        0,
        0,
        foodSubtotal
      );
      document.dispatchEvent(new CustomEvent('private-menu:estimate', {
        detail: {
          menuId: currentMenuId,
          menuLabel,
          guestCount,
          groupedSelections,
          selectedItems,
          foodSubtotal,
          foodSummary: summaryField?.value || ''
        }
      }));
      updateResetButton();
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
          applyPreset(currentMenuId);
          renderMenuTypes();
          renderMenuSections();
          updateEstimate();
        });
        menuTypes.appendChild(btn);
      });
      ensureResetButton();
      updateResetButton();
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

    applyPreset(currentMenuId);
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
        if (btn.dataset.sendEmail === 'true') {
          sendFormMailto(formId, mailto, subject);
          return;
        }
        copyForm(formId, mailto, subject);
      });
    });
  }

  function buildFormBody(formId) {
    const form = document.getElementById(formId);
    if (!form) return '';
    const menuSummary = form.querySelector('[data-menu-summary]');
    const lines = [];
    Array.from(form.elements).forEach((el) => {
      if (!el.name || ['submit', 'button'].includes(el.type)) return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      if (menuSummary && el === menuSummary) return;
      const label = form.querySelector(`label[for="${el.id}"]`);
      const title = label ? label.textContent.trim() : el.name;
      const value = el.value || '(not provided)';
      lines.push(`${title}: ${value}`);
    });
    if (menuSummary && menuSummary.value.trim()) {
      lines.push('', menuSummary.value.trim());
    }
    return lines.join('\n');
  }

  async function copyForm(formId, email, subject) {
    const text = buildFormBody(formId);
    if (!text) return;
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(text);
    } catch (err) {
      console.warn('Clipboard copy failed', err);
    }
    if (DEBUG) dbg('form copied to clipboard', { formId, subject });
  }

  function sendFormMailto(formId, email, subject) {
    if (!email) return;
    const body = buildFormBody(formId);
    const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  function initFormspreeForm(form) {
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

    const successMessage = form.dataset.successMessage || 'Thanks - we received your message.';
    const errorMessage = form.dataset.errorMessage || 'Something went wrong. Please try again.';

    const syncAriaInvalid = () => {
      Array.from(form.elements).forEach((el) => {
        if (!el.willValidate) return;
        if (!el.checkValidity()) {
          el.setAttribute('aria-invalid', 'true');
        } else {
          el.removeAttribute('aria-invalid');
        }
      });
    };

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
      const validationEvent = new CustomEvent('formspree:validate', { bubbles: false, cancelable: true });
      if (!form.dispatchEvent(validationEvent)) return;
      if (!form.checkValidity()) {
        syncAriaInvalid();
        form.reportValidity();
        return;
      }
      syncAriaInvalid();
      setStatus('', '');
      const action = form.getAttribute('action') || 'https://formspree.io/f/xbddjoek';
      const formData = new FormData(form);
      button.dataset.submitting = 'true';
      button.disabled = true;
      const defaultLabel = button.textContent;
      button.textContent = 'Sending...';
      form.dispatchEvent(new CustomEvent('formspree:submitting'));
      fetch(action, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' }
      }).then((res) => {
        if (!res.ok) throw new Error('Formspree error');
        setStatus('success', successMessage);
        form.dispatchEvent(new CustomEvent('formspree:success', { detail: { formData } }));
        form.reset();
        syncAriaInvalid();
      }).catch(() => {
        setStatus('error', errorMessage);
        form.dispatchEvent(new CustomEvent('formspree:error'));
      }).finally(() => {
        button.dataset.submitting = 'false';
        button.disabled = false;
        button.textContent = defaultLabel;
      });
    });

    form.addEventListener('input', syncAriaInvalid);
    form.addEventListener('change', syncAriaInvalid);
  }

  function initContactForm() {
    document.querySelectorAll('form[data-formspree]').forEach((form) => {
      initFormspreeForm(form);
    });
  }

  function injectSchema(site) {
    if (!site?.name) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    if (site.seoDescription && !document.querySelector('meta[name="description"][data-page-seo]')) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', site.seoDescription);
      const og = document.querySelector('meta[property="og:description"]');
      if (og) og.setAttribute('content', site.seoDescription);
    }
    const ogImg = resolveImage(site.images?.ogImage || site.defaultSEO?.ogImage || site.openGraphImage || site.heroImage);
    if (ogImg && !document.querySelector('meta[property="og:image"][data-page-seo]')) {
      const ogMeta = document.querySelector('meta[property="og:image"]');
      if (ogMeta) ogMeta.setAttribute('content', ogImg.src);
      const twMeta = document.querySelector('meta[name="twitter:image"]');
      if (twMeta) twMeta.setAttribute('content', ogImg.src);
    }
    const data = {
      '@context': 'https://schema.org',
      '@type': document.getElementById('party-form') ? ['Restaurant', 'EventVenue'] : 'Restaurant',
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
      url: window.location.href.split('#')[0],
      image: document.querySelector('meta[property="og:image"]')?.content || (site.images && site.images.ogImage) || (site.defaultSEO && site.defaultSEO.ogImage) || site.openGraphImage || site.heroImage,
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
    renderExperience(site);
    renderTestimonials(site);
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
    renderAuction,
    renderSponsors,
    renderJamSponsors,
    renderEmailSignup,
    renderEventCountdown,
    renderAuctionIntro,
    renderFeaturedAuctionItems,
    renderFundraisingCtas,
    renderJamPromo,
    renderJamSchedule,
    initFormspreeForm,
    renderFeaturedItems,
    renderSpecialsPreview,
    renderEventsPreview,
    applySpecialsToMenu,
    renderGiftCards,
    renderDeposits,
    renderReserveDateDeposit,
    renderWineClub,
    renderGallery,
    renderDrinks,
    initializeTicketQuantitySelectors
  };
})();
