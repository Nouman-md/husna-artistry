const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    sizes: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one frame size is required.",
      },
    },
    frameColor: { type: String, trim: true, default: "" },
    description: { type: String, required: true, trim: true },
    // Stored as web paths like "/uploads/1719999999-123456789.jpg"
    images: { type: [String], default: [] },
    // Simple availability flag instead of numeric stock counts —
    // this is a made-to-order handmade business, not a warehouse.
    stockStatus: {
      type: String,
      enum: ["in_stock", "made_to_order"],
      default: "made_to_order",
    },
    // Denormalized rating summary, kept in sync whenever a review is added/removed.
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text", category: "text" });

module.exports = mongoose.model("Product", productSchema);
