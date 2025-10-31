import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import mailRoutes from "./routes/mail.js";

dotenv.config(); 

const app = express();

// --- MIDDLEWARE ---
app.use(
  cors({
    origin: [
      "http://localhost:5173", 
      "https://yourfrontend.com", 
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// --- DATABASE ---
connectDB()
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// --- ROUTES ---
app.use("/api/mail", mailRoutes);

// --- HEALTH CHECK  ---
app.get("/", (req, res) => {
  res.send("📩 FHE Mail API is running...");
});

// --- START SERVER ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
