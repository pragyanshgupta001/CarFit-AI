# CarFit AI — Migration Baseline (Phase 1)

**Status:** Verified baseline documentation.  
**Source:** Actual repository source code at `D:\car-marketplace`.  
**Date:** Tue Nov 03 2026  
**Scope:** Existing Node.js/Express backend and React frontend. No Python code, no frontend changes, no MCP server changes.

---

## 1. Repository Overview

| Path | Description |
|------|-------------|
| `backend/src/server.js` | Express 5 entry point, CORS, Helmet, route mounting, health/telemetry endpoints |
| `backend/src/api/session.routes.js` | Session CRUD, chat message handling, car selection |
| `backend/src/api/chat.routes.js` | Direct marketplace search endpoint (`/api/search`) |
| `backend/src/api/booking.routes.js` | Booking creation and mock checkout |
| `backend/src/api/mcp.routes.js` | Serves MCP app HTML files |
| `backend/src/agent/car-agent.js` | DeepAgents orchestrator, LLM factory, MCP marketplace client |
| `backend/src/agent/interview.js` | Six-slot elicitation, preference extraction, normalization |
| `backend/src/mcp/marketplace-server.js` | `roam-marketplace` MCP server, `search_listing` tool |
| `backend/src/mcp/booking-server.js` | `roam-booking` MCP server, `create_booking` tool, HTML resource |
| `backend/src/mcp/checkout-server.js` | `roam-checkout` MCP server, `mock_checkout` tool, HTML resource |
| `backend/src/mcp/clients.js` | Singleton MCP client manager (booking, checkout) |
| `backend/src/models/Session.js` | Mongoose session schema |
| `backend/src/models/Listing.js` | Mongoose listing schema |
| `backend/src/models/Booking.js` | Mongoose booking schema |
| `backend/src/marketplace/search.js` | MongoDB query construction for listings |
| `backend/src/marketplace/ranking.js` | 100-point multi-attribute ranking formula |
| `backend/src/config/db.js` | MongoDB connection |
| `backend/src/config/money.js` | INR/USD conversion and formatting |
| `backend/src/config/telemetry.js` | OpenTelemetry + Langfuse tracing |
| `backend/src/a2ui/builder.js` | A2UI protocol envelope serialization |
| `backend/src/a2ui/catalog.js` | A2UI catalog and surface ID constants |
| `backend/.env.example` | Environment variable template (contains real MongoDB credentials — see Security Notes) |
| `frontend/src/App.jsx` | React single-page app, chat, booking, checkout state |
| `frontend/src/a2ui/renderer.jsx` | A2UI protocol reducer |
| `frontend/src/a2ui/catalog.jsx` | React component catalog for A2UI rendering |
| `frontend/src/a2ui/utils.js` | Path resolution and INR/USD formatting |
| `frontend/package.json` | React 19, Vite 8, Tailwind CSS v4 |
| `backend/package.json` | Node.js 20 ESM, Express 5, DeepAgents, LangChain, MCP SDK |
| `docker-compose.yml` | MongoDB, backend, frontend services |
| `spec.md` | Technical specification document |

**Authentication:** None. No JWT, no user model, no password handling, no cookies. Sessions are anonymous UUIDs. CORS allows all `http://localhost:*` and `http://127.0.0.1:*` origins.

---

## 2. Backend API Routes

### 2.1 `GET /api/health`

| Attribute | Value |
|-----------|-------|
| Source | `backend/src/server.js:36` |
| Method | GET |
| Authentication | None |
| Request body | None |
| Response | `{ ok: true }`, HTTP 200 |

### 2.2 `GET /api/telemetry/status`

| Attribute | Value |
|-----------|-------|
| Source | `backend/src/server.js:37` |
| Method | GET |
| Authentication | None |
| Request body | None |
| Response | `{ openTelemetry: true, langfuseConnected: boolean, tracer: string, host: string }`, HTTP 200 |

### 2.3 `POST /api/sessions`

| Attribute | Value |
|-----------|-------|
| Source | `backend/src/api/session.routes.js:27-39` |
| Method | POST |
| Authentication | None |
| Request body | None required |
| Response (201) | `{ sessionId: string, status: "interviewing", preferences: {}, a2ui: [...] }` |
| Response (500) | `{ message: string, error: string }` |

### 2.4 `GET /api/sessions/:sessionId`

| Attribute | Value |
|-----------|-------|
| Source | `backend/src/api/session.routes.js:41-49` |
| Method | GET |
| Authentication | None |
| Path params | `sessionId` (string) |
| Response (200) | Full Session document (MongoDB) |
| Response (404) | `{ message: "Session not found" }` |

### 2.5 `POST /api/sessions/:sessionId/messages`

| Attribute | Value |
|-----------|-------|
| Source | `backend/src/api/session.routes.js:85-145` |
| Method | POST |
| Authentication | None |
| Path params | `sessionId` (string) |
| Request body | `{ content: string }` (content must be non-empty after trim) |
| Response (200) | `{ sessionId, status, reply, preferences, recommendations, a2ui, tool }` |
| Response (400) | `{ message: "content is required" }` |
| Response (404) | `{ message: "Session not found" }` |
| Response (500) | `{ message: "Something went wrong", error: string }` |

**Behavior:**
1. Validates `content` is present and non-empty.
2. Loads session from MongoDB.
3. Extracts current preferences from session (`toObject()` or fallback).
4. Calls `runCarAgentTurn(content, currentPreferences, sessionId)` from `car-agent.js`.
5. Updates `session.preferences` with result.
6. Pushes user and assistant messages to `session.messages`.
7. Determines phase: if `result.complete`, status transitions `interviewing` → `searching` → `recommendations_ready` (if recommendations exist) or back to `interviewing` (if empty).
8. Saves session.
9. Builds A2UI via `builder.js` based on phase.
10. Returns structured response.

### 2.6 `POST /api/sessions/:sessionId/select`

| Attribute | Value |
|-----------|-------|
| Source | `backend/src/api/session.routes.js:51-83` |
| Method | POST |
| Authentication | None |
| Path params | `sessionId` (string) |
| Request body | `{ listingId: string }` |
| Response (200) | `{ sessionId, status: "booking", listing, a2ui, mcpApp }` |
| Response (404) | `{ message: "Session not found" }` or `{ message: "Listing not found" }` |

**Behavior:**
1. Loads session, returns 404 if missing.
2. Finds listing in `session.recommendations` by `listingId`, or falls back to `Listing.findOne({ listingId })`.
3. Sets `session.selectedListingId = listingId`, `session.status = "booking"`.
4. Pushes assistant message to `session.messages`.
5. Saves session.
6. Returns booking form A2UI and MCP app payload (`ui://roam/booking-form.html`).

### 2.7 `POST /api/bookings`

| Attribute | Value |
|-----------|-------|
| Source | `backend/src/api/booking.routes.js:19-47` |
| Method | POST |
| Authentication | None |
| Request body | `{ listingId, customer: { name, email, phone? }, startDate, endDate }` |
| Validation | `listingId`, `customer.name`, `customer.email` required |
| Response (201) | `{ ...result, a2ui, mcpApp }` where `result` includes `booking` |
| Response (400) | `{ message: "listingId, customer name, and email are required" }` |
| Response (500) | `{ message: "Something went wrong", error: string }` |

**Behavior:**
1. Validates required fields.
2. Calls `createBookingThroughMcp({ listingId, customer, startDate, endDate })` from `mcp/clients.js`.
3. MCP server `roam-booking` executes `create_booking` tool.
4. Returns checkout A2UI and MCP app payload (`ui://roam/checkout-form.html`).

### 2.8 `POST /api/checkout`

| Attribute | Value |
|-----------|-------|
| Source | `backend/src/api/booking.routes.js:49-62` |
| Method | POST |
| Authentication | None |
| Request body | `{ bookingId: string }` |
| Response (200) | `{ ...result, a2ui }` where `result` includes `confirmationNumber` |
| Response (500) | `{ message: "Something went wrong", error: string }` |

**Behavior:**
1. Calls `checkoutThroughMcp({ bookingId, paymentMethod: "demo" })` from `mcp/clients.js`.
2. MCP server `roam-checkout` executes `mock_checkout` tool.
3. Returns confirmation A2UI.

### 2.9 `POST /api/search`

| Attribute | Value |
|-----------|-------|
| Source | `backend/src/api/chat.routes.js:7-18` |
| Method | POST |
| Authentication | None |
| Request body | `{ transactionType, category, maxBudget, ... }` |
| Validation | `transactionType`, `category`, `maxBudget` required |
| Response (200) | `{ count: number, recommendations: [...] }` (top 10 ranked) |
| Response (400) | `{ message: "transactionType, category, and maxBudget are required" }` |
| Response (500) | `{ message: string }` |

**Behavior:** Direct marketplace search bypassing the agent. Calls `searchListings()` then `rankListings()`. Does not use session or MCP.

### 2.10 `GET /api/mcp/apps`

| Attribute | Value |
|-----------|-------|
| Source | `backend/src/api/mcp.routes.js:25-34` |
| Method | GET |
| Authentication | None |
| Response (200) | Array of `{ key, resourceUri, title, url }` for booking and checkout |

### 2.11 `GET /api/mcp/apps/:key`

| Attribute | Value |
|-----------|-------|
| Source | `backend/src/api/mcp.routes.js:36-46` |
| Method | GET |
| Authentication | None |
| Path params | `key` ("booking" or "checkout") |
| Response (200) | HTML file content, `Content-Type: text/html; charset=utf-8` |
| Response (404) | `{ message: "MCP app not found" }` |

**Files served:** `booking-app.html`, `checkout-app.html` from `backend/src/mcp/`.

---

## 3. Six-Slot Elicitation Flow

### 3.1 Required Slots

| Slot | Type | Description |
|------|------|-------------|
| `transactionType` | `"rent"` \| `"buy"` | Whether user wants to rent or purchase |
| `location` | string | City or pickup location |
| `category` | string | Vehicle category (SUV, Sedan, Electric, etc.) |
| `maxBudget` | number | Daily rate (rent) or purchase price (buy) in INR |
| `startDate` | string | YYYY-MM-DD |
| `passengers` | number | Seat capacity |

**Additional conditional slot:** `endDate` is required when `transactionType !== "buy"` (i.e., for rentals). Source: `backend/src/agent/interview.js:22-26`.

### 3.2 Preference Extraction Rules (`interview.js:37-88`)

| Field | Extraction Method | Notes |
|-------|-------------------|-------|
| `transactionType` | Regex: `\b(buy\|purchase\|own)\b` → "buy"; `\b(rent\|rental\|hire)\b` → "rent" | Case-insensitive |
| `location` | Exact match from hardcoded list: Boston, Chicago, New York, Austin, Seattle, Aligarh, Mathura, Delhi, Agra | Also supports route pattern "CityA to CityB" |
| `category` | Exact match from: SUV, Sedan, Electric, Luxury, Hybrid, Truck, Minivan, Compact | Case-insensitive |
| `maxBudget` | Regex for "under/below/budget/up to/maximum/max/within \$X" or `\$X` / `₹X` | Currency normalized to INR via `normalizeToInr()` |
| `passengers` | Regex: `(\d+)\s*(people\|passengers\|seats\|seater)` | Converts to number |
| `fuelType` | Regex: `\b(petrol\|gasoline\|diesel\|hybrid\|electric)\b` | "petrol" normalized to "gasoline" |
| `startDate` / `endDate` | ISO dates `\d{4}-\d{2}-\d{2}` or natural language (e.g., "5th January") | Two dates → start+end; one date → start (or end if start already set) |

### 3.3 Normalization (`interview.js:28-35`)

- Currency resolution: Indian cities (Aligarh, Mathura, Delhi, Agra, Mumbai, Pune, Jaipur, Gurugram, Noida, Bengaluru) → INR; otherwise USD.
- For `buy` transactions: if `startDate` set and `endDate` not set, `endDate = startDate`.
- Budget in USD is converted to INR using `INR_PER_USD = 83` (`config/money.js`).

### 3.4 Missing Field Detection (`interview.js:22-26`)

```javascript
const requiredFields = ["transactionType", "location", "category", "maxBudget", "startDate", "passengers"];
if (preferences.transactionType !== "buy") fields.push("endDate");
return fields.filter(field => value is undefined/null/empty);
```

### 3.5 Interview Turn (`interview.js:103-112`)

1. Normalize + extract preferences from user text.
2. Compute missing fields.
3. If missing: return question for first missing field (from `questionFor()` prompts).
4. If complete: return "I have everything I need. Searching the marketplace for your best matches now."

### 3.6 Agent Turn (`car-agent.js:153-201`)

1. Extract + normalize preferences from text + current session preferences.
2. If missing fields: call `interviewTurn()`, return question + preferences.
3. If complete: create `DeepAgent` with `search_listing` tool and system prompt.
4. Invoke agent with user message.
5. Extract recommendations from tool result messages.
6. If complete but no recommendations: direct `callMarketplaceMcp()` fallback.
7. On any error: fallback to `interviewTurn()` + direct MCP search.
8. Return `{ preferences, complete, reply, recommendations, tool }`.

---

## 4. 100-Point Vehicle Ranking Formula

**Source:** `backend/src/marketplace/ranking.js:5-33`

### 4.1 Formula

```
Score = round(100 × [
  0.30 × S_budget +
  0.20 × S_category +
  0.10 × S_fuel +
  0.15 × S_seats +
  0.15 × S_features +
  0.10 × S_rating
])
```

### 4.2 Component Scores

| Component | Weight | Scoring Rule | Range |
|-----------|--------|--------------|-------|
| `S_budget` | 0.30 | `clamp(1 - max(0, price - budget) / max(budget, 1))` | 0 to 1 |
| `S_category` | 0.20 | 1.0 if exact category match, else 0.35 | 0.35 or 1.0 |
| `S_fuel` | 0.10 | 1.0 if exact fuel type match, else 0.5 | 0.5 or 1.0 |
| `S_seats` | 0.15 | `clamp(listing.seats / requested.passengers)` | 0 to 1 |
| `S_features` | 0.15 | `matchedFeatures / requiredFeatures.length`; if no required features, 0.7 | 0 to 1 |
| `S_rating` | 0.10 | `listing.rating / 5` | 0 to 1 |

**Price used:** `purchasePrice` for buy, `dailyPrice` for rent.

### 4.3 Budget Conversion

- If `preferences.currency === "USD"`, budget is converted to INR via `toInr()` (×83) before comparison.
- If `budget` is undefined/null/Infinity, `budgetScore` uses `Infinity` as denominator.

### 4.4 Search Pre-Ranking Filter (`search.js:6-32`)

MongoDB query filters:
- `transactionType` (exact)
- `location` (regex case-insensitive)
- `category` (regex `^category$` case-insensitive)
- `seats` (`$gte` passengers)
- Price: `dailyPrice` or `purchasePrice` `$lte` maxBudget (INR-converted)
- Date range: `availableFrom $lte startDate` AND `availableTo $gte endDate` (or startDate)

**Fallback:** If 0 results after budget filter, retry without the price constraint.

**Post-filter:** `fuelType` exact match (case-insensitive) applied in JavaScript after MongoDB query.

### 4.5 Output

- Top 10 listings sorted by score descending.
- Each result includes `score` (integer), `reasons` (array of strings), `tradeoffs` (array, e.g., `["Above your stated budget"]`).
- Reasons include: "Fits your budget" / "Closest price match", seats + fuel type, rating.

---

## 5. MCP Servers (Node.js, Stdio Transport)

All three servers are spawned as child processes via `StdioClientTransport` using `process.execPath` (Node.js) and the server file path. Stderr is piped to `console.warn`. No authentication or authorization in any server.

### 5.1 `roam-marketplace`

| Attribute | Value |
|-----------|-------|
| File | `backend/src/mcp/marketplace-server.js` |
| Server name | `roam-marketplace` |
| Version | `1.0.0` |
| Transport | Stdio (`StdioServerTransport`) |
| Tool | `search_listing` |
| Resources | None |

**Tool input schema (Zod):**
- `transactionType`: enum ["rent", "buy"]
- `location`: string, min 1
- `dropoffLocation`: string, optional
- `category`: string, min 1
- `maxBudget`: number, positive
- `startDate`: string, min 1
- `endDate`: string, min 1
- `passengers`: number, int, positive
- `fuelType`: string, optional
- `requiredFeatures`: array of strings, optional

**Tool output:**
```json
{
  "content": [{ "type": "text", "text": JSON.stringify({ count, recommendations }) }],
  "structuredContent": { count: number, recommendations: [...] }
}
```

**Database:** Calls `connectDB()`, then `searchListings(preferences)` → `rankListings(listings, preferences)` → `.slice(0, 10)`.

**Spawner:** `backend/src/agent/car-agent.js:getMarketplaceClient()` (lines 57-77). Duplicates client logic also in `mcp/clients.js`.

### 5.2 `roam-booking`

| Attribute | Value |
|-----------|-------|
| File | `backend/src/mcp/booking-server.js` |
| Server name | `roam-booking` |
| Version | `1.0.0` |
| Transport | Stdio (`StdioServerTransport`) |
| Tool | `create_booking` |
| Resource | `ui://roam/booking-form.html` (serves `booking-app.html`) |

**Tool input schema (Zod):**
- `listingId`: string, min 1
- `customer`: object `{ name: string min 1, email: string email, phone: string optional }`
- `startDate`: string, min 1
- `endDate`: string, min 1

**Tool output:**
```json
{
  "content": [{ "type": "text", "text": JSON.stringify({ booking }) }],
  "structuredContent": { booking: { bookingId, listingId, customer, startDate, endDate, totalAmount, currency, status } }
}
```

**Business logic:**
1. `Listing.findOne({ listingId })` — returns error if not found.
2. `days = Math.max(1, ceil((end - start) / 86400000))`
3. `totalAmount = rent ? dailyPrice × days : purchasePrice`
4. `bookingId = "booking_" + randomUUID().slice(0, 8)`
5. `Booking.create({ ..., status: "pending", paymentStatus: "unpaid" })`

**Spawner:** `backend/src/mcp/clients.js:getClient("booking", "booking-server.js")`.

**HTML resource:** `booking-app.html` — form with name, email, phone fields; communicates via `window.parent.postMessage`.

### 5.3 `roam-checkout`

| Attribute | Value |
|-----------|-------|
| File | `backend/src/mcp/checkout-server.js` |
| Server name | `roam-checkout` |
| Version | `1.0.0` |
| Transport | Stdio (`StdioServerTransport`) |
| Tool | `mock_checkout` |
| Resource | `ui://roam/checkout-form.html` (serves `checkout-app.html`) |

**Tool input schema (Zod):**
- `bookingId`: string, min 1
- `paymentMethod`: string, default "demo"

**Tool output:**
```json
{
  "content": [{ "type": "text", "text": JSON.stringify(result) }],
  "structuredContent": { status: "mock-approved", confirmationNumber: "DEMO-XXXXXX", bookingId, totalAmount, currency }
}
```

**Business logic:**
1. `Booking.findOne({ bookingId })` — returns error if not found.
2. If already `confirmed`: return existing result.
3. Else: `status = "confirmed"`, `paymentStatus = "mock-approved"`, `confirmationNumber = "DEMO-" + randomUUID().slice(0, 8).toUpperCase()`, save.

**Spawner:** `backend/src/mcp/clients.js:getClient("checkout", "checkout-server.js")`.

**HTML resource:** `checkout-app.html` — "Approve mock payment" button; communicates via `window.parent.postMessage`.

### 5.4 MCP Client Manager (`clients.js`)

- Singleton `Map` of client promises per server name.
- `getClient(name, filename)` creates `new Client({ name, version })`, connects via `StdioClientTransport` with `command: process.execPath`, `args: [filename]`, `cwd: repo root`, `stderr: "pipe"`, `env: { ...process.env }`.
- `readResult()`: throws if `isError`, returns `structuredContent` or parses text content.
- Exported functions: `createBookingThroughMcp(input)`, `checkoutThroughMcp(input)`.
- Both wrapped with `traceMcpCall` telemetry.

---

## 6. MongoDB Collections and Models

**Driver:** Mongoose 9.9.1 (`backend/src/config/db.js`). Connection string from `MONGO_URI` env var.

### 6.1 `sessions`

| Field | Type | Required | Index | Notes |
|-------|------|----------|-------|-------|
| `sessionId` | String | Yes | Unique | UUID from `randomUUID()` |
| `status` | String | Yes | No | Enum: interviewing, ready_to_search, recommendations_ready, booking, checkout, confirmed. Default: "interviewing" |
| `preferences` | Object | No | No | transactionType, location, dropoffLocation, category, maxBudget, currency, startDate, endDate, passengers, fuelType, requiredFeatures |
| `messages` | Array | No | No | `{ role: "user"\|"assistant", content: string, ui: Mixed }`, timestamps |
| `recommendations` | Array | No | No | Mixed type, default `[]` |
| `selectedListingId` | String | No | No | |
| `timestamps` | — | — | — | `createdAt`, `updatedAt` |

**Messages schema:** `{ role: String enum ["user","assistant"], content: String, ui: Mixed }`, `{ _id: false, timestamps: true }`.

**Preferences sub-schema:** `transactionType` enum ["rent","buy"], `location` String, `dropoffLocation` String, `category` String, `maxBudget` Number, `currency` enum ["INR","USD"] default "INR", `startDate` String, `endDate` String, `passengers` Number, `fuelType` String, `requiredFeatures` [String].

### 6.2 `listings`

| Field | Type | Required | Index | Notes |
|-------|------|----------|-------|-------|
| `listingId` | String | Yes | Unique | e.g., "listing_0001" |
| `transactionType` | String | Yes | Yes | enum ["rent","buy"] |
| `brand` | String | Yes | Yes | |
| `model` | String | Yes | No | |
| `category` | String | Yes | Yes | |
| `location` | String | Yes | Yes | |
| `dailyPrice` | Number | No | No | min 0 |
| `purchasePrice` | Number | No | No | min 0 |
| `currency` | String | No | No | enum ["INR","USD"], default "INR" |
| `seats` | Number | Yes | No | min 1 |
| `fuelType` | String | Yes | No | |
| `transmission` | String | Yes | No | |
| `features` | [String] | No | No | default [] |
| `availableFrom` | Date | Yes | No | |
| `availableTo` | Date | Yes | No | |
| `rating` | Number | Yes | No | min 0, max 5 |
| `provider` | String | Yes | No | |
| `timestamps` | — | — | — | createdAt, updatedAt |

**Seed data:** 250 listings via `backend/src/marketplace/seed.js`. 10 categories × 10 brands. Sedan = rent only; other categories alternate rent/buy. Pricing in INR. `availableFrom: 2026-01-01`, `availableTo: 2026-12-31`.

### 6.3 `bookings`

| Field | Type | Required | Index | Notes |
|-------|------|----------|-------|-------|
| `bookingId` | String | Yes | Unique | e.g., "booking_abc123ef" |
| `listingId` | String | Yes | No | |
| `customer` | Object | No | No | { name, email, phone } |
| `startDate` | Date | No | No | |
| `endDate` | Date | No | No | |
| `totalAmount` | Number | Yes | No | min 0 |
| `currency` | String | No | No | enum ["INR","USD"], default "INR" |
| `status` | String | No | No | enum ["pending","confirmed","cancelled"], default "pending" |
| `paymentStatus` | String | No | No | enum ["unpaid","mock-approved"], default "unpaid" |
| `confirmationNumber` | String | No | No | e.g., "DEMO-A1B2C3D4" |
| `timestamps` | — | — | — | createdAt, updatedAt |

### 6.4 ObjectId Usage

Mongoose auto-generates `_id: ObjectId` for all collections. Session documents use `sessionId` (string UUID) as the lookup key, not `_id`. Booking documents use `bookingId` (string) as lookup key. Listing documents use `listingId` (string) as lookup key.

---

## 7. LLM Provider Selection and Fallback

**Source:** `backend/src/agent/car-agent.js:23-55`

### 7.1 Priority Order

1. **Groq** — if `process.env.GROQ_API_KEY` is set
2. **OpenAI** — if `process.env.OPENAI_API_KEY` is set
3. **Gemini** — if `process.env.GEMINI_API_KEY` is set
4. **Ollama** — if `ENABLE_OLLAMA === "true"` OR no cloud API keys configured
5. **null** — if none of the above (triggers deterministic fallback)

### 7.2 Provider Configurations

| Provider | Class | Model | Base URL | Temperature |
|----------|-------|-------|----------|-------------|
| Groq | `ChatOpenAI` (LangChain) | `GROQ_MODEL` or `llama-3.3-70b-versatile` | `https://api.groq.com/openai/v1` | 0.1 |
| OpenAI | `ChatOpenAI` | `OPENAI_MODEL` or `gpt-4o-mini` | Default OpenAI | 0.1 |
| Gemini | `ChatOpenAI` (LangChain) | `GEMINI_MODEL` or `gemini-2.0-flash` | `https://generativelanguage.googleapis.com/v1beta/openai/` | 0.1 |
| Ollama | `ChatOllama` | `OLLAMA_MODEL` or `qwen2.5:7b` | `OLLAMA_URL` or `http://localhost:11434` | 0.1 |

### 7.3 Fallback Behavior

- If no active LLM provider (`getAgentModel()` returns null): `runCarAgentTurn()` catches the error and falls back to `interviewTurn()` (deterministic regex-based interview) + direct `callMarketplaceMcp()` search when complete.
- Ollama `₹` mangling: `sanitizeReply()` in `car-agent.js:147-151` replaces `?` before digits with `₹`, and replaces `$` amounts with `₹` amounts.

### 7.4 Agent Invocation

- `createDeepAgent({ model, tools: [searchListingTool], systemPrompt })` — agent recreated per turn.
- System prompt instructs: collect 6 required fields + endDate, ask one question at a time, call `search_listing` when complete, summarize results, prices in INR (₹ format), never output `$`.
- Tool: `search_listing` with Zod schema matching MCP server input.

---

## 8. Complete User Workflow

### Phase A: Session Creation

1. Frontend (`App.jsx:sendMessage`) calls `POST /api/sessions` if no `sessionId` exists.
2. Backend creates session document with `sessionId = randomUUID()`, status `"interviewing"`.
3. Returns `{ sessionId, status, preferences: {}, a2ui: buildInterviewA2UI() }`.
4. Frontend stores `sessionId` in state.

### Phase B: Interview

1. User types message in chat input.
2. Frontend calls `POST /api/sessions/:sessionId/messages { content }`.
3. Backend loads session, calls `runCarAgentTurn()`.
4. If fields missing: LLM or deterministic interviewer asks one question for first missing field.
5. Response includes `reply`, `preferences`, `missingFields`, A2UI interview progress surface.
6. Frontend appends assistant reply to messages, renders A2UI progress bar + preference grid.
7. Repeat until all 6 slots (+ endDate for rent) are complete.

### Phase C: Search

1. Once complete, agent calls `search_listing` MCP tool.
2. `roam-marketplace` MCP server queries MongoDB, ranks results, returns top 10.
3. Backend stores `recommendations` in session, status → `recommendations_ready`.
4. Frontend receives `recommendations` array, renders `CarCatalog` via A2UI.
5. Each car card shows: rank, brand/model, category/fuel, seats/transmission/provider, score, reasons, price, "Select" button.

### Phase D: Selection

1. User clicks "Select" on a car card.
2. A2UI action `select_car` → frontend `beginBooking(car)`.
3. Frontend calls `POST /api/sessions/:sessionId/select { listingId }`.
4. Backend sets `selectedListingId`, status `"booking"`, returns booking form A2UI + MCP app payload.
5. Frontend renders booking form (VehicleSummary, TripGrid, name/email/phone fields, "Continue to payment" button).

### Phase E: Booking

1. User fills name, email, phone; clicks "Continue to payment".
2. A2UI action `submit_booking` → frontend `createBooking(customerDetails)`.
3. Frontend calls `POST /api/bookings { listingId, customer, startDate, endDate }`.
4. Backend calls `createBookingThroughMcp()` → `roam-booking` MCP server.
5. MCP server validates listing, calculates `totalAmount`, creates `Booking` record (status "pending").
6. Backend returns checkout A2UI + MCP app payload (`ui://roam/checkout-form.html`).

### Phase F: Mock Checkout

1. Frontend renders checkout form (amount, "Approve mock payment" button).
2. User clicks "Approve mock payment".
3. A2UI action `approve_payment` → frontend `confirmCheckout()`.
4. Frontend calls `POST /api/checkout { bookingId }`.
5. Backend calls `checkoutThroughMcp()` → `roam-checkout` MCP server.
6. MCP server confirms booking, sets `confirmationNumber = "DEMO-XXXXXX"`.
7. Backend returns confirmation A2UI with confirmation number and amount.

---

## 9. Health and Telemetry Endpoints

### `GET /api/health`
- Source: `backend/src/server.js:36`
- Returns: `{ ok: true }`, HTTP 200
- No authentication, no database check.

### `GET /api/telemetry/status`
- Source: `backend/src/server.js:37`
- Returns: `{ openTelemetry: true, langfuseConnected: boolean, tracer: "OpenTelemetry Node SDK + Langfuse v3", host: string }`
- `langfuseConnected` is true only if `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are set.
- No authentication.

### Telemetry Instrumentation (`config/telemetry.js`)

- OpenTelemetry tracer: `"roam-car-agent"`, version `"1.0.0"`.
- Spans: `agent.turn` (per chat turn), `mcp.<server>.<tool>` (per MCP call).
- Langfuse SDK v3: traces and generations if `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY` configured.
- `flushAsync()` called after each span/generation (fire-and-forget with `.catch()`).

---

## 10. Source-Code-Verified vs Runtime-Verified

### Source-Code-Verified (read directly from files)

All API routes, request/response schemas, MCP tool schemas, ranking formula weights, elicitation regex patterns, model schemas, LLM provider priority, telemetry span names, and server file paths were verified by reading the actual source files listed in Section 1.

### Runtime-Verified

**NOT VERIFIED** — The following were not executed at runtime in this session:
- `npm run dev` to start the backend and confirm port 5000 binding
- `npm run seed` to confirm 250 listings are inserted
- Actual HTTP requests to any endpoint
- MCP server spawning and Stdio communication
- Ollama or Groq API connectivity
- MongoDB connection and document persistence
- Frontend build and rendering

These can be checked by:
1. `cd backend && npm install && cp .env.example .env && npm run seed` (requires MongoDB at `MONGO_URI`)
2. `cd backend && npm run dev` then `curl http://localhost:5000/api/health`
3. `cd frontend && npm install && npm run dev` then open `http://localhost:5173`
4. `docker compose up --build` for full containerized verification

---

## 11. Security Notes

- **No authentication exists.** Any session ID can be accessed by anyone. No JWT, no password, no cookies.
- **CORS** allows all `http://localhost:*` and `http://127.0.0.1:*` origins; `CLIENT_URL` env var can restrict further.
- **MCP servers** spawn with `env: { ...process.env }`, passing all environment variables (including potential secrets) to child processes.
- **`backend/.env.example`** contains a real MongoDB connection string with credentials (`pragyanshgupta001_db_user:e00l5eC7W2QmOyJU@cluster0.azabulp.mongodb.net`). This should be replaced with a placeholder before any commit.
- **No input validation** on chat message content beyond non-empty check.
- **No rate limiting** on any endpoint.
- **Booking totalAmount** is calculated server-side from Listing document (not trusted from client).

---

## 12. Existing Instruction Files

- `AGENTS.md` already exists at `D:\car-marketplace\AGENTS.md` (created earlier in this session).
- `README.md` and `spec.md` contain architecture overviews but are not authoritative for exact API contracts.
- No `CLAUDE.md`, `.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`, or `opencode.json` found.

---

## End of Baseline
