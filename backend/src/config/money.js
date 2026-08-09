export const INR_PER_USD = 83;

export function toInr(usdAmount) {
  return Math.round(usdAmount * INR_PER_USD);
}

export function toUsd(inrAmount) {
  return inrAmount / INR_PER_USD;
}

export function formatMoney(amount, currency = "INR") {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
    return "—";
  }
  const value = Number(amount);
  if (currency === "USD") return `$${value.toLocaleString("en-US")}`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export function normalizeToInr(amount, currency) {
  if (currency === "USD") return toInr(amount);
  return Math.round(amount);
}
