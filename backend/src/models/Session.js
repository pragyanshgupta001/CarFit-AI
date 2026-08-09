import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    ui: { type: mongoose.Schema.Types.Mixed }
  },
  { _id: false, timestamps: true }
);

const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, unique: true, required: true, index: true },
    status: { type: String, enum: ["interviewing", "ready_to_search", "recommendations_ready", "booking", "checkout", "confirmed"], default: "interviewing" },
    preferences: {
      transactionType: { type: String, enum: ["rent", "buy"] },
      location: String,
      dropoffLocation: String,
      category: String,
      maxBudget: Number,
      currency: { type: String, enum: ["INR", "USD"], default: "INR" },
      startDate: String,
      endDate: String,
      passengers: Number,
      fuelType: String,
      requiredFeatures: [String]
    },
    messages: { type: [messageSchema], default: [] },
    recommendations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    selectedListingId: String
  },
  { timestamps: true }
);

export default mongoose.model("Session", sessionSchema);