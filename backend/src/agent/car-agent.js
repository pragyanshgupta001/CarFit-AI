import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createDeepAgent } from "deepagents";
import { ChatOllama } from "@langchain/ollama";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { traceMcpCall, traceTurn } from "../config/telemetry.js";
import {
  extractPreferences,
  interviewTurn,
  missingFields,
  normalizePreferences,
} from "./interview.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const marketplaceServerPath = path.resolve(currentDirectory, "../mcp/marketplace-server.js");

let mcpClientPromise;

async function getMarketplaceClient() {
  if (!mcpClientPromise) {
    mcpClientPromise = (async () => {
      const client = new Client({ name: "roam-agent", version: "1.0.0" });
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [marketplaceServerPath],
        cwd: path.resolve(currentDirectory, "../.."),
        stderr: "pipe",
        env: { ...process.env }
      });
      transport.stderr?.on("data", (chunk) => console.warn(`[marketplace-mcp] ${chunk.toString().trim()}`));
      await client.connect(transport);
      return client;
    })().catch((error) => {
      mcpClientPromise = undefined;
      throw error;
    });
  }
  return mcpClientPromise;
}

function parseToolResult(result) {
  if (result.structuredContent) return result.structuredContent;
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("search_listing returned no content");
  return JSON.parse(text);
}

async function callMarketplaceMcp(preferences) {
  return traceMcpCall("marketplace", "search_listing", preferences, async () => {
    const client = await getMarketplaceClient();
    const toolResult = await client.callTool({ name: "search_listing", arguments: preferences });
    if (toolResult.isError) throw new Error("The marketplace MCP search failed");
    return parseToolResult(toolResult);
  });
}

const searchListingTool = tool(
  async (preferences) => JSON.stringify(await callMarketplaceMcp(preferences)),
  {
    name: "search_listing",
    description: "Call the marketplace MCP server to search and rank available cars. Use only after all required preferences are known.",
    schema: z.object({
      transactionType: z.enum(["rent", "buy"]),
      location: z.string().min(1),
      category: z.string().min(1),
      maxBudget: z.number().positive(),
      startDate: z.string().min(1),
      endDate: z.string().optional(),
      passengers: z.number().int().positive(),
      fuelType: z.string().optional(),
      requiredFeatures: z.array(z.string()).optional()
    })
  }
);

function summarizeRecommendations(recommendations) {
  if (!recommendations?.length) return "";
  const top = recommendations.slice(0, 3);
  const lines = top.map((car, index) => {
    const price = car.dailyPrice ? `₹${car.dailyPrice}/day` : `₹${car.purchasePrice?.toLocaleString("en-IN")}`;
    return `${index + 1}. ${car.brand} ${car.model} — ${price}`;
  });
  return lines.join("\n");
}

function extractRecommendations(messages) {
  for (const message of [...messages].reverse()) {
    if (message.type !== "tool" || message.name !== "search_listing") continue;
    try {
      const result = typeof message.content === "string" ? JSON.parse(message.content) : message.content;
      return result.recommendations || [];
    } catch {
      return [];
    }
  }
  return [];
}

function lastAgentText(messages) {
  const message = [...messages].reverse().find((item) => item.type === "ai");
  if (!message?.content) return "I am ready to help you find a car.";
  const raw = typeof message.content === "string" ? message.content : message.content.map((item) => item.text || "").join(" ");
  return sanitizeReply(raw);
}

// Ollama reliably mangles the "$" character into "?" (e.g. "?80"). Since the
// marketplace is rupee-first, rewrite any "?" that precedes a number as "₹"
// and leave real question marks untouched.
function sanitizeReply(text) {
  return text
    .replace(/\?\s*(\d)/g, "₹$1")
    .replace(/\b(usd|\$)\s*(\d[\d,]*)/gi, (_, __, number) => `₹${number.replace(/,/g, "")}`);
}

export async function runCarAgentTurn(text, preferences, sessionId) {
  const capturedPreferences = normalizePreferences(
    extractPreferences(text, preferences)
  );
  const requiredFieldsMissing = missingFields(capturedPreferences);

  return traceTurn(
    { sessionId, text, preferences: capturedPreferences, missingFields: requiredFieldsMissing },
    async () => {
      if (requiredFieldsMissing.length > 0) {
        const fallback = await interviewTurn(text, capturedPreferences);
        return { ...fallback, preferences: capturedPreferences, recommendations: [], tool: null };
      }
      if (process.env.ENABLE_OLLAMA !== "true") {
        const fallback = await interviewTurn(text, capturedPreferences);
        if (!fallback.complete) return { ...fallback, recommendations: [], tool: null };
        const searchResult = await callMarketplaceMcp(fallback.preferences);
        const top = summarizeRecommendations(searchResult.recommendations);
        return { ...fallback, reply: `I have everything I need. I searched the marketplace and ranked the strongest matches for you.\n\n${top}`, recommendations: searchResult.recommendations || [], tool: "search_listing" };
      }

      try {
        const model = new ChatOllama({
          model: process.env.OLLAMA_MODEL || "qwen2.5:7b",
          baseUrl: process.env.OLLAMA_URL || "http://localhost:11434",
          temperature: 0.1
        });
        const agent = createDeepAgent({
          model,
          tools: [searchListingTool],
          systemPrompt: `You are ROAM, a car rental and buying agent. Interview the user conversationally and collect these required fields: transactionType (rent or buy), location, category, maxBudget, startDate, endDate, passengers. Current captured preferences: ${JSON.stringify(capturedPreferences)}. Missing fields: ${JSON.stringify(requiredFieldsMissing)}. Ask exactly one concise question for the first missing field. When all fields are available, you MUST call search_listing with the complete preferences, then summarize the ranked results and their reasons. Never invent listing facts. IMPORTANT: All prices are in Indian rupees (INR). Always write amounts in the form "₹2,400/day" or "₹15,00,000". Never output a "$" symbol and never put a "?" character directly before a number.`
        });
        const result = await agent.invoke({ messages: [{ role: "user", content: requiredFieldsMissing.length ? text : `${text}\n\nSYSTEM: All required fields are already complete. Do not ask about optional fuel or features. Immediately call the search_listing tool using this exact complete preference object: ${JSON.stringify(capturedPreferences)}` }] });
        const recommendations = extractRecommendations(result.messages || []);
        const complete = requiredFieldsMissing.length === 0;
        if (complete && !recommendations.length) {
          const searchResult = await callMarketplaceMcp(capturedPreferences);
          const top = summarizeRecommendations(searchResult.recommendations);
          return { preferences: capturedPreferences, complete: true, reply: `I searched the marketplace and ranked the strongest matches for you.\n\n${top}`, recommendations: searchResult.recommendations || [], tool: "search_listing" };
        }
        return {
          preferences: capturedPreferences,
          complete,
          reply: lastAgentText(result.messages || []),
          recommendations,
          tool: complete ? "search_listing" : null
        };
      } catch (error) {
        console.warn(`DeepAgent unavailable, using fallback interviewer: ${error.message}`);
        const fallback = await interviewTurn(text, capturedPreferences);
        if (!fallback.complete) return { ...fallback, recommendations: [], tool: null };
        const searchResult = await callMarketplaceMcp(fallback.preferences);
        const top = summarizeRecommendations(searchResult.recommendations);
        return { ...fallback, reply: `${fallback.reply}\n\n${top}`, recommendations: searchResult.recommendations || [], tool: "search_listing" };
      }
    }
  );
}