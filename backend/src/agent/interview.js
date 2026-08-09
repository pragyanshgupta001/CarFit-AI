import { normalizeToInr } from "../config/money.js";

const requiredFields = ["transactionType", "location", "category", "maxBudget", "startDate", "passengers"];

const INDIAN_CITIES = ["Aligarh", "Mathura", "Delhi", "Agra", "Mumbai", "Pune", "Jaipur", "Gurugram", "Noida", "Bengaluru"];

export function detectCurrency(text) {
  const lower = text.toLowerCase();
  if (/\b(rupee|rupees|inr|rs\.?)\b|₹/.test(lower)) return "INR";
  if (/\b(usd|us\$|dollars?|dollar)\b|\$/.test(lower)) return "USD";
  return null;
}

function resolveCurrency(preferences) {
  if (preferences.currency) return preferences.currency;
  const indian = INDIAN_CITIES.some((city) =>
    (preferences.location || "").toLowerCase().includes(city.toLowerCase())
  );
  return indian ? "INR" : "USD";
}

export function missingFields(preferences) {
  const fields = [...requiredFields];
  if (preferences.transactionType !== "buy") fields.push("endDate");
  return fields.filter((field) => preferences[field] === undefined || preferences[field] === null || preferences[field] === "");
}

export function normalizePreferences(preferences) {
  const next = { ...preferences };
  next.currency = resolveCurrency(next);
  if (next.transactionType === "buy" && next.startDate && !next.endDate) {
    next.endDate = next.startDate;
  }
  return next;
}

export function extractPreferences(text, current) {
  const next = { ...current };
  const lower = text.toLowerCase();
  if (/\b(buy|purchase|own)\b/.test(lower)) next.transactionType = "buy";
  if (/\b(rent|rental|hire)\b/.test(lower)) next.transactionType = "rent";
  const locations = ["Boston", "Chicago", "New York", "Austin", "Seattle", "Aligarh", "Mathura", "Delhi", "Agra"];
  const route = lower.match(/\b(aligarh|mathura|delhi|agra|boston|chicago|new york|austin|seattle)\b\s+(?:to|->|-)\s+\b(aligarh|mathura|delhi|agra|boston|chicago|new york|austin|seattle)\b/);
  if (route) {
    next.location = route[1].replace(/\b\w/g, (letter) => letter.toUpperCase());
    next.dropoffLocation = route[2].replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  const location = locations.find((item) => lower.includes(item.toLowerCase()));
  if (location) next.location = location;
  const categories = ["SUV", "Sedan", "Electric", "Luxury", "Hybrid", "Truck", "Minivan", "Compact"];
  const category = categories.find((item) => lower.includes(item.toLowerCase()));
  if (category) next.category = category;
  const budgetMatch =
    lower.match(/(?:under|below|budget(?: of)?|up to|maximum|max|within)\s*[:=]?\s*(\$|₹)?\s*([\d,]+)\s*(?:rupee|rupees|rs\.?|inr|usd|dollars?)?/i) ||
    lower.match(/(\$|₹)\s*([\d,]+)/);
  if (budgetMatch) {
    const symbol = budgetMatch[1];
    const budgetNumber = Number(budgetMatch[2].replace(",", ""));
    const budgetUnit = symbol === "$" ? "USD" : next.currency || "INR";
    next.maxBudget = normalizeToInr(budgetNumber, budgetUnit);
    next.currency = "INR";
  }
  const passengers = lower.match(/(\d+)\s*(?:people|passengers|seats|seater)/);
  if (passengers) next.passengers = Number(passengers[1]);
  const fuel = lower.match(/\b(petrol|gasoline|diesel|hybrid|electric)\b/);
  if (fuel) next.fuelType = fuel[1] === "petrol" ? "gasoline" : fuel[1];
  const dates = [...text.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((match) => match[0]);
  if (dates.length >= 2) {
    next.startDate = dates[0];
    next.endDate = dates[1];
  } else if (dates[0]) {
    if (current.startDate && !current.endDate) next.endDate = dates[0];
    else next.startDate = dates[0];
  }
  const naturalDates = lower.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s*(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+to\s+(\d{1,2})\s*(?:st|nd|rd|th)?\s*(january|february|march|april|may|june|july|august|september|october|november|december))?/);
  if (naturalDates) {
    const year = new Date().getFullYear();
    const toIso = (day, month) => `${year}-${String(new Date(`${month} 1, ${year}`).getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const parsedStart = toIso(naturalDates[1], naturalDates[2]);
    const parsedEnd = naturalDates[3] ? toIso(naturalDates[3], naturalDates[4]) : null;
    if (parsedEnd) {
      next.startDate = parsedStart;
      next.endDate = parsedEnd;
    } else if (current.startDate && !current.endDate) next.endDate = parsedStart;
    else next.startDate = parsedStart;
  }
  return next;
}

function questionFor(missing, preferences) {
  const prompts = {
    transactionType: "Would you like to rent or buy the car?",
    location: "Which city should I search?",
    category: "What type of car do you prefer, such as an SUV, sedan, electric, or luxury car?",
    maxBudget: preferences.transactionType === "buy" ? "What is your maximum purchase budget?" : "What is your maximum daily rental budget?",
    startDate: preferences.transactionType === "buy" ? "When are you hoping to purchase it? Use YYYY-MM-DD." : "What is your rental start date? Use YYYY-MM-DD.",
    endDate: "What is the end date? Use YYYY-MM-DD.",
    passengers: "How many passengers should the car fit?"
  };
  return prompts[missing[0]];
}

export async function interviewTurn(text, preferences) {
  const nextPreferences = normalizePreferences(extractPreferences(text, preferences));
  const missing = missingFields(nextPreferences);
  return {
    preferences: nextPreferences,
    complete: missing.length === 0,
    reply: missing.length
      ? questionFor(missing, nextPreferences)
      : "I have everything I need. Searching the marketplace for your best matches now."
  };
}