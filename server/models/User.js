const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: "Home" },
    fullName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    houseNo: { type: String, required: true, trim: true },
    street: { type: String, required: true, trim: true },
    area: { type: String, trim: true, default: "" },
    landmark: { type: String, trim: true, default: "" },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    addressType: { type: String, enum: ["Home", "Work"], default: "Home" },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true, default: "" },
    passwordHash: { type: String, required: true },
    addresses: { type: [addressSchema], default: [] },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
