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
    'menu', 'specials', 'events', 'private-parties', 'wine-club', 'gift-cards', 'contact'
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

  const state = { site: null, payments: null };

  async function fetchJSON(filename, fallback) {
    const url = withBase(`/data/${filename}`);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      return await res.json();
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
    const navList = document.querySelector('nav ul');
    if (!toggle || !navList) return;

    toggle.addEventListener('click', () => {
      navList.classList.toggle('open');
    });
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
        list.appendChild(row);
      });
      section.appendChild(list);
      container.appendChild(section);
    });
    enableFadeIn();
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
      card.innerHTML = `
        <div class="inline-links"><span class="badge">Weekly special</span>${item.pairing ? `<span class="badge">Pairing: ${item.pairing}</span>` : ''}</div>
        <h3>${item.name}</h3>
        <p>${item.description}</p>
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

  function renderEvents(data, emailFallback, learnMoreUrl) {
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
      let button = '';
      if (ev.payment_link_url && !isPlaceholderUrl(ev.payment_link_url, ev.isPlaceholder)) {
        button = `<a class="btn btn-primary btn-small" href="${ev.payment_link_url}">Buy Tickets</a>`;
      } else if (emailFallback) {
        button = `<a class="btn btn-secondary btn-small" href="mailto:${emailFallback}?subject=${encodeURIComponent(ev.title)}">RSVP / Learn More</a>`;
      } else if (learnMoreUrl && !isPlaceholderUrl(learnMoreUrl)) {
        button = `<a class="btn btn-secondary btn-small" href="${learnMoreUrl}">Learn More</a>`;
      } else {
        button = `<button class="btn btn-secondary btn-small" type="button" disabled>Details coming soon</button>`;
      }
      card.innerHTML = `
        <div class="inline-links"><span class="badge">${formatDate(ev.date)}</span><span class="badge">${ev.price}</span></div>
        <h3>${ev.title}</h3>
        <p>${ev.description}</p>
        ${button}
      `;
      container.appendChild(card);
    });
    enableFadeIn();
  }

  function renderFeaturedItems(site, menuData) {
    const container = document.getElementById('featured-items');
    if (!container) return;
    let items = Array.isArray(site?.featuredItems) ? site.featuredItems.slice(0, 4) : [];
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
    if (!payments?.giftCards) {
      container.innerHTML = '<p class="note">Online payments are temporarily unavailable—please call us.</p>';
      return;
    }
    if (!payments.giftCards.length) {
      container.innerHTML = '<p class="note">Gift card purchasing is temporarily unavailable.</p>';
      return;
    }
    container.innerHTML = '';
    payments.giftCards.forEach((item) => {
      const actionable = item.url && !isPlaceholderUrl(item.url, item.isPlaceholder);
      const card = document.createElement('div');
      card.className = 'card fade-in';
      const action = actionable
        ? `<a class="btn btn-primary" href="${item.url}">Buy ${item.label || `$${item.amount}`}</a>`
        : `<button class="btn btn-secondary" type="button" disabled>Coming soon</button>`;
      card.innerHTML = `<h3>${item.label || `$${item.amount} Gift Card`}</h3><p>Digital delivery via Stripe checkout.</p>${action}`;
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

  function renderDeposits(payments) {
    const container = document.getElementById('deposit-options');
    if (!container) return;
    if (!payments?.partyDeposits) {
      container.innerHTML = '<p class="note">Online payments are temporarily unavailable—please call us.</p>';
      return;
    }
    if (!payments.partyDeposits.length) {
      container.innerHTML = '<p class="note">Deposit links coming soon.</p>';
      return;
    }
    container.innerHTML = '';
    payments.partyDeposits.forEach((item) => {
      const actionable = item.url && !isPlaceholderUrl(item.url, item.isPlaceholder);
      const action = actionable
        ? `<a class="btn btn-primary btn-small" href="${item.url}">Pay ${item.label || `$${item.amount}`}</a>`
        : `<button class="btn btn-secondary btn-small" type="button" disabled>Coming soon</button>`;
      const card = document.createElement('div');
      card.className = 'card fade-in';
      card.innerHTML = `<h3>${item.label || `$${item.amount} Reservation Deposit`}</h3><p>Hold your date instantly.</p>${action}`;
      container.appendChild(card);
    });
    if (payments.policies?.partyDeposits) {
      const policy = document.createElement('p');
      policy.className = 'note';
      policy.textContent = payments.policies.partyDeposits;
      container.appendChild(policy);
    }
    enableFadeIn();
  }

  function renderWineClub(payments) {
    const container = document.getElementById('wineclub-options');
    if (!container) return;
    if (!payments?.wineClub) {
      container.innerHTML = '<p class="note">Online payments are temporarily unavailable—please call us.</p>';
      return;
    }
    const tiers = payments.wineClub.tiers || payments.wineClubTiers || [];
    if (!tiers.length) {
      container.innerHTML = '<p class="note">Wine club enrollment is temporarily unavailable.</p>';
      return;
    }
    container.innerHTML = '';
    tiers.forEach((tier) => {
      const actionable = tier.url && !isPlaceholderUrl(tier.url, tier.isPlaceholder) && tier.active !== false;
      const action = actionable
        ? `<a class="btn btn-primary" href="${tier.url}">Join</a>`
        : `<button class="btn btn-secondary" type="button" disabled>Coming soon</button>`;
      const perks = tier.perks?.length
        ? `<ul class="table-list">${tier.perks.map((p) => `<li>${p}</li>`).join('')}</ul>`
        : '';
      const note = tier.pickupPolicyNote ? `<p class="note">${tier.pickupPolicyNote}</p>` : '';
      const card = document.createElement('div');
      card.className = 'card fade-in';
      card.innerHTML = `<h3>${tier.name}</h3><p>${tier.priceDisplay || tier.price}</p><p class="note">${tier.cadence || ''}</p>${perks}${note}${action}`;
      container.appendChild(card);
    });
    if (payments.wineClub.manageMembershipUrl && !isPlaceholderUrl(payments.wineClub.manageMembershipUrl)) {
      const manage = document.createElement('p');
      manage.className = 'note';
      manage.innerHTML = `<a href="${payments.wineClub.manageMembershipUrl}">Manage membership</a>`;
      container.appendChild(manage);
    }
    if (payments.policies?.wineClub) {
      const policy = document.createElement('p');
      policy.className = 'note';
      policy.textContent = payments.policies.wineClub;
      container.appendChild(policy);
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
    renderGiftCards,
    renderDeposits,
    renderWineClub,
    renderGallery
  };
})();
