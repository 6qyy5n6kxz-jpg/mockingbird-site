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
    'menu', 'specials', 'events', 'private-parties', 'wine-club', 'gift-cards', 'contact', 'drinks'
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

  const __debug = new URLSearchParams(window.location.search).get('debug') === '1';
  function dbg(...args) {
    if (__debug) console.log('[dbg]', ...args);
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

    function coerceFields(list) {
      const defaults = {
        name: { id: 'name', label: 'Name', type: 'text' },
        email: { id: 'email', label: 'Email', type: 'email' },
        phone: { id: 'phone', label: 'Phone', type: 'tel' },
        quantity: { id: 'quantity', label: 'Quantity', type: 'select', options: ['1', '2', '3', '4', '5', '6'] },
        notes: { id: 'notes', label: 'Notes', type: 'textarea', rows: 3, placeholder: 'Attendee names + any seating notes' },
        date: { id: 'date', label: 'Date', type: 'text' },
        plan: { id: 'plan', label: 'Plan', type: 'select' },
        paid: { id: 'paid', label: 'I already paid via Clover', type: 'checkbox', required: false }
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
    const intro = document.createElement('p');
    intro.className = 'note';
    intro.textContent = 'Pay on Clover first.';
    form.appendChild(intro);
    const subnote = document.createElement('p');
    subnote.className = 'note';
    subnote.textContent = 'Then send attendee names for seating. (This emails us — it doesn’t process payment.)';
    form.appendChild(subnote);
    const fieldList = coerceFields(fields);
    const hasPaid = fieldList.some((f) => f.id === 'paid');
    if (!hasPaid) {
      fieldList.push({ id: 'paid', label: 'I already paid via Clover', type: 'checkbox', required: false });
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
        .filter((f) => f.required || ['notes', 'paid', 'name', 'email', 'quantity'].includes(f.id))
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
      input.name = field.id;
      if (field.required) input.required = true;
      if (field.placeholder && field.type !== 'textarea') input.placeholder = field.placeholder;
      if (field.type === 'checkbox') {
        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${field.label}`));
        wrapField.appendChild(label);
      } else {
        wrapField.appendChild(input);
      }
      form.appendChild(wrapField);
    });
    const error = document.createElement('p');
    error.className = 'note';
    error.style.color = 'var(--color-error, #b00020)';
    error.style.display = 'none';
    form.appendChild(error);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'btn btn-secondary btn-small';
    btn.textContent = submitLabel || 'Send Details';
    actions.appendChild(btn);
    form.appendChild(actions);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const dataTokens = { ...(tokens || {}) };
      renderFields.forEach((field) => {
        const el = form.querySelector(`#field-${field.id}`);
        if (!el) return;
        let value = '';
        if (field.type === 'checkbox') {
          value = el.checked ? 'Yes' : 'No';
        } else {
          value = el.value || '';
        }
        dataTokens[field.id] = value;
      });
      const requiredMissing = renderFields.some((f) => f.required && !dataTokens[f.id]);
      const emailField = renderFields.find((f) => f.id === 'email');
      const emailValue = emailField ? dataTokens[emailField.id] : '';
      const emailBad = emailField && !isEmailValid(emailValue);
      if (requiredMissing) {
        error.textContent = 'Please fill all required fields.';
        error.style.display = 'block';
        return;
      }
      if (emailBad) {
        error.textContent = 'Please enter a valid email.';
        error.style.display = 'block';
        return;
      }
      error.style.display = 'none';
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

  async function fetchJSON(filename, fallback) {
    const url = withBase(`/data/${filename}`);
    try {
      const res = await fetch(url);
      if (__debug) dbg('fetchJSON', { filename, url, ok: res.ok, status: res.status });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = await res.json();
      if (__debug && filename === 'drinks.json') {
        dbg('drinks payload', { keys: Object.keys(json || {}), sectionIds: (json?.sections || []).map((s) => s.id) });
      }
      return json;
    } catch (err) {
      console.warn(`Data load error for ${filename}`, err);
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
    applyText('[data-fill="name"]', site.name || site.shortName);
    applyText('[data-fill="tagline"]', site.tagline);
    applyText('[data-fill="hero-headline"]', site.heroHeadline);
    applyText('[data-fill="hero-subhead"]', site.heroSubhead);
    applyText('[data-fill="location-short"]', site.locationShort);
    applyText('[data-fill="phone"]', site.phone);
    applyText('[data-fill="phone-link"]', site.phone);
    applyText('[data-fill="email-link"]', site.email);
    applyText('[data-fill="address"]', site.address?.line1 || '');
    applyText('[data-fill="city"]', `${site.address?.city || ''}, ${site.address?.state || ''} ${site.address?.zip || ''}`.trim());
    applyText('[data-fill="full-address"]', site.address?.full || '');
    applyText('[data-fill="email-text"]', site.email);
    if (site.hours?.length) {
      const hoursText = site.hours.map((h) => `${h.label} ${h.value}`).join(' · ');
      applyText('[data-fill="hours"]', hoursText);
    }
    if (site.seasonalHoursNote) {
      applyText('[data-fill="seasonal-hours"]', site.seasonalHoursNote);
    }

    setHref('[data-fill="phone-link"]', site.phone ? `tel:${site.phone}` : null);
    setHref('[data-fill="map"]', site.mapsUrl || site.mapLink);
    setHref('[data-fill="email-link"]', site.email ? `mailto:${site.email}` : null);
    const socials = site.socials || site.social;
    setHref('[data-fill="facebook"]', socials?.facebook);
    setHref('[data-fill="instagram"]', socials?.instagram);

    setHref('[data-cta="call"]', site.phone ? `tel:${site.phone}` : '#');
    setHref('[data-cta="directions"]', site.mapsUrl || site.mapLink || '#');
  }

  function populateWhyBullets(site) {
    if (!site?.whyBullets?.length) return;
    const bullets = site.whyBullets;
    document.querySelectorAll('[data-why]').forEach((el) => {
      const idx = Number(el.getAttribute('data-why'));
      if (!Number.isNaN(idx) && bullets[idx]) el.textContent = bullets[idx];
    });
    document.querySelectorAll('[data-why-body]').forEach((el) => {
      const idx = Number(el.getAttribute('data-why-body'));
      if (!Number.isNaN(idx) && bullets[idx]) el.textContent = bullets[idx];
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
    table.innerHTML = site.hours.map((row) => `<tr><td>${row.label}</td><td>${row.value}</td></tr>`).join('');
  }

  function renderMenu(menuData) {
    const container = document.getElementById('menu-container');
    if (!container) return;
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
      return;
    }
    container.innerHTML = '';
    menuData.categories.forEach((cat) => {
      const section = document.createElement('section');
      section.className = 'menu-category fade-in';
      section.innerHTML = `<div class="inline-links"><span class="kicker">${cat.name}</span>${cat.description ? `<span class="note">${cat.description}</span>` : ''}</div>`;
      const list = document.createElement('div');
      cat.items?.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'menu-item';
        const tags = Array.isArray(item.tags) && item.tags.length
          ? `<div class="inline-links">${item.tags.map((t) => `<span class="badge">${t}</span>`).join('')}</div>`
          : '';
        row.innerHTML = `<div><h4>${item.name}</h4><p>${item.description || ''}</p>${tags}</div><div>${item.price || ''}</div>`;
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
        if (section.id === 'wine-flights' && drinks.notes?.pricingRules) {
          const note = document.createElement('div');
          note.className = 'note';
          note.textContent = drinks.notes.pricingRules;
          secEl.appendChild(note);
        }
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
          if (sub.description) {
            const p = document.createElement('p');
            p.className = 'note';
            p.textContent = sub.description;
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
      const cash = drinks.notes?.cashDiscount || '';
      const rules = drinks.notes?.pricingRules || '';
      const eligibility = drinks.notes?.eligibility || '';
      note.innerHTML = [rules, eligibility, cash].filter(Boolean).join(' · ');
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
      const availabilityBadge = ticketing
        ? `<span class="badge">${soldOut ? 'Sold out' : `${remaining} remaining`}</span>`
        : '';
      const priceBadge = (ticketing && ticketing.price_display) ? `<span class="badge">${ticketing.price_display}</span>` : (ev.price ? `<span class="badge">${ev.price}</span>` : '');
      const typeBadge = ev.type ? `<span class="badge badge-soft">${ev.type}</span>` : '';

      let button = '';
      if (ticketing && !soldOut && isValidPaymentLink(ticketing.clover_payment_url, ticketing.isPlaceholder)) {
        button = `<a class="btn btn-primary btn-small" href="${ticketing.clover_payment_url}" target="_blank" rel="noopener noreferrer">Pay on Clover</a>`;
      }
      const lowInventory = ticketing && remaining > 0 && remaining <= 5;
      card.innerHTML = `
        ${img}
        <div class="inline-links"><span class="badge">${formatDate(ev.date)}</span>${priceBadge}${availabilityBadge}${typeBadge}</div>
        <h3>${ev.title}</h3>
        <p>${ev.description}</p>
        ${ticketing?.policy ? `<p class="note">${ticketing.policy}</p>` : ''}
        <div class="form-actions">
          ${button || ''}
        </div>
        ${lowInventory ? '<p class="note">Limited tickets remain. Availability isn’t held until payment completes.</p>' : ''}
      `;

      if (ticketing?.intake) {
        const tokens = {
          event_title: ev.title || '',
          event_date: formatDate(ev.date),
          event_price: ticketing.price_display || ev.price || '',
          site_contact_email: state.site?.email || emailFallback || ''
        };
        const fields = ticketing.intake.required_fields || [];
        const fallbackBody = `Event: ${tokens.event_title}\nDate: ${tokens.event_date}\nName: {{name}}\nEmail: {{email}}\nPhone: {{phone}}\nQuantity: {{quantity}}\nNotes: {{notes}}\nPaid via Clover: {{paid}}\n`;
        const form = createForm(
          fields,
          ticketing.intake.submission,
          tokens,
          'Send Details',
          ticketing.intake.instructions,
          ticketing.intake.submission?.subject_template || 'Event Details – {{event_title}} – {{event_date}}',
          fallbackBody,
          'event_ticketed',
          { defaultCollapsed: true, collapseLabel: 'Send seating details', compact: true }
        );
        if (form) card.appendChild(form);
      }

      container.appendChild(card);
    });
    enableFadeIn();
  }

  function renderFeaturedItems(site, menuData) {
    const container = document.getElementById('featured-items');
    if (!container) return;
    let items = Array.isArray(site?.featuredItems) ? site.featuredItems.slice(0, 4) : [];
    if ((!items || !items.length) && menuData?.categories?.length) {
      const featuredMenu = [];
      menuData.categories.forEach((cat) => {
        (cat.items || []).forEach((item) => {
          if (item.featured) featuredMenu.push(item);
        });
      });
      items = featuredMenu.slice(0, 4);
    }
    if ((!items || !items.length) && menuData?.categories?.length) {
      const collected = [];
      menuData.categories.slice(0, 2).forEach((cat) => {
        (cat.items || []).forEach((item) => {
          if (collected.length < 4) collected.push(item);
        });
      });
      items = collected;
    }
    if (!items || !items.length) {
      container.innerHTML = '<p class="note">Featured items will be posted soon.</p>';
      return;
    }
    container.innerHTML = '';
    items.slice(0, 4).forEach((item) => {
      const card = document.createElement('div');
      card.className = 'card fade-in';
      card.innerHTML = `<h3>${item.name}</h3><p>${item.description || ''}</p>${item.price ? `<strong>${item.price}</strong>` : ''}`;
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
    const giftData = payments?.giftCards || payments?.gift_cards || payments?.payments?.gift_cards;
    if (!giftData) {
      container.innerHTML = '<p class="note">Gift card info coming soon.</p>';
      return;
    }
    // New structure: in-person call to action
    if (giftData.mode === 'in_person') {
      container.innerHTML = `<div class="card fade-in"><h3>${giftData.title || 'Gift Cards'}</h3><p>${giftData.description || ''}</p><a class="btn btn-primary" href="${giftData.cta_url || '#'}">${giftData.cta_label || 'Call to purchase'}</a></div>`;
      return;
    }
    const list = Array.isArray(giftData) ? giftData : [];
    if (!list.length) {
      container.innerHTML = '<p class="note">Gift card purchasing is temporarily unavailable.</p>';
      return;
    }
    container.innerHTML = '';
    list.forEach((item) => {
      const actionable = item.url && !isPlaceholderUrl(item.url, item.isPlaceholder);
      const card = document.createElement('div');
      card.className = 'card fade-in';
      const action = actionable
        ? `<a class="btn btn-primary" href="${item.url}">Buy ${item.label || `$${item.amount}`}</a>`
        : `<button class="btn btn-secondary" type="button" disabled>Coming soon</button>`;
      card.innerHTML = `<h3>${item.label || `$${item.amount} Gift Card`}</h3><p>Digital delivery via Clover checkout.</p>${action}`;
      container.appendChild(card);
    });
    if (payments.policies?.giftCards) {
      const policy = document.createElement('p');
      policy.className = 'note';
      policy.textContent = payments.policies.giftCards;
      container.appendChild(policy);
    }
    enableFadeIn();
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
    const action = actionable
      ? `<a class="btn btn-primary btn-small" href="${deposit.clover_payment_url}" target="_blank" rel="noopener noreferrer">Pay Deposit</a>`
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
      const fallbackBody = `Name: {{name}}\nEmail: {{email}}\nPhone: {{phone}}\nPreferred date: {{date}}\nNotes: {{notes}}\nPaid via Clover: {{paid}}\n`;
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
    const lines = [];
    Array.from(form.elements).forEach((el) => {
      if (!el.name || ['submit', 'button'].includes(el.type)) return;
      const label = form.querySelector(`label[for="${el.id}"]`);
      const title = label ? label.textContent.trim() : el.name;
      const value = el.value || '(not provided)';
      lines.push(`${title}: ${value}`);
    });
    const text = lines.join('\n');
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(text);
    } catch (err) {
      console.warn('Clipboard copy failed', err);
    }
    const encoded = encodeURIComponent(text);
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encoded}`;
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
    state.site = site;
    populateSite(site);
    populateWhyBullets(site);
    populateImages(site);
    populateTrust(site);
    setupAnnouncement(site);
    setupBottomBar();
    injectSchema(site);
    attachCopyButtons(site?.email);
  });

  document.addEventListener('DOMContentLoaded', () => {
    renderHeader();
    setupNav();
    setNavLinks();
    setupBackToTop();
    enableFadeIn();
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
    renderWineClub,
    renderGallery,
    renderDrinks
  };
})();
