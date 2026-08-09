import "dotenv/config";
import mongoose from "mongoose";
import Listing from "../models/Listing.js";

const brands = ["Toyota", "Honda", "BMW", "Ford", "Kia", "Hyundai", "Tesla", "Volvo", "Audi", "Mazda"];
const categories = ["SUV", "Sedan", "Hatchback", "Luxury", "Electric", "Hybrid", "Truck", "Convertible", "Minivan", "Compact"];
const locations = ["Boston", "Chicago", "New York", "Austin", "Seattle", "Aligarh", "Mathura", "Delhi", "Agra"];
const fuels = ["hybrid", "gasoline", "electric", "diesel"];
const features = ["backup camera", "large trunk", "adaptive cruise", "apple carplay", "child seats"];

// INR pricing (rupee-first marketplace). Base prices per category, varied per listing.
const dailyBase = {
  Compact: 700, Hatchback: 950, Sedan: 950, SUV: 1800, Hybrid: 1900,
  Electric: 2100, Minivan: 2600, Truck: 2900, Convertible: 4200, Luxury: 5200
};
const purchaseBase = {
  Compact: 480000, Hatchback: 620000, Sedan: 900000, SUV: 1500000, Hybrid: 1600000,
  Electric: 2000000, Minivan: 1900000, Truck: 1600000, Convertible: 4600000, Luxury: 7200000
};

const listings = Array.from({ length: 250 }, (_, index) => {
	const category = categories[index % categories.length];
	const brand = brands[Math.floor(index / categories.length) % brands.length];
	const location = locations[Math.floor(index / categories.length) % locations.length];
	const transactionType = category === "Sedan" ? "rent" : (index % 2 === 0 ? "rent" : "buy");
	const baseDate = new Date("2026-01-01T00:00:00.000Z");
	return {
		listingId: `listing_${String(index + 1).padStart(4, "0")}`,
		transactionType,
		brand,
		model: `${brand} ${category} ${100 + (index % 20)}`,
		category,
		location,
		dailyPrice: transactionType === "rent"
			? Math.round(dailyBase[category] + (index % 9) * Math.round(dailyBase[category] * 0.12))
			: undefined,
		purchasePrice: transactionType === "buy"
			? Math.round(purchaseBase[category] + (index % 12) * Math.round(purchaseBase[category] * 0.08))
			: undefined,
		seats: category === "Sedan" ? 5 : 4 + (index % 3),
		fuelType: category === "Sedan" ? "gasoline" : fuels[index % fuels.length],
		transmission: index % 4 === 0 ? "manual" : "automatic",
		features: [features[index % features.length], features[(index + 2) % features.length]],
		availableFrom: baseDate,
		availableTo: new Date("2026-12-31T00:00:00.000Z"),
		rating: 3.8 + (index % 12) / 10,
		provider: `DriveHub ${1 + (index % 5)}`,
		currency: "INR"
	};
});

await mongoose.connect(process.env.MONGO_URI);
await Listing.deleteMany({});
await Listing.insertMany(listings);
console.log(`Seeded ${listings.length} listings`);
await mongoose.disconnect();
