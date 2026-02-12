document.addEventListener("DOMContentLoaded", () => {
  let currentOrderId = null;
  let cartCount = 0;
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


  /* ================= ELEMENTS ================= */
  const cartCounter = document.getElementById("cart-counter");
  const cartFab = document.getElementById("cart-fab");
  const cartDrawer = document.getElementById("cart-drawer");
  const cartOverlay = document.getElementById("cart-overlay");
  const closeCartBtn = document.getElementById("close-cart");
  const cartItemsContainer = document.getElementById("cart-items");
  const confirmOrderBtn = document.getElementById("confirm-order-btn");
  const cats = document.querySelectorAll(".menu-cat");
  const content = document.querySelector(".menu-content");

  /* ================= FALLBACK DATA ================= */
  const dummyMenuData = {
    main: [
      { id: 1, title: "Ayam Goreng Seruni", desc: "Signature fried chicken topped with savory crumbs.", price: 32000, image: "assets/ayam.jpg" },
      { id: 2, title: "Sop Seruni", desc: "A comforting traditional soup.", price: 35000, image: "assets/sop.jpg" },
      { id: 3, title: "Soto Seruni", desc: "Warm Indonesian chicken soup.", price: 30000, image: "assets/soto.jpg" }
    ],
    side: [
      { id: 4, title: "Tempe Goreng", desc: "Crispy fried tempeh.", price: 12000, image: "assets/tempe.jpg" },
      { id: 5, title: "Tahu Isi", desc: "Stuffed tofu with vegetables.", price: 15000, image: "assets/tahu.jpg" },
      { id: 6, title: "Perkedel", desc: "Classic potato fritter.", price: 10000 }
    ],
    snack: [
      { id: 7, title: "Pisang Goreng", desc: "Fried banana with crispy batter.", price: 14000 },
      { id: 8, title: "Singkong Keju", desc: "Cassava with cheese topping.", price: 18000 },
      { id: 9, title: "Kroket", desc: "Golden fried croquette.", price: 12000 }
    ],
    beverage: [
      { id: 10, title: "Es Teh Manis", desc: "Sweet iced tea.", price: 8000 },
      { id: 11, title: "Es Jeruk", desc: "Fresh iced orange juice.", price: 10000 },
      { id: 12, title: "Wedang Jahe", desc: "Warm ginger drink.", price: 12000 }
    ]
  };

  /* ================= DRAFT ORDER LOGIC ================= */
async function initDraftOrder() {
  const saved = localStorage.getItem("draft_session");
  const headers = {};

  if (saved) {
    const session = JSON.parse(saved);
    headers["X-Visitor-Token"] = session.visitor_token;
  }

  // Gunakan URL persis seperti router, tanpa trailing slash
  const res = await fetch(`${API_BASE}/orders/draft`, {
    method: "POST",
    headers
  });

  if (!res.ok) {
    throw new Error(`Draft fetch failed: ${res.status}`);
  }

  const data = await res.json();

  currentOrderId = data.order_id;

  localStorage.setItem(
    "draft_session",
    JSON.stringify({
      order_id: data.order_id,
      visitor_token: data.visitor_token
    })
  );
}



  async function addToDraft(menuItemId) {
  if (!currentOrderId) return;

  const res = await apiFetch(
    `${API_BASE}/orders/${currentOrderId}/add/${menuItemId}/`,
    { method: "POST" }
  );

  if (!res.ok) {
    toast("Failed to add item");
    return;
  }

  loadDraftItems();
}

function apiFetch(url, options = {}) {
  const session = JSON.parse(localStorage.getItem("draft_session") || "{}");

  const headers = {
    ...(session.visitor_token && {
      "X-Visitor-Token": session.visitor_token
    }),
    ...(options.headers || {})
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(url, { ...options, headers });
}




  function restoreCartCount() {
    const saved = localStorage.getItem("cart_count");
    if (saved) {
      cartCount = parseInt(saved);
      cartCounter.textContent = cartCount;
    }
  }

  /* ================= CART DRAWER LOGIC ================= */
  function openCart() {
    cartDrawer.classList.add("active");
    cartOverlay.classList.add("active");
    loadDraftItems();
  }

  function closeCart() {
    cartDrawer.classList.remove("active");
    cartOverlay.classList.remove("active");
  }

  async function loadDraftItems() {
  if (!currentOrderId) return;

  const res = await apiFetch(`${API_BASE}/orders/${currentOrderId}/`);
  const data = await res.json();

  cartItemsContainer.innerHTML = "";

  let totalCount = 0;

  if (!data.items || data.items.length === 0) {
    cartItemsContainer.innerHTML = "<p>No items yet</p>";
  } else {
    data.items.forEach(item => {
      totalCount += item.quantity;

      cartItemsContainer.insertAdjacentHTML("beforeend", `
        <div class="cart-item">
          <strong>${item.title}</strong>
          <div class="qty-control">
            <button class="qty-btn" data-id="${item.menu_item_id}" data-action="dec">−</button>
            <span>x${item.quantity}</span>
            <button class="qty-btn" data-id="${item.menu_item_id}" data-action="inc">+</button>
          </div>
        </div>
      `);
    });
  }

  // 🔑 SINGLE SOURCE OF TRUTH
  cartCount = totalCount;
  cartCounter.textContent = cartCount;
  localStorage.setItem("cart_count", cartCount);
}


  /* ================= RENDER MENU ================= */
  const fadeObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  function renderMenu(menuData) {
    document.querySelectorAll(".menu-grid").forEach(grid => {
      const category = grid.dataset.category;
      const items = menuData[category];
      if (!items) return;

      grid.innerHTML = "";
      items.forEach(item => {
        const price = new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          minimumFractionDigits: 0
        }).format(item.price);

        grid.insertAdjacentHTML("beforeend", `
          <article class="menu-card fade-up">
            <div class="menu-image" style="background-image:${item.image ? `url('${item.image}')` : "none"}"></div>
            <div class="menu-info">
              <h3 class="menu-title">${item.title}</h3>
              <p class="menu-desc">${item.desc}</p>
              <div class="menu-price">${price}</div>
            </div>
            <button class="add-btn" data-id="${item.id}">+</button>
          </article>
        `);
      });

      grid.querySelectorAll(".add-btn").forEach(btn => {
        btn.addEventListener("click", () => addToDraft(btn.dataset.id));
      });

      grid.querySelectorAll(".fade-up").forEach(el => fadeObserver.observe(el));
    });

    setupCategoryHighlight();
  }

  function setupCategoryHighlight() {
    const groups = document.querySelectorAll(".menu-group");
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          cats.forEach(cat => {
            cat.classList.toggle("is-active", cat.dataset.target === entry.target.id);
          });
        }
      });
    }, {
      root: window.innerWidth <= 768 ? null : content,
      threshold: 0.45
    });
    groups.forEach(group => observer.observe(group));
  }

  /* ================= INITIALIZATION & EVENTS ================= */

  // 1. Initialize Order and Menu
(async () => {
  try {
    await initDraftOrder();

    const res = await apiFetch(`${API_BASE}/menu/`);
    if (!res.ok) throw new Error("Menu fetch failed");

    const data = await res.json();
    renderMenu(data);
  } catch (err) {
    console.error(err);
    toast("Menu gagal dimuat", "error");
  }
})();


  // 2. UI Event Listeners
  cartFab.addEventListener("click", openCart);
  cartOverlay.addEventListener("click", closeCart);
  closeCartBtn.addEventListener("click", closeCart);

  // 3. Cart Quantity Delegation
  cartItemsContainer.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("qty-btn")) return;
    const id = e.target.dataset.id;
    const action = e.target.dataset.action;
    await apiFetch(`${API_BASE}/orders/${currentOrderId}/${action}/${id}/`, { method: "POST" });
    loadDraftItems();
  });

  // 4. Category Scrolling
  cats.forEach(cat => {
    cat.addEventListener("click", () => {
      const target = document.getElementById(cat.dataset.target);
      if (!target) return;
      const scrollRoot = window.innerWidth <= 768 ? window : content;
      const y = target.getBoundingClientRect().top + (scrollRoot === window ? window.scrollY : content.scrollTop) - 24;
      scrollRoot.scrollTo({ top: y, behavior: "smooth" });
    });
  });

  // 5. Confirm Order
  confirmOrderBtn.addEventListener("click", async () => {
  if (!currentOrderId || cartCount === 0) {
    toast("Cart is empty");
    return;
  }

  // Cek draft masih valid
  const res = await apiFetch(`${API_BASE}/orders/${currentOrderId}/`);
  if (!res.ok) {
    toast("Draft expired, silakan pilih ulang", "error");
    localStorage.removeItem("draft_session");
    return;
  }

  // Redirect ke homepage (reservation page)
  window.location.href = "index.html#reserve";
});




});