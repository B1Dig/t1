# Digital Signage Dashboard

A full-screen browser-based digital signage dashboard for UMass Boston, built with vanilla HTML/CSS/JS and deployed on Vercel.

**Live:** https://t1-gray-xi.vercel.app

---

## Access

The site is password-protected. Users are prompted for a password on first visit. After a successful login the session persists for the duration of the browser tab.

---

## Facility Modes

The dashboard supports four display modes, each with its own events and content:

| Mode | Description |
|------|-------------|
| `gym` | Fitness Center — classes, workout schedule, fitness events |
| `dining` | Dining Hall — meal times, menu highlights, dining events |
| `campus` | Campus — announcements and general campus events |
| `entertainment` | Shows, screenings, and live events with poster calendar |

Select a mode on the facility picker (`index.html`) or navigate directly via `dashboard.html?mode=<mode>`.

---

## Features

### Widgets
- **Upcoming Events** (top-right) — compact badge by default; click to expand full event list; ‹ › arrows to navigate days
- **Time & Weather** (bottom-right) — compact card by default; click to expand with Wind / Humidity / Feels Like / UV Index
- Both widgets are **draggable** (hover to reveal handle), **removable** (✕ button), and **restorable** (banner at top)
- Positions and states persist via `localStorage`

### Calendar
- Current week view, centered on screen, showing facility-specific events
- **← → arrows** and **mouse wheel** to navigate between weeks
- **Today** button snaps back to current week
- Click any day to **add or remove events** via modal
- Color-coded event pills: white = public holidays, blue = facility events, teal = user-added events

### Commercial Strip
- Scrolling ticker at the bottom with emoji + text + tag sections
- **✎ button** opens editor to add or remove sections
- Content persists via `localStorage`

### Background
- Full-screen image carousel, crossfades every 8 seconds
- Vignette overlay for readability

---

## Project Structure

```
t1/
├── index.html            # Facility picker (entry after login)
├── login.html            # Password login gate
├── dashboard.html        # Main signage display (loads via ?mode=)
├── dev.html              # Developer reference page
├── js/
│   ├── auth.js           # Client-side auth (sessionStorage)
│   └── dashboard.js      # All dashboard UI logic
├── css/
│   ├── login.css         # Login page styles
│   ├── landing.css       # Facility picker styles
│   └── dashboard.css     # Dashboard styles
├── data/
│   ├── gym/              # Events and content for Fitness Center
│   ├── dining/           # Events and content for Dining Hall
│   ├── campus/           # Events and content for Campus
│   └── entertainment/    # Events and content for Entertainment
├── assets/
│   └── logos/            # SVG brand logos for commercial strip
├── vercel.json           # Vercel config
└── README.md
```

---

## Deployment

Deployed automatically via Vercel on every push to `main`.

To run locally:
```bash
npx serve .
```

Then open `http://localhost:3000` — you'll land on the login page first.

---

## Data Sources

| Data | Source |
|------|--------|
| Weather | [Open-Meteo API](https://open-meteo.com) (no key required) |
| Public Holidays | [date.nager.at](https://date.nager.at) (US holidays, no key required) |
| Background images | [Unsplash](https://unsplash.com) |
| Facility events | Local JSON files under `data/<mode>/` |

---

## Storage

### localStorage

| Key | Contents |
|-----|----------|
| `events` | User-added calendar events |
| `commercial_sections` | Commercial strip sections |
| `pos_widget-events` | Events widget position |
| `pos_widget-clock` | Clock widget position |
| `size_events` | Events widget size (compact/expanded) |
| `size_clock` | Clock widget size |
| `hidden_widgets` | Which widgets are hidden |

### sessionStorage

| Key | Contents |
|-----|----------|
| `b1_auth` | Auth flag — set to `'1'` after successful login; cleared when tab closes |
