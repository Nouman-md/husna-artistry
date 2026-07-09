const express = require("express");
const router = express.Router();
const Wishlist = require("../models/Wishlist");
const { verifyCustomer } = require("../middleware/auth");

router.use(verifyCustomer);

router.get("/", async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.userId }).populate("products");
    if (!wishlist) wishlist = await Wishlist.create({ user: req.userId, products: [] });
    res.json(wishlist);
  } catch (err) {
    res.status(500).json({ message: "Could not load wishlist." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ message: "Product is required." });

    let wishlist = await Wishlist.findOne({ user: req.userId });
    if (!wishlist) wishlist = new Wishlist({ user: req.userId, products: [] });

    if (!wishlist.products.map(String).includes(productId)) {
      wishlist.products.push(productId);
    }
    await wishlist.save();
    await wishlist.populate("products");
    res.json(wishlist);
  } catch (err) {
    res.status(500).json({ message: "Could not update wishlist." });
  }
});

router.delete("/:productId", async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.userId });
    if (!wishlist) return res.status(404).json({ message: "Wishlist not found." });
    wishlist.products = wishlist.products.filter(
      (p) => p.toString() !== req.params.productId
    );
    await wishlist.save();
    await wishlist.populate("products");
    res.json(wishlist);
  } catch (err) {
    res.status(500).json({ message: "Could not update wishlist." });
  }
});

module.exports = router;
