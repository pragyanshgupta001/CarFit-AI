import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, unique: true, required: true },
    listingId: { type: String, required: true },
    customer: { name: String, email: String, phone: String },
    startDate: Date,
    endDate: Date,
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["INR", "USD"], default: "INR" },
    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending" },
    paymentStatus: { type: String, enum: ["unpaid", "mock-approved"], default: "unpaid" },
    confirmationNumber: String
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);