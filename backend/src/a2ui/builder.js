import { ROAM_CATALOG_ID, SURFACE_IDS } from "./catalog.js";
import { missingFields } from "../agent/interview.js";
import { formatMoney } from "../config/money.js";

const VERSION = "v0.9.1";

function message(body) {
  return { version: VERSION, ...body };
}

export function createAgentSurface(theme = { primaryColor: "#db6f45" }) {
  return message({
    createSurface: {
      surfaceId: SURFACE_IDS.agent,
      catalogId: ROAM_CATALOG_ID,
      theme,
      sendDataModel: true,
    },
  });
}

export function updateAgentDataModel(data) {
  return message({
    updateDataModel: {
      surfaceId: SURFACE_IDS.agent,
      path: "/",
      value: data,
    },
  });
}

function preferenceItems(preferences) {
  const route = preferences.dropoffLocation
    ? `${preferences.location || "?"} → ${preferences.dropoffLocation}`
    : preferences.location;

  return [
    { label: "Mode", value: preferences.transactionType },
    { label: "Route", value: route },
    { label: "Vehicle", value: preferences.category },
    { label: "Fuel", value: preferences.fuelType },
    { label: "Passengers", value: preferences.passengers?.toString() },
    {
      label: "Budget",
      value: preferences.maxBudget ? `$${preferences.maxBudget}` : undefined,
    },
    {
      label: "Dates",
      value:
        preferences.startDate && preferences.endDate
          ? `${preferences.startDate} → ${preferences.endDate}`
          : preferences.startDate,
    },
  ];
}

export function buildInterviewA2UI(preferences, status = "interviewing") {
  const missing = missingFields(preferences);
  const captured = preferenceItems(preferences).filter((item) => item.value);
  const total = 7;
  const done = total - missing.length;

  return [
    createAgentSurface(),
    updateAgentDataModel({
      phase: status,
      preferences,
      missingFields: missing,
      progress: { done, total, label: `${done}/${total} preferences captured` },
      captured,
    }),
    message({
      updateComponents: {
        surfaceId: SURFACE_IDS.agent,
        components: [
          {
            id: "root",
            component: "Column",
            children: ["header", "progress", "preferences"],
          },
          {
            id: "header",
            component: "Text",
            text: "Live interview progress",
            variant: "eyebrow",
          },
          {
            id: "progress",
            component: "ProgressBar",
            value: { path: "/progress/done" },
            max: { path: "/progress/total" },
            label: { path: "/progress/label" },
          },
          {
            id: "preferences",
            component: "PreferenceGrid",
            items: { path: "/captured" },
          },
        ],
      },
    }),
  ];
}

export function buildSearchProgressA2UI(preferences) {
  return [
    createAgentSurface(),
    updateAgentDataModel({
      phase: "searching",
      preferences,
      message: "Searching marketplace listings via MCP…",
    }),
    message({
      updateComponents: {
        surfaceId: SURFACE_IDS.agent,
        components: [
          {
            id: "root",
            component: "Column",
            children: ["header", "spinner", "status"],
          },
          {
            id: "header",
            component: "Text",
            text: "Marketplace research",
            variant: "eyebrow",
          },
          {
            id: "spinner",
            component: "Spinner",
            label: "Querying listings",
          },
          {
            id: "status",
            component: "Text",
            text: { path: "/message" },
            variant: "body",
          },
        ],
      },
    }),
  ];
}

export function buildCatalogA2UI(preferences, recommendations) {
  const currency = preferences.currency || "INR";
  const cars = (recommendations || []).map((car, index) => ({
    rank: index + 1,
    listingId: car.listingId,
    title: `${car.brand} ${car.model}`,
    subtitle: `${car.category} / ${car.fuelType}`,
    meta: `${car.seats} seats · ${car.transmission} · ${car.provider}`,
    score: car.score,
    reasons: car.reasons || [],
    price:
      preferences.transactionType === "rent"
        ? `${formatMoney(car.dailyPrice, currency)}/day`
        : formatMoney(car.purchasePrice, currency),
  }));

  return [
    createAgentSurface(),
    updateAgentDataModel({
      phase: "recommendations",
      preferences,
      recommendations: cars,
      count: cars.length,
    }),
    message({
      updateComponents: {
        surfaceId: SURFACE_IDS.agent,
        components: [
          {
            id: "root",
            component: "Column",
            children: ["header", "catalog"],
          },
          {
            id: "header",
            component: "Row",
            children: ["title", "count"],
          },
          {
            id: "title",
            component: "Text",
            text: "Your strongest matches",
            variant: "h2",
          },
          {
            id: "count",
            component: "Badge",
            text: { path: "/count" },
            suffix: " matches",
          },
          {
            id: "catalog",
            component: "CarCatalog",
            items: { path: "/recommendations" },
            action: { event: { name: "select_car" } },
          },
        ],
      },
    }),
  ];
}

export function buildEmptyResultsA2UI(preferences) {
  return [
    createAgentSurface(),
    updateAgentDataModel({
      phase: "empty",
      preferences,
      message: "No listings matched your filters. Try widening your budget or dates.",
    }),
    message({
      updateComponents: {
        surfaceId: SURFACE_IDS.agent,
        components: [
          {
            id: "root",
            component: "Column",
            children: ["header", "empty"],
          },
          {
            id: "header",
            component: "Text",
            text: "Search complete",
            variant: "eyebrow",
          },
          {
            id: "empty",
            component: "EmptyState",
            message: { path: "/message" },
          },
        ],
      },
    }),
  ];
}

export function buildBookingFormA2UI(listing, preferences = {}) {
  const currency = listing.currency || preferences.currency || "INR";
  const route = preferences.dropoffLocation
    ? `${preferences.location || "?"} → ${preferences.dropoffLocation}`
    : preferences.location || "—";
  const dates =
    preferences.startDate && preferences.endDate
      ? `${preferences.startDate} → ${preferences.endDate}`
      : preferences.startDate || "—";
  const priceLine =
    preferences.transactionType === "rent"
      ? `${formatMoney(listing.dailyPrice, currency)}/day`
      : formatMoney(listing.purchasePrice, currency);

  return [
    createAgentSurface(),
    updateAgentDataModel({
      phase: "booking",
      preferences,
      route,
      dates,
      listing: {
        listingId: listing.listingId,
        brand: listing.brand,
        model: listing.model,
        category: listing.category,
        fuelType: listing.fuelType,
        seats: listing.seats,
        transmission: listing.transmission,
        provider: listing.provider,
        rating: listing.rating,
        priceLine,
        currency,
      },
    }),
    message({
      updateComponents: {
        surfaceId: SURFACE_IDS.agent,
        components: [
          {
            id: "root",
            component: "Column",
            children: ["header", "vehicle", "trip", "name", "email", "phone", "submit"],
          },
          {
            id: "header",
            component: "Text",
            text: "Reserve your selected car",
            variant: "h2",
          },
          {
            id: "vehicle",
            component: "VehicleSummary",
            props: { vehicle: { path: "/listing" } },
          },
          {
            id: "trip",
            component: "TripGrid",
            props: { route: { path: "/route" }, dates: { path: "/dates" } },
          },
          {
            id: "name",
            component: "TextField",
            props: { name: "name", label: "Full name", placeholder: "e.g. Pragyansh Gupta", required: true, autocomplete: "name" },
          },
          {
            id: "email",
            component: "TextField",
            props: { name: "email", label: "Email", type: "email", placeholder: "you@example.com", required: true, autocomplete: "email" },
          },
          {
            id: "phone",
            component: "TextField",
            props: { name: "phone", label: "Phone", placeholder: "Optional", autocomplete: "tel" },
          },
          {
            id: "submit",
            component: "Button",
            props: { text: "Continue to payment", primary: true },
            action: { event: { name: "submit_booking" } },
          },
        ],
      },
    }),
  ];
}

export function buildCheckoutA2UI(booking) {
  const amount = Number(booking.totalAmount) || 0;
  const currency = booking.currency || "INR";
  return [
    createAgentSurface(),
    updateAgentDataModel({
      phase: "checkout",
      booking: {
        bookingId: booking.bookingId,
        totalAmount: amount,
        currency,
        amountText: formatMoney(amount, currency),
        label: booking.status === "confirmed" ? "Already paid" : "Trip total",
        status: booking.status,
        paymentStatus: booking.paymentStatus,
      },
    }),
    message({
      updateComponents: {
        surfaceId: SURFACE_IDS.agent,
        components: [
          {
            id: "root",
            component: "Column",
            children: ["header", "amount", "approve"],
          },
          {
            id: "header",
            component: "Text",
            text: "Mock payment",
            variant: "h2",
          },
          {
            id: "amount",
            component: "AmountRow",
            props: { label: { path: "/booking/label" }, amount: { path: "/booking/amountText" } },
          },
          {
            id: "approve",
            component: "Button",
            props: { text: "Approve mock payment", primary: true },
            action: { event: { name: "approve_payment" } },
          },
        ],
      },
    }),
  ];
}

export function buildConfirmationA2UI(result) {
  const currency = result.currency || "INR";
  return [
    createAgentSurface(),
    updateAgentDataModel({
      phase: "confirmed",
      confirmationNumber: result.confirmationNumber,
      bookingId: result.bookingId,
      amountText: formatMoney(result.totalAmount, currency),
      currency,
    }),
    message({
      updateComponents: {
        surfaceId: SURFACE_IDS.agent,
        components: [
          {
            id: "root",
            component: "Column",
            children: ["icon", "title", "subtitle", "details"],
          },
          {
            id: "icon",
            component: "Icon",
            name: "check",
            variant: "success",
          },
          {
            id: "title",
            component: "Text",
            text: "Demo booking confirmed",
            variant: "h2",
          },
          {
            id: "subtitle",
            component: "Text",
            text: { path: "/confirmationNumber" },
            variant: "confirmation",
          },
          {
            id: "details",
            component: "Text",
            text: { path: "/amountText" },
            variant: "body",
          },
        ],
      },
    }),
  ];
}

export function buildA2UIForTurn({ preferences, recommendations, phase }) {
  if (phase === "searching") return buildSearchProgressA2UI(preferences);
  if (phase === "recommendations") {
    return recommendations?.length
      ? buildCatalogA2UI(preferences, recommendations)
      : buildEmptyResultsA2UI(preferences);
  }
  return buildInterviewA2UI(preferences, phase);
}
