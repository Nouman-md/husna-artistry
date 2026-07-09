const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const Order = require("../models/Order");
const Product = require("../models/Product");
const getRazorpay = require("../utils/razorpay");
const { optionalCustomer, verifyCustomer } = require("../middleware/auth");

const FLAT_DELIVERY_CHARGE = 0; // free shipping all over India, per current business policy

// STEP 1 — Create a pending order + a Razorpay order to pay against.
router.post(
  "/",
  optionalCustomer,
  [
    body("items").isArray({ min: 1 }).withMessage("Your cart is empty."),
    body("shippingAddress.fullName").trim().notEmpty().withMessage("Full name is required."),
    body("shippingAddress.mobile").trim().isLength({ min: 10 }).withMessage("A valid mobile number is required."),
    body("shippingAddress.houseNo").trim().notEmpty().withMessage("House/Flat No. is required."),
    body("shippingAddress.street").trim().notEmpty().withMessage("Street is required."),
    body("shippingAddress.city").trim().notEmpty().withMessage("City is required."),
    body("shippingAddress.state").trim().notEmpty().withMessage("State is required."),
    body("shippingAddress.pincode").trim().isLength({ min: 4 }).withMessage("A valid PIN code is required."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    try {
      const { items, shippingAddress } = req.body;

      // Re-price server-side from the database — never trust client-sent prices.
      let itemsTotal = 0;
      const verifiedItems = [];
      for (const line of items) {
        const product = await Product.findById(line.productId);
        if (!product) {
          return res.status(400).json({ message: `A product in your cart is no longer available.` });
        }
        const qty = Math.max(1, Number(line.qty) || 1);
        itemsTotal += product.price * qty;
        verifiedItems.push({
          productId: product._id,
          name: product.name,
          size: line.size,
          price: product.price,
          qty,
        });
      }

      const totalAmount = itemsTotal + FLAT_DELIVERY_CHARGE;

      const order = await Order.create({
        items: verifiedItems,
        shippingAddress,
        itemsTotal,
        deliveryCharge: FLAT_DELIVERY_CHARGE,
        totalAmount,
        user: req.userId || null,
      });

      const razorpay = getRazorpay();
      const rpOrder = await razorpay.orders.create({
        amount: Math.round(totalAmount * 100), // paise
        currency: "INR",
        receipt: order._id.toString(),
      });

      order.razorpayOrderId = rpOrder.id;
      await order.save();

      res.status(201).json({
        orderId: order._id,
        razorpayOrderId: rpOrder.id,
        amount: rpOrder.amount,
        currency: rpOrder.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Could not create your order. Please try again." });
    }
  }
);

// STEP 2 — Verify payment signature after Razorpay checkout completes.
router.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment details." });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed." });
    }

    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    if (!order) return res.status(404).json({ message: "Order not found." });

    order.paymentStatus = "paid";
    order.razorpayPaymentId = razorpay_payment_id;
    order.orderStatus = "confirmed";
    await order.save();

    res.json({ message: "Payment verified.", order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not verify payment." });
  }
});

router.get("/my", verifyCustomer, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Could not load your orders." });
  }
});

router.get("/:id", verifyCustomer, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.userId });
    if (!order) return res.status(404).json({ message: "Order not found." });
    res.json(order);
  } catch (err) {
    res.status(404).json({ message: "Order not found." });
  }
});

// Customers can cancel only before the order ships.
router.patch("/:id/cancel", verifyCustomer, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.userId });
    if (!order) return res.status(404).json({ message: "Order not found." });

    if (["shipped", "delivered", "cancelled"].includes(order.orderStatus)) {
      return res.status(400).json({
        message: `This order has already ${order.orderStatus === "cancelled" ? "been cancelled" : "shipped"} and can no longer be cancelled.`,
      });
    }

    order.orderStatus = "cancelled";
    order.cancelReason = req.body.reason || "Cancelled by customer";
    await order.save();
    res.json({ message: "Order cancelled.", order });
  } catch (err) {
    res.status(500).json({ message: "Could not cancel order." });
  }
});

module.exports = router;
