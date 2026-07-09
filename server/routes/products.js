const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const Product = require("../models/Product");
const Review = require("../models/Review");
const { verifyCustomer } = require("../middleware/auth");

// GET /api/products?category=&search=&minPrice=&maxPrice=&sort=
router.get("/", async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, sort } = req.query;
    const filter = {};

    if (category && category !== "all") filter.category = category;

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ name: regex }, { description: regex }, { category: regex }];
    }

    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") sortOption = { price: 1 };
    else if (sort === "price_desc") sortOption = { price: -1 };
    else if (sort === "rating") sortOption = { ratingAverage: -1 };
    else if (sort === "newest") sortOption = { createdAt: -1 };

    const products = await Product.find(filter).sort(sortOption);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Could not load products." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found." });
    const reviews = await Review.find({ product: product._id }).sort({ createdAt: -1 });
    res.json({ product, reviews });
  } catch (err) {
    res.status(404).json({ message: "Product not found." });
  }
});

// Reviews
router.post(
  "/:id/reviews",
  verifyCustomer,
  [
    body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5."),
    body("comment").trim().isLength({ min: 3, max: 1000 }).withMessage("Please write a short review."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ message: "Product not found." });

      const existing = await Review.findOne({ product: product._id, user: req.userId });
      if (existing) {
        return res.status(409).json({ message: "You've already reviewed this product." });
      }

      const User = require("../models/User");
      const user = await User.findById(req.userId).select("name");

      const review = await Review.create({
        product: product._id,
        user: req.userId,
        name: user.name,
        rating: req.body.rating,
        comment: req.body.comment,
      });

      const allReviews = await Review.find({ product: product._id });
      const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      product.ratingAverage = Math.round(avg * 10) / 10;
      product.ratingCount = allReviews.length;
      await product.save();

      res.status(201).json({ review });
    } catch (err) {
      res.status(500).json({ message: "Could not save your review." });
    }
  }
);

module.exports = router;
