document.addEventListener('DOMContentLoaded', () => {
  /* ======================================================
     0. GLOBAL CONFIG
  ====================================================== */
  const API_BASE = window.__API_BASE__ || 'http://127.0.0.1:8000';
  let EVENT_CACHE = [];

  /* ======================================================
     1. HEADER SETUP
  ====================================================== */
  const header = document.getElementById('siteHeader');
  const logo = document.getElementById('headerLogo');

  if (header) {
    header.classList.add('is-scrolled');
    header.classList.remove('is-hero');
  }

  if (logo?.dataset?.default) {
    logo.src = logo.dataset.default;
  }

  /* ======================================================
     2. FADE-UP ANIMATION (SHARED)
  ====================================================== */
  document.documentElement.classList.add('js');

  const fadeObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          fadeObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  document.querySelectorAll('.fade-up').forEach(el =>
    fadeObserver.observe(el)
  );

  /* ======================================================
     3. EVENT DATA (TEMP – BACKEND READY)
  ====================================================== */
//const events = [
//  {
//    id: 1,
//    title: 'EVENT A',
//    start_date: '2026-01-21',
//    end_date: '2026-04-26',
//    image: 'assets/event1.jpg',
//    description: 'Menikmati lobster, kepiting, dan ikan premium...',
//  },
//  {
//    id: 2,
//    title: 'EVENT B',
//    start_date: '2026-01-21',
//    end_date: '2026-01-21',
//    image: 'assets/event2.jpg',
//    description: 'Pengalaman seafood premium...',
//  },
//  {
//    id: 3,
//    title: 'EVENT C',
//    start_date: '2026-06-21',
//    end_date: '2026-06-21',
//    image: 'assets/event2.jpg',
//    description: 'Pengalaman seafood premium...',
//  },
//];

 /* ======================================================
   EVENT FETCH & RENDERING (PRODUCTION READY)
====================================================== */

/* ---------- CONFIG ---------- */
const EVENT_ENDPOINT = `${API_BASE}/events`;

/* ---------- ELEMENTS ---------- */
const list = document.getElementById('eventList');
const search = document.getElementById('eventSearch');

if (!list || !search) {
  console.warn('Event list or search input not found');
  return;
}

/* ---------- UTILS ---------- */
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }

function formatDateRange(start, end) {
  const opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
  const s = new Date(start).toLocaleDateString('id-ID', opts);
  const e = new Date(end).toLocaleDateString('id-ID', opts);
  return s === e ? s : `${s} – ${e}`;
}

/* ---------- FETCH ---------- */
async function fetchEvents() {
  try {
    const res = await fetch(EVENT_ENDPOINT);
    if (!res.ok) throw new Error('Failed to fetch events');

    EVENT_CACHE = await res.json();
    renderEvents(EVENT_CACHE);
  } catch (err) {
    console.error(err);
    list.innerHTML = `<p style="padding:16px">Failed to load events.</p>`;
  }
}

/* ---------- RENDER ---------- */
function renderEvents(data) {
  list.innerHTML = '';

  if (!data || !data.length) {
    list.innerHTML = `<p style="padding:16px;font-family:Inter">No events found.</p>`;
    return;
  }

  const PRIORITY = { ongoing: 0, upcoming: 1, past: 2 };

  const sorted = [...data].sort((a, b) => {
    if (PRIORITY[a.status] !== PRIORITY[b.status]) {
      return PRIORITY[a.status] - PRIORITY[b.status];
    }

    const aStart = new Date(a.start_date);
    const aEnd = new Date(a.end_date);
    const bStart = new Date(b.start_date);
    const bEnd = new Date(b.end_date);

    if (a.status === 'ongoing') return aEnd - bEnd;
    if (a.status === 'upcoming') return aStart - bStart;
    return bEnd - aEnd;
  });

  sorted.forEach(event => {
    const dateLabel = formatDateRange(event.start_date, event.end_date);
    const hasLink = Boolean(event.detail_link);

    const card = document.createElement('article');
    card.className = 'event-card fade-up';

    card.innerHTML = `
      <div class="event-trailer">
        <img
          src="${escapeHTML(event.cover_image || '')}"
          loading="lazy"
        >

        <span class="event-date">${dateLabel}</span>

        <span class="event-status event-status--${event.status}">
          ${event.status.toUpperCase()}
        </span>

        <h2 class="event-title">${escapeHTML(event.title)}</h2>
        <button class="event-toggle" aria-label="Toggle Event">⌄</button>
      </div>

      <div class="event-content">
      <h2 class="event-title-expanded">
      ${escapeHTML(event.title)}
    </h2>
        <p>${escapeHTML(event.description || '')}</p>

        ${
          hasLink
            ? `<a href="${escapeHTML(event.detail_link)}"
                 class="event-btn"
                 target="_blank"
                 rel="noopener noreferrer">
                 DETAIL
               </a>`
            : ''
        }
      </div>
    `;

    card.querySelector('.event-toggle')
      .addEventListener('click', () => {
        card.classList.toggle('active');
      });

    list.appendChild(card);
    if (typeof fadeObserver !== 'undefined') {
      fadeObserver.observe(card);
    }
  });
}


  /* ======================================================
     5. SEARCH FILTER (FRONTEND)
  ====================================================== */
search.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();

  const filtered = EVENT_CACHE.filter(ev =>
    ev.title.toLowerCase().includes(q) ||
    (ev.description || '').toLowerCase().includes(q)
  );

  renderEvents(filtered);
});


  /* ======================================================
     6. INIT
  ====================================================== */
  fetchEvents();
});
