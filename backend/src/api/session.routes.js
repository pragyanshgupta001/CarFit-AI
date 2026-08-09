import express from "express";
import { randomUUID } from "node:crypto";
import Session from "../models/Session.js";
import Listing from "../models/Listing.js";
import { runCarAgentTurn } from "../agent/car-agent.js";
import {
  buildA2UIForTurn,
  buildBookingFormA2UI,
  buildConfirmationA2UI,
  buildInterviewA2UI,
} from "../a2ui/builder.js";

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

router.post("/sessions", async (req, res, next) => {
  try {
    const session = await Session.create({ sessionId: randomUUID() });
    res.status(201).json({
      sessionId: session.sessionId,
      status: session.status,
      preferences: session.preferences,
      a2ui: buildInterviewA2UI(session.preferences || {}),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/sessions/:sessionId", async (req, res, next) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.sessionId }).lean();
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.post("/sessions/:sessionId/select", async (req, res, next) => {
  try {
    const { listingId } = req.body;
    const session = await Session.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const recommendation =
      session.recommendations.find((item) => item.listingId === listingId) ||
      (await Listing.findOne({ listingId }).lean());
    if (!recommendation) return res.status(404).json({ message: "Listing not found" });

    session.selectedListingId = listingId;
    session.status = "booking";
    session.messages.push({
      role: "assistant",
      content: `You selected ${recommendation.brand} ${recommendation.model}. Complete the booking form below — it is generated as an MCP App inside the chat.`,
    });
    await session.save();

    res.json({
      sessionId: session.sessionId,
      status: session.status,
      listing: recommendation,
      a2ui: buildBookingFormA2UI(recommendation, session.preferences || {}),
      mcpApp: mcpAppPayload("booking", {
        listing: recommendation,
        preferences: session.preferences,
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/sessions/:sessionId/messages", async (req, res, next) => {
  try {
    if (!req.body.content?.trim()) {
      return res.status(400).json({ message: "content is required" });
    }

    const session = await Session.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const currentPreferences =
      session.preferences?.toObject?.() || session.preferences || {};
    const result = await runCarAgentTurn(req.body.content.trim(), currentPreferences);

    session.preferences = result.preferences;
    session.messages.push(
      { role: "user", content: req.body.content.trim() },
      { role: "assistant", content: result.reply }
    );

    let a2ui = buildInterviewA2UI(result.preferences, "interviewing");
    let recommendations = [];

    if (result.complete) {
      session.status = "searching";
      a2ui = buildA2UIForTurn({
        preferences: result.preferences,
        phase: "searching",
      });

      recommendations = result.recommendations || [];
      session.recommendations = recommendations;
      session.status = recommendations.length ? "recommendations_ready" : "interviewing";

      a2ui = buildA2UIForTurn({
        preferences: result.preferences,
        recommendations,
        phase: "recommendations",
      });
    } else {
      session.status = "interviewing";
    }

    await session.save();

    res.json({
      sessionId: session.sessionId,
      status: session.status,
      reply: result.reply,
      preferences: session.preferences,
      recommendations,
      a2ui,
      tool: result.tool || null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
