import mongoose from "mongoose";

const listingSchema = new mongoose.Schema(
	{
		listingId: { type: String, required: true, unique: true, index: true },
		transactionType: { type: String, enum: ["rent", "buy"], required: true, index: true },
		brand: { type: String, required: true, index: true },
		model: { type: String, required: true },
		category: { type: String, required: true, index: true },
		location: { type: String, required: true, index: true },
		dailyPrice: { type: Number, min: 0 },
		purchasePrice: { type: Number, min: 0 },
		currency: { type: String, enum: ["INR", "USD"], default: "INR" },
		seats: { type: Number, required: true, min: 1 },
		fuelType: { type: String, required: true },
		transmission: { type: String, required: true },
		features: { type: [String], default: [] },
		availableFrom: { type: Date, required: true },
		availableTo: { type: Date, required: true },
		rating: { type: Number, min: 0, max: 5, required: true },
		provider: { type: String, required: true }
	},
	{ timestamps: true }
);

export default mongoose.model("Listing", listingSchema);
