import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import connectDB from "./config/db.js";
import chatRoutes from "./api/chat.routes.js";
import bookingRoutes from "./api/booking.routes.js";
import sessionRoutes from "./api/session.routes.js";
import mcpRoutes from "./api/mcp.routes.js";

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (
      !origin ||
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:")
    ) {
      return callback(null, true);
    }
    const configured = process.env.CLIENT_URL;
    return callback(null, !configured || origin === configured);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

app.get("/", (req, res) => res.send("API Running..."));
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api", chatRoutes);
app.use("/api", bookingRoutes);
app.use("/api", sessionRoutes);
app.use("/api", mcpRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong", error: err.message });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});