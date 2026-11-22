(function () {
  'use strict';

  const builder = document.getElementById('private-menu-builder');
  const form = document.getElementById('party-form');
  const pricing = window.PrivateMenuPricing;
  const config = pricing?.EVENT_PRICING;
  if (!builder || !form || !config) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const summaryField = $('#party-menu-summary');
  const estimateRegion = $('[data-event-estimate]', builder);
  const totalOutput = $('[data-current-estimated-total]', builder);
  const hostedOptions = $('#hosted-beverage-options', builder);
  const methodNote = $('[data-beverage-method-note]', builder);
  const knownBeverageWrap = $('[data-known-beverages]', builder);
  // Hosted drinks: the fixed list plus wine bottles, sangria growlers and cans priced from the live
  // drinks menu (the same list as the Drinks page). Added once the menu loads.
  const beverageOptions = { ...config.beverages };
  const state = {
    food: { menuLabel: '', guestCount: 0, foodSubtotal: 0, foodSummary: '', selectedItems: [] },
    beverageQuantities: Object.fromEntries(Object.keys(config.beverages).map((key) => [key, 0])),
    estimate: null,
    sections: []
  };
  let syncing = false;

  // $250, $15.50 (never $15.5).
  const money = (value) => {
    const n = Number(value) || 0;
    const cents = Math.round(n * 100) % 100 !== 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 }).format(n);
  };

  const track = (eventName, parameters = {}) => {
    if (typeof window.gtag === 'function') window.gtag('event', eventName, parameters);
    else if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: eventName, ...parameters });
  };

  const selectedMethod = () => $('[name="beverage-method"]:checked', builder)?.value || 'guest';
  const methodLabels = {
    guest: 'Guests purchase drinks individually',
    hosted: 'Host provides selected beverages',
    combination: 'Combination of hosted and guest-purchased drinks',
    unsure: 'Not sure yet — help me plan'
  };

  function renderKnownBeverages() {
    knownBeverageWrap.replaceChildren();
    Object.entries(beverageOptions).forEach(([key, item]) => {
      if (!(key in state.beverageQuantities)) state.beverageQuantities[key] = 0;
      const row = document.createElement('div');
      row.className = 'planner-quantity-row';
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = `${item.label} — ${money(item.price)}`;
      copy.appendChild(title);
      if (item.guide) {
        const guide = document.createElement('small');
        guide.textContent = item.guide;
        copy.appendChild(guide);
      }
      const controls = document.createElement('div');
      controls.className = 'qty-control';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.className = 'btn btn-secondary btn-small';
      minus.textContent = '−';
      minus.setAttribute('aria-label', `Remove one ${item.label}`);
      const count = document.createElement('span');
      count.className = 'qty-value';
      count.dataset.beverageCount = key;
      count.textContent = String(state.beverageQuantities[key] || 0);
      count.setAttribute('aria-live', 'polite');
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'btn btn-secondary btn-small';
      plus.textContent = '+';
      plus.setAttribute('aria-label', `Add one ${item.label}`);
      const setQuantity = (next, analytics) => {
        state.beverageQuantities[key] = Math.max(0, next);
        count.textContent = String(state.beverageQuantities[key]);
        if (analytics && state.beverageQuantities[key] > 0) track('hosted_beverage_added', { beverage_type: key });
        updatePlan();
      };
      minus.addEventListener('click', () => setQuantity(state.beverageQuantities[key] - 1, false));
      plus.addEventListener('click', () => setQuantity(state.beverageQuantities[key] + 1, true));
      controls.append(minus, count, plus);
      row.append(copy, controls);
      knownBeverageWrap.appendChild(row);
    });
  }

  function setReveal(control, reveal) {
    if (!control) return;
    control.hidden = !reveal;
  }

  function updateConditionalFields() {
    const method = selectedMethod();
    const hosted = method === 'hosted' || method === 'combination';
    setReveal(hostedOptions, hosted);
    $$('[name="beverage-method"]', builder).forEach((radio) => radio.setAttribute('aria-expanded', radio.checked && hosted ? 'true' : 'false'));
    methodNote.textContent = method === 'guest'
      ? 'Guests order and pay for their own beverages during the event. Estimated hosted beverage cost: $0.'
      : method === 'unsure'
        ? 'We’ll help you choose a beverage approach. Beverage planning assistance will be confirmed after reviewing your request.'
        : 'Build an opening estimate below. Final beverage options and consumption will be confirmed with your event.';
    $$('[data-custom-beverage]', builder).forEach((input) => setReveal($(`[data-dependent="${input.dataset.customBeverage}"]`, builder), hosted && input.checked));
    $$('[data-planner-enhancement]', builder).forEach((input) => setReveal($(`[data-dependent-enhancement="${input.dataset.plannerEnhancement}"]`, builder), input.checked));
    const canvas = $('[data-canvas-experience]', builder)?.value || 'none';
    setReveal($('[data-canvas-painters-wrap]', builder), ['mini', 'standard', 'full'].includes(canvas));
  }

  function customPricingItems(method) {
    const items = [];
    if (method === 'unsure') items.push('Beverage planning assistance — To be determined');
    if (method === 'hosted' || method === 'combination') {
      const labels = {
        wine: 'Specific wines or a pairing', beer: 'Specific beers', keg: 'Sixth-barrel keg',
        nonalcoholic: 'Soft drinks or nonalcoholic options', other: 'Other beverage request'
      };
      $$('[data-custom-beverage]:checked', builder).forEach((input) => items.push(`${labels[input.dataset.customBeverage]} — To be determined`));
    }
    if ($('[data-planner-enhancement="outsideMusician"]', builder)?.checked) items.push('Preferred musician coordination — To be determined');
    if ($('[data-canvas-experience]', builder)?.value === 'help') items.push('Wine & Canvas planning assistance — To be determined');
    if ($('[data-planner-enhancement="custom"]', builder)?.checked) items.push('Custom event enhancement — To be determined');
    return items;
  }

  function knownBeverageSelections(method) {
    if (method !== 'hosted' && method !== 'combination') return [];
    return Object.entries(state.beverageQuantities).filter(([key, quantity]) => quantity > 0 && beverageOptions[key]).map(([key, quantity]) => ({
      key, quantity, ...beverageOptions[key], amount: quantity * beverageOptions[key].price
    }));
  }

  // "$9.00 | $21.00" with header ["Glass","Bottle"], or "Can $3.50 · To Go 4 Pack $12.00".
  const priceFor = (item, header, label) => {
    const text = String(item?.priceText || '');
    const want = label.toLowerCase();
    if (Array.isArray(header) && header.length) {
      const i = header.findIndex((h) => String(h).toLowerCase() === want);
      const parts = text.split('|').map((p) => p.trim());
      if (i >= 0 && parts.length === header.length) {
        const n = Number(parts[i].replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) && n > 0 ? n : null;
      }
    }
    const match = text.match(new RegExp(`${label}\\s*\\$([0-9]+(?:\\.[0-9]{1,2})?)`, 'i'));
    return match ? Number(match[1]) : null;
  };
  const median = (values) => {
    const sorted = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  function applyDrinkPrices(drinks) {
    const sections = drinks?.sections || [];
    const items = (id) => sections.filter((sec) => sec.id === id).flatMap((sec) => (sec.subsections || []).map((sub) => ({ sub, list: sub.items || [] })));
    const bottles = items('wine-flights').flatMap(({ sub, list }) => list.map((it) => priceFor(it, sub.priceHeader, 'Bottle')));
    const sangria = items('on-tap').flatMap(({ sub, list }) => list.filter((it) => /sangria/i.test(it.name || '')).map((it) => priceFor(it, sub.priceHeader, 'Growler')));
    const cans = items('beer-cans').filter(({ sub }) => !/non-?alcoholic/i.test(sub.title || '')).flatMap(({ sub, list }) => list.map((it) => priceFor(it, sub.priceHeader, 'Can')));
    const wine = median(bottles), growler = median(sangria), can = median(cans);
    const range = (values) => { const v = values.filter((x) => x > 0); return v.length ? `${money(Math.min(...v))}–${money(Math.max(...v))}` : ''; };
    const added = {};
    if (wine) added.wineBottle = { label: 'Wine bottles, your choice from our list', price: Math.round(wine), guide: `About 5 glasses per bottle. Estimated at a typical bottle; our bottles run ${range(bottles)}.` };
    if (growler) added.sangria = { ...config.beverages.sangria, price: Math.round(growler) };
    if (can) added.cans = { label: 'Beer & seltzer cans', price: Math.round(can * 2) / 2, guide: `Estimated at a typical can; cans run ${range(cans)}.` };
    if (!Object.keys(added).length) return;
    const ordered = {};
    if (added.wineBottle) ordered.wineBottle = added.wineBottle;
    Object.entries(beverageOptions).forEach(([key, item]) => { ordered[key] = added[key] || item; });
    if (added.cans) ordered.cans = added.cans;
    Object.keys(beverageOptions).forEach((key) => delete beverageOptions[key]);
    Object.assign(beverageOptions, ordered);
    renderKnownBeverages();
    updatePlan();
  }

  function enhancementSelections() {
    const items = [];
    ['photoBooth', 'uplighting', 'partyAudio'].forEach((key) => {
      if ($(`[data-planner-enhancement="${key}"]`, builder)?.checked) items.push({ key, ...config.enhancements[key], amount: config.enhancements[key].price });
    });
    const liveHours = Number($('[data-live-hours]', builder)?.value) || 0;
    if (liveHours > 0) items.push({ key: 'liveMusic', label: config.enhancements.liveMusicHourly.label, amount: liveHours * config.enhancements.liveMusicHourly.price, detail: `${liveHours} hour${liveHours === 1 ? '' : 's'}` });
    const canvasType = $('[data-canvas-experience]', builder)?.value || 'none';
    const painters = Number($('[data-canvas-painters]', builder)?.value) || 0;
    const canvasError = $('#planner-canvas-error');
    if (canvasError) canvasError.textContent = '';
    if (['mini', 'standard', 'full'].includes(canvasType)) {
      if (painters < config.enhancements.wineCanvas.minimumPainters) {
        if (canvasError) canvasError.textContent = `A minimum of ${config.enhancements.wineCanvas.minimumPainters} paid painters is required. This selection is not included in the estimate yet.`;
      } else {
        const option = config.enhancements.wineCanvas[canvasType];
        items.push({ key: 'wineCanvas', label: `Wine & Canvas — ${option.label}`, amount: painters * option.price, detail: `${painters} painters × ${money(option.price)}` });
      }
    }
    return items;
  }

  function appendRows(container, rows) {
    const list = document.createElement('dl');
    list.className = 'planner-estimate-list';
    rows.forEach(([label, value, strong]) => {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      if (strong) { dt.className = 'is-total'; dd.className = 'is-total'; }
      list.append(dt, dd);
    });
    container.appendChild(list);
  }

  const hasGuests = () => Number(state.food.guestCount) > 0;

  function renderEstimate(beverages, enhancements, customItems) {
    const estimate = state.estimate;
    estimateRegion.replaceChildren();
    if (!hasGuests()) {
      const prompt = document.createElement('p');
      prompt.className = 'note planner-estimate-prompt';
      prompt.textContent = 'Add your guest count and choose a menu to see your estimate.';
      estimateRegion.appendChild(prompt);
    }
    const venue = document.createElement('section');
    venue.innerHTML = '<h4>Venue</h4>';
    appendRows(venue, [['Venue rental', money(estimate.venueRental)]]);
    const depositNote = document.createElement('p');
    depositNote.className = 'note';
    depositNote.textContent = `A ${money(estimate.reservationDeposit)} deposit holds your date. It counts toward the venue rental, so it isn't an extra charge.`;
    venue.appendChild(depositNote);
    estimateRegion.appendChild(venue);
    const fb = document.createElement('section');
    fb.innerHTML = '<h4>Food & Beverages</h4>';
    const taxPct = Math.round(config.taxRate * 100);
    const svcPct = Math.round(config.serviceChargeRate * 100);
    appendRows(fb, [['Food subtotal', money(estimate.foodSubtotal)], ['Hosted beverage subtotal', money(estimate.hostedBeverageSubtotal)], ['Food and beverage subtotal', money(estimate.foodAndBeverageSubtotal)], [`Tax (${taxPct}%)`, money(estimate.taxAmount)], [`Food-and-beverage service charge (${svcPct}%)`, money(estimate.serviceChargeAmount)]]);
    estimateRegion.appendChild(fb);
    if (enhancements.length) {
      const section = document.createElement('section');
      section.innerHTML = '<h4>Event Enhancements</h4>';
      appendRows(section, enhancements.map((item) => [item.detail ? `${item.label} (${item.detail})` : item.label, money(item.amount)]));
      estimateRegion.appendChild(section);
    }
    if (customItems.length) {
      const section = document.createElement('section');
      section.innerHTML = '<h4>Additional selections requiring final pricing</h4>';
      const ul = document.createElement('ul');
      customItems.forEach((item) => { const li = document.createElement('li'); li.textContent = item; ul.appendChild(li); });
      section.appendChild(ul);
      estimateRegion.appendChild(section);
    }
    const totals = document.createElement('section');
    totals.innerHTML = '<h4>Planning Total</h4>';
    appendRows(totals, [['Estimated event total', money(estimate.estimatedTotal), true], ['Due now to hold your date (deposit)', money(estimate.reservationDeposit)], ['Due before the event', money(estimate.remainingAfterDeposit), true]]);
    estimateRegion.appendChild(totals);
    const shown = hasGuests() ? money(estimate.estimatedTotal) : '—';
    totalOutput.textContent = shown;
    $$('[data-mobile-total]').forEach((el) => { el.textContent = shown; });
  }

  function detailLines() {
    return {
      wine: [$('[data-wine-preference]', builder)?.value, $('[data-wine-notes]', builder)?.value].filter(Boolean).join(' — '),
      beer: [$('[data-beer-preference]', builder)?.value, $('[data-beer-notes]', builder)?.value].filter(Boolean).join(' — '),
      keg: [$('[data-keg-preference]', builder)?.value, $('[data-keg-notes]', builder)?.value].filter(Boolean).join(' — '),
      nonalcoholic: $('[data-nonalcoholic-notes]', builder)?.value || '',
      other: $('[data-other-beverage-notes]', builder)?.value || ''
    };
  }

  function buildSections(beverages, enhancements, customItems) {
    const method = selectedMethod();
    const customDetails = detailLines();
    const foodLines = state.food.foodSummary ? state.food.foodSummary.split('\n') : ['No food estimate created'];
    const beverageLines = [`Beverage handling: ${methodLabels[method]}`];
    beverages.forEach((item) => beverageLines.push(`${item.label}: ${item.quantity} × ${money(item.price)} = ${money(item.amount)}`));
    $$('[data-custom-beverage]:checked', builder).forEach((input) => {
      const detail = customDetails[input.dataset.customBeverage];
      if (detail) beverageLines.push(`${input.dataset.customBeverage} preferences: ${detail}`);
    });
    if (!beverages.length && method === 'guest') beverageLines.push('Estimated hosted beverage cost: $0');
    const enhancementLines = enhancements.map((item) => `${item.label}${item.detail ? ` (${item.detail})` : ''}: ${money(item.amount)}`);
    const playlist = $('[data-playlist-notes]', builder)?.value.trim();
    if (playlist) enhancementLines.push(`Playlist notes: ${playlist}`);
    if ($('[data-planner-enhancement="outsideMusician"]', builder)?.checked) {
      enhancementLines.push(`Preferred musician/group: ${$('[data-musician-name]', builder)?.value || 'Not provided'}`);
      enhancementLines.push(`Musician contact: ${$('[data-musician-contact]', builder)?.value || 'Not provided'}`);
      enhancementLines.push(`Performance length: ${$('[data-musician-length]', builder)?.value || 'Not provided'}`);
      enhancementLines.push(`Production notes: ${$('[data-musician-notes]', builder)?.value || 'Not provided'}`);
    }
    const customEnhancement = $('[data-custom-enhancement-notes]', builder)?.value.trim();
    if (customEnhancement) enhancementLines.push(`Custom enhancement request: ${customEnhancement}`);
    if (!enhancementLines.length) enhancementLines.push('None selected');
    const e = state.estimate;
    const estimateLines = [
      `Venue rental: ${money(e.venueRental)}`,
      `Food subtotal: ${money(e.foodSubtotal)}`,
      `Hosted beverage subtotal: ${money(e.hostedBeverageSubtotal)}`,
      `Food and beverage subtotal: ${money(e.foodAndBeverageSubtotal)}`,
      `Tax (${Math.round(config.taxRate * 100)}%): ${money(e.taxAmount)}`,
      `Food-and-beverage service charge (${Math.round(config.serviceChargeRate * 100)}%): ${money(e.serviceChargeAmount)}`,
      `Event enhancements: ${money(e.enhancementsSubtotal)}`,
      `Current estimated event total: ${money(e.estimatedTotal)}`,
      `Deposit to hold the date: ${money(e.reservationDeposit)} (counts toward the venue rental; not an extra charge)`,
      `Due before the event: ${money(e.remainingAfterDeposit)}`
    ];
    return [
      { title: 'Food Selections', lines: foodLines },
      { title: 'Beverage Plan', lines: beverageLines },
      { title: 'Enhancements', lines: enhancementLines },
      { title: 'Preliminary Estimate', lines: estimateLines },
      { title: 'Items Requiring Follow-Up', lines: customItems.length ? customItems : ['None'] }
    ];
  }

  function syncInquiryEnhancements() {
    if (syncing) return;
    syncing = true;
    const mapping = {
      'Photo Booth': $('[data-planner-enhancement="photoBooth"]', builder)?.checked,
      'Uplighting': $('[data-planner-enhancement="uplighting"]', builder)?.checked,
      'Indoor and outdoor audio': $('[data-planner-enhancement="partyAudio"]', builder)?.checked,
      'Live music': Number($('[data-live-hours]', builder)?.value) > 0 || $('[data-planner-enhancement="outsideMusician"]', builder)?.checked,
      'Wine & Canvas activity': $('[data-canvas-experience]', builder)?.value !== 'none',
      'Custom event enhancement': $('[data-planner-enhancement="custom"]', builder)?.checked
    };
    $$('[data-enhancement-option]', form).forEach((input) => {
      if (Object.prototype.hasOwnProperty.call(mapping, input.value)) input.checked = Boolean(mapping[input.value]);
    });
    syncing = false;
  }

  function updatePlan() {
    updateConditionalFields();
    const method = selectedMethod();
    const beverages = knownBeverageSelections(method);
    const enhancements = enhancementSelections();
    const customItems = customPricingItems(method);
    state.estimate = pricing.computeEventEstimate({
      foodSubtotal: state.food.foodSubtotal,
      hostedBeverageSubtotal: beverages.reduce((sum, item) => sum + item.amount, 0),
      enhancementItems: enhancements
    });
    state.sections = buildSections(beverages, enhancements, customItems);
    renderEstimate(beverages, enhancements, customItems);
    if (summaryField) summaryField.value = state.sections.map((section) => `${section.title.toUpperCase()}\n${section.lines.join('\n')}`).join('\n\n');
    const foodField = $('#party-food', form);
    if (foodField) foodField.value = state.food.menuLabel
      ? `${state.food.menuLabel}: ${(state.food.selectedItems || []).map((item) => `${item.name}${item.qty > 1 ? ` x${item.qty}` : ''}`).join(', ') || 'no items chosen yet'}`
      : 'No menu chosen yet';
    const beverageField = $('#party-beverages', form);
    if (beverageField) beverageField.value = [methodLabels[method], ...beverages.map((item) => `${item.label} x${item.quantity}`)].join('; ');
    syncInquiryEnhancements();
    document.dispatchEvent(new CustomEvent('private-event-plan:updated', { detail: { estimate: state.estimate } }));
  }

  function syncFromInquiry(input) {
    if (syncing || !input.matches('[data-enhancement-option]')) return;
    syncing = true;
    const map = {
      'Photo Booth': () => { $('[data-planner-enhancement="photoBooth"]', builder).checked = input.checked; },
      'Uplighting': () => { $('[data-planner-enhancement="uplighting"]', builder).checked = input.checked; },
      'Indoor and outdoor audio': () => { $('[data-planner-enhancement="partyAudio"]', builder).checked = input.checked; },
      'Live music': () => { $('[data-live-hours]', builder).value = input.checked ? '1' : '0'; },
      'Wine & Canvas activity': () => { $('[data-canvas-experience]', builder).value = input.checked ? 'help' : 'none'; },
      'Custom event enhancement': () => { $('[data-planner-enhancement="custom"]', builder).checked = input.checked; }
    };
    map[input.value]?.();
    syncing = false;
    updatePlan();
  }

  document.addEventListener('private-menu:estimate', (event) => {
    state.food = { ...state.food, ...(event.detail || {}) };
    updatePlan();
  });

  renderKnownBeverages();
  window.Mockingbird?.fetchJSON?.('drinks.json', {}).then(applyDrinkPrices).catch(() => {});
  $$('[name="beverage-method"]', builder).forEach((radio) => radio.addEventListener('change', () => {
    track('beverage_method_selected', { beverage_method: radio.value });
    updatePlan();
  }));
  $$('[data-custom-beverage], [data-planner-enhancement]', builder).forEach((input) => input.addEventListener('change', () => {
    if (input.matches('[data-planner-enhancement]') && input.checked) track('enhancement_selected', { enhancement_type: input.dataset.plannerEnhancement });
    updatePlan();
  }));
  $$('select, input[type="text"], input[type="number"], textarea', builder).forEach((input) => input.addEventListener('input', updatePlan));
  $$('select', builder).forEach((input) => input.addEventListener('change', updatePlan));
  form.addEventListener('change', (event) => syncFromInquiry(event.target));
  $('[data-calculator-to-form]', builder)?.addEventListener('click', () => track('preliminary_estimate_created'));

  window.PrivateEventPlanner = {
    update: updatePlan,
    getEstimate: () => ({ ...(state.estimate || {}) }),
    getHeadline: () => ({
      guestCount: Number(state.food.guestCount) || 0,
      menuLabel: state.food.menuLabel || '',
      itemCount: (state.food.selectedItems || []).length,
      beverageMethod: methodLabels[selectedMethod()],
      total: hasGuests() ? state.estimate?.estimatedTotal : null
    }),
    getSubmissionSections: () => state.sections.map((section) => ({ title: section.title, lines: [...section.lines] }))
  };

  updatePlan();
})();
