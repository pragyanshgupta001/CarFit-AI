import { useState } from "react";
import { CarFront, LoaderCircle, Send, Sparkles } from "lucide-react";
import "./App.css";
import { A2UIRenderer } from "./a2ui/renderer.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function Preference({ label, value }) {
  return (
    <div className="preference-item">
      <span>{label}</span>
      <strong>{value || "Not captured yet"}</strong>
    </div>
  );
}

function App() {
  const [form, setForm] = useState({});
  const [cars, setCars] = useState([]);
  const [status, setStatus] = useState("ready");
  const [selected, setSelected] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Tell me what you need for your next drive. I will ask a few focused questions, then search the market.",
    },
  ]);
  const [chatBusy, setChatBusy] = useState(false);
  const [booking, setBooking] = useState(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [uiEvents, setUiEvents] = useState([]);

  function pushAssistant(text) {
    if (!text) return;
    setMessages((current) => [
      ...current,
      { role: "assistant", content: text },
    ]);
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!chatInput.trim() || chatBusy) return;
    setChatBusy(true);
    const content = chatInput.trim();
    setChatInput("");
    setMessages((current) => [...current, { role: "user", content }]);
    try {
      let currentSession = sessionId;
      if (!currentSession) {
        const response = await fetch(`${API_URL}/sessions`, { method: "POST" });
        currentSession = (await response.json()).sessionId;
        setSessionId(currentSession);
      }
      const response = await fetch(
        `${API_URL}/sessions/${currentSession}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Interview failed");
      setForm((current) => ({ ...current, ...data.preferences }));
      setUiEvents(data.a2ui || (data.ui ? [data.ui] : []));
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.reply },
      ]);
      if (data.recommendations?.length) {
        setCars(data.recommendations);
        setStatus("complete");
      }
    } catch (error) {
      pushAssistant(error.message);
    } finally {
      setChatBusy(false);
    }
  }

  async function beginBooking(car) {
    setSelected(car.listingId);
    setBooking(null);
    if (!sessionId) return;
    try {
      const response = await fetch(`${API_URL}/sessions/${sessionId}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: car.listingId }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Could not save the selected car");
      setUiEvents(data.a2ui || (data.ui ? [data.ui] : []));
    } catch (error) {
      pushAssistant(error.message);
    }
  }

  async function createBooking(customerDetails) {
    if (!selected) return;
    setBookingBusy(true);
    try {
      const response = await fetch(`${API_URL}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: selected,
          customer: customerDetails || {},
          startDate: form.startDate,
          endDate: form.endDate,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Could not create booking");
      setBooking(data.booking);
      setUiEvents(data.a2ui || (data.ui ? [data.ui] : []));
    } catch (error) {
      pushAssistant(error.message);
    } finally {
      setBookingBusy(false);
    }
  }

  async function confirmCheckout() {
    if (!booking?.bookingId) return;
    setBookingBusy(true);
    try {
      const response = await fetch(`${API_URL}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.bookingId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Checkout failed");
      setBooking({ ...booking, ...data });
      setUiEvents(data.a2ui || (data.ui ? [data.ui] : []));
    } catch (error) {
      pushAssistant(error.message);
    } finally {
      setBookingBusy(false);
    }
  }

  async function handleA2UIAction(payload) {
    if (!payload) return;
    if (payload.name === "select_car") {
      const car = cars.find(
        (item) => item.listingId === payload.context?.listingId,
      );
      if (car) await beginBooking(car);
    } else if (payload.name === "submit_booking") {
      await createBooking(payload.data || {});
    } else if (payload.name === "approve_payment") {
      await confirmCheckout();
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <CarFront size={24} />
          <span>ROAM / AI</span>
        </div>
        <span className="live">
          <i /> LOCAL MARKETPLACE
        </span>
      </header>
      <section className="intro">
        <div>
          <p className="eyebrow">
            <Sparkles size={15} /> YOUR PERSONAL CAR MATCHMAKER
          </p>
          <h1>
            Find the car
            <br />
            <em>that fits.</em>
          </h1>
          <p className="lede">
            Tell us what your next journey needs. We will search, compare, and
            explain the best matches.
          </p>
        </div>
        <div className="intro-mark">
          01<span>/</span>DISCOVER
        </div>
      </section>
      <section className="chat-panel">
        <div className="chat-heading">
          <span>LIVE INTERVIEW</span>
          <b>{sessionId ? "SESSION ACTIVE" : "START A CONVERSATION"}</b>
        </div>
        <div className="chat-messages">
          {messages.map((message, index) => (
            <div
              className={`chat-message ${message.role}`}
              key={`${message.role}-${index}`}
            >
              {message.content}
            </div>
          ))}
          {chatBusy && (
            <div className="chat-message assistant">
              <LoaderCircle className="spin" size={15} /> Thinking...
            </div>
          )}
        </div>
        <form className="chat-form" onSubmit={sendMessage}>
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Try: I need to rent a petrol sedan in Delhi under ₹1000 a day..."
          />
          <button
            aria-label="Send message"
            disabled={chatBusy || !chatInput.trim()}
          >
            <Send size={17} />
          </button>
        </form>
      </section>
      {sessionId && (
        <section className="preference-summary">
          <div className="chat-heading">
            <span>CAPTURED PREFERENCES</span>
            <b>{status === "complete" ? "READY TO SEARCH" : "UPDATING LIVE"}</b>
          </div>
          <div className="preference-grid">
            <Preference label="Mode" value={form.transactionType} />
            <Preference
              label="Route"
              value={
                form.dropoffLocation
                  ? `${form.location || "?"} to ${form.dropoffLocation}`
                  : form.location
              }
            />
            <Preference label="Vehicle" value={form.category} />
            <Preference label="Fuel" value={form.fuelType} />
            <Preference label="Passengers" value={form.passengers} />
            <Preference
              label="Budget"
              value={
                form.maxBudget
                  ? `₹${form.maxBudget.toLocaleString("en-IN")}`
                  : ""
              }
            />
            <Preference
              label="Dates"
              value={
                form.startDate && form.endDate
                  ? `${form.startDate} to ${form.endDate}`
                  : form.startDate
              }
            />
          </div>
        </section>
      )}
      <A2UIRenderer events={uiEvents} onAction={handleA2UIAction} />
      {bookingBusy && (
        <div className="a2ui-busy">
          <LoaderCircle className="spin" size={18} /> Processing…
        </div>
      )}
      {uiEvents.length === 0 && (
        <section className="results">
          <div className="results-head">
            <div>
              <p className="panel-kicker">02 / MCP RESEARCH & RANK</p>
              <h2>Your matches will appear here</h2>
            </div>
          </div>
          <div className="empty">
            <p>
              Start the conversation above. The agent will interview you before
              calling the marketplace search tool.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
