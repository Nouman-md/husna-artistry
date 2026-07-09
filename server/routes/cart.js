const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart");
const { verifyCustomer } = require("../middleware/auth");

// All cart routes require login — cart persists across devices once logged in.
// Guests use local browser storage on the frontend instead.
router.use(verifyCustomer);

router.get("/", async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.userId }).populate("items.product");
    if (!cart) cart = await Cart.create({ user: req.userId, items: [] });
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: "Could not load cart." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { productId, size, qty } = req.body;
    if (!productId || !size) {
      return res.status(400).json({ message: "Product and size are required." });
    }
    let cart = await Cart.findOne({ user: req.userId });
    if (!cart) cart = new Cart({ user: req.userId, items: [] });

    const existing = cart.items.find(
      (i) => i.product.toString() === productId && i.size === size
    );
    if (existing) {
      existing.qty += qty || 1;
    } else {
      cart.items.push({ product: productId, size, qty: qty || 1 });
    }
    await cart.save();
    await cart.populate("items.product");
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: "Could not update cart." });
  }
});

router.put("/item", async (req, res) => {
  try {
    const { productId, size, qty } = req.body;
    const cart = await Cart.findOne({ user: req.userId });
    if (!cart) return res.status(404).json({ message: "Cart not found." });

    const item = cart.items.find(
      (i) => i.product.toString() === productId && i.size === size
    );
    if (!item) return res.status(404).json({ message: "Item not in cart." });

    if (qty <= 0) {
      cart.items = cart.items.filter(
        (i) => !(i.product.toString() === productId && i.size === size)
      );
    } else {
      item.qty = qty;
    }
    await cart.save();
    await cart.populate("items.product");
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: "Could not update cart item." });
  }
});

router.delete("/item", async (req, res) => {
  try {
    const { productId, size } = req.body;
    const cart = await Cart.findOne({ user: req.userId });
    if (!cart) return res.status(404).json({ message: "Cart not found." });
    cart.items = cart.items.filter(
      (i) => !(i.product.toString() === productId && i.size === size)
    );
    await cart.save();
    await cart.populate("items.product");
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: "Could not remove item." });
  }
});

router.delete("/", async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ user: req.userId }, { items: [] });
    res.json({ message: "Cart cleared." });
  } catch (err) {
    res.status(500).json({ message: "Could not clear cart." });
  }
});

module.exports = router;
