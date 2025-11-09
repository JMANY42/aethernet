const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const apiProxyRoutes = require("./routes/apiProxyRoutes");

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
// Proxy routes for external data service (mirrors endpoints at https://hackutd2025.eog.systems)
app.use("/api", apiProxyRoutes);

// Simple health route
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
