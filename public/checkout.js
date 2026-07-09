/* =========================================================
   CHECKOUT PAGE LOGIC
   Requires api.js to be loaded first.
   ========================================================= */

function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

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

const cart = loadLocal("husna_checkout_cart", []);

function renderSummary() {
  const container = document.getElementById("summaryItems");
  if (cart.length === 0) {
    container.innerHTML = `<p class="account-empty">Your cart is empty.</p>`;
    document.getElementById("payNowBtn").disabled = true;
    return;
  }
  let itemsTotal = 0;
  container.innerHTML = cart.map((item) => {
    itemsTotal += item.price * item.qty;
    return `
    <div class="summary-item">
      <span>${escapeHtml(item.name)} (${escapeHtml(item.size)}) × ${item.qty}</span>
      <strong>₹${(item.price * item.qty).toLocaleString("en-IN")}</strong>
    </div>`;
  }).join("");

  const deliveryCharge = 0;
  const total = itemsTotal + deliveryCharge;
  document.getElementById("summaryItemsTotal").textContent = "₹" + itemsTotal.toLocaleString("en-IN");
  document.getElementById("summaryDelivery").textContent = deliveryCharge === 0 ? "Free" : "₹" + deliveryCharge.toLocaleString("en-IN");
  document.getElementById("summaryTotal").textContent = "₹" + total.toLocaleString("en-IN");
}
renderSummary();

document.getElementById("checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (cart.length === 0) {
    showToast("Your cart is empty.", "error");
    return;
  }

  const form = e.target;
  const payBtn = document.getElementById("payNowBtn");
  payBtn.disabled = true;
  payBtn.textContent = "Processing...";

  const shippingAddress = {
    fullName: form.fullName.value.trim(),
    mobile: form.mobile.value.trim(),
    email: form.email.value.trim(),
    houseNo: form.houseNo.value.trim(),
    street: form.street.value.trim(),
    area: form.area.value.trim(),
    landmark: form.landmark.value.trim(),
    city: form.city.value.trim(),
    state: form.state.value.trim(),
    pincode: form.pincode.value.trim(),
    addressType: form.addressType.value,
  };

  const items = cart.map((item) => ({ productId: item.productId, size: item.size, qty: item.qty }));

  try {
    const orderData = await apiFetch("/orders", {
      method: "POST",
      body: JSON.stringify({ items, shippingAddress }),
    });

    const razorpayOptions = {
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: "Husna Artistry",
      description: "Handwritten Arabic Calligraphy Frame(s)",
      order_id: orderData.razorpayOrderId,
      prefill: {
        name: shippingAddress.fullName,
        contact: shippingAddress.mobile,
        email: shippingAddress.email,
      },
      theme: { color: "#C9A961" },
      handler: async function (response) {
        try {
          await apiFetch("/orders/verify-payment", {
            method: "POST",
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          localStorage.removeItem("husna_checkout_cart");
          localStorage.setItem("husna_cart", JSON.stringify([]));
          if (getToken()) {
            try { await apiFetch("/cart", { method: "DELETE" }); } catch (err) {}
          }
          window.location.href = "/order-success.html?orderId=" + orderData.orderId;
        } catch (err) {
          showToast(err.message, "error");
          payBtn.disabled = false;
          payBtn.textContent = "Pay Now";
        }
      },
      modal: {
        ondismiss: function () {
          payBtn.disabled = false;
          payBtn.textContent = "Pay Now";
          showToast("Payment cancelled. You can try again anytime.", "error");
        },
      },
    };

    const rzp = new Razorpay(razorpayOptions);
    rzp.open();
  } catch (err) {
    showToast(err.message, "error");
    payBtn.disabled = false;
    payBtn.textContent = "Pay Now";
  }
});
