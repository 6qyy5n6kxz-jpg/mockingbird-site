(function() {
  if (!window.withBase) return;
  const grid = document.getElementById('availability-grid');
  const monthLabel = document.getElementById('availability-month');
  const prevBtn = document.getElementById('availability-prev');
  const nextBtn = document.getElementById('availability-next');
  const warning = document.getElementById('availability-warning');
  const timeWarning = document.getElementById('availability-warning-time');
  const dateInput = document.getElementById('party-date');
  const timeSelect = document.getElementById('party-time-window');
  const fallback = document.getElementById('availability-fallback');

  if (!grid || !monthLabel) return;

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const blockedSet = new Set();
  const blockedDates = [];
  let viewDate = new Date();
  viewDate.setDate(1);

  function toKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseDate(value) {
    if (!value) return null;
    const parts = value.split('-').map((n) => Number(n));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function addBlockedDate(date) {
    const key = toKey(date);
    if (blockedSet.has(key)) return;
    blockedSet.add(key);
    blockedDates.push(key);
  }

  function expandRange(start, end) {
    const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (current <= last) {
      addBlockedDate(current);
      current.setDate(current.getDate() + 1);
    }
  }

  function renderFallbackList() {
    if (!fallback) return;
    const list = fallback.querySelector('ul');
    if (!list) return;
    const today = new Date();
    const upcoming = blockedDates
      .map((key) => parseDate(key))
      .filter((d) => d && d >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
      .sort((a, b) => a - b)
      .slice(0, 10);
    list.innerHTML = '';
    if (!upcoming.length) {
      fallback.hidden = true;
      return;
    }
    fallback.hidden = false;
    upcoming.forEach((date) => {
      const li = document.createElement('li');
      li.textContent = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      list.appendChild(li);
    });
  }

  const startOfToday = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
  // Thursday–Saturday evenings are regular dinner service; those days are open for daytime events only.
  const isDaytimeOnly = (date) => [4, 5, 6].includes(date.getDay());

  function selectDate(key) {
    if (!dateInput) return;
    dateInput.value = key;
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    renderCalendar();
  }

  function renderCalendar() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const today = startOfToday();
    const todayKey = toKey(today);
    const selectedKey = dateInput?.value || '';
    monthLabel.textContent = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (prevBtn) prevBtn.disabled = year < today.getFullYear() || (year === today.getFullYear() && month <= today.getMonth());
    grid.innerHTML = '';
    weekdayLabels.forEach((label) => {
      const el = document.createElement('div');
      el.className = 'availability-weekday';
      el.textContent = label;
      el.setAttribute('aria-hidden', 'true');
      grid.appendChild(el);
    });
    const startOffset = new Date(year, month, 1).getDay();
    for (let i = 0; i < startOffset; i += 1) {
      const pad = document.createElement('div');
      pad.className = 'availability-pad';
      grid.appendChild(pad);
    }
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const key = toKey(date);
      const past = date < today;
      const booked = blockedSet.has(key);
      const daytime = !past && !booked && isDaytimeOnly(date);
      const label = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
      let cell;
      if (past || booked) {
        cell = document.createElement('div');
        cell.setAttribute('aria-disabled', 'true');
        cell.classList.add(past ? 'is-past' : 'unavailable');
        if (booked && !past) cell.classList.add('is-unavailable');
        cell.setAttribute('aria-label', `${label} — ${past ? 'past' : 'booked'}`);
        if (booked && !past) cell.title = 'Booked';
      } else {
        cell = document.createElement('button');
        cell.type = 'button';
        if (daytime) cell.classList.add('is-daytime');
        cell.setAttribute('aria-label', `${label} — ${daytime ? 'open for daytime events' : 'open'}`);
        cell.setAttribute('aria-pressed', key === selectedKey ? 'true' : 'false');
        cell.title = daytime ? 'Open for daytime events' : 'Open';
        cell.addEventListener('click', () => selectDate(key));
      }
      cell.classList.add('calendar-day', 'cal-day');
      if (key === todayKey) cell.classList.add('today', 'is-today');
      if (key === selectedKey) cell.classList.add('is-selected');
      cell.setAttribute('role', 'gridcell');
      cell.textContent = String(day);
      grid.appendChild(cell);
    }
  }

  function updateWarning() {
    if (!warning || !dateInput) return;
    const value = dateInput.value;
    if (timeWarning) timeWarning.textContent = '';
    if (!value) { warning.textContent = ''; return; }
    const date = parseDate(value);
    if (date && date < startOfToday()) warning.textContent = 'That date has already passed. Please choose a future date.';
    else if (blockedSet.has(value)) warning.textContent = 'That date is already booked. You can still send your request if you are flexible, and we’ll suggest options.';
    else if (date && isDaytimeOnly(date)) warning.textContent = 'Thursday–Saturday are open for morning and afternoon events only.';
    else warning.textContent = '';
    if (timeWarning && timeSelect && date && timeSelect.value === 'Evening' && isDaytimeOnly(date)) {
      timeWarning.textContent = 'Thursday–Saturday evenings aren’t available. Choose morning or afternoon, or another date.';
    }
  }

  // Typing a date moves the calendar to it.
  function showDateMonth() {
    const date = parseDate(dateInput?.value);
    if (date) viewDate = new Date(date.getFullYear(), date.getMonth(), 1);
    renderCalendar();
  }

  function attachNav() {
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        viewDate.setMonth(viewDate.getMonth() - 1);
        renderCalendar();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        viewDate.setMonth(viewDate.getMonth() + 1);
        renderCalendar();
      });
    }
    if (dateInput) {
      dateInput.min = toKey(startOfToday());
      dateInput.addEventListener('change', () => { updateWarning(); showDateMonth(); });
      dateInput.addEventListener('input', updateWarning);
    }
    if (timeSelect) {
      timeSelect.addEventListener('change', updateWarning);
    }
  }

  function loadData() {
    fetch(withBase('/data/private-availability.json'))
      .then((res) => res.json())
      .then((data) => {
        (data?.blocked_dates || []).forEach((entry) => {
          const date = parseDate(entry);
          if (date) addBlockedDate(date);
        });
        (data?.blocked_ranges || []).forEach((range) => {
          const start = parseDate(range?.start);
          const end = parseDate(range?.end);
          if (start && end) expandRange(start, end);
        });
        blockedDates.sort();
        renderCalendar();
        renderFallbackList();
        updateWarning();
        attachNav();
      })
      .catch(() => {
        renderCalendar();
        attachNav();
      });
  }

  loadData();
})();
