/* =========================================================
   ADMIN PORTAL — SHARED API HELPER
   Uses its own token key, completely separate from the customer site.
   ========================================================= */
const ADMIN_API_BASE = "/api/admin";

function getAdminToken() {
  return localStorage.getItem("husna_admin_token");
}
function setAdminToken(token) {
  if (token) localStorage.setItem("husna_admin_token", token);
  else localStorage.removeItem("husna_admin_token");
}

async function adminFetch(path, options = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  const token = getAdminToken();
  if (token) headers.Authorization = "Bearer " + token;
  if (options.body instanceof FormData) delete headers["Content-Type"];

  const res = await fetch(ADMIN_API_BASE + path, { ...options, headers });

  if (res.status === 401) {
    setAdminToken(null);
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.href = "/admin/login.html";
    }
    throw new Error("Session expired. Please log in again.");
  }

  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) throw new Error((data && data.message) || "Something went wrong.");
  return data;
}

function requireAdminAuth() {
  if (!getAdminToken()) {
    window.location.href = "/admin/login.html";
  }
}

function showAdminToast(message, type) {
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
