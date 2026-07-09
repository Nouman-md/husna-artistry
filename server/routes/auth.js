const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { verifyCustomer } = require("../middleware/auth");

function signToken(user) {
  return jwt.sign({ id: user._id, role: "customer" }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
}

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required."),
    body("email").isEmail().withMessage("A valid email is required.").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    try {
      const { name, email, password } = req.body;
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists." });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({ name, email, passwordHash });
      const token = signToken(user);
      res.status(201).json({ token, user: { name: user.name, email: user.email } });
    } catch (err) {
      res.status(500).json({ message: "Registration failed. Please try again." });
    }
  }
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("A valid email is required.").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ message: "Incorrect email or password." });
      if (user.isBlocked) {
        return res.status(403).json({ message: "This account has been blocked. Please contact us." });
      }
      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) return res.status(401).json({ message: "Incorrect email or password." });

      const token = signToken(user);
      res.json({ token, user: { name: user.name, email: user.email } });
    } catch (err) {
      res.status(500).json({ message: "Login failed. Please try again." });
    }
  }
);

router.get("/me", verifyCustomer, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "Account not found." });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Could not load account." });
  }
});

router.put(
  "/me",
  verifyCustomer,
  [
    body("name").optional().trim().notEmpty(),
    body("phone").optional().trim(),
  ],
  async (req, res) => {
    try {
      const updates = {};
      if (req.body.name) updates.name = req.body.name;
      if (req.body.phone !== undefined) updates.phone = req.body.phone;
      const user = await User.findByIdAndUpdate(req.userId, updates, {
        new: true,
      }).select("-passwordHash");
      res.json({ user });
    } catch (err) {
      res.status(500).json({ message: "Could not update profile." });
    }
  }
);

router.put(
  "/change-password",
  verifyCustomer,
  [
    body("currentPassword").notEmpty().withMessage("Current password is required."),
    body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    try {
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ message: "Account not found." });

      const match = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
      if (!match) return res.status(401).json({ message: "Current password is incorrect." });

      user.passwordHash = await bcrypt.hash(req.body.newPassword, 10);
      await user.save();
      res.json({ message: "Password updated successfully." });
    } catch (err) {
      res.status(500).json({ message: "Could not change password." });
    }
  }
);

// Address book
router.post("/addresses", verifyCustomer, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Account not found." });
    user.addresses.push(req.body);
    await user.save();
    res.status(201).json({ addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ message: "Could not save address." });
  }
});

router.delete("/addresses/:addressId", verifyCustomer, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Account not found." });
    user.addresses = user.addresses.filter(
      (a) => a._id.toString() !== req.params.addressId
    );
    await user.save();
    res.json({ addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ message: "Could not remove address." });
  }
});

module.exports = router;
