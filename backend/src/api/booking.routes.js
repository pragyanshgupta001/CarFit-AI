import express from "express";
import { checkoutThroughMcp, createBookingThroughMcp } from "../mcp/clients.js";
import { buildCheckoutA2UI, buildConfirmationA2UI } from "../a2ui/builder.js";

const router = express.Router();

function mcpAppPayload(type, data = {}) {
  return {
    type,
    resourceUri:
      type === "booking"
        ? "ui://roam/booking-form.html"
        : "ui://roam/checkout-form.html",
    url: `/api/mcp/apps/${type}`,
    data,
  };
}

router.post("/bookings", async (req, res, next) => {
  try {
    const { listingId, customer, startDate, endDate } = req.body;
    if (!listingId || !customer?.name || !customer?.email) {
      return res
        .status(400)
        .json({ message: "listingId, customer name, and email are required" });
    }
    const result = await createBookingThroughMcp({
      listingId,
      customer,
      startDate,
      endDate,
    });
    res.status(201).json({
      ...result,
      a2ui: buildCheckoutA2UI(result.booking),
      mcpApp: mcpAppPayload("checkout", {
        booking: result.booking,
        mockMode: true,
        totalAmount: result.booking.totalAmount,
        currency: result.booking.currency,
        paymentStatus: result.booking.paymentStatus,
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/checkout", async (req, res, next) => {
  try {
    const result = await checkoutThroughMcp({
      bookingId: req.body.bookingId,
      paymentMethod: "demo",
    });
    res.json({
      ...result,
      a2ui: buildConfirmationA2UI(result),
    });
  } catch (error) {
    next(error);
  }
});

export default router;