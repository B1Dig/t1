/* ══════════════════════════════════════════════
   MODE CONFIG
══════════════════════════════════════════════ */
const MODES = {
  gym: {
    label: 'Fitness Center',
    eventsTitle: "Today's Schedule",
    showCalendar: true,
    backgrounds: [
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2670&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2670&auto=format&fit=crop',
    ],
    stripDefaults: [
      { id: '1', icon: '🏋️', text: 'Fitness Center — Open 6AM to 10PM', tag: 'HOURS' },
      { id: '2', icon: '🧘', text: 'Yoga Class — Mon & Wed 7:00 AM',     tag: 'CLASS' },
      { id: '3', icon: '🏃', text: 'Cardio Bootcamp — Tue & Thu 6:30 PM', tag: 'CLASS' },
      { id: '4', icon: '💪', text: 'Personal Training Available',          tag: 'INFO' },
    ],
  },
  dining: {
    label: 'Dining Hall',
    eventsTitle: 'Meal Times',
    showCalendar: false,
    backgrounds: [
      'https://images.unsplash.com/photo-1567521464027-f127ff144326?q=80&w=2748&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2670&auto=format&fit=crop',
    ],
    stripDefaults: [
      { id: '1', icon: '🍳', text: 'Breakfast — 7:00 AM to 10:30 AM',  tag: 'HOURS' },
      { id: '2', icon: '🥗', text: 'Lunch — 11:00 AM to 2:30 PM',      tag: 'HOURS' },
      { id: '3', icon: '🍽️', text: 'Dinner — 5:00 PM to 8:00 PM',      tag: 'HOURS' },
      { id: '4', icon: '☕', text: 'Coffee Bar Open All Day',            tag: 'INFO' },
    ],
  },
  campus: {
    label: 'Campus',
    eventsTitle: "Today's Events",
    showCalendar: false,
    backgrounds: [
      'https://images.unsplash.com/photo-1541753236788-b0ac1fc5009d?q=80&w=2612&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2670&auto=format&fit=crop',
    ],
    stripDefaults: [
      { id: '1', icon: '🎓', text: 'Welcome to UMass Boston',              tag: 'NEWS' },
      { id: '2', icon: '📅', text: 'Spring 2025 Registration Now Open',    tag: 'REGISTER' },
      { id: '3', icon: '🏆', text: 'UMass Boston Athletics',               tag: 'SPORTS' },
      { id: '4', icon: '📢', text: 'Campus Events Every Week',             tag: 'EVENTS' },
      { id: '5', icon: '🌐', text: 'Online & Hybrid Courses Available',    tag: 'ONLINE' },
    ],
  },
};
const DEFAULT_MODE = 'campus';


/* ══════════════════════════════════════════════
   GLOBAL STATE
══════════════════════════════════════════════ */
let calModalDay  = null;
let calHolidays  = [];
let weekOffset   = 0;
let _didDrag     = false;

const DEFAULT_COMMERCIAL = MODES[DEFAULT_MODE].stripDefaults;


/* ══════════════════════════════════════════════
   WIDGET SIZE TOGGLE
══════════════════════════════════════════════ */
function toggleWidgetSize(name) {
  if (_didDrag) return; // ignore if we were just dragging
  const el = document.getElementById('widget-' + name);
  if (!el) return;
  const next = el.dataset.size === 'compact' ? 'expanded' : 'compact';
  el.dataset.size = next;
  localStorage.setItem('size_' + name, next);
}


/* ══════════════════════════════════════════════
   WIDGET VISIBILITY
══════════════════════════════════════════════ */
function hideWidget(name) {
  const el = document.getElementById('widget-' + name);
  if (el) el.style.display = 'none';
  const h = JSON.parse(localStorage.getItem('hidden_widgets') || '[]');
  if (!h.includes(name)) { h.push(name); localStorage.setItem('hidden_widgets', JSON.stringify(h)); }
  updateRestoreBar();
}

function showWidget(name) {
  const el = document.getElementById('widget-' + name);
  if (el) el.style.display = '';
  const h = JSON.parse(localStorage.getItem('hidden_widgets') || '[]').filter(n => n !== name);
  localStorage.setItem('hidden_widgets', JSON.stringify(h));
  updateRestoreBar();
}

function updateRestoreBar() {
  const bar = document.getElementById('restore-bar');
  const hidden = JSON.parse(localStorage.getItem('hidden_widgets') || '[]');
  const labels = { events: '+ Upcoming Events', clock: '+ Time & Weather' };
  bar.innerHTML = '';
  hidden.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'restore-btn';
    btn.textContent = labels[name] || ('+ ' + name);
    btn.onclick = () => showWidget(name);
    bar.appendChild(btn);
  });
  bar.classList.toggle('visible', hidden.length > 0);
}


/* ══════════════════════════════════════════════
   DRAGGABLE
══════════════════════════════════════════════ */
function initDraggable(widgetId, handleId) {
  const el     = document.getElementById(widgetId);
  const handle = document.getElementById(handleId);
  if (!el || !handle) return;

  // Always use top/left for stable positioning during size toggle
  const rect  = el.getBoundingClientRect();
  const saved = JSON.parse(localStorage.getItem('pos_' + widgetId) || 'null');
  if (saved) {
    el.style.left = saved.left; el.style.top = saved.top;
  } else {
    el.style.left = rect.left + 'px'; el.style.top = rect.top + 'px';
  }
  el.style.right = ''; el.style.bottom = '';

  // Restore size
  const savedSize = localStorage.getItem('size_' + widgetId.replace('widget-', ''));
  if (savedSize) el.dataset.size = savedSize;

  // Restore visibility
  const hidden = JSON.parse(localStorage.getItem('hidden_widgets') || '[]');
  if (hidden.includes(widgetId.replace('widget-', ''))) el.style.display = 'none';

  let startX, startY, startL, startT;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    _didDrag = false;
    const r = el.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    startL = r.left;    startT = r.top;
    el.style.left = startL + 'px'; el.style.top = startT + 'px';
    handle.classList.add('dragging');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  function onMove(e) {
    _didDrag = true;
    el.style.left = Math.max(0, startL + e.clientX - startX) + 'px';
    el.style.top  = Math.max(0, startT + e.clientY - startY) + 'px';
  }

  function onUp() {
    handle.classList.remove('dragging');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (_didDrag) {
      localStorage.setItem('pos_' + widgetId, JSON.stringify({ left: el.style.left, top: el.style.top }));
      setTimeout(() => { _didDrag = false; }, 100);
    }
  }
}


/* ══════════════════════════════════════════════
   CALENDAR
══════════════════════════════════════════════ */
function calNav(delta) {
  weekOffset += delta;
  if (window._renderCalendar) window._renderCalendar();
}

function calGoToday() {
  weekOffset = 0;
  if (window._renderCalendar) window._renderCalendar();
}

function openCalModal(day, holidays) {
  calModalDay = day; calHolidays = holidays || [];
  document.getElementById('cal-modal-title').textContent =
    day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('new-event-title').value = '';
  document.getElementById('new-event-time').value  = '';
  document.getElementById('new-event-meta').value  = '';
  renderCalModalEvents();
  document.getElementById('cal-modal').classList.add('open');
}

function renderCalModalEvents() {
  const container = document.getElementById('cal-modal-events');
  container.innerHTML = '';
  const dayHols   = calHolidays.filter(h => new Date(h.date).toDateString() === calModalDay.toDateString());
  const stored    = JSON.parse(localStorage.getItem('events') || '[]');
  const dayCustom = stored.filter(e => new Date(e.date).toDateString() === calModalDay.toDateString());
  if (!dayHols.length && !dayCustom.length) {
    container.innerHTML = '<div style="color:rgba(255,255,255,.38);font-size:13px;padding:8px 0;">No events for this day.</div>';
    return;
  }
  dayHols.forEach(h => {
    const item = document.createElement('div');
    item.className = 'modal-event-item';
    item.innerHTML = `<div class="ev-info"><div class="ev-name">${h.localName}</div><div class="ev-time">Public Holiday</div></div>`;
    container.appendChild(item);
  });
  dayCustom.forEach(ev => {
    const item = document.createElement('div');
    item.className = 'modal-event-item';
    const ts = [ev.time, ev.meta].filter(Boolean).join(' · ');
    item.innerHTML = `<div class="ev-info"><div class="ev-name">${ev.title}</div>${ts ? `<div class="ev-time">${ts}</div>` : ''}</div>
      <button class="modal-delete-btn" onclick="deleteCalEvent('${ev.id}')">Remove</button>`;
    container.appendChild(item);
  });
}

function addCalendarEvent() {
  const title = document.getElementById('new-event-title').value.trim();
  if (!title) return;
  const time  = document.getElementById('new-event-time').value;
  const meta  = document.getElementById('new-event-meta').value.trim();
  const stored = JSON.parse(localStorage.getItem('events') || '[]');
  stored.push({ id: Date.now().toString(), date: calModalDay.toDateString(), title, time, meta });
  localStorage.setItem('events', JSON.stringify(stored));
  document.getElementById('new-event-title').value = '';
  document.getElementById('new-event-time').value  = '';
  document.getElementById('new-event-meta').value  = '';
  renderCalModalEvents();
  if (window._renderCalendar) window._renderCalendar();
}

function deleteCalEvent(id) {
  const stored = JSON.parse(localStorage.getItem('events') || '[]').filter(e => e.id !== id);
  localStorage.setItem('events', JSON.stringify(stored));
  renderCalModalEvents();
  if (window._renderCalendar) window._renderCalendar();
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}


/* ══════════════════════════════════════════════
   COMMERCIAL STRIP
══════════════════════════════════════════════ */
function getCommercialSections(modeStripDefaults) {
  const s = localStorage.getItem('commercial_sections');
  return s ? JSON.parse(s) : (modeStripDefaults || DEFAULT_COMMERCIAL);
}
function saveCommercialSections(s) { localStorage.setItem('commercial_sections', JSON.stringify(s)); }

function renderCommercialStrip(modeStripDefaults) {
  const track = document.getElementById('commercial-track');
  const secs  = getCommercialSections(modeStripDefaults);
  if (!secs.length) { track.innerHTML = ''; return; }
  const build = () => secs.map(s => `
    <div class="commercial-section">
      ${s.icon ? `<span class="sect-icon">${s.icon}</span>` : ''}
      <span class="sect-text">${s.text}</span>
      ${s.tag ? `<span class="sect-tag">${s.tag}</span>` : ''}
    </div>`).join('');
  track.innerHTML = build() + build();
  track.style.animationDuration = Math.max(18, secs.length * 7) + 's';
}

function openCommercialEditor() { renderCommercialSectionsList(); document.getElementById('commercial-modal').classList.add('open'); }

function renderCommercialSectionsList() {
  const container = document.getElementById('commercial-sections-list');
  const secs = getCommercialSections();
  container.innerHTML = '';
  if (!secs.length) { container.innerHTML = '<div style="color:rgba(255,255,255,.38);font-size:13px;padding:8px 0;">No sections yet.</div>'; return; }
  secs.forEach(s => {
    const item = document.createElement('div');
    item.className = 'modal-event-item';
    item.innerHTML = `<div class="ev-info"><div class="ev-name">${s.icon||''} ${s.text}</div>${s.tag?`<div class="ev-time">Tag: ${s.tag}</div>`:''}</div>
      <button class="modal-delete-btn" onclick="deleteCommercialSection('${s.id}')">Remove</button>`;
    container.appendChild(item);
  });
}

function addCommercialSection() {
  const icon = document.getElementById('new-comm-icon').value.trim();
  const text = document.getElementById('new-comm-text').value.trim();
  const tag  = document.getElementById('new-comm-tag').value.trim().toUpperCase();
  if (!text) return;
  const secs = getCommercialSections();
  secs.push({ id: Date.now().toString(), icon, text, tag });
  saveCommercialSections(secs);
  document.getElementById('new-comm-icon').value = '';
  document.getElementById('new-comm-text').value = '';
  document.getElementById('new-comm-tag').value  = '';
  renderCommercialSectionsList();
  renderCommercialStrip();
}

function deleteCommercialSection(id) {
  saveCommercialSections(getCommercialSections().filter(s => s.id !== id));
  renderCommercialSectionsList();
  renderCommercialStrip();
}


/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* ── Resolve mode from URL ── */
  const params   = new URLSearchParams(window.location.search);
  const modeName = params.get('mode') || DEFAULT_MODE;
  const mode     = MODES[modeName] || MODES[DEFAULT_MODE];

  /* Apply mode: events title */
  const ecbTitle = document.querySelector('.ecb-title');
  if (ecbTitle) ecbTitle.textContent = mode.eventsTitle;

  /* Apply mode: calendar visibility */
  if (!mode.showCalendar) {
    const cal = document.getElementById('center-calendar');
    if (cal) cal.style.display = 'none';
  }

  /* Modal overlay close */
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });

  /* Draggable widgets */
  initDraggable('widget-events', 'handle-events');
  initDraggable('widget-clock',  'handle-clock');
  updateRestoreBar();

  /* ── Media Carousel ── */
  const carousel = document.getElementById('carousel-container');
  const playlist = mode.backgrounds.map(src => ({ type: 'image', src }));
  let idx = 0, cur = null;
  function showNextMedia() {
    const m = playlist[idx];
    let el;
    if (m.type === 'video') {
      el = document.createElement('video'); el.src = m.src; el.autoplay = true; el.muted = true; el.loop = true; el.playsInline = true;
    } else {
      el = document.createElement('img'); el.src = m.src; el.alt = '';
    }
    el.className = 'media-layer';
    carousel.appendChild(el); void el.offsetWidth; el.classList.add('active');
    if (cur) { const old = cur; old.classList.remove('active'); setTimeout(() => old.remove(), 1500); }
    cur = el; idx = (idx + 1) % playlist.length;
  }
  showNextMedia(); setInterval(showNextMedia, 8000);

  /* ── Clock ── */
  function updateTime() {
    const now = new Date();
    const t = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const d = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    document.getElementById('time').textContent   = t;
    document.getElementById('date').textContent   = d;
    document.getElementById('cc-time').textContent = t;
    document.getElementById('cc-date').textContent = d;
  }
  updateTime(); setInterval(updateTime, 1000);

  /* ── Weather ── */
  async function fetchWeather() {
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060' +
                  '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index' +
                  '&wind_speed_unit=mph&timezone=America%2FNew_York';
      const r = await fetch(url);
      if (!r.ok) return;
      const d = await r.json();
      const c = d.current;
      const temp   = Math.round(c.temperature_2m);
      const feels  = Math.round(c.apparent_temperature);
      const humid  = Math.round(c.relative_humidity_2m);
      const wind   = Math.round(c.wind_speed_10m);
      const uv     = c.uv_index !== undefined ? c.uv_index.toFixed(1) : '--';
      const code   = c.weather_code;
      const desc   = weatherDesc(code);
      const svg    = weatherSVG(code);
      const svgSm  = weatherSVGSmall(code);

      document.getElementById('temp').textContent          = `${temp}°C`;
      document.getElementById('weather-desc').textContent  = desc;
      document.getElementById('weather-icon-container').innerHTML = svg;
      document.getElementById('wex-wind').textContent      = `${wind} mph`;
      document.getElementById('wex-humidity').textContent  = `${humid}%`;
      document.getElementById('wex-feels').textContent     = `${feels}°C`;
      document.getElementById('wex-uv').textContent        = uv;

      document.getElementById('cc-temp').textContent  = `${temp}°C`;
      document.getElementById('cc-desc').textContent  = desc;
      document.getElementById('cc-icon').innerHTML    = svgSm;
    } catch(e) { console.error(e); }
  }

  function weatherDesc(c) {
    if (c === 0)              return 'Clear sky';
    if (c <= 3)               return 'Partly cloudy';
    if (c >= 45 && c <= 48)  return 'Foggy';
    if (c >= 51 && c <= 67)  return 'Rain';
    if (c >= 71 && c <= 77)  return 'Snow';
    if (c >= 80 && c <= 82)  return 'Showers';
    if (c >= 95)              return 'Thunderstorm';
    return 'Cloudy';
  }

  function weatherSVG(c) {
    const sun   = `<svg class="weather-icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#e67e22"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#e67e22" stroke-width="2" stroke-linecap="round"/></svg>`;
    const cloud = `<svg class="weather-icon-svg" viewBox="0 0 24 24"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#7f8c8d"/></svg>`;
    const fog   = `<svg class="weather-icon-svg" viewBox="0 0 24 24"><path d="M4 10h16v2H4zm0 4h16v2H4zm0 4h16v2H4z" fill="#7f8c8d"/></svg>`;
    const rain  = `<svg class="weather-icon-svg" viewBox="0 0 24 24"><path d="M16 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#7f8c8d"/><path d="M8 21v2m4-2v2m4-2v2" stroke="#2980b9" stroke-width="2" stroke-linecap="round"/></svg>`;
    const snow  = `<svg class="weather-icon-svg" viewBox="0 0 24 24"><path d="M16 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#7f8c8d"/><path d="M8 21h.01M12 21h.01M16 21h.01" stroke="#2980b9" stroke-width="3" stroke-linecap="round"/></svg>`;
    const thund = `<svg class="weather-icon-svg" viewBox="0 0 24 24"><path d="M16 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#7f8c8d"/><path d="M13 14l-2 4h3l-1 4" stroke="#f1c40f" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    if (c === 0) return sun;
    if (c <= 3)  return cloud;
    if (c >= 45 && c <= 48) return fog;
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return rain;
    if (c >= 71 && c <= 77) return snow;
    if (c >= 95) return thund;
    return cloud;
  }

  function weatherSVGSmall(c) {
    // same icons but with cc-icon-sm class
    return weatherSVG(c).replace('class="weather-icon-svg"', 'class="cc-icon-sm"');
  }

  fetchWeather(); setInterval(fetchWeather, 1800000);

  /* ── Calendar ── */
  async function renderCalendar() {
    const weekEl  = document.getElementById('cal-week');
    const rangeEl = document.getElementById('cal-week-range');
    weekEl.innerHTML = '';

    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    const end = new Date(start); end.setDate(start.getDate() + 6);

    const fmt = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    rangeEl.textContent = `${fmt(start)} – ${fmt(end)}`;

    if (!calHolidays.length) {
      try {
        const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${today.getFullYear()}/US`);
        if (r.ok) calHolidays = await r.json();
      } catch(e) {}
    }

    const stored = JSON.parse(localStorage.getItem('events') || '[]');

    for (let i = 0; i < 7; i++) {
      const day = new Date(start); day.setDate(start.getDate() + i);
      const isToday = day.toDateString() === today.toDateString();

      const dayEl = document.createElement('div');
      dayEl.className = 'cal-day' + (isToday ? ' today' : '');
      dayEl.addEventListener('click', () => openCalModal(day, calHolidays));

      const hdr = document.createElement('div');
      hdr.className = 'cal-day-header';
      hdr.textContent = day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
      dayEl.appendChild(hdr);

      const dayHols   = calHolidays.filter(h => new Date(h.date).toDateString() === day.toDateString());
      const dayCustom = stored.filter(e => new Date(e.date).toDateString() === day.toDateString());
      const all = [...dayHols, ...dayCustom];

      if (!all.length) {
        const none = document.createElement('div');
        none.className = 'cal-no-event'; none.textContent = '—';
        dayEl.appendChild(none);
      } else {
        all.forEach(ev => {
          const evEl = document.createElement('div');
          evEl.className = 'cal-event';
          evEl.textContent = ev.localName || ev.title;
          dayEl.appendChild(evEl);
        });
      }
      weekEl.appendChild(dayEl);
    }
  }

  renderCalendar();
  window._renderCalendar = renderCalendar;

  /* Calendar mouse wheel navigation */
  document.getElementById('center-calendar').addEventListener('wheel', e => {
    e.preventDefault();
    weekOffset += e.deltaY > 0 ? 1 : -1;
    renderCalendar();
  }, { passive: false });

  /* Commercial strip */
  renderCommercialStrip(mode.stripDefaults);
});
