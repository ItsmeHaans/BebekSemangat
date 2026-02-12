document.addEventListener('DOMContentLoaded', () => {


(() => {
  const reveal = document.getElementById('brandReveal');

  let atTop = true;
  let revealActive = false;
  let pull = 0;
  const THRESHOLD = 140;

  window.addEventListener('scroll', () => {
    atTop = window.scrollY <= 0;
  });

  window.addEventListener('wheel', (e) => {
    if (!atTop && !revealActive) return;

    // tarik ke atas
    if (e.deltaY < 0 && !revealActive) {
      pull += Math.abs(e.deltaY);

      if (pull > THRESHOLD) {
        openReveal();
      }
    }

    // scroll turun = tutup
    if (revealActive && e.deltaY > 0) {
      closeReveal();
    }
  }, { passive: true });

  function openReveal() {
    reveal.classList.remove('is-closing');
    reveal.classList.add('is-active');
    revealActive = true;
    pull = 0;
  }

  function closeReveal() {
    reveal.classList.add('is-closing');

    setTimeout(() => {
      reveal.classList.remove('is-active', 'is-closing');
      revealActive = false;
    }, 800);
  }
})();



const draftSession = JSON.parse(localStorage.getItem("draft_session") || "null");
const API_BASE = window.__API_BASE__ || "https://bebeksemangat-production.up.railway.app";
function toast(message, type = "info", duration = 2500) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;

  container.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, duration);
}

  /* ======================================================
     1. HEADER & HERO LOGIC
  ====================================================== */
    const header = document.getElementById('siteHeader');
  const hero = document.getElementById('hero');
  const logo = document.getElementById('headerLogo');
  const slider = document.getElementById('slider');
const slides = document.querySelectorAll('.slide');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');

let currentIndex = 0;
const totalSlides = slides.length;

function updateSlider() {
  slider.style.transform = `translateX(-${currentIndex * 100}%)`;
}

function nextSlide() {
  currentIndex = (currentIndex + 1) % totalSlides;
  updateSlider();
}

function prevSlide() {
  currentIndex = (currentIndex - 1 + totalSlides) % totalSlides;
  updateSlider();
}

// Event Listeners
nextBtn.addEventListener('click', () => {
  nextSlide();
  resetAutoSlide();
});

prevBtn.addEventListener('click', () => {
  prevSlide();
  resetAutoSlide();
});

// Auto Slide Loop
let autoSlideInterval = setInterval(nextSlide, 5000);

function resetAutoSlide() {
  clearInterval(autoSlideInterval);
  autoSlideInterval = setInterval(nextSlide, 5000);
}

// Support Touch Swipe for Mobile
let touchStartX = 0;
slider.addEventListener('touchstart', e => touchStartX = e.touches[0].clientX);
slider.addEventListener('touchend', e => {
  const touchEndX = e.changedTouches[0].clientX;
  if (touchStartX - touchEndX > 50) nextSlide();
  if (touchEndX - touchStartX > 50) prevSlide();
});
  if (logo?.dataset?.default) logo.src = logo.dataset.default;


  async function apiFetch(url, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  if (draftSession?.visitor_token) {
    headers["X-Visitor-Token"] = draftSession.visitor_token;
  }

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res;
}

async function createReservation(payload) {
  const res = await apiFetch(`${API_BASE}/reservations/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return res.json();
}


  if ('IntersectionObserver' in window && hero && header) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        header.classList.toggle('is-hero', entry.isIntersecting);
        header.classList.toggle('is-scrolled', !entry.isIntersecting);
      },
      { threshold: 0.3 }
    );
    observer.observe(hero);
  }

  /* ======================================================
     2. FADE UP ANIMATIONS
  ====================================================== */
  document.documentElement.classList.add('js');
  const fadeObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.fade-up').forEach(el => fadeObserver.observe(el));

    /* ======================================================
     3. RESERVATION – DRAFT ORDER POPULATION
  ====================================================== */
  const form = document.getElementById('reserveForm');
  const orderSelect = document.getElementById('draft');
const locationSelect = document.getElementById('tempat');

if (locationSelect) {
  apiFetch(`${API_BASE}/locations/`)
    .then(res => {
      if (!res.ok) throw new Error('Failed to load locations');
      return res.json();
    })
    .then(data => {
      window.storeData = data;

      locationSelect.innerHTML = '<option value="">Select Location</option>';

      data.forEach(store => {
        const option = document.createElement('option');
        option.value = store.id;
        option.textContent = `${store.name} — ${store.address.split(',')[0]}`;
        option.dataset.phone = store.phone_number || '';
        locationSelect.appendChild(option);
      });
    })
    .catch(err => {
      console.error(err);
      locationSelect.innerHTML =
        '<option value="">Failed to load locations</option>';
    });
}


  if (form && orderSelect) {
  if (!draftSession?.order_id) {
    orderSelect.innerHTML = '<option value="">No active order</option>';
    orderSelect.disabled = true;
  } else {
    apiFetch(`${API_BASE}/orders/${draftSession.order_id}`)
  .then(res => res.json())
  .then(order => {
    loadedOrder = order; // ✅ SIMPAN DRAFT

    orderSelect.innerHTML = '';

    if (!order.items || order.items.length === 0) {
      orderSelect.innerHTML = '<option value="">Order is empty</option>';
      orderSelect.disabled = true;
      return;
    }

    const summary = order.items
      .map(item => `${item.title} ×${item.quantity}`)
      .join(', ');

    const option = document.createElement('option');
    option.value = order.id;
    option.textContent = summary;

    orderSelect.appendChild(option);
    orderSelect.disabled = false;
  })

      .catch(err => {
        console.error(err);
        orderSelect.innerHTML = '<option value="">Draft expired</option>';
        orderSelect.disabled = true;
        localStorage.removeItem("draft_session");
      });
  }
}



  /* ======================================================
     4. FORM VALIDATION & MODALS (Updated)
  ====================================================== */
  const overlay = document.getElementById('modalOverlay');
  const confirmModal = document.getElementById('confirmModal');
  const successModal = document.getElementById('successModal');
  const cancelBtn = document.getElementById('cancelConfirm');
  const confirmBtn = document.getElementById('confirmReserve');
  const closeBtn = document.getElementById('closeSuccess');
   const timeSelect = document.getElementById('time');

// Start at 9:00 (9) and end at 20:00 (20)
for (let hour = 9; hour <= 20; hour++) {
  ['00', '30'].forEach(minute => {
    // Prevent 20:30 if your limit is strictly 20:00
    if (hour === 20 && minute === '30') return;

    const timeString = `${hour.toString().padStart(2, '0')}:${minute}`;
    const option = document.createElement('option');
    option.value = timeString;
    option.textContent = timeString;
    timeSelect.appendChild(option);
  });
}
  form?.addEventListener("submit", (e) => {
  e.preventDefault();

  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;
  const pax = Number(document.getElementById("pax").value);
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const locationId = locationSelect.value;

  if (!date || !time || !name || !pax || !locationId) {
    toast("Please complete all fields");
    return;
  }

  if (pax < 1 || pax > 20) {
    toast("Pax must be between 1 and 20");
    return;
  }

  overlay.hidden = false;
  confirmModal.hidden = false;
});

  confirmBtn?.addEventListener("click", async () => {
  confirmBtn.disabled = true;

  try {
    const payload = {
      customer_name: document.getElementById("name").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      pax: Number(document.getElementById("pax").value),
      reservation_date: document.getElementById("date").value,
      reservation_time: document.getElementById("time").value,
      location_id: Number(locationSelect.value),
      order_id: loadedOrder?.id || null,
    };

    const reservation = await createReservation(payload);

    // Build WhatsApp message (NOW FROM DB)
    const itemsText = loadedOrder?.items?.length
      ? loadedOrder.items
          .map(item => `- ${item.title} x${item.quantity}`)
          .join("\n")
      : "- (No pre-order)";

    const message =
      `Halo Ayam Penyet Surabaya!\n\n` +
      `*Reservasi Baru*\n\n` +
      `Nama: ${reservation.customer_name}\n` +
      `Tanggal: ${reservation.reservation_date}\n` +
      `Jam: ${reservation.reservation_time}\n` +
      `Pax: ${reservation.pax}\n` +
      `No Antrian: ${reservation.queue_number}\n\n` +
      `Pesanan:\n${itemsText}\n\n` +
      `Terima kasih 🙏`;

    const selectedOption =
      locationSelect.options[locationSelect.selectedIndex];

    const phone =
      selectedOption?.dataset.phone?.replace(/\D/g, "");

    if (!phone) {
      toast("Nomor WhatsApp lokasi tidak tersedia");
      return;
    }

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );

    // Cleanup
    localStorage.removeItem("draft_session");
    localStorage.removeItem("cart_count");

    confirmModal.hidden = true;
    successModal.hidden = false;

  } catch (err) {
    console.error(err);
    toast("Failed to create reservation. Please try again.", "error");
  } finally {
    confirmBtn.disabled = false;
  }
});




  closeBtn?.addEventListener('click', () => {
    overlay.hidden = true;
    form.reset();
    // Reload to show "No active order" since we just cleared it
    window.location.reload();
  });

  /* Modal Button Listeners */
  cancelBtn?.addEventListener('click', () => {
    overlay.hidden = true;
  });

  /* Inside your confirmBtn listener in js/index.js */
  closeBtn?.addEventListener('click', () => {
    overlay.hidden = true;
    form.reset();
  });

  overlay?.addEventListener('click', e => {
    if (e.target === overlay) overlay.hidden = true;
  });
});

/* ======================================================
   5. TRUST SECTION ANIMATION
====================================================== */
const trustItems = document.querySelectorAll('.trust__item');

if ('IntersectionObserver' in window && trustItems.length) {
  const trustObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          trustObserver.unobserve(entry.target); // animate once
        }
      });
    },
    { threshold: 0.2 }
  );

  trustItems.forEach(item => trustObserver.observe(item));
}
