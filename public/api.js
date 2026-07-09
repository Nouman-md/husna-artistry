/* =========================================================
   HUSNA ARTISTRY — SHARED API HELPER (customer site)
   Same-origin backend, so relative paths work in dev and production.
   ========================================================= */
const API_BASE = "/api";

function getToken() {
  return localStorage.getItem("husna_token");
}
function setToken(token) {
  if (token) localStorage.setItem("husna_token", token);
  else localStorage.removeItem("husna_token");
}

async function apiFetch(path, options = {}) {
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    options.headers || {}
  );
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;

  // Let the browser set the multipart boundary itself for FormData bodies.
  if (options.body instanceof FormData) delete headers["Content-Type"];

  const res = await fetch(API_BASE + path, { ...options, headers });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    const message = (data && data.message) || "Something went wrong. Please try again.";
    throw new Error(message);
  }
  return data;
}
