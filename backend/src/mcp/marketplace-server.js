import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import connectDB from "../config/db.js";
import { searchListings } from "../marketplace/search.js";
import { rankListings } from "../marketplace/ranking.js";

const server = new McpServer({ name: "roam-marketplace", version: "1.0.0" });

server.registerTool(
  "search_listing",
  {
    title: "Search car listings",
    description: "Search available rental and purchase car listings using the user's captured preferences, then return ranked matches with reasons.",
    inputSchema: {
      transactionType: z.enum(["rent", "buy"]),
      location: z.string().min(1),
      dropoffLocation: z.string().optional(),
      category: z.string().min(1),
      maxBudget: z.number().positive(),
      startDate: z.string().min(1),
      endDate: z.string().min(1),
      passengers: z.number().int().positive(),
      fuelType: z.string().optional(),
      requiredFeatures: z.array(z.string()).optional()
    }
  },
  async (preferences) => {
    const listings = await searchListings(preferences);
    const recommendations = rankListings(listings, preferences).slice(0, 10);
    return {
      content: [{ type: "text", text: JSON.stringify({ count: recommendations.length, recommendations }) }],
      structuredContent: { count: recommendations.length, recommendations }
    };
  }
);

await connectDB();
await server.connect(new StdioServerTransport());