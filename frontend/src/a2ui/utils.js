export function getPath(path, data) {
  if (data == null) return undefined;
  if (!path) return data;
  const parts = String(path)
    .replace(/^\$\./, "")
    .replace(/^\//, "")
    .split(/[./]/)
    .filter(Boolean);
  let current = data;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

export function resolvePathValue(value, data) {
  if (typeof value === "string" && value.startsWith("$.")) {
    return getPath(value, data);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (typeof value.path === "string") return getPath(value.path, data);
    if (typeof value.binding === "string") return getPath(value.binding, data);
    const resolved = {};
    for (const key of Object.keys(value))
      resolved[key] = resolvePathValue(value[key], data);
    return resolved;
  }
  if (Array.isArray(value))
    return value.map((item) => resolvePathValue(item, data));
  return value;
}

export function formatMoney(amount, currency = "INR") {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount)))
    return "—";
  const value = Number(amount);
  if (currency === "USD") return `$${value.toLocaleString("en-US")}`;
  return `₹${value.toLocaleString("en-IN")}`;
}
