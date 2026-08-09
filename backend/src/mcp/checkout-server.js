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

const server = new McpServer({ name: "roam-checkout", version: "1.0.0" });
const appHtml = await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "checkout-app.html"), "utf8");

server.registerResource("checkout-form", "ui://roam/checkout-form.html", { mimeType: "text/html", description: "Embedded safe mock checkout interface", _meta: { "ui:prefersBorder": true } }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/html", text: appHtml }] }));

server.registerTool("mock_checkout", {
  title: "Approve mock payment",
  description: "Approve a safe simulated payment for a pending demo booking. Never processes real money.",
  inputSchema: { bookingId: z.string().min(1), paymentMethod: z.string().default("demo") },
  _meta: { "ui/resourceUri": "ui://roam/checkout-form.html" }
}, async ({ bookingId }) => {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) return { isError: true, content: [{ type: "text", text: "Booking not found" }] };
  const result = { status: "mock-approved", confirmationNumber: booking.confirmationNumber, bookingId, totalAmount: booking.totalAmount, currency: booking.currency || "INR" };
  if (booking.status === "confirmed") return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  booking.status = "confirmed";
  booking.paymentStatus = "mock-approved";
  booking.confirmationNumber = `DEMO-${randomUUID().slice(0, 8).toUpperCase()}`;
  await booking.save();
  result.confirmationNumber = booking.confirmationNumber;
  return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
});

await connectDB();
await server.connect(new StdioServerTransport());