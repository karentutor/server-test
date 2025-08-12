// index.js
import bodyParser from "body-parser";
import cookieParser from "cookie-parser"; // <-- Import cookie-parser
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { monitorPM2Logs } from "./configurations/pm2Monitor.js";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import client from "prom-client";
import allowedOrigins from "./configurations/corsConfig.js";

import { initSocket } from "./configurations/socket.js"; // Import Socket.io setup function

// Routes
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import userRoutes from "./routes/userRoutes.js";

/* CONFIGURATIONS */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

// Create Express app
const app = express();

//forward the IP
app.set('trust proxy', true);

/* ALLOWED ORIGINS */
//const allowedOrigins =
  process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.length > 0
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : ["http://10.0.0.99:8000"];

// MIDDLEWARES

// 1) Set up CORS with credentials so the browser can send cookies if needed
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // Important for cross-origin cookies/credentials
  })
);

// 2) Built-in JSON parser, plus body-parser for extended form data
app.use(express.json());
app.use(bodyParser.json({ limit: "30mb", extended: true }));
app.use(bodyParser.urlencoded({ limit: "30mb", extended: true }));

// 3) Use cookie-parser to parse cookies from incoming requests
app.use(cookieParser());

// 4) Security and logging middlewares
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));

// 5) Serve static assets
app.use("/assets", express.static(path.join(__dirname, "public/assets")));

/* METRICS */
// Create a Registry to register the metrics
const metricsRegister = new client.Registry();
// Enable the collection of default metrics
client.collectDefaultMetrics({ register: metricsRegister });
// Create a metrics endpoint
app.get("/metrics", (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(metricsRegister.metrics());
});

app.get('/api/health', (_req, res) => {
  return res.json({ status: 'ok' });
});

/* ROUTES */
app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/users", userRoutes);

/* MONGOOSE SETUP */
mongoose
  .connect(process.env.DATABASE, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log(`Mongoose connected to ${mongoose.connection.name}`))
  .catch((error) => console.log(`${error} did not connect`));

// HTTP Server and Socket.io Setup
const server = createServer(app);
initSocket(server, allowedOrigins);

// Start Server
const PORT = process.env.PORT || 8000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);

  // Start monitoring PM2 logs for 500 errors AFTER the server is running
    // Conditionally start PM2 monitoring if ERROR_LOGGING=true
    if (process.env.ERROR_LOGGING === "true") {
      monitorPM2Logs();
    }
});
