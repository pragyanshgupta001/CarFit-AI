import express from "express";
import { searchListings } from "../marketplace/search.js";
import { rankListings } from "../marketplace/ranking.js";

const router = express.Router();

router.post("/search", async (req, res, next) => {
	try {
		const preferences = req.body;
		if (!preferences.transactionType || !preferences.category || !preferences.maxBudget) {
			return res.status(400).json({ message: "transactionType, category, and maxBudget are required" });
		}
		const listings = await searchListings(preferences);
		res.json({ count: listings.length, recommendations: rankListings(listings, preferences).slice(0, 10) });
	} catch (error) {
		next(error);
	}
});

export default router;
