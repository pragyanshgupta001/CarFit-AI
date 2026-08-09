import Listing from "../models/Listing.js";
import { toInr } from "../config/money.js";

const dateValue = (value) => (value ? new Date(value) : null);

export async function searchListings(preferences) {
	const query = {
		transactionType: preferences.transactionType,
		...(preferences.location && { location: new RegExp(preferences.location, "i") }),
		...(preferences.category && { category: new RegExp(`^${preferences.category}$`, "i") }),
		...(preferences.passengers && { seats: { $gte: preferences.passengers } })
	};
	let maxBudget = preferences.maxBudget;
	if (preferences.currency === "USD") maxBudget = toInr(maxBudget);
	if (maxBudget) query[preferences.transactionType === "buy" ? "purchasePrice" : "dailyPrice"] = { $lte: maxBudget };

	const start = dateValue(preferences.startDate);
	const end = dateValue(preferences.endDate || preferences.startDate);
	if (start && end) {
		query.availableFrom = { $lte: start };
		query.availableTo = { $gte: end };
	}

	let listings = await Listing.find(query).limit(100).lean();
	if (!listings.length && maxBudget) {
		const relaxedQuery = { ...query };
		delete relaxedQuery[preferences.transactionType === "buy" ? "purchasePrice" : "dailyPrice"];
		listings = await Listing.find(relaxedQuery).limit(100).lean();
	}
	return preferences.fuelType
		? listings.filter((listing) => listing.fuelType.toLowerCase() === preferences.fuelType.toLowerCase())
		: listings;
}
