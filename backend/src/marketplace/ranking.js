import { toInr } from "../config/money.js";

const clamp = (value) => Math.max(0, Math.min(1, value));

export function rankListings(listings, preferences) {
	const rawBudget = preferences.maxBudget;
	const budget = rawBudget === undefined || rawBudget === null ? Infinity : preferences.currency === "USD" ? toInr(rawBudget) : rawBudget;
	return listings
		.map((listing) => {
			const price = preferences.transactionType === "buy" ? listing.purchasePrice : listing.dailyPrice;
			const budgetScore = price === undefined ? 0 : clamp(1 - Math.max(0, price - budget) / Math.max(budget, 1));
			const categoryScore = preferences.category && listing.category.toLowerCase() === preferences.category.toLowerCase() ? 1 : 0.35;
			const fuelScore = preferences.fuelType && listing.fuelType.toLowerCase() === preferences.fuelType.toLowerCase() ? 1 : 0.5;
			const passengerScore = preferences.passengers ? clamp(listing.seats / preferences.passengers) : 0.7;
			const featureMatches = (preferences.requiredFeatures || []).filter((feature) =>
				listing.features.some((item) => item.toLowerCase() === feature.toLowerCase())
			).length;
			const featureScore = preferences.requiredFeatures?.length
				? featureMatches / preferences.requiredFeatures.length
				: 0.7;
			const ratingScore = listing.rating / 5;
			const score = Math.round(
				(budgetScore * 0.3 + categoryScore * 0.2 + fuelScore * 0.1 + passengerScore * 0.15 + featureScore * 0.15 + ratingScore * 0.1) * 100
			);
			const reasons = [
				price <= budget ? "Fits your budget" : "Closest price match",
				`${listing.seats} seats and ${listing.fuelType} powertrain`,
				`${listing.rating.toFixed(1)}/5 provider rating`
			];
			if (featureMatches) reasons.push(`Matches ${featureMatches} requested feature${featureMatches > 1 ? "s" : ""}`);
			return { ...listing.toObject?.() ?? listing, score, reasons, tradeoffs: price > budget ? ["Above your stated budget"] : [] };
		})
		.sort((a, b) => b.score - a.score);
}
