/* =========================================================
   HUSNA ARTISTRY — CUSTOMER SITE APPLICATION LOGIC
   Requires api.js to be loaded first (defines apiFetch, getToken, setToken)
   ========================================================= */

const WHATSAPP_NUMBER = "919391119262";

let products = [];
let categories = [];
let cart = loadLocal("husna_cart", []);
let wishlist = loadLocal("husna_wishlist", []); // array of product objects (guest) or ids
let currentUser = null;

let currentFilter = "all";
let currentSearch = "";
let currentSort = "newest";
let currentMinPrice = "";
let currentMaxPrice = "";

let activeProduct = null;
let activeSize = null;
let activeGalleryIndex = 0;

/* ---------- LOCAL STORAGE HELPERS ---------- */
function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Could not save to local storage", e);
  }
}

/* =========================================================
   TOASTS
   ========================================================= */
function showToast(message, type) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast" + (type === "error" ? " error" : "");
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 320);
  }, 3200);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

/* =========================================================
   LOADING SCREEN
   ========================================================= */
window.addEventListener("load", () => {
  setTimeout(() => {
    const el = document.getElementById("loadingScreen");
    if (el) el.classList.add("hidden");
  }, 900);
});

/* =========================================================
   DARK MODE
   ========================================================= */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  saveLocal("husna_theme", theme);
}
(function initTheme() {
  const saved = loadLocal("husna_theme", null);
  if (saved) applyTheme(saved);
})();
const darkModeBtn = document.getElementById("darkModeBtn");
if (darkModeBtn) {
  darkModeBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

/* =========================================================
   NAVBAR SCROLL
   ========================================================= */
const navbar = document.getElementById("navbar");
if (navbar) {
  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 10);
  });
}

/* =========================================================
   SIDEBAR
   ========================================================= */
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
function openSidebar() { sidebar.classList.add("active"); sidebarOverlay.classList.add("active"); }
function closeSidebarFn() { sidebar.classList.remove("active"); sidebarOverlay.classList.remove("active"); }
if (sidebar) {
  document.getElementById("hamburgerBtn").addEventListener("click", openSidebar);
  document.getElementById("closeSidebar").addEventListener("click", closeSidebarFn);
  sidebarOverlay.addEventListener("click", closeSidebarFn);
  document.querySelectorAll(".sidebar-link").forEach((link) => link.addEventListener("click", closeSidebarFn));
  document.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => { closeSidebarFn(); openModal(btn.dataset.open); });
  });
}

/* =========================================================
   MODAL HELPERS
   ========================================================= */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("active");
  document.body.style.overflow = "hidden";
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("active");
  document.body.style.overflow = "";
}
document.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", () => closeModal(btn.dataset.close)));
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(overlay.id); });
});
document.querySelectorAll("[data-switch]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const current = link.closest(".modal-overlay").id;
    closeModal(current);
    openModal(link.dataset.switch);
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelectorAll(".modal-overlay.active").forEach((m) => closeModal(m.id));
});

/* =========================================================
   DRAWERS
   ========================================================= */
function openDrawer(drawerId, overlayId) {
  document.getElementById(drawerId).classList.add("active");
  document.getElementById(overlayId).classList.add("active");
  document.body.style.overflow = "hidden";
}
function closeDrawer(drawerId, overlayId) {
  document.getElementById(drawerId).classList.remove("active");
  document.getElementById(overlayId).classList.remove("active");
  document.body.style.overflow = "";
}
const cartBtn = document.getElementById("cartBtn");
if (cartBtn) {
  cartBtn.addEventListener("click", () => { renderCart(); openDrawer("cartDrawer", "cartOverlay"); });
  document.getElementById("wishlistBtn").addEventListener("click", () => { renderWishlist(); openDrawer("wishlistDrawer", "wishlistOverlay"); });
  document.querySelectorAll("[data-close-drawer]").forEach((btn) => {
    const id = btn.dataset.closeDrawer;
    const overlayId = id === "cartDrawer" ? "cartOverlay" : "wishlistOverlay";
    btn.addEventListener("click", () => closeDrawer(id, overlayId));
  });
  document.getElementById("cartOverlay").addEventListener("click", () => closeDrawer("cartDrawer", "cartOverlay"));
  document.getElementById("wishlistOverlay").addEventListener("click", () => closeDrawer("wishlistDrawer", "wishlistOverlay"));
}

/* =========================================================
   LOAD DATA FROM API
   ========================================================= */
async function loadProducts() {
  try {
    const params = new URLSearchParams();
    if (currentFilter !== "all") params.set("category", currentFilter);
    if (currentSearch.trim()) params.set("search", currentSearch.trim());
    if (currentMinPrice) params.set("minPrice", currentMinPrice);
    if (currentMaxPrice) params.set("maxPrice", currentMaxPrice);
    if (currentSort) params.set("sort", currentSort);

    products = await apiFetch("/products?" + params.toString());
    renderProducts();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function loadCategories() {
  try {
    categories = await apiFetch("/categories");
    renderCategoryFilters();
  } catch (err) {
    // non-fatal — category chips just won't populate
  }
}

/* =========================================================
   CATEGORY FILTERS
   ========================================================= */
function renderCategoryFilters() {
  const container = document.getElementById("categoryFilters");
  const sidebarCats = document.getElementById("sidebarCategories");
  if (!container) return;

  container.innerHTML =
    '<button class="filter-chip active" data-category="all">All</button>' +
    categories.map((c) => `<button class="filter-chip" data-category="${escapeHtml(c.name)}">${escapeHtml(c.name)}</button>`).join("");

  if (sidebarCats) {
    sidebarCats.innerHTML = categories.length
      ? categories.map((c) => `<button data-category="${escapeHtml(c.name)}">${escapeHtml(c.name)}</button>`).join("")
      : "<p style='color:rgba(251,250,247,0.5);font-size:.8rem;'>No categories yet</p>";
    sidebarCats.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        closeSidebarFn();
        currentFilter = btn.dataset.category;
        document.querySelectorAll("#categoryFilters .filter-chip").forEach((c) => c.classList.toggle("active", c.dataset.category === currentFilter));
        document.getElementById("products").scrollIntoView({ behavior: "smooth" });
        loadProducts();
      });
    });
  }

  container.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      container.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilter = chip.dataset.category;
      loadProducts();
    });
  });
}

/* Search + sort + price filter inputs */
const searchInput = document.getElementById("searchInput");
if (searchInput) {
  let searchTimer;
  const onSearch = (val) => {
    currentSearch = val;
    document.getElementById("searchInputMobile").value = val;
    searchInput.value = val;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadProducts, 350);
  };
  searchInput.addEventListener("input", (e) => onSearch(e.target.value));
  document.getElementById("searchInputMobile").addEventListener("input", (e) => onSearch(e.target.value));

  document.getElementById("sortSelect").addEventListener("change", (e) => {
    currentSort = e.target.value;
    loadProducts();
  });
  document.getElementById("applyPriceFilter").addEventListener("click", () => {
    currentMinPrice = document.getElementById("minPrice").value;
    currentMaxPrice = document.getElementById("maxPrice").value;
    loadProducts();
  });
}

/* =========================================================
   PRODUCT GRID
   ========================================================= */
function isWishlisted(productId) {
  return wishlist.some((w) => (typeof w === "string" ? w === productId : w._id === productId));
}

function renderProducts() {
  const grid = document.getElementById("productsGrid");
  const emptyState = document.getElementById("emptyProductsState");
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = "";
    emptyState.style.display = "block";
    const hasFilters = currentFilter !== "all" || currentSearch.trim() || currentMinPrice || currentMaxPrice;
    emptyState.querySelector("h3").textContent = hasFilters ? "No pieces match your search" : "New pieces are being lettered";
    emptyState.querySelector("p").textContent = hasFilters
      ? "Try a different keyword, category, or price range."
      : "Our collection is being prepared by hand. Please check back soon, or reach out to commission a custom artwork.";
    return;
  }
  emptyState.style.display = "none";

  grid.innerHTML = products.map((p) => {
    const img = (p.images && p.images[0]) || "";
    const wished = isWishlisted(p._id);
    const stockLabel = p.stockStatus === "in_stock" ? "In Stock" : "Made to Order";
    const stockClass = p.stockStatus === "in_stock" ? "in-stock" : "";
    return `
    <div class="product-card" data-id="${p._id}">
      <div class="product-card-img">
        ${img ? `<img src="${img}" alt="${escapeHtml(p.name)}">` : ""}
        <span class="stock-tag ${stockClass}">${stockLabel}</span>
        <button class="product-card-wish ${wished ? "active" : ""}" data-wish-id="${p._id}" aria-label="Toggle wishlist">
          <svg viewBox="0 0 24 24" fill="${wished ? "currentColor" : "none"}"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2 4.5 5.7 4c2-.3 3.9.7 6.3 3 2.4-2.3 4.3-3.3 6.3-3 3.7.5 5.3 4.4 3.7 7.7C19.5 16.4 12 21 12 21z" stroke="currentColor" stroke-width="1.7"/></svg>
        </button>
      </div>
      <div class="product-card-body">
        <span class="product-card-cat">${escapeHtml(p.category)}</span>
        <h3 class="product-card-name">${escapeHtml(p.name)}</h3>
        ${p.ratingCount > 0 ? `<span class="product-card-rating">★ ${p.ratingAverage.toFixed(1)} (${p.ratingCount})</span>` : ""}
        <p class="product-card-caption">${escapeHtml(p.description)}</p>
        <div class="product-card-footer">
          <span class="product-card-price">₹${Number(p.price).toLocaleString("en-IN")}</span>
          <button class="product-card-add" data-add-id="${p._id}">Add to Cart</button>
        </div>
      </div>
    </div>`;
  }).join("");

  grid.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-wish-id]") || e.target.closest("[data-add-id]")) return;
      openProductModal(card.dataset.id);
    });
  });
  grid.querySelectorAll("[data-wish-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); toggleWishlist(btn.dataset.wishId); });
  });
  grid.querySelectorAll("[data-add-id]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const product = products.find((p) => p._id === btn.dataset.addId);
      if (product) addToCart(product, (product.sizes && product.sizes[0]) || "Standard", 1);
    });
  });
}

/* =========================================================
   PRODUCT DETAILS MODAL + REVIEWS
   ========================================================= */
async function openProductModal(id) {
  try {
    const data = await apiFetch("/products/" + id);
    activeProduct = data.product;
    activeSize = (activeProduct.sizes && activeProduct.sizes[0]) || "Standard";
    activeGalleryIndex = 0;
    renderProductModal(activeProduct);
    renderReviews(activeProduct, data.reviews);
    openModal("productModal");
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderProductModal(product) {
  const images = (product.images && product.images.length) ? product.images : [];
  const mainImg = images[activeGalleryIndex] || "";
  const sizes = product.sizes && product.sizes.length ? product.sizes : ["Standard"];
  const stockLabel = product.stockStatus === "in_stock" ? "In Stock" : "Made to Order";

  document.getElementById("productModalBody").innerHTML = `
    <div class="pm-gallery">
      <div class="pm-gallery-main">${mainImg ? `<img src="${mainImg}" alt="${escapeHtml(product.name)}">` : ""}</div>
      ${images.length > 1 ? `<div class="pm-gallery-thumbs">${images.map((img, i) => `<img src="${img}" data-idx="${i}" class="${i === activeGalleryIndex ? "active" : ""}">`).join("")}</div>` : ""}
    </div>
    <div class="pm-details">
      <span class="pm-cat">${escapeHtml(product.category)}</span>
      <h2 class="pm-name">${escapeHtml(product.name)}</h2>
      ${product.ratingCount > 0 ? `<div class="pm-rating">★ ${product.ratingAverage.toFixed(1)} · ${product.ratingCount} review${product.ratingCount === 1 ? "" : "s"}</div>` : ""}
      <span class="pm-stock">${stockLabel}</span>
      <div class="pm-price">₹${Number(product.price).toLocaleString("en-IN")}</div>
      <p class="pm-desc">${escapeHtml(product.description)}</p>
      <div class="pm-sizes">
        <label>Frame Size</label>
        <div class="pm-size-options">
          ${sizes.map((s) => `<button class="pm-size-chip ${s === activeSize ? "active" : ""}" data-size="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
        </div>
      </div>
      <div class="pm-actions">
        <button class="btn btn-primary" id="pmAddToCart">Add to Cart</button>
        <button class="btn btn-outline" id="pmToggleWish">${isWishlisted(product._id) ? "In Wishlist" : "Add to Wishlist"}</button>
      </div>
    </div>
  `;

  document.querySelectorAll(".pm-gallery-thumbs img").forEach((thumb) => {
    thumb.addEventListener("click", () => { activeGalleryIndex = Number(thumb.dataset.idx); renderProductModal(product); });
  });
  document.querySelectorAll(".pm-size-chip").forEach((chip) => {
    chip.addEventListener("click", () => { activeSize = chip.dataset.size; renderProductModal(product); });
  });
  document.getElementById("pmAddToCart").addEventListener("click", () => addToCart(product, activeSize, 1));
  document.getElementById("pmToggleWish").addEventListener("click", () => { toggleWishlist(product._id); renderProductModal(product); });
}

function renderReviews(product, reviews) {
  const container = document.getElementById("pmReviews");
  const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

  container.innerHTML = `
    <h4>Customer Reviews</h4>
    ${reviews.length === 0 ? `<p class="account-empty">No reviews yet. Be the first to share your experience.</p>` :
      reviews.map((r) => `
        <div class="review-item">
          <div class="review-item-head"><span>${escapeHtml(r.name)}</span><span class="review-stars">${stars(r.rating)}</span></div>
          <p class="review-comment">${escapeHtml(r.comment)}</p>
        </div>
      `).join("")
    }
    <div id="reviewFormArea"></div>
  `;

  const formArea = document.getElementById("reviewFormArea");
  if (!getToken()) {
    formArea.innerHTML = `<p class="review-login-note"><a href="#" data-open-from-modal="loginModal">Log in</a> to leave a review.</p>`;
    formArea.querySelector("[data-open-from-modal]").addEventListener("click", (e) => {
      e.preventDefault();
      closeModal("productModal");
      openModal("loginModal");
    });
    return;
  }

  const alreadyReviewed = reviews.some((r) => currentUser && r.user === currentUser.id);
  if (alreadyReviewed) {
    formArea.innerHTML = `<p class="review-login-note">You've already reviewed this piece. Thank you!</p>`;
    return;
  }

  formArea.innerHTML = `
    <form class="review-form" id="reviewForm">
      <select name="rating" required>
        <option value="">Rate this piece</option>
        <option value="5">★★★★★ Excellent</option>
        <option value="4">★★★★ Very Good</option>
        <option value="3">★★★ Good</option>
        <option value="2">★★ Fair</option>
        <option value="1">★ Poor</option>
      </select>
      <textarea name="comment" rows="3" placeholder="Share your experience with this piece..." required></textarea>
      <button type="submit" class="btn btn-outline btn-small">Submit Review</button>
    </form>
  `;
  document.getElementById("reviewForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await apiFetch(`/products/${product._id}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating: Number(form.rating.value), comment: form.comment.value.trim() }),
      });
      showToast("Thank you for your review!");
      openProductModal(product._id);
      loadProducts();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

/* =========================================================
   WISHLIST (server-synced when logged in, local for guests)
   ========================================================= */
async function toggleWishlist(productId) {
  const wished = isWishlisted(productId);
  try {
    if (getToken()) {
      if (wished) {
        const data = await apiFetch("/wishlist/" + productId, { method: "DELETE" });
        wishlist = data.products;
      } else {
        const data = await apiFetch("/wishlist", { method: "POST", body: JSON.stringify({ productId }) });
        wishlist = data.products;
      }
    } else {
      if (wished) wishlist = wishlist.filter((w) => w !== productId);
      else wishlist.push(productId);
      saveLocal("husna_wishlist", wishlist);
    }
    showToast(wished ? "Removed from wishlist." : "Added to wishlist.");
  } catch (err) {
    showToast(err.message, "error");
    return;
  }
  renderProducts();
  renderWishlist();
}

function renderWishlist() {
  const container = document.getElementById("wishlistItems");
  if (!container) return;

  const items = wishlist.map((w) => {
    if (typeof w === "object") return w; // populated from server
    return products.find((p) => p._id === w); // guest: resolve from loaded products
  }).filter(Boolean);

  if (items.length === 0) {
    container.innerHTML = `<div class="drawer-empty">Your wishlist is empty.<br>Tap the heart on any piece to save it here.</div>`;
    return;
  }
  container.innerHTML = items.map((p) => {
    const img = (p.images && p.images[0]) || "";
    return `
    <div class="drawer-item">
      ${img ? `<img src="${img}" alt="${escapeHtml(p.name)}">` : ""}
      <div class="drawer-item-info">
        <div class="drawer-item-name">${escapeHtml(p.name)}</div>
        <div class="drawer-item-meta">₹${Number(p.price).toLocaleString("en-IN")}</div>
        <button class="drawer-item-remove" data-remove-wish="${p._id}">Remove</button>
      </div>
    </div>`;
  }).join("");
  container.querySelectorAll("[data-remove-wish]").forEach((btn) => btn.addEventListener("click", () => toggleWishlist(btn.dataset.removeWish)));
}

/* =========================================================
   CART (server-synced when logged in, local for guests)
   ========================================================= */
function cartItemFromServer(item) {
  const p = item.product;
  return { productId: p._id, name: p.name, price: p.price, size: item.size, qty: item.qty, image: (p.images && p.images[0]) || "" };
}

async function addToCart(product, size, qty) {
  try {
    if (getToken()) {
      const data = await apiFetch("/cart", { method: "POST", body: JSON.stringify({ productId: product._id, size, qty }) });
      cart = data.items.map(cartItemFromServer);
    } else {
      const existing = cart.find((c) => c.productId === product._id && c.size === size);
      if (existing) existing.qty += qty;
      else cart.push({ productId: product._id, name: product.name, price: product.price, size, qty, image: (product.images && product.images[0]) || "" });
      saveLocal("husna_cart", cart);
    }
    updateBadges();
    showToast("Added to your cart.");
    renderCart();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function updateCartQty(productId, size, newQty) {
  try {
    if (getToken()) {
      const data = await apiFetch("/cart/item", { method: "PUT", body: JSON.stringify({ productId, size, qty: newQty }) });
      cart = data.items.map(cartItemFromServer);
    } else {
      if (newQty <= 0) cart = cart.filter((c) => !(c.productId === productId && c.size === size));
      else {
        const item = cart.find((c) => c.productId === productId && c.size === size);
        if (item) item.qty = newQty;
      }
      saveLocal("husna_cart", cart);
    }
    updateBadges();
    renderCart();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function removeFromCart(productId, size) {
  try {
    if (getToken()) {
      const data = await apiFetch("/cart/item", { method: "DELETE", body: JSON.stringify({ productId, size }) });
      cart = data.items.map(cartItemFromServer);
    } else {
      cart = cart.filter((c) => !(c.productId === productId && c.size === size));
      saveLocal("husna_cart", cart);
    }
    updateBadges();
    renderCart();
    showToast("Removed from cart.");
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderCart() {
  const container = document.getElementById("cartItems");
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `<div class="drawer-empty">Your cart is empty.<br>Explore the collection to find your piece.</div>`;
    document.getElementById("cartSubtotal").textContent = "₹0";
    return;
  }
  let subtotal = 0;
  container.innerHTML = cart.map((item) => {
    subtotal += item.price * item.qty;
    return `
    <div class="drawer-item">
      ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}">` : ""}
      <div class="drawer-item-info">
        <div class="drawer-item-name">${escapeHtml(item.name)}</div>
        <div class="drawer-item-meta">Size: ${escapeHtml(item.size)} · ₹${Number(item.price).toLocaleString("en-IN")}</div>
        <div class="drawer-item-qty">
          <button class="qty-btn" data-dec="${item.productId}|${item.size}">−</button>
          <span>${item.qty}</span>
          <button class="qty-btn" data-inc="${item.productId}|${item.size}">+</button>
        </div>
        <button class="drawer-item-remove" data-remove="${item.productId}|${item.size}">Remove</button>
      </div>
    </div>`;
  }).join("");
  document.getElementById("cartSubtotal").textContent = "₹" + subtotal.toLocaleString("en-IN");

  container.querySelectorAll("[data-inc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [productId, size] = btn.dataset.inc.split("|");
      const item = cart.find((c) => c.productId === productId && c.size === size);
      updateCartQty(productId, size, item.qty + 1);
    });
  });
  container.querySelectorAll("[data-dec]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [productId, size] = btn.dataset.dec.split("|");
      const item = cart.find((c) => c.productId === productId && c.size === size);
      updateCartQty(productId, size, item.qty - 1);
    });
  });
  container.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [productId, size] = btn.dataset.remove.split("|");
      removeFromCart(productId, size);
    });
  });
}

function updateBadges() {
  const cartBadge = document.getElementById("cartBadge");
  const wishBadge = document.getElementById("wishlistBadge");
  if (cartBadge) cartBadge.textContent = cart.reduce((sum, c) => sum + c.qty, 0);
  if (wishBadge) wishBadge.textContent = wishlist.length;
}

const checkoutBtn = document.getElementById("checkoutBtn");
if (checkoutBtn) {
  checkoutBtn.addEventListener("click", () => {
    if (cart.length === 0) { showToast("Your cart is empty.", "error"); return; }
    saveLocal("husna_checkout_cart", cart);
    window.location.href = "/checkout.html";
  });
}

/* =========================================================
   AUTH: LOGIN / REGISTER / ACCOUNT
   ========================================================= */
async function syncCartAfterLogin() {
  try {
    const serverCart = await apiFetch("/cart");
    if (serverCart.items.length === 0 && cart.length > 0) {
      // push local guest cart up to the server
      for (const item of cart) {
        await apiFetch("/cart", { method: "POST", body: JSON.stringify({ productId: item.productId, size: item.size, qty: item.qty }) });
      }
      const refreshed = await apiFetch("/cart");
      cart = refreshed.items.map(cartItemFromServer);
    } else {
      cart = serverCart.items.map(cartItemFromServer);
    }
    saveLocal("husna_cart", cart);
    updateBadges();
  } catch (err) { /* non-fatal */ }

  try {
    const serverWishlist = await apiFetch("/wishlist");
    wishlist = serverWishlist.products;
  } catch (err) { /* non-fatal */ }
}

const accountBtn = document.getElementById("accountBtn");
if (accountBtn) {
  accountBtn.addEventListener("click", () => {
    if (getToken()) { openModal("accountModal"); loadAccountTab("profile"); }
    else openModal("loginModal");
  });
}

const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: form.name.value.trim(), email: form.email.value.trim(), password: form.password.value }),
      });
      setToken(data.token);
      currentUser = data.user;
      form.reset();
      closeModal("registerModal");
      showToast(`Welcome, ${data.user.name}! Your account is ready.`);
      await syncCartAfterLogin();
      renderProducts();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.email.value.trim(), password: form.password.value }),
      });
      setToken(data.token);
      currentUser = data.user;
      form.reset();
      closeModal("loginModal");
      showToast(`Welcome back, ${data.user.name}!`);
      await syncCartAfterLogin();
      renderProducts();
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

/* Account modal tabs */
document.querySelectorAll(".account-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".account-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    loadAccountTab(tab.dataset.tab);
  });
});

async function loadAccountTab(tab) {
  const body = document.getElementById("accountBody");
  if (!body) return;
  body.innerHTML = `<p class="account-empty">Loading...</p>`;

  if (tab === "profile") {
    try {
      const { user } = await apiFetch("/auth/me");
      currentUser = user;
      body.innerHTML = `
        <form id="profileForm" class="auth-form">
          <label>Name<input type="text" name="name" value="${escapeHtml(user.name)}" required></label>
          <label>Email<input type="email" value="${escapeHtml(user.email)}" disabled></label>
          <label>Phone<input type="tel" name="phone" value="${escapeHtml(user.phone || "")}"></label>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </form>
        <form id="passwordForm" class="auth-form" style="margin-top:20px;">
          <label>Current Password<input type="password" name="currentPassword" required></label>
          <label>New Password<input type="password" name="newPassword" required minlength="6"></label>
          <button type="submit" class="btn btn-outline">Change Password</button>
        </form>
        <button class="btn btn-outline btn-block" id="logoutBtn" style="margin-top:10px;">Log Out</button>
      `;
      document.getElementById("profileForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          await apiFetch("/auth/me", { method: "PUT", body: JSON.stringify({ name: e.target.name.value, phone: e.target.phone.value }) });
          showToast("Profile updated.");
        } catch (err) { showToast(err.message, "error"); }
      });
      document.getElementById("passwordForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          await apiFetch("/auth/change-password", { method: "PUT", body: JSON.stringify({ currentPassword: e.target.currentPassword.value, newPassword: e.target.newPassword.value }) });
          showToast("Password changed.");
          e.target.reset();
        } catch (err) { showToast(err.message, "error"); }
      });
      document.getElementById("logoutBtn").addEventListener("click", () => {
        setToken(null);
        currentUser = null;
        cart = [];
        wishlist = [];
        saveLocal("husna_cart", []);
        updateBadges();
        closeModal("accountModal");
        showToast("You've been logged out.");
      });
    } catch (err) {
      body.innerHTML = `<p class="account-empty">Could not load account.</p>`;
    }
  }

  if (tab === "orders") {
    try {
      const orders = await apiFetch("/orders/my");
      if (orders.length === 0) {
        body.innerHTML = `<p class="account-empty">No orders yet. Once you check out, your orders will appear here.</p>`;
        return;
      }
      body.innerHTML = orders.map((o) => `
        <div class="order-card">
          <div class="order-card-head">
            <span>#${o._id.slice(-8).toUpperCase()}</span>
            <span class="order-status-pill ${o.orderStatus}">${o.orderStatus}</span>
          </div>
          <div class="drawer-item-meta">${new Date(o.createdAt).toLocaleDateString("en-IN")} · ₹${o.totalAmount.toLocaleString("en-IN")}</div>
          ${["placed", "confirmed"].includes(o.orderStatus) ? `<button class="btn btn-outline btn-small" data-cancel-order="${o._id}" style="margin-top:8px;">Cancel Order</button>` : ""}
        </div>
      `).join("");
      body.querySelectorAll("[data-cancel-order]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          if (!confirm("Cancel this order?")) return;
          try {
            await apiFetch(`/orders/${btn.dataset.cancelOrder}/cancel`, { method: "PATCH", body: JSON.stringify({}) });
            showToast("Order cancelled.");
            loadAccountTab("orders");
          } catch (err) { showToast(err.message, "error"); }
        });
      });
    } catch (err) {
      body.innerHTML = `<p class="account-empty">Could not load orders.</p>`;
    }
  }

  if (tab === "addresses") {
    try {
      const { user } = await apiFetch("/auth/me");
      const addresses = user.addresses || [];
      body.innerHTML = `
        ${addresses.length === 0 ? `<p class="account-empty">No saved addresses yet.</p>` :
          addresses.map((a) => `
            <div class="address-card">
              <button data-remove-address="${a._id}">Remove</button>
              <strong>${escapeHtml(a.fullName)}</strong> (${escapeHtml(a.addressType)})<br>
              ${escapeHtml(a.houseNo)}, ${escapeHtml(a.street)}${a.area ? ", " + escapeHtml(a.area) : ""}<br>
              ${escapeHtml(a.city)}, ${escapeHtml(a.state)} - ${escapeHtml(a.pincode)}<br>
              ${escapeHtml(a.mobile)}
            </div>
          `).join("")
        }
        <p class="account-orders-title" style="margin-top:10px;">Addresses you save at checkout will appear here.</p>
      `;
      body.querySelectorAll("[data-remove-address]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await apiFetch("/auth/addresses/" + btn.dataset.removeAddress, { method: "DELETE" });
            loadAccountTab("addresses");
          } catch (err) { showToast(err.message, "error"); }
        });
      });
    } catch (err) {
      body.innerHTML = `<p class="account-empty">Could not load addresses.</p>`;
    }
  }
}

/* =========================================================
   FAQ
   ========================================================= */
const FAQ_DATA = [
  { q: "Are all artworks handmade?", a: "Yes. Each Arabic calligraphy artwork is carefully created with attention to detail unless otherwise stated in the product description." },
  { q: "Do you offer custom calligraphy?", a: "Yes. We create custom Arabic calligraphy based on your requested text, subject to approval and design feasibility." },
  { q: "Can I cancel or modify my order?", a: "You can cancel an order from My Account before it ships. Once production begins on a custom piece, changes are not possible." },
  { q: "Do you accept returns, exchanges, or refunds?", a: "All sales are final. We do not accept returns, exchanges, or refunds. Please ensure all order details are correct before completing your purchase." },
  { q: "What if my order arrives damaged or I receive the wrong item?", a: "Contact us within 48 hours of delivery with clear photos of the item and its packaging. We will review the issue and provide an appropriate solution." },
  { q: "How long will my order take?", a: "Processing time depends on the artwork and whether it is custom-made. Estimated shipping times are shared at checkout." },
  { q: "Do you ship internationally?", a: "We currently ship all over India. For international requests, please contact us directly to check availability." },
  { q: "How should I care for my artwork?", a: "Keep your artwork away from direct sunlight, excessive humidity, and water. Handle it with care to preserve its quality." },
  { q: "Can I use your artwork for commercial purposes?", a: "No. All artwork is protected by copyright and may not be reproduced, distributed, or used commercially without prior written permission." },
  { q: "How can I contact you?", a: "You can reach us through the Contact section on this website, by phone/WhatsApp at +91 93911 19262, or by emailing aliyasoughat.k@gmail.com." },
];

function renderFaq() {
  const list = document.getElementById("faqList");
  if (!list) return;
  list.innerHTML = FAQ_DATA.map((item, i) => `
    <div class="faq-item" data-idx="${i}">
      <button class="faq-question"><span>${escapeHtml(item.q)}</span><span class="plus">+</span></button>
      <div class="faq-answer"><p>${escapeHtml(item.a)}</p></div>
    </div>
  `).join("");
  list.querySelectorAll(".faq-item").forEach((item) => {
    item.querySelector(".faq-question").addEventListener("click", () => {
      const wasOpen = item.classList.contains("open");
      list.querySelectorAll(".faq-item").forEach((i) => i.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });
}

/* =========================================================
   CONTACT FORM (WhatsApp handoff — no dedicated backend endpoint)
   ========================================================= */
const contactForm = document.getElementById("contactForm");
if (contactForm) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const waMessage = `Hello Husna Artistry, I'm ${form.name.value.trim()} (${form.email.value.trim()}).\n${form.message.value.trim()}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`, "_blank");
    form.reset();
    showToast("Thanks for reaching out! Opening WhatsApp to continue the conversation.");
  });
}

/* =========================================================
   POLICIES
   ========================================================= */
const BUSINESS_EMAIL = "aliyasoughat.k@gmail.com";
const POLICIES = {
  returns: {
    title: "Return Policy",
    body: `All sales at Husna Artistry are final.\n\nWe do not accept returns, exchanges, or refunds on any product, as each piece is handmade to order. Please review your order — including text, size, and design details — carefully before completing your purchase.\n\nDamaged or Incorrect Items: If your order arrives damaged in transit, or you receive the wrong item due to our error, contact us within 48 hours of delivery with clear photographs of the item and its packaging. We will review the issue and, if confirmed, arrange an appropriate resolution.\n\nFor questions, reach us at ${BUSINESS_EMAIL} or +91 93911 19262.`,
  },
  shipping: {
    title: "Shipping Policy",
    body: `We currently ship all over India, free of charge.\n\nPayment: We accept online payments only — Cash on Delivery (COD) is not available.\n\nCustom & Pre-Booked Orders: For customisable art, an order is confirmed only once 50% of the total amount is paid in advance. The remaining balance is collected before or on delivery, as agreed at the time of booking.\n\nProcessing & delivery times depend on the artwork and are shared with you at the time of order confirmation.`,
  },
  privacy: {
    title: "Privacy Policy",
    body: `Husna Artistry respects your privacy. This page explains, in plain terms, how your information is handled.\n\nInformation We Collect: When you place an order, register an account, or contact us, we collect details such as your name, email, phone number, and shipping address, only to process your order and communicate with you.\n\nHow We Use It: Your information is used solely to fulfil orders, respond to enquiries, and improve our service. We do not sell, rent, or share your personal information with third parties, except where necessary to deliver your order, process payment, or as required by law.\n\nPayments: Payments are processed securely by Razorpay. We do not see or store your card, UPI, or bank details on our servers.\n\nYour Rights: You may request details of the information we hold about you, or ask us to delete it, at any time by emailing ${BUSINESS_EMAIL}.`,
  },
  terms: {
    title: "Terms & Conditions",
    body: `By placing an order with Husna Artistry, you agree to the following Terms & Conditions.\n\n1. Products\nAll Arabic calligraphy artworks are handmade or created by the artist unless otherwise stated. Due to the handmade nature of the products, slight variations in color, texture, or size may occur. Product images are provided for reference — actual colors may vary depending on your screen settings.\n\n2. Orders & Payments\nOrders are confirmed only after the required payment is received (full payment, or 50% advance for custom pieces). Prices are listed in Indian Rupees (₹) and may change without prior notice.\n\n3. Custom Orders\nCustom calligraphy orders require accurate text and instructions from the customer. Once the design is approved or production has begun, changes or cancellations are not permitted.\n\n4. Shipping & Delivery\nProcessing times are shared at the time of order confirmation. Delivery times are estimates and may vary depending on the shipping carrier and destination.\n\n5. No Return, No Exchange & No Refund Policy\nAll sales are final. We do not accept returns, exchanges, or refunds for any products.\n\n6. Damaged or Incorrect Items\nContact us within 48 hours of delivery with clear photographs of the item and its packaging.\n\n7. Intellectual Property\nAll artwork, designs, photographs, and website content remain the intellectual property of Husna Artistry.\n\n8. Islamic Content\nSome artworks may contain Qur'anic verses, Hadith, or other Islamic texts. Customers are requested to handle these items with the respect they deserve.\n\n9. Limitation of Liability\nWe are not responsible for delays caused by shipping carriers, customs, natural disasters, or other events beyond our control.\n\n10. Privacy\nCustomer information is used only for processing orders and providing customer support.\n\n11. Contact\nEmail: ${BUSINESS_EMAIL}\nPhone: +91 93911 19262`,
  },
};

document.querySelectorAll("[data-policy]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const policy = POLICIES[link.dataset.policy];
    if (!policy) return;
    document.getElementById("policyTitle").textContent = policy.title;
    document.getElementById("policyBody").textContent = policy.body;
    openModal("policyModal");
  });
});

/* =========================================================
   INIT
   ========================================================= */
(async function init() {
  const yearEl = document.getElementById("footerYear");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (getToken()) {
    try {
      const { user } = await apiFetch("/auth/me");
      currentUser = user;
      const serverCart = await apiFetch("/cart");
      cart = serverCart.items.map(cartItemFromServer);
      const serverWishlist = await apiFetch("/wishlist");
      wishlist = serverWishlist.products;
    } catch (err) {
      setToken(null); // expired/invalid token
    }
  }

  await loadCategories();
  await loadProducts();
  renderFaq();
  updateBadges();
  renderCart();
  renderWishlist();
})();
