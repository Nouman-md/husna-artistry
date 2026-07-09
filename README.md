# Husna Artistry — Full Stack E-Commerce Site

A complete online store for handmade Arabic calligraphy frames: customer-facing
shop (Node/Express + MongoDB backend) and a fully separate admin portal.

---

## ⚠️ Compatibility note for your Windows 7 laptop

MongoDB and Node.js have both dropped official Windows 7 support in their
newer versions. Here's what actually works, and what we recommend instead:

| Software | Last version supporting Windows 7 | Our recommendation |
|---|---|---|
| MongoDB Server | 4.0.x | **Don't install locally — use MongoDB Atlas** (free cloud database, see below). This sidesteps the version issue entirely and is ready for when you go live. |
| Node.js | v13.14.0 | Install this version locally for development. It's old (2020) and unsupported, so keep it **only for local testing** — the live server (once hosted) will run a modern Node version. |

**Recommended path:** use MongoDB Atlas (free tier, cloud-hosted) instead of
installing MongoDB on Windows 7 at all. Your Node.js server (running locally
on old Node 13, or later on a modern host) connects to Atlas over the internet
either way — so your local machine's age stops being a constraint.

---

## Project Structure

```
husna-artistry/
├── server/                 Node.js + Express + MongoDB backend
│   ├── config/db.js        MongoDB connection
│   ├── models/              Product, User, Order, Review, Category, Cart, Wishlist
│   ├── middleware/          auth (JWT), upload (Multer, disk storage)
│   ├── routes/               products, categories, auth, cart, wishlist, orders, admin
│   ├── utils/razorpay.js    Razorpay client
│   ├── uploads/              product images are saved here, served at /uploads/...
│   ├── server.js             app entry point
│   ├── package.json
│   └── .env.example          copy to .env and fill in your real values
│
├── public/                 Customer-facing site (served at /)
│   ├── index.html            home, shop, product details, cart/wishlist drawers, login/account
│   ├── checkout.html          Flipkart-style address + payment checkout
│   ├── order-success.html
│   ├── 404.html
│   ├── style.css
│   ├── api.js                 shared fetch helper
│   ├── script.js               main site logic
│   └── checkout.js
│
└── admin/                  Admin portal (served at /admin — NOT linked from the customer site)
    ├── login.html
    ├── dashboard.html
    ├── admin.css
    ├── admin-api.js
    ├── admin.js
    └── login.js
```

---

## 1. Set up MongoDB Atlas (recommended)

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a free "M0" cluster (no credit card required).
3. Under **Database Access**, create a database user with a username and password.
4. Under **Network Access**, add your current IP (or `0.0.0.0/0` for testing — restrict this later).
5. Click **Connect → Drivers**, copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Add `/husna_artistry` before the `?` so it points at a database named `husna_artistry`.

## 2. Set up Razorpay

1. Sign up at https://dashboard.razorpay.com/signup.
2. Once approved, go to **Settings → API Keys** and generate a **Test Mode** key first (switch to Live Mode keys only when you're ready to accept real payments).
3. You'll get a `Key ID` and `Key Secret` — you'll paste these into `.env`.

## 3. Install Node.js

- For local development on Windows 7: install **Node.js v13.14.0** from
  https://nodejs.org/download/release/v13.14.0/ (choose the Windows Installer,
  64-bit if applicable).
- If/when you develop from a newer machine or deploy to a host, use a current
  Node LTS version instead — the code doesn't depend on anything Node-13-specific.

## 4. Install dependencies & configure environment

```bash
cd server
npm install
copy .env.example .env      (on Windows)
```

Open `.env` and fill in:
```
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/husna_artistry?retryWrites=true&w=majority
JWT_SECRET=<a long random string — see the comment in .env.example for how to generate one>
ADMIN_NAME=Aliya Soughat
ADMIN_PASSWORD=Aliya&ougath1
RAZORPAY_KEY_ID=<your Razorpay Key ID>
RAZORPAY_KEY_SECRET=<your Razorpay Key Secret>
```

## 5. Run the server

```bash
npm start
```

You should see:
```
Husna Artistry server running on http://localhost:5000
Admin portal available at http://localhost:5000/admin
```

- Customer site: **http://localhost:5000**
- Admin portal: **http://localhost:5000/admin/login.html** (bookmark this — it is
  intentionally not linked from anywhere on the customer site)

---

## How the admin portal stays separate

- It lives in its own `/admin` folder, served at its own `/admin` URL.
- It has its own login page, its own token (`husna_admin_token`, stored separately
  from the customer's `husna_token`), and its own set of protected API routes
  under `/api/admin/*`.
- There is no link, button, or reference to `/admin` anywhere in `public/`.
  The only way in is knowing the URL and the admin credentials.

## Security notes (what's implemented, and what to know)

- Passwords are hashed with bcrypt — never stored in plain text.
- Admin and customer sessions use separate JWTs; admin routes require the `admin`
  role in the token, customer routes require `customer`.
- `express-mongo-sanitize` strips MongoDB operator characters from input, to
  prevent NoSQL injection.
- `xss-clean` escapes script-like input to reduce stored-XSS risk.
- `helmet` sets protective HTTP headers.
- Rate limiting is applied globally, with a stricter limit on the admin login
  specifically (10 attempts per 15 minutes) to slow down brute-forcing.
- Prices are always re-fetched from the database when an order is created —
  the client-side cart is never trusted for the actual charge amount.
- Payments are verified server-side using Razorpay's HMAC signature check
  before an order is marked as paid.
- **On CSRF:** this app authenticates with a bearer token in the `Authorization`
  header (not cookies), which is what makes traditional CSRF attacks largely
  ineffective here — CSRF exploits rely on the browser automatically attaching
  cookies to cross-site requests, which doesn't happen with header-based auth.
  If you later switch to cookie-based sessions, you'd want to add explicit
  CSRF tokens.
- Refunds: the admin panel can mark an order as "refunded," but the actual money
  transfer must be completed from your Razorpay dashboard (or by wiring up
  `razorpay.payments.refund()` in `server/routes/admin.js` once you're ready —
  the structure is there, the live call is intentionally not automated yet,
  so a refund can't be accidentally triggered).

## What's simple by design

- **Stock**: a simple "In Stock" / "Made to Order" flag per product, not numeric
  inventory counts — matching your single-artist, made-to-order business.
- **Delivery charge**: currently hardcoded to free (₹0) across India in
  `server/routes/orders.js` (`FLAT_DELIVERY_CHARGE`). Change that one constant
  if you introduce delivery fees later.
- **Contact form**: still hands off to WhatsApp (no database storage) since
  that wasn't part of what you asked to move to the database.

## Deploying online later

When you're ready to host this for real customers:
1. Deploy `server/` to a Node host (Render, Railway, Fly.io, a VPS, etc.).
2. Point `MONGODB_URI` at the same (or a production) Atlas cluster.
3. Switch Razorpay to **Live Mode** keys.
4. Update the admin bookmark to the new domain (e.g. `https://yourdomain.com/admin/login.html`).
5. Keep `.env` out of any public git repository.
