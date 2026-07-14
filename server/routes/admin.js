const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit"); 
const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");

const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const User = require("../models/User");
const upload = require("../middleware/upload");
const { verifyAdmin } = require("../middleware/auth");

// Slow down brute-force attempts against the admin login specifically.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
});

router.post("/login", adminLoginLimiter, async (req, res) => {
  const { name, password } = req.body;

  if (name === process.env.ADMIN_NAME) {
      const passwordMatch = await bcrypt.compare(
          password,
          process.env.ADMIN_PASSWORD
      );

      if (passwordMatch) {
          const token = jwt.sign(
              { role: "admin" },
              process.env.JWT_SECRET,
              { expiresIn: "12h" }
          );

          return res.json({ token });
      }
  }

  res.status(401).json({ message: "Incorrect admin name or password." });
});

// Everything below requires a valid admin session.
router.use(verifyAdmin);

/* ---------------- PRODUCTS ---------------- */
router.get("/products", async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
});

router.post("/products", upload.array("images", 6), async (req, res) => {
  try {
    const { name, category, price, description, frameColor, stockStatus } = req.body;
    const sizes = (req.body.sizes || "").split(",").map((s) => s.trim()).filter(Boolean);

    if (!name || !category || !price || !description || sizes.length === 0) {
      return res.status(400).json({ message: "Please fill in every required field." });
    }

    const images = (req.files || []).map(f => f.path);
    const product = await Product.create({
      name,
      category,
      price,
      sizes,
      description,
      frameColor,
      stockStatus: stockStatus === "in_stock" ? "in_stock" : "made_to_order",
      images,
    });

    await Category.findOneAndUpdate(
      { name: category },
      { name: category },
      { upsert: true }
    );

    res.status(201).json({ product });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not save product." });
  }
});

router.put("/products/:id", upload.array("images", 6), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found." });

    const { name, category, price, description, frameColor, stockStatus } = req.body;
    if (name) product.name = name;
    if (category) product.category = category;
    if (price) product.price = price;
    if (description) product.description = description;
    if (frameColor !== undefined) product.frameColor = frameColor;
    if (stockStatus) product.stockStatus = stockStatus === "in_stock" ? "in_stock" : "made_to_order";
    if (req.body.sizes) {
      product.sizes = req.body.sizes.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (req.files && req.files.length) {
      product.images = req.files.map(f => f.path);
    }

    await product.save();
    if (category) {
      await Category.findOneAndUpdate({ name: category }, { name: category }, { upsert: true });
    }
    res.json({ product });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not update product." });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found." });
    res.json({ message: "Product deleted." });
  } catch (err) {
    res.status(500).json({ message: "Could not delete product." });
  }
});

/* ---------------- CATEGORIES ---------------- */
router.get("/categories", async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json(categories);
});

router.post("/categories", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Category name is required." });
    const category = await Category.findOneAndUpdate(
      { name: name.trim() },
      { name: name.trim() },
      { upsert: true, new: true }
    );
    res.status(201).json({ category });
  } catch (err) {
    res.status(500).json({ message: "Could not save category." });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: "Category deleted." });
  } catch (err) {
    res.status(500).json({ message: "Could not delete category." });
  }
});

/* ---------------- ORDERS ---------------- */
router.get("/orders", async (req, res) => {
  try {
    const { search, status } = req.query;
    const filter = {};
    if (status && status !== "all") filter.orderStatus = status;
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { "shippingAddress.fullName": regex },
        { "shippingAddress.mobile": regex },
        { _id: search.match(/^[0-9a-fA-F]{24}$/) ? search : undefined },
      ];
    }
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Could not load orders." });
  }
});

router.patch("/orders/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["placed", "confirmed", "shipped", "delivered", "cancelled"];
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status." });

    const order = await Order.findByIdAndUpdate(req.params.id, { orderStatus: status }, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found." });
    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: "Could not update order." });
  }
});

// Refund structure only — actual refund must be triggered from the Razorpay
// dashboard (or via razorpay.payments.refund(...) once you're ready to wire it up).
router.patch("/orders/:id/refund", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (order.paymentStatus !== "paid") {
      return res.status(400).json({ message: "Only paid orders can be refunded." });
    }
    order.paymentStatus = "refunded";
    order.orderStatus = "cancelled";
    await order.save();
    res.json({ message: "Order marked as refunded. Process the actual refund in your Razorpay dashboard.", order });
  } catch (err) {
    res.status(500).json({ message: "Could not update refund status." });
  }
});

// Export all orders as CSV
router.get("/orders/export/csv", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    const header = [
      "Order ID", "Date", "Customer", "Mobile", "City", "State", "Pincode",
      "Items Total", "Delivery Charge", "Total Amount", "Payment Status", "Order Status",
    ];
    const rows = orders.map((o) => [
      o._id,
      o.createdAt.toISOString(),
      o.shippingAddress.fullName,
      o.shippingAddress.mobile,
      o.shippingAddress.city,
      o.shippingAddress.state,
      o.shippingAddress.pincode,
      o.itemsTotal,
      o.deliveryCharge,
      o.totalAmount,
      o.paymentStatus,
      o.orderStatus,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=husna-artistry-orders.csv");
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: "Could not export orders." });
  }
});

/* ---------------- USERS ---------------- */
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Could not load users." });
  }
});

router.patch("/users/:id/block", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: !!req.body.isBlocked },
      { new: true }
    ).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Could not update user." });
  }
});

/* ---------------- DASHBOARD ---------------- */
router.get("/dashboard", async (req, res) => {
  try {
    const [productCount, userCount, orders] = await Promise.all([
      Product.countDocuments(),
      User.countDocuments(),
      Order.find(),
    ]);

    const paidOrders = orders.filter((o) => o.paymentStatus === "paid");
    const revenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    const recentOrders = orders
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10);

    const madeToOrderCount = await Product.countDocuments({ stockStatus: "made_to_order" });

    const statusBreakdown = orders.reduce((acc, o) => {
      acc[o.orderStatus] = (acc[o.orderStatus] || 0) + 1;
      return acc;
    }, {});

    res.json({
      productCount,
      userCount,
      orderCount: orders.length,
      revenue,
      madeToOrderCount,
      statusBreakdown,
      recentOrders,
    });
  } catch (err) {
    res.status(500).json({ message: "Could not load dashboard data." });
  }
});

module.exports = router;
