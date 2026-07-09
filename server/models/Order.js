const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true },
    size: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: "" },
    houseNo: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    area: { type: String, trim: true, default: "" },
    landmark: { type: String, trim: true, default: "" },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    addressType: { type: String, enum: ["Home", "Work"], default: "Home" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "An order must contain at least one item.",
      },
    },
    shippingAddress: { type: addressSchema, required: true },
    itemsTotal: { type: Number, required: true, min: 0 },
    deliveryCharge: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Razorpay payment tracking
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    orderStatus: {
      type: String,
      enum: ["placed", "confirmed", "shipped", "delivered", "cancelled"],
      default: "placed",
    },
    cancelReason: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
