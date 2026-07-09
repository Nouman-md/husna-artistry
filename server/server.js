require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const path = require("path");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");


const connectDB = require("./config/db");

const productRoutes = require("./routes/products");
const categoryRoutes = require("./routes/categories");
const authRoutes = require("./routes/auth");
const cartRoutes = require("./routes/cart");
const wishlistRoutes = require("./routes/wishlist");
const orderRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");
const cookieParser = require( "cookie-parser" );

const app = express();
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());
connectDB();

/* ---------- Security middleware ---------- */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
  
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(mongoSanitize()); // strips $ and . from request data — prevents NoSQL injection
app.use(xss()); // strips/escapes script-like input — basic XSS protection
app.use(cookieParser());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests. Please try again later."
});

app.use(limiter);

// General API rate limiting (separate, stricter limiter is applied to admin login)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { message: "Too many requests. Please slow down and try again shortly." },
});
app.use("/api", apiLimiter);

/* ---------- Static files ---------- */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Customer-facing site
app.use(express.static(path.join(__dirname, "..", "public")));

// Admin portal — a separate app, never linked from the customer site.
// Served at /admin, with its own login page and its own JS/CSS.
app.use("/admin", express.static(path.join(__dirname, "..", "admin")));

/* ---------- API routes ---------- */
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
// Serve admin frontend
app.use("/admin", express.static(path.join(__dirname, "..", "admin")));

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "admin", "login.html"));
});

/* ---------- 404 + error handling ---------- */
app.use("/api", (req, res) => {
  res.status(404).json({ message: "API route not found." });
});
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});
// Any other unmatched route on the customer site → serve the SPA-style 404 page
app.get("*", (req, res) => {
  res.status(404).sendFile(path.join(__dirname, "..", "public", "404.html"));
});

// Central error handler — never leak stack traces or internals to the client.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message && err.status ? err.message : "Something went wrong. Please try again.",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Husna Artistry server running on http://localhost:${PORT}`);
  console.log(`Admin portal available at http://localhost:${PORT}/admin`);
});
