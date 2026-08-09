import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import connectDB from "../config/db.js";
import Booking from "../models/Booking.js";
import Listing from "../models/Listing.js";

const server = new McpServer({ name: "roam-booking", version: "1.0.0" });
const appHtml = await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "booking-app.html"), "utf8");

server.registerResource("booking-form", "ui://roam/booking-form.html", { mimeType: "text/html", description: "Embedded booking form for the selected vehicle", _meta: { "ui:prefersBorder": true } }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/html", text: appHtml }] }));

server.registerTool("create_booking", {
  title: "Create pending booking",
  description: "Create a pending demo booking for a selected vehicle after collecting customer details.",
  inputSchema: {
    listingId: z.string().min(1),
    customer: z.object({ name: z.string().min(1), email: z.string().email(), phone: z.string().optional() }),
    startDate: z.string().min(1),
    endDate: z.string().min(1)
  },
  _meta: { "ui/resourceUri": "ui://roam/booking-form.html" }
}, async ({ listingId, customer, startDate, endDate }) => {
  const listing = await Listing.findOne({ listingId }).lean();
  if (!listing) return { isError: true, content: [{ type: "text", text: "Listing not found" }] };
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(1, Math.ceil((end - start) / 86400000));
  const totalAmount = listing.transactionType === "rent" ? (listing.dailyPrice || 0) * days : (listing.purchasePrice || 0);
  const booking = await Booking.create({ bookingId: `booking_${randomUUID().slice(0, 8)}`, listingId, customer, startDate, endDate, totalAmount, currency: listing.currency || "INR" });
  return { content: [{ type: "text", text: JSON.stringify({ booking }) }], structuredContent: { booking } };
});

await connectDB();
await server.connect(new StdioServerTransport());