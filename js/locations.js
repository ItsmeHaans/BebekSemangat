document.addEventListener('DOMContentLoaded', () => {
document.documentElement.classList.add("js");

const API_BASE = window.__API_BASE__ || "https://bebeksemangat-production.up.railway.app";
function escapeHTML(str = "") {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

  /* ======================================================
     1. HEADER & GLOBAL SETUP
  ====================================================== */
  const header = document.getElementById('siteHeader');
  const logo = document.getElementById('headerLogo');
  const container = document.getElementById('storeList');

  // Fallback Dummy Data
  const fallbackStores = [
    {
      id: "dummy-1", // Added ID for the distance selector
      name: "Cimanuk",
      distance: "200m from you",
      address: "Cimanuk St No.42, Citarum,\nBandung Wetan, Bandung City,\nWest Java 40115",
      hours: "09.00 – 22.00 · Open Everyday",
      rating: 4.6,
      reviews: 124,
      image: "assets/cisangkuy.png",
      maps: "#"
    }
  ];

  if (logo?.dataset?.default) logo.src = logo.dataset.default;
  if (header) {
    header.classList.add('is-scrolled');
    header.classList.remove('is-hero');
  }

  if (!container) return;

  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });


  /* ======================================================
     2. FETCH LOCATIONS WITH FALLBACK
  ====================================================== */
  fetch(`${API_BASE}/locations`)
    .then(res => {
      if (!res.ok) throw new Error("Could not fetch locations");
      return res.json();
    })
    .then(data => {
      window.storeData = data;
      renderStores(data);
      setupDistance(data);
    })
    .catch(err => {
      console.warn("Using fallback store data:", err);
      window.storeData = fallbackStores;
      renderStores(fallbackStores);
      // No need to run setupDistance for dummy data as it has static distance text
    });

  /* ======================================================
     3. RENDER STORES
  ====================================================== */
  function renderStores(stores) {
    container.innerHTML = '';

    stores.forEach(store => {
      const formattedAddress = escapeHTML(store.address).replace(/\n/g, '<br>');
      const hours = escapeHTML(store.hours || "");


      // Support both backend (image_url) and dummy (image) formats
      const imgSrc = store.image_url || store.image || '';
      const mapLink = store.maps_url || store.maps || '#';

      // Star rating logic
      const rating = Number(store.rating) || 0;
        const fullStars = '★'.repeat(Math.floor(rating));
        const emptyStars = '☆'.repeat(5 - Math.floor(rating));

      // Handle distance: use static 'distance' property if it exists (dummy),
      // otherwise wait for Geolocation to fill the span (backend)
      const distanceDisplay =
  typeof store.__distanceKm === 'number'
    ? store.__distanceKm < 1
      ? `(${Math.round(store.__distanceKm * 1000)}m from you)`
      : `(${store.__distanceKm.toFixed(1)}km from you)`
    : '';


      const cardHTML = `
        <article class="store-card fade-up">
          <div class="store-image" style="background-image:url('${imgSrc}')"></div>

          <div class="store-content">
            <h3 class="store-title">
              ${store.name}
              <span id="dist-${store.id}" style="font-weight:400; font-size: 0.9em; color: #666;">
                ${distanceDisplay}
              </span>
            </h3>

            <p class="store-address">${formattedAddress}</p>
            <p class="store-address" style="margin-top: 5px; font-weight: 500;">${hours}</p>

            <div class="store-rating">
              <span class="rating-badge">${store.rating}</span>
              <div class="stars" style="margin: 0 8px;">
                ${fullStars}${emptyStars}
              </div>
              <span style="font-family:Inter; font-size:14px; color: #666;">
                (${store.reviews})
              </span>
            </div>

            <a href="${mapLink}" target="_blank" class="store-btn">Google Maps</a>
          </div>
        </article>
      `;

      container.insertAdjacentHTML('beforeend', cardHTML);
    });

    container.querySelectorAll('.fade-up').forEach(el => fadeObserver.observe(el));
  }

  /* ======================================================
     4. DISTANCE CALCULATION
  ===================================================== */
  function setupDistance(stores) {
  if (!("geolocation" in navigator)) return;

  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;

      stores.forEach(store => {
        if (store.lat && store.lng) {
          store.__distanceKm = haversine(
            latitude,
            longitude,
            store.lat,
            store.lng
          );
        } else {
          store.__distanceKm = Infinity;
        }
      });

      // 🔥 SORT TERDEKAT → TERJAUH
      stores.sort((a, b) => a.__distanceKm - b.__distanceKm);

      // 🔥 RENDER ULANG SETELAH SORT
      renderStores(stores);
    },
    err => console.warn("Geolocation denied or failed.", err)
  );
}


  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
});
