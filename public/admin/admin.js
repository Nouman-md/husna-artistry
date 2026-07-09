/* =========================================================
   ADMIN DASHBOARD LOGIC
   Requires admin-api.js to be loaded first.
   ========================================================= */
requireAdminAuth();

/* ---------- NAV / PANEL SWITCHING ---------- */
document.querySelectorAll(".admin-nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".admin-nav-link").forEach((l) => l.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach((p) => p.classList.remove("active"));
    link.classList.add("active");
    document.getElementById(link.dataset.panel).classList.add("active");

    if (link.dataset.panel === "dashboardPanel") loadDashboard();
    if (link.dataset.panel === "productsPanel") loadProducts();
    if (link.dataset.panel === "categoriesPanel") loadCategories();
    if (link.dataset.panel === "ordersPanel") loadOrders();
    if (link.dataset.panel === "usersPanel") loadUsers();
  });
});

document.getElementById("adminLogoutBtn").addEventListener("click", () => {
  setAdminToken(null);
  window.location.href = "/admin/login.html";
});

/* =========================================================
   DASHBOARD
   ========================================================= */
async function loadDashboard() {
  try {
    const data = await adminFetch("/dashboard");
    document.getElementById("statGrid").innerHTML = `
      <div class="stat-card"><div class="stat-value">₹${data.revenue.toLocaleString("en-IN")}</div><div class="stat-label">Revenue (Paid Orders)</div></div>
      <div class="stat-card"><div class="stat-value">${data.orderCount}</div><div class="stat-label">Total Orders</div></div>
      <div class="stat-card"><div class="stat-value">${data.productCount}</div><div class="stat-label">Products</div></div>
      <div class="stat-card"><div class="stat-value">${data.userCount}</div><div class="stat-label">Customers</div></div>
    `;

    const recent = document.getElementById("recentOrdersList");
    recent.innerHTML = data.recentOrders.length === 0
      ? `<p class="empty-note">No orders yet.</p>`
      : data.recentOrders.map((o) => `
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(11,31,61,0.06);font-size:.85rem;">
          <span>${escapeHtml(o.shippingAddress.fullName)} · #${o._id.slice(-6).toUpperCase()}</span>
          <span><span class="pill ${o.orderStatus}">${o.orderStatus}</span> ₹${o.totalAmount.toLocaleString("en-IN")}</span>
        </div>
      `).join("");

    const snapshot = document.getElementById("snapshotList");
    const breakdown = Object.entries(data.statusBreakdown || {}).map(([status, count]) =>
      `<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:.85rem;"><span class="pill ${status}">${status}</span><span>${count}</span></div>`
    ).join("");
    snapshot.innerHTML = `
      <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:.85rem;"><span>Made-to-order pieces</span><strong>${data.madeToOrderCount}</strong></div>
      ${breakdown}
    `;
  } catch (err) {
    showAdminToast(err.message, "error");
  }
}

/* =========================================================
   PRODUCTS
   ========================================================= */
let pendingImages = [];
let adminProducts = [];

document.getElementById("pf-images").addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  pendingImages = files; // store File objects for FormData upload
  const previewRow = document.getElementById("pf-image-preview");
  previewRow.innerHTML = "";
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement("img");
      img.src = reader.result;
      previewRow.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
});

document.getElementById("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const editId = document.getElementById("productEditId").value;

  const formData = new FormData();
  formData.append("name", document.getElementById("pf-name").value.trim());
  formData.append("category", document.getElementById("pf-category").value.trim());
  formData.append("price", document.getElementById("pf-price").value);
  formData.append("sizes", document.getElementById("pf-sizes").value);
  formData.append("frameColor", document.getElementById("pf-color").value.trim());
  formData.append("stockStatus", document.getElementById("pf-stock").value);
  formData.append("description", document.getElementById("pf-description").value.trim());
  pendingImages.forEach((file) => formData.append("images", file));

  if (!editId && pendingImages.length === 0) {
    showAdminToast("Please add at least one product image.", "error");
    return;
  }

  try {
    if (editId) {
      await adminFetch("/products/" + editId, { method: "PUT", body: formData });
      showAdminToast("Product updated.");
    } else {
      await adminFetch("/products", { method: "POST", body: formData });
      showAdminToast("Product added to your collection.");
    }
    resetProductForm();
    loadProducts();
  } catch (err) {
    showAdminToast(err.message, "error");
  }
});

document.getElementById("pf-cancel").addEventListener("click", resetProductForm);
function resetProductForm() {
  document.getElementById("productForm").reset();
  document.getElementById("productEditId").value = "";
  pendingImages = [];
  document.getElementById("pf-image-preview").innerHTML = "";
}

async function loadProducts() {
  try {
    adminProducts = await adminFetch("/products");
    renderAdminProductList();
  } catch (err) {
    showAdminToast(err.message, "error");
  }
}

function renderAdminProductList() {
  const container = document.getElementById("adminProductList");
  if (adminProducts.length === 0) {
    container.innerHTML = `<p class="empty-note">No products yet. Add your first calligraphy piece above.</p>`;
    return;
  }
  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Availability</th><th>Rating</th><th>Actions</th></tr></thead>
      <tbody>
        ${adminProducts.map((p) => `
          <tr>
            <td>${p.images && p.images[0] ? `<img src="${p.images[0]}">` : ""}</td>
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.category)}</td>
            <td>₹${Number(p.price).toLocaleString("en-IN")}</td>
            <td><span class="pill ${p.stockStatus === "in_stock" ? "delivered" : ""}">${p.stockStatus === "in_stock" ? "In Stock" : "Made to Order"}</span></td>
            <td>${p.ratingCount > 0 ? `★ ${p.ratingAverage.toFixed(1)} (${p.ratingCount})` : "—"}</td>
            <td class="table-actions">
              <button data-edit="${p._id}">Edit</button>
              <button class="danger" data-delete="${p._id}">Delete</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  container.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = adminProducts.find((pr) => pr._id === btn.dataset.edit);
      if (!p) return;
      document.getElementById("productEditId").value = p._id;
      document.getElementById("pf-name").value = p.name;
      document.getElementById("pf-category").value = p.category;
      document.getElementById("pf-price").value = p.price;
      document.getElementById("pf-sizes").value = p.sizes.join(", ");
      document.getElementById("pf-color").value = p.frameColor || "";
      document.getElementById("pf-stock").value = p.stockStatus;
      document.getElementById("pf-description").value = p.description;
      pendingImages = [];
      const previewRow = document.getElementById("pf-image-preview");
      previewRow.innerHTML = (p.images || []).map((img) => `<img src="${img}">`).join("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  container.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this product? This cannot be undone.")) return;
      try {
        await adminFetch("/products/" + btn.dataset.delete, { method: "DELETE" });
        showAdminToast("Product deleted.");
        loadProducts();
      } catch (err) {
        showAdminToast(err.message, "error");
      }
    });
  });
}

/* =========================================================
   CATEGORIES
   ========================================================= */
document.getElementById("categoryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("cat-name");
  try {
    await adminFetch("/categories", { method: "POST", body: JSON.stringify({ name: input.value.trim() }) });
    input.value = "";
    showAdminToast("Category saved.");
    loadCategories();
  } catch (err) {
    showAdminToast(err.message, "error");
  }
});

async function loadCategories() {
  try {
    const categories = await adminFetch("/categories");
    const container = document.getElementById("adminCategoryList");
    container.innerHTML = categories.length === 0
      ? `<p class="empty-note">No categories yet.</p>`
      : `<table class="data-table"><thead><tr><th>Name</th><th>Actions</th></tr></thead><tbody>
          ${categories.map((c) => `
            <tr><td>${escapeHtml(c.name)}</td><td class="table-actions"><button class="danger" data-delete-cat="${c._id}">Delete</button></td></tr>
          `).join("")}
        </tbody></table>`;
    container.querySelectorAll("[data-delete-cat]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this category? Existing products keep their category text.")) return;
        try {
          await adminFetch("/categories/" + btn.dataset.deleteCat, { method: "DELETE" });
          loadCategories();
        } catch (err) {
          showAdminToast(err.message, "error");
        }
      });
    });
  } catch (err) {
    showAdminToast(err.message, "error");
  }
}

/* =========================================================
   ORDERS
   ========================================================= */
document.getElementById("orderSearchBtn").addEventListener("click", loadOrders);
document.getElementById("orderSearch").addEventListener("keypress", (e) => { if (e.key === "Enter") loadOrders(); });

async function loadOrders() {
  try {
    const search = document.getElementById("orderSearch").value.trim();
    const status = document.getElementById("orderStatusFilter").value;
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);

    const orders = await adminFetch("/orders?" + params.toString());
    const container = document.getElementById("adminOrdersList");

    if (orders.length === 0) {
      container.innerHTML = `<p class="empty-note">No orders found.</p>`;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${orders.map((o) => `
            <tr>
              <td>#${o._id.slice(-8).toUpperCase()}<br><small>${new Date(o.createdAt).toLocaleDateString("en-IN")}</small></td>
              <td>${escapeHtml(o.shippingAddress.fullName)}<br><small>${escapeHtml(o.shippingAddress.mobile)}</small><br><small>${escapeHtml(o.shippingAddress.city)}, ${escapeHtml(o.shippingAddress.state)} - ${escapeHtml(o.shippingAddress.pincode)}</small></td>
              <td>${o.items.map((i) => `${escapeHtml(i.name)} (${escapeHtml(i.size)}) x${i.qty}`).join("<br>")}</td>
              <td>₹${o.totalAmount.toLocaleString("en-IN")}</td>
              <td><span class="pill ${o.paymentStatus}">${o.paymentStatus}</span></td>
              <td>
                <select data-status-select="${o._id}">
                  ${["placed", "confirmed", "shipped", "delivered", "cancelled"].map((s) => `<option value="${s}" ${s === o.orderStatus ? "selected" : ""}>${s}</option>`).join("")}
                </select>
              </td>
              <td class="table-actions">
                ${o.paymentStatus === "paid" ? `<button class="danger" data-refund="${o._id}">Refund</button>` : ""}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    container.querySelectorAll("[data-status-select]").forEach((select) => {
      select.addEventListener("change", async () => {
        try {
          await adminFetch(`/orders/${select.dataset.statusSelect}/status`, { method: "PATCH", body: JSON.stringify({ status: select.value }) });
          showAdminToast("Order status updated.");
          loadOrders();
        } catch (err) {
          showAdminToast(err.message, "error");
        }
      });
    });
    container.querySelectorAll("[data-refund]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Mark this order as refunded? You'll still need to process the actual refund in your Razorpay dashboard.")) return;
        try {
          await adminFetch(`/orders/${btn.dataset.refund}/refund`, { method: "PATCH" });
          showAdminToast("Order marked as refunded.");
          loadOrders();
        } catch (err) {
          showAdminToast(err.message, "error");
        }
      });
    });
  } catch (err) {
    showAdminToast(err.message, "error");
  }
}

/* =========================================================
   CUSTOMERS (USERS)
   ========================================================= */
async function loadUsers() {
  try {
    const users = await adminFetch("/users");
    const container = document.getElementById("adminUsersList");
    if (users.length === 0) {
      container.innerHTML = `<p class="empty-note">No registered customers yet.</p>`;
      return;
    }
    container.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.map((u) => `
            <tr>
              <td>${escapeHtml(u.name)}</td>
              <td>${escapeHtml(u.email)}</td>
              <td>${escapeHtml(u.phone || "—")}</td>
              <td>${new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
              <td><span class="pill ${u.isBlocked ? "blocked" : "delivered"}">${u.isBlocked ? "Blocked" : "Active"}</span></td>
              <td class="table-actions">
                <button data-toggle-block="${u._id}" data-blocked="${u.isBlocked}">${u.isBlocked ? "Unblock" : "Block"}</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    container.querySelectorAll("[data-toggle-block]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const isBlocked = btn.dataset.blocked === "true";
        try {
          await adminFetch(`/users/${btn.dataset.toggleBlock}/block`, { method: "PATCH", body: JSON.stringify({ isBlocked: !isBlocked }) });
          showAdminToast(isBlocked ? "Customer unblocked." : "Customer blocked.");
          loadUsers();
        } catch (err) {
          showAdminToast(err.message, "error");
        }
      });
    });
  } catch (err) {
    showAdminToast(err.message, "error");
  }
}

/* ---------- INIT ---------- */
loadDashboard();
