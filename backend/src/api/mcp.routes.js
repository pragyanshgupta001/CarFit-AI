import express from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const router = express.Router();
const mcpDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../mcp"
);

const apps = {
  booking: {
    resourceUri: "ui://roam/booking-form.html",
    file: "booking-app.html",
    title: "Booking form",
  },
  checkout: {
    resourceUri: "ui://roam/checkout-form.html",
    file: "checkout-app.html",
    title: "Mock checkout",
  },
};

router.get("/mcp/apps", (_req, res) => {
  res.json(
    Object.entries(apps).map(([key, app]) => ({
      key,
      resourceUri: app.resourceUri,
      title: app.title,
      url: `/api/mcp/apps/${key}`,
    }))
  );
});

router.get("/mcp/apps/:key", async (req, res, next) => {
  try {
    const app = apps[req.params.key];
    if (!app) return res.status(404).json({ message: "MCP app not found" });
    const html = await readFile(path.join(mcpDirectory, app.file), "utf8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    next(error);
  }
});

export default router;
