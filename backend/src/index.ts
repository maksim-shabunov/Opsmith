import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import health from "./routes/health.js";
import upload from "./routes/upload.js";
import tools from "./routes/tools.js";

// Initialize DB (runs migrations + seed on first start)
import "./db.js";

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Global error handler — never let an unhandled exception return HTML
app.onError((err, c) => {
  console.error("[app error]", err);
  return c.json({ error: "Internal server error" }, 500);
});

app.route("/api/health", health);
app.route("/api/upload", upload);
app.route("/api/tools", tools);

const PORT = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Opsmith backend running on http://localhost:${PORT}`);
});

export default app;
