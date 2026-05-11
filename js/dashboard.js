/* ══════════════════════════════════════════════
   MODE CONFIG
══════════════════════════════════════════════ */
const MODES = {
  gym:           { label: 'Fitness Center', eventsTitle: "Today's Schedule",  showCalendar: true  },
  dining:        { label: 'Dining Hall',    eventsTitle: 'Meal Times',         showCalendar: false },
  campus:        { label: 'Campus',         eventsTitle: "Today's Events",     showCalendar: false },
  entertainment: { label: 'Entertainment',  eventsTitle: "Tonight's Shows",    showCalendar: true  },
};
const DEFAULT_MODE = 'campus';


/* ══════════════════════════════════════════════
   GLOBAL STATE
══════════════════════════════════════════════ */
let calModalDay  = null;
let calHolidays  = [];
let weekOffset   = 0;
let evDayOffset  = 0;
let _didDrag     = false;
let _bgMode      = DEFAULT_MODE;
let _selectedEventImage = null;

const DEFAULT_COMMERCIAL = [];


/* ══════════════════════════════════════════════
   EVENT DATE HELPERS
══════════════════════════════════════════════ */
function parseEventDate(str) {
  if (!str) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  if (str === 'Today') return new Date(today);
  if (str === 'Tomorrow') { const d = new Date(today); d.setDate(d.getDate()+1); return d; }
  const d = new Date(str + ' ' + today.getFullYear());
  if (!isNaN(d.getTime())) { d.setHours(0,0,0,0); return d; }
  return null;
}

function getDayLabel(offset) {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  if (offset === -1) return 'Yesterday';
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function renderEventsWidget(allEvents) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(today); target.setDate(today.getDate() + evDayOffset);

  const dayEvents = allEvents.filter(ev => {
    const d = parseEventDate(ev.date);
    return d && d.toDateString() === target.toDateString();
  });

  const label = getDayLabel(evDayOffset);
  const ecbDayLabel = document.getElementById('ecb-day-label');
  const evDayLabelEl = document.getElementById('ev-day-label');
  if (ecbDayLabel) ecbDayLabel.textContent = label;
  if (evDayLabelEl) evDayLabelEl.textContent = label;

  const ecbCount = document.getElementById('ecb-count');
  const ecbNext  = document.getElementById('ecb-next');
  if (ecbCount) ecbCount.textContent = dayEvents.length;
  if (ecbNext)  ecbNext.textContent  = dayEvents.length ? dayEvents[0].name : 'No events';

  const eventsList = document.getElementById('events-list');
  if (!eventsList) return;
  if (!dayEvents.length) {
    eventsList.innerHTML = '<div style="color:rgba(0,0,0,.45);font-size:13px;padding:12px 0 4px;text-align:center;">No events for this day.</div>';
    return;
  }
  eventsList.innerHTML = dayEvents.map(ev => `
    <div class="ev-row">
      <div class="col-left"><div class="dow">${ev.dow}</div><div class="time">${ev.time}</div></div>
      <div class="col-right"><div class="date">${ev.date}</div><div class="name">${ev.name}</div><div class="meta">${ev.meta || ''}</div></div>
    </div>`).join('');
}

function shiftEvDay(delta) {
  evDayOffset += delta;
  renderEventsWidget(window._facilityEvents || []);
}


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
   EDIT VISIBILITY
══════════════════════════════════════════════ */
function toggleEditMode() {
    const body = document.body;
    const btn = document.getElementById('edit-mode-btn');

    body.classList.toggle('edit-only');

    if (body.classList.contains('edit-only')) {
        btn.textContent = 'Show Edit Controls';
    } else {
        btn.textContent = 'Hide Edit Controls';
    }
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
  loadEventImagePicker();
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
    const thumb = ev.image ? `<img src="${ev.image}" style="width:48px;height:36px;object-fit:cover;border-radius:5px;flex-shrink:0;margin-right:4px;" />` : '';
    item.innerHTML = `${thumb}<div class="ev-info"><div class="ev-name">${ev.title}</div>${ts ? `<div class="ev-time">${ts}</div>` : ''}</div>
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
  const ev = { id: Date.now().toString(), date: calModalDay.toDateString(), title, time, meta };
  if (_selectedEventImage) ev.image = _selectedEventImage;
  stored.push(ev);
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
   BACKGROUND MANAGER
══════════════════════════════════════════════ */
function openBgManager() {
  document.getElementById('bg-modal').classList.add('open');
  loadBgImages();
}

async function loadBgImages() {
  const grid    = document.getElementById('bg-image-grid');
  const countEl = document.getElementById('bg-count-label');
  grid.innerHTML = '<div class="bg-empty-state">Loading...</div>';
  const pinned = localStorage.getItem('pinned_bg');
  try {
    const r = await fetch(`/api/images/list?mode=${_bgMode}`);
    if (!r.ok) {
      const msg = await r.text().catch(() => r.statusText);
      console.error('List API error:', r.status, msg);
      grid.innerHTML = `<div class="bg-empty-state">API error ${r.status} — check console for details.</div>`;
      return;
    }
    const urls = await r.json();
    countEl.textContent = urls.length ? `(${urls.length})` : '';
    if (!urls.length) {
      grid.innerHTML = '<div class="bg-empty-state">No images uploaded yet.</div>';
      return;
    }
    grid.innerHTML = '';
    urls.forEach(url => {
      const isPinned = url === pinned;
      const item = document.createElement('div');
      item.className = 'bg-image-item' + (isPinned ? ' is-pinned' : '');
      item.innerHTML = `
        <img src="${url}" loading="lazy" alt="" />
        <div class="bg-image-controls">
          <button class="bg-img-action bg-action-pin">${isPinned ? '📌 Unpin' : '📌 Pin'}</button>
          <button class="bg-img-action bg-action-place">📍 Place</button>
          <button class="bg-img-action danger bg-action-delete">🗑 Delete</button>
        </div>`;
      item.querySelector('.bg-action-pin').onclick    = () => isPinned ? clearPinnedBg() : setPinnedBg(url);
      item.querySelector('.bg-action-place').onclick  = () => placeImageOnScreen(url);
      item.querySelector('.bg-action-delete').onclick = e  => deleteBgImage(url, e.currentTarget);
      grid.appendChild(item);
    });
  } catch(e) {
    console.error('loadBgImages failed:', e);
    grid.innerHTML = `<div class="bg-empty-state">Could not reach API — are you running via <code>vercel dev</code>?</div>`;
  }
}

async function deleteBgImage(url, btn) {
  const orig = btn.textContent; btn.textContent = '…';
  try {
    const r = await fetch('/api/images/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (r.ok) {
      if (localStorage.getItem('pinned_bg') === url) { localStorage.removeItem('pinned_bg'); renderPinnedBadge(); }
      loadBgImages();
    } else { btn.textContent = orig; }
  } catch(e) { btn.textContent = orig; }
}


/* ── Pinned background ── */
function setPinnedBg(url) {
  localStorage.setItem('pinned_bg', url);
  location.reload();
}

function clearPinnedBg() {
  localStorage.removeItem('pinned_bg');
  location.reload();
}

function renderPinnedBadge() {
  document.getElementById('pinned-bg-badge')?.remove();
  if (!localStorage.getItem('pinned_bg')) return;
  const btn = document.createElement('button');
  btn.id = 'pinned-bg-badge';
  btn.className = 'pinned-bg-badge';
  btn.textContent = '📌 Background pinned — click to resume slideshow';
  btn.onclick = clearPinnedBg;
  document.body.appendChild(btn);
}


/* ── Placed images ── */
function getPlacedImages()      { return JSON.parse(localStorage.getItem('placed_images') || '[]'); }
function savePlacedImages(arr)  { localStorage.setItem('placed_images', JSON.stringify(arr)); }

function renderPlacedImages() {
  document.querySelectorAll('.placed-image-wrap').forEach(el => el.remove());
  getPlacedImages().forEach(createPlacedImageEl);
}

function placeImageOnScreen(url) {
  closeModal('bg-modal');
  const p = {
    id:    Date.now().toString(),
    url,
    x:     Math.round(window.innerWidth  / 2 - 150),
    y:     Math.round(window.innerHeight / 2 - 100),
    width: 300,
  };
  const arr = getPlacedImages(); arr.push(p); savePlacedImages(arr);
  createPlacedImageEl(p);
}

function deletePlacedImage(id) {
  document.getElementById('placed-' + id)?.remove();
  savePlacedImages(getPlacedImages().filter(p => p.id !== id));
}

function createPlacedImageEl(p) {
  const wrap = document.createElement('div');
  wrap.className = 'placed-image-wrap';
  wrap.id = 'placed-' + p.id;
  wrap.style.cssText = `left:${p.x}px; top:${p.y}px; width:${p.width}px;`;
  wrap.innerHTML = `
    <div class="placed-image-hud">
      <span class="placed-drag-handle" id="pdh-${p.id}">⠿ Move</span>
      <button class="placed-delete-btn" id="pdb-${p.id}">✕</button>
    </div>
    <img src="${p.url}" class="placed-image-img" draggable="false" alt="" />
    <div class="placed-resize-handle" id="prh-${p.id}"></div>`;
  document.body.appendChild(wrap);

  document.getElementById('pdb-' + p.id).onclick = () => deletePlacedImage(p.id);

  // Drag
  const handle = document.getElementById('pdh-' + p.id);
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    const r = wrap.getBoundingClientRect();
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    handle.classList.add('dragging');
    const onMove = e => {
      p.x = Math.max(0, e.clientX - ox);
      p.y = Math.max(0, e.clientY - oy);
      wrap.style.left = p.x + 'px';
      wrap.style.top  = p.y + 'px';
    };
    const onUp = () => {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      savePlacedImages(getPlacedImages().map(i => i.id === p.id ? { ...i, x: p.x, y: p.y } : i));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });

  // Resize
  const resizeHandle = document.getElementById('prh-' + p.id);
  resizeHandle.addEventListener('mousedown', e => {
    e.preventDefault();
    const startW = wrap.offsetWidth, startX = e.clientX;
    const onMove = e => {
      p.width = Math.max(80, startW + e.clientX - startX);
      wrap.style.width = p.width + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      savePlacedImages(getPlacedImages().map(i => i.id === p.id ? { ...i, width: p.width } : i));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}


/* ── Event image picker ── */
function selectEventImage(url) {
  _selectedEventImage = url;
  document.querySelectorAll('.event-img-opt, .event-img-none').forEach(el => el.classList.remove('selected'));
  const sel = url
    ? document.querySelector(`.event-img-opt[data-url="${CSS.escape(url)}"]`)
    : document.getElementById('event-img-none-opt');
  if (sel) sel.classList.add('selected');
}

async function loadEventImagePicker() {
  const picker = document.getElementById('event-img-picker');
  if (!picker) return;
  picker.querySelectorAll('.event-img-opt').forEach(el => el.remove());
  selectEventImage(null);
  try {
    const r = await fetch(`/api/images/list?mode=${_bgMode}`);
    if (!r.ok) return;
    const urls = await r.json();
    urls.forEach(url => {
      const opt = document.createElement('div');
      opt.className = 'event-img-opt';
      opt.dataset.url = url;
      opt.innerHTML = `<img src="${url}" alt="" />`;
      opt.onclick = () => selectEventImage(url);
      picker.appendChild(opt);
    });
  } catch(e) {}
}

function compressImage(file, maxMB = 4) {
  return new Promise((resolve) => {
    if (file.size <= maxMB * 1024 * 1024 && file.type === 'image/jpeg') {
      resolve(file); return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = e => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const MAX_DIM = 2560;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        let quality = 0.88;
        const tryEncode = () => {
          canvas.toBlob(blob => {
            if (blob.size > maxMB * 1024 * 1024 && quality > 0.25) {
              quality = Math.round((quality - 0.1) * 100) / 100;
              tryEncode();
            } else {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
            }
          }, 'image/jpeg', quality);
        };
        tryEncode();
      };
    };
  });
}

async function uploadBgFiles(files) {
  const status      = document.getElementById('bg-upload-status');
  const bar         = document.getElementById('bg-progress-bar');
  const text        = document.getElementById('bg-progress-text');
  const dropContent = document.getElementById('bg-dropzone-content');

  const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!valid.length) return;

  dropContent.style.display = 'none';
  status.style.display = 'block';

  for (let i = 0; i < valid.length; i++) {
    const file = valid[i];

    text.textContent = `Preparing ${i + 1} of ${valid.length}: ${file.name}`;
    bar.style.width  = (i / valid.length * 100) + '%';
    let toUpload;
    try {
      toUpload = await compressImage(file);
    } catch(e) {
      console.error('Compression failed:', file.name, e);
      toUpload = file;
    }

    text.textContent = `Uploading ${i + 1} of ${valid.length}: ${toUpload.name}`;
    try {
      const r = await fetch(`/api/images/upload?mode=${_bgMode}&filename=${encodeURIComponent(toUpload.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': toUpload.type },
        body: toUpload,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        console.error('Upload failed:', file.name, r.status, err);
      }
    } catch(e) {
      console.error('Upload failed:', file.name, e);
    }
  }

  bar.style.width  = '100%';
  text.textContent = valid.length === 1 ? 'Upload complete!' : `${valid.length} images uploaded!`;
  setTimeout(() => {
    status.style.display = 'none';
    dropContent.style.display = '';
    bar.style.width = '0';
    loadBgImages();
  }, 900);
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
document.addEventListener('DOMContentLoaded', async () => {

  /* ── Resolve mode from URL ── */
  const params   = new URLSearchParams(window.location.search);
  const modeName = params.get('mode') || DEFAULT_MODE;
  const mode     = MODES[modeName] || MODES[DEFAULT_MODE];

  /* Apply mode: titles (compact badge + expanded shield) */
  const ecbTitle = document.getElementById('ecb-title-label');
  if (ecbTitle) ecbTitle.textContent = mode.eventsTitle;
  const expandedTitle = document.querySelector('.event-module .title');
  if (expandedTitle) expandedTitle.textContent = mode.eventsTitle;

  /* Apply mode: calendar visibility */
  if (!mode.showCalendar) {
    const cal = document.getElementById('center-calendar');
    if (cal) cal.style.display = 'none';
  }

  /* ── Resolve mode ── */
  _bgMode = modeName;

  /* ── Fetch facility data ── */
  const [eventsData, stripData, backgroundsData] = await Promise.all([
    fetch(`data/${modeName}/events.json`).then(r => r.json()).catch(() => []),
    fetch(`data/${modeName}/strip.json`).then(r => r.json()).catch(() => []),
    fetch(`data/${modeName}/backgrounds.json`).then(r => r.json()).catch(() => []),
  ]);

  /* Apply tag filter if ?tag= is in URL */
  const tagFilter = params.get('tag');
  const filteredEvents = tagFilter
    ? eventsData.filter(e => e.tags && e.tags.includes(tagFilter))
    : eventsData;
  const filteredStrip = tagFilter
    ? stripData.filter(s => s.tags && s.tags.includes(tagFilter))
    : stripData;

  /* Store facility events globally and render day view */
  window._facilityEvents = filteredEvents;
  renderEventsWidget(filteredEvents);

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
  const pinnedBg = localStorage.getItem('pinned_bg');
  if (pinnedBg) {
    const el = document.createElement('img');
    el.src = pinnedBg; el.alt = ''; el.className = 'media-layer';
    carousel.appendChild(el); void el.offsetWidth; el.classList.add('active');
    renderPinnedBadge();
  } else {
    let apiImages = [];
    try {
      const r = await fetch(`/api/images/list?mode=${modeName}`);
      if (r.ok) apiImages = await r.json();
    } catch(e) {}
    const playlist = [...apiImages, ...backgroundsData].map(src => ({ type: 'image', src }));
    if (playlist.length) {
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
    }
  }

  /* ── Placed images ── */
  renderPlacedImages();

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

      const dayHols     = calHolidays.filter(h => new Date(h.date).toDateString() === day.toDateString());
      const dayCustom   = stored.filter(e => new Date(e.date).toDateString() === day.toDateString());
      const dayFacility = (window._facilityEvents || []).filter(ev => {
        const d = parseEventDate(ev.date);
        return d && d.toDateString() === day.toDateString();
      });

      const hasAny = dayHols.length || dayCustom.length || dayFacility.length;
      if (!hasAny) {
        const none = document.createElement('div');
        none.className = 'cal-no-event'; none.textContent = '—';
        dayEl.appendChild(none);
      } else {
        dayHols.forEach(ev => {
          const evEl = document.createElement('div');
          evEl.className = 'cal-event';
          evEl.textContent = ev.localName;
          dayEl.appendChild(evEl);
        });
        dayCustom.forEach(ev => {
          const evEl = document.createElement('div');
          evEl.className = 'cal-event';
          if (ev.image) {
            evEl.innerHTML = `<img class="cal-event-img" src="${ev.image}" alt="${ev.title}"><div>${ev.title}</div>`;
          } else {
            evEl.textContent = ev.title;
          }
          dayEl.appendChild(evEl);
        });
        dayFacility.forEach(ev => {
          const evEl = document.createElement('div');
          evEl.className = 'cal-event cal-event-facility';
          if (ev.image) {
            evEl.innerHTML = `<img class="cal-event-img" src="${ev.image}" alt="${ev.name}"><div>${ev.name}</div>`;
          } else {
            evEl.textContent = (ev.time ? ev.time + ' ' : '') + ev.name;
          }
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

  /* ── Background manager drag-and-drop ── */
  const dropzone  = document.getElementById('bg-dropzone');
  const fileInput = document.getElementById('bg-file-input');
  dropzone.addEventListener('dragover',  e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', ()  => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    uploadBgFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) uploadBgFiles(fileInput.files);
    fileInput.value = '';
  });

  /* Commercial strip */
  renderCommercialStrip(filteredStrip);
});
