import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { traceMcpCall } from "../config/telemetry.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const clients = new Map();

async function getClient(name, filename) {
  if (!clients.has(name)) {
    const promise = (async () => {
      const client = new Client({ name: `roam-${name}-client`, version: "1.0.0" });
      const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(directory, filename)], cwd: path.resolve(directory, "../.."), stderr: "pipe", env: { ...process.env } });
      transport.stderr?.on("data", (chunk) => console.warn(`[${name}-mcp] ${chunk.toString().trim()}`));
      await client.connect(transport);
      return client;
    })().catch((error) => { clients.delete(name); throw error; });
    clients.set(name, promise);
  }
  return clients.get(name);
}

function readResult(result) {
  if (result.isError) throw new Error(result.content?.[0]?.text || "MCP tool failed");
  if (result.structuredContent) return result.structuredContent;
  return JSON.parse(result.content?.find((item) => item.type === "text")?.text || "{}");
}

export async function createBookingThroughMcp(input) {
  return traceMcpCall("booking", "create_booking", input, async () => {
    const client = await getClient("booking", "booking-server.js");
    return readResult(await client.callTool({ name: "create_booking", arguments: input }));
  });
}

export async function checkoutThroughMcp(input) {
  return traceMcpCall("checkout", "mock_checkout", input, async () => {
    const client = await getClient("checkout", "checkout-server.js");
    return readResult(await client.callTool({ name: "mock_checkout", arguments: input }));
  });
}