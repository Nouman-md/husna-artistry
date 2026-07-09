if (getAdminToken()) {
  window.location.href = "/admin/dashboard.html";
}

document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.value.trim(), password: form.password.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed.");
    setAdminToken(data.token);
    window.location.href = "/admin/dashboard.html";
  } catch (err) {
    showAdminToast(err.message, "error");
  }
});
