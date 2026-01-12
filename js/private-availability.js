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

  function renderCalendar() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    monthLabel.textContent = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    grid.innerHTML = '';
    weekdayLabels.forEach((label) => {
      const el = document.createElement('div');
      el.className = 'availability-weekday';
      el.textContent = label;
      el.setAttribute('aria-hidden', 'true');
      grid.appendChild(el);
    });
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    for (let i = 0; i < startOffset; i += 1) {
      const pad = document.createElement('div');
      pad.className = 'availability-pad';
      grid.appendChild(pad);
    }
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayKey = toKey(today);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const key = toKey(date);
      const cell = document.createElement('div');
      cell.className = 'calendar-day cal-day';
      if (key === todayKey) cell.classList.add('today', 'is-today');
      if (blockedSet.has(key)) cell.classList.add('unavailable', 'is-unavailable');
      cell.textContent = String(day);
      const status = blockedSet.has(key) ? 'Unavailable' : 'Available';
      cell.setAttribute('aria-label', `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} — ${status}`);
      cell.setAttribute('role', 'gridcell');
      if (blockedSet.has(key)) {
        cell.setAttribute('aria-disabled', 'true');
        cell.title = 'Unavailable (already booked)';
      }
      grid.appendChild(cell);
    }
  }

  function updateWarning() {
    if (!warning || !dateInput) return;
    const value = dateInput.value;
    if (!value) {
      warning.textContent = '';
      if (timeWarning) timeWarning.textContent = '';
      return;
    }
    if (blockedSet.has(value)) {
      warning.textContent = 'That date appears unavailable—still submit if flexible, and we’ll confirm options.';
    } else {
      warning.textContent = '';
    }
    if (timeWarning && timeSelect) {
      const selected = timeSelect.value || '';
      const date = parseDate(value);
      if (date && selected === 'Evening') {
        const day = date.getDay();
        if (day === 4 || day === 5 || day === 6) {
          timeWarning.textContent = 'Thursday–Saturday evenings aren’t available—submit if flexible and we’ll follow up with alternatives.';
        } else {
          timeWarning.textContent = '';
        }
      } else {
        timeWarning.textContent = '';
      }
    }
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
      dateInput.addEventListener('change', updateWarning);
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
