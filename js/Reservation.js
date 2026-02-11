/**
 * Admin Reservation Management Script
 * Clean, Safe, Mobile-Friendly
 */

document.addEventListener("DOMContentLoaded", () => {

  const API_BASE = window.__API_BASE__ || "http://127.0.0.1:8000";
  const ADMIN_KEY_NAME = "ADMIN_API_KEY";

  /* ================= AUTH FETCH ================= */
  const getAdminKey = () => localStorage.getItem(ADMIN_KEY_NAME);

  async function adminFetch(url, options = {}) {
  const key = getAdminKey();

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": key, // ✅ MATCH backend
      ...(options.headers || {})
    }
  });

  if (res.status === 401) {
    alert("Admin session expired");
    localStorage.removeItem(ADMIN_KEY_NAME);
    location.reload();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "API Error");
  }

  return res.json();
}


  /* ================= DOM ================= */
  const listEl = document.getElementById("reservationList");

  const filterDate = document.getElementById("filterDate");
  const filterLocation = document.getElementById("filterLocation");
  const filterStatus = document.getElementById("filterStatus");

  const sortDate = document.getElementById("sortDate");
  const sortTime = document.getElementById("sortTime");

  /* ================= LOAD LOCATIONS ================= */
  async function loadLocations() {
    try {
      const locations = await adminFetch(`${API_BASE}/locations/`);
      filterLocation.innerHTML = `<option value="">All Locations</option>`;

      locations.forEach(loc => {
        const opt = document.createElement("option");
        opt.value = loc.id;
        opt.textContent = loc.name;
        filterLocation.appendChild(opt);
      });
    } catch (err) {
      console.error("Failed to load locations", err);
    }
  }

  /* ================= LOAD RESERVATIONS ================= */
  async function loadReservations() {
    try {
      const params = new URLSearchParams();

      if (filterDate.value) params.append("reservation_date", filterDate.value);
      if (filterLocation.value) params.append("location_id", filterLocation.value);
      if (filterStatus.value) params.append("status", filterStatus.value);

      const data = await adminFetch(
        `${API_BASE}/reservations/?${params.toString()}`
      );

      const sorted = data.sort((a, b) => {
        // Sort by date
        if (sortDate.value === "asc") {
          if (a.reservation_date !== b.reservation_date) {
            return a.reservation_date.localeCompare(b.reservation_date);
          }
        } else {
          if (a.reservation_date !== b.reservation_date) {
            return b.reservation_date.localeCompare(a.reservation_date);
          }
        }

        // Sort by time
        if (sortTime.value === "asc") {
          return a.reservation_time.localeCompare(b.reservation_time);
        }
        return b.reservation_time.localeCompare(a.reservation_time);
      });

      renderList(sorted);
    } catch (err) {
      console.error("Failed to load reservations", err);
      listEl.innerHTML = `<p class="empty">Failed to load reservations</p>`;
    }
  }

  /* ================= RENDER LIST ================= */
  function renderList(data) {
  listEl.innerHTML = "";

  if (!data.length) {
    listEl.innerHTML = `<p class="empty">No reservations found</p>`;
    return;
  }

  // 1️⃣ Group by date
  const grouped = data.reduce((acc, r) => {
    (acc[r.reservation_date] ||= []).push(r);
    return acc;
  }, {});

  // 2️⃣ Sort dates DESC (latest on top)
  const dates = Object.keys(grouped).sort((a, b) =>
    b.localeCompare(a)
  );

  dates.forEach(date => {
    // 3️⃣ Divider
    const divider = document.createElement("div");
    divider.className = "day-divider";
    divider.innerHTML = `
      <span>${date}</span>
    `;
    listEl.appendChild(divider);

    // 4️⃣ Sort inside the day
    const sorted = grouped[date].sort((a, b) => {
      const weight = s =>
        s === "pending" ? 0 : 1;
      return weight(a.status) - weight(b.status)
        || a.queue_number - b.queue_number;
    });

    // 5️⃣ Render cards
    sorted.forEach(r => {
      const card = document.createElement("div");
      card.className = "reservation-card";
      card.dataset.id = r.id;

      const orderItems = r.order_items?.length
        ? r.order_items
            .map(i => `${escapeHTML(i.title)} × ${i.quantity}`)
            .join("<br>")
        : `<span class="muted">No order</span>`;

      card.innerHTML = `
        <div class="cell queue">#${r.queue_number}</div>

        <div class="cell customer">
          <strong>${escapeHTML(r.customer_name)}</strong>
          <div class="muted">Pax ${r.pax}</div>
          ${r.phone ? `<div class="muted">${escapeHTML(r.phone)}</div>` : ""}
        </div>

        <div class="cell datetime">
          <div>${r.reservation_time}</div>
        </div>

        <div class="cell order">${orderItems}</div>

        <div class="cell status">
          <span class="status-pill ${r.status}">
            ${r.status}
          </span>
        </div>

        <div class="cell actions">
          <button
            class="btn confirm"
            data-action="confirmed"
            ${r.status !== "pending" ? "disabled" : ""}
          >Confirm</button>

          <button
            class="btn cancel"
            data-action="cancelled"
            ${r.status === "cancelled" ? "disabled" : ""}
          >Cancel</button>
        </div>
      `;

      listEl.appendChild(card);
    });
  });
}



  /* ================= UPDATE STATUS ================= */
  async function updateStatus(id, status) {
    try {
      await adminFetch(
        `${API_BASE}/reservations/${id}/status?status=${status}`,
        { method: "PATCH" }
      );
      await loadReservations();
    } catch (err) {
      console.error("Failed to update status", err);
      alert("Failed to update reservation");
    }
  }

  /* ================= EVENTS ================= */

  // Filter & sort change
  [
    filterDate,
    filterLocation,
    filterStatus,
    sortDate,
    sortTime
  ].forEach(el => el?.addEventListener("change", loadReservations));

  // Delegated action buttons
  listEl?.addEventListener("click", e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const card = btn.closest(".reservation-card");
    if (!card) return;

    const id = card.dataset.id;
    const action = btn.dataset.action;

    updateStatus(id, action);
  });

  /* ================= HELPERS ================= */
  function escapeHTML(str = "") {
    return str.replace(/[&<>"']/g, m =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
    );
  }

  /* ================= INIT ================= */
  loadLocations();
  loadReservations();
/* ================= LOGOUT ================= */
document.getElementById('adminLogout')?.addEventListener('click', () => {
  localStorage.removeItem(ADMIN_KEY_NAME);
  location.reload();
});
});
