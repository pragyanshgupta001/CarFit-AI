import { Langfuse } from "langfuse";
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("roam-car-agent", "1.0.0");

let langfuseClient = null;

export function getLangfuse() {
  if (!langfuseClient && process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
    try {
      langfuseClient = new Langfuse({
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
      });
      console.log("[Telemetry] Langfuse cloud tracer initialized");
    } catch (error) {
      console.warn("[Telemetry] Failed to initialize Langfuse:", error.message);
    }
  }
  return langfuseClient;
}

export async function traceTurn({ sessionId, text, preferences, missingFields }, actionFn) {
  const startTime = Date.now();
  const otelSpan = tracer.startSpan("agent.turn", {
    attributes: {
      "session.id": sessionId || "anonymous",
      "user.text": text,
      "preferences.captured": JSON.stringify(preferences || {}),
      "missing.fields": JSON.stringify(missingFields || []),
    },
  });

  const langfuse = getLangfuse();
  const traceObj = langfuse?.trace({
    name: "agent-interview-turn",
    sessionId: sessionId || "anonymous",
    input: { text, preferences },
    metadata: { missingFields },
  });

  try {
    const result = await actionFn();
    const duration = Date.now() - startTime;

    otelSpan.setAttribute("agent.reply", result.reply || "");
    otelSpan.setAttribute("agent.complete", result.complete || false);
    otelSpan.setAttribute("recommendations.count", result.recommendations?.length || 0);
    otelSpan.setStatus({ code: 1 }); // OK
    otelSpan.end();

    if (traceObj) {
      traceObj.generation({
        name: "llm-agent-reasoning",
        model: process.env.OLLAMA_MODEL || "qwen2.5:7b",
        input: text,
        output: result.reply,
        metadata: {
          complete: result.complete,
          recommendationsCount: result.recommendations?.length || 0,
          toolUsed: result.tool || null,
        },
      });
      await langfuse.flushAsync().catch(() => {});
    }

    console.log(`[Telemetry Trace] Turn completed in ${duration}ms | Session: ${sessionId || "demo"} | Tool: ${result.tool || "none"} | Recs: ${result.recommendations?.length || 0}`);
    return result;
  } catch (error) {
    otelSpan.recordException(error);
    otelSpan.setStatus({ code: 2, message: error.message }); // Error
    otelSpan.end();

    if (traceObj) {
      traceObj.event({
        name: "agent-turn-error",
        level: "ERROR",
        statusMessage: error.message,
      });
      await langfuse.flushAsync().catch(() => {});
    }

    throw error;
  }
}

export async function traceMcpCall(serverName, toolName, inputArgs, actionFn) {
  const startTime = Date.now();
  const otelSpan = tracer.startSpan(`mcp.${serverName}.${toolName}`, {
    attributes: {
      "mcp.server": serverName,
      "mcp.tool": toolName,
      "mcp.input": JSON.stringify(inputArgs),
    },
  });

  const langfuse = getLangfuse();
  const span = langfuse?.span({
    name: `mcp-${serverName}-${toolName}`,
    input: inputArgs,
    metadata: { serverName, toolName },
  });

  try {
    const result = await actionFn();
    const duration = Date.now() - startTime;

    otelSpan.setStatus({ code: 1 });
    otelSpan.end();

    if (span) {
      span.end({ output: result });
      await langfuse.flushAsync().catch(() => {});
    }

    console.log(`[Telemetry Trace] MCP Tool '${toolName}' on '${serverName}' executed in ${duration}ms`);
    return result;
  } catch (error) {
    otelSpan.recordException(error);
    otelSpan.setStatus({ code: 2, message: error.message });
    otelSpan.end();

    if (span) {
      span.end({ level: "ERROR", statusMessage: error.message });
      await langfuse.flushAsync().catch(() => {});
    }

    throw error;
  }
}

export function getTelemetryStatus() {
  const hasLangfuse = Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
  return {
    openTelemetry: true,
    langfuseConnected: hasLangfuse,
    tracer: "OpenTelemetry Node SDK + Langfuse v3",
    host: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
  };
}
