document.addEventListener('DOMContentLoaded', () => {
  /* ======================================================
     0. AUTH & FETCH WRAPPER
  ====================================================== */
  const ADMIN_KEY_NAME = 'ADMIN_API_KEY';

  async function adminFetch(url, options = {}) {
    const key = localStorage.getItem(ADMIN_KEY_NAME);

    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        'X-API-Key': key
      }
    });

    if (res.status === 401 || res.status === 403) {
      await Swal.fire('Unauthorized', 'Admin session expired', 'error');
      localStorage.removeItem(ADMIN_KEY_NAME);
      location.reload();
      throw new Error('Unauthorized');
    }

    return res;
  }

  const API = 'https://bebeksemangat-production.up.railway.app/events';
  const UPLOAD_API = 'https://bebeksemangat-production.up.railway.app/events/upload';

  document.getElementById('adminLogout')?.addEventListener('click', e => {
  e.preventDefault();
  localStorage.removeItem(ADMIN_KEY_NAME);
  location.reload();
});


  /* ======================================================
     1. DOM
  ====================================================== */
  const eventModal = document.getElementById('eventModal');
  const cropModal = document.getElementById('cropModal');
  const eventForm = document.getElementById('eventForm');
  const eventList = document.getElementById('eventList');

  const inputId = document.getElementById('eventId');
  const inputTitle = document.getElementById('eventTitle');
  const inputDesc = document.getElementById('eventDescription');
  const inputStart = document.getElementById('eventStartDate');
  const inputEnd = document.getElementById('eventEndDate');
  const inputLink = document.getElementById('eventDetailLink');
  const inputImageUrl = document.getElementById('eventImageUrl');
  const inputImageFile = document.getElementById('eventImageFile');
  const preview = document.getElementById('eventImagePreview');

  let EVENT_CACHE = [];
/* ======================================================
   ADMIN SEARCH
====================================================== */
const search = document.getElementById('eventSearch');

if (search) {
  search.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();

    const filtered = EVENT_CACHE.filter(ev =>
      ev.title.toLowerCase().includes(q) ||
      (ev.description || '').toLowerCase().includes(q)
    );

    renderAdminEvents(filtered);
  });
}

  /* ======================================================
     2. HELPERS
  ====================================================== */
  const escapeHTML = s =>
    s?.replace(/[&<>"']/g, m =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])
    ) || '';

  const formatDateRange = (a, b) =>
    new Date(a).toLocaleDateString() + ' – ' +
    new Date(b).toLocaleDateString();

  function closeEventModal() {
    eventModal.classList.remove('is-open');
    eventForm.reset();
    inputId.value = '';
    preview.innerHTML = '';
  }

  /* ======================================================
     3. FETCH & RENDER
  ====================================================== */
  async function loadEvents() {
    try {
      const res = await adminFetch(API);
      EVENT_CACHE = await res.json();
      renderAdminEvents(EVENT_CACHE);
    } catch {
      Swal.fire('Error', 'Failed to load events', 'error');
    }
  }

  function renderAdminEvents(events) {
  eventList.innerHTML = '';

  if (!events || !events.length) {
    eventList.innerHTML = `<p style="padding:16px;font-family:Inter">No events found.</p>`;
    return;
  }

  const PRIORITY = { ongoing: 0, upcoming: 1, past: 2 };

  const sorted = [...events].sort((a, b) => {
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

  sorted.forEach(ev => {
    const dateLabel = formatDateRange(ev.start_date, ev.end_date);
    const hasLink = Boolean(ev.detail_link);

    const card = document.createElement('article');
    card.className = 'event-card';
    card.dataset.id = ev.id;

    card.innerHTML = `
      <div class="event-trailer">
        <img
          src="${escapeHTML(ev.cover_image || '')}"
          loading="lazy"
        >

        <span class="event-date">${dateLabel}</span>

        <span class="event-status event-status--${ev.status}">
          ${ev.status.toUpperCase()}
        </span>

        <h2 class="event-title">${escapeHTML(ev.title)}</h2>

        <button class="event-toggle" aria-label="Toggle Event">⌄</button>

        <div class="admin-actions-floating">
          <button class="btn-icon btn-edit" title="Edit">✎</button>
          <button class="btn-icon btn-delete" title="Delete">×</button>
        </div>
      </div>

      <div class="event-content">
        <h2 class="event-title-expanded">
          ${escapeHTML(ev.title)}
        </h2>

        <p>${escapeHTML(ev.description || '')}</p>

        ${
          hasLink
            ? `<a href="${escapeHTML(ev.detail_link)}"
                 class="event-btn"
                 target="_blank"
                 rel="noopener noreferrer">
                 DETAIL
               </a>`
            : ''
        }
      </div>
    `;

    /* ===============================
       TOGGLE CONTENT (INI YANG HILANG)
       =============================== */
    card.querySelector('.event-toggle')
      .addEventListener('click', () => {
        card.classList.toggle('active');
      });

    eventList.appendChild(card);
  });
}


  /* ======================================================
     4. IMAGE CROP (UNCHANGED CORE)
  ====================================================== */
  const cropImg = document.getElementById('cropperImage');
  const cropFrame = document.querySelector('.crop-frame');
  const zoomInput = document.getElementById('cropZoom');
  const originalImage = new Image();

  let scale = 1, pos = { x:0, y:0 };
  let dragging = false;
let start = { x: 0, y: 0 };

document.getElementById('cropStage').addEventListener('mousedown', e => {
  dragging = true;
  start = { x: e.clientX - pos.x, y: e.clientY - pos.y };
});

window.addEventListener('mousemove', e => {
  if (!dragging) return;
  pos = { x: e.clientX - start.x, y: e.clientY - start.y };
  updateTransform();
});

window.addEventListener('mouseup', () => dragging = false);

zoomInput.addEventListener('input', () => {
  scale = zoomInput.value;
  updateTransform();
});

  function updateTransform() {
    cropImg.style.transform =
      `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${scale})`;
  }

  inputImageFile.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;

    const r = new FileReader();
    r.onload = ev => {
      originalImage.onload = () => {
  cropImg.src = originalImage.src;
  cropModal.classList.add('is-open');

  // FIT image to frame (16:9)
  scale = Math.max(
    cropFrame.clientWidth / originalImage.naturalWidth,
    cropFrame.clientHeight / originalImage.naturalHeight
  );

  pos = { x:0, y:0 };
  zoomInput.value = scale;
  updateTransform();
};

      originalImage.src = ev.target.result;
    };
    r.readAsDataURL(file);
  });

 document.getElementById('btnCropApply').addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 6000;
canvas.height = 1200;

    const ctx = canvas.getContext('2d');
    const frame = cropFrame.getBoundingClientRect();
    const img = cropImg.getBoundingClientRect();
    const s = originalImage.naturalWidth / img.width;

    ctx.drawImage(originalImage, (frame.left - img.left) * s, (frame.top - img.top) * s, frame.width * s, frame.height * s, 0, 0, 6000, 1200);

    canvas.toBlob(async blob => {
      const fd = new FormData();
      fd.append('file', blob, `event-${Date.now()}.jpg`);
      Swal.fire({ title: 'Uploading Image...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      try {
        const res = await adminFetch(UPLOAD_API, { method: 'POST', body: fd });
        const data = await res.json();
        inputImageUrl.value = data.url; // BUKAN ditambah localhost

        preview.innerHTML = `<img src="${inputImageUrl.value}" style="width:100px; border-radius:8px; margin-top:10px;">`;
        cropModal.classList.remove('is-open');
        Swal.fire({ icon: 'success', title: 'Image Uploaded', timer: 1000, showConfirmButton: false });
      } catch (err) {
        Swal.fire('Error', 'Image upload failed', 'error');
      }
    }, 'image/jpeg');
  });


  /* ======================================================
     5. CLICK HANDLING
  ====================================================== */
  document.body.addEventListener('click', async e => {

  /* =====================
     GLOBAL BUTTONS
  ===================== */
  if (e.target.id === 'btnAddEvent') {
    closeEventModal();
    eventModal.classList.add('is-open');
    return;
  }

  if (
    e.target.id === 'btnEventCancel' ||
    e.target.id === 'btnCropCancel' ||
    e.target.classList.contains('modal-backdrop')
  ) {
    closeEventModal();
    cropModal.classList.remove('is-open');
    return;
  }

  /* =====================
     EVENT CARD ACTIONS
  ===================== */
  const card = e.target.closest('.event-card');
  if (!card) return;

  const id = card.dataset.id;
  const ev = EVENT_CACHE.find(x => x.id == id);
  if (!ev) return;

  // Inside the CLICK HANDLING section for 'btn-edit'
if (e.target.classList.contains('btn-edit')) {
    inputId.value = ev.id;
    inputTitle.value = ev.title;
    inputDesc.value = ev.description || '';
    inputStart.value = ev.start_date;
    inputEnd.value = ev.end_date;
    inputLink.value = ev.detail_link || '';

    // FIX HERE: Use cover_image
    inputImageUrl.value = ev.cover_image || '';
    preview.innerHTML = ev.cover_image
      ? `<img src="${ev.cover_image}" style="width:120px">`
      : '';

    eventModal.classList.add('is-open');
}

  if (e.target.classList.contains('btn-delete')) {
    const ok = await Swal.fire({
      title: 'Delete event?',
      icon: 'warning',
      showCancelButton: true
    });

    if (ok.isConfirmed) {
      await adminFetch(`${API}/${id}`, { method: 'DELETE' });
      loadEvents();
    }
  }
});


  /* ======================================================
     6. SUBMIT
  ====================================================== */
  eventForm.addEventListener('submit', async e => {
  e.preventDefault();

  if (!inputImageUrl.value) {
    Swal.fire('Error', 'Please upload event image first', 'error');
    return;
  }

  // Build payload CLEANLY
  const payload = {};

  if (inputTitle.value.trim()) {
    payload.title = inputTitle.value.trim();
  }

  if (inputDesc.value.trim()) {
    payload.description = inputDesc.value.trim();
  }

  if (inputStart.value) {
    payload.start_date = inputStart.value;
  }

  if (inputEnd.value) {
    payload.end_date = inputEnd.value;
  }

  if (inputLink.value.trim()) {
    payload.detail_link = inputLink.value.trim();
  }

  if (inputImageUrl.value) {
    payload.cover_image = inputImageUrl.value;
  }

  const isEdit = Boolean(inputId.value);

  const res = await adminFetch(
    isEdit ? `${API}/${inputId.value}` : API,
    {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );

  if (!res.ok) {
    const err = await res.json();
    console.error('UPDATE ERROR:', err);
    Swal.fire('Error', err.detail || 'Failed to save event', 'error');
    return;
  }

  closeEventModal();
  loadEvents();
});



  loadEvents();
});
