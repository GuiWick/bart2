import express from "express";
import cors from "cors";
import path from "path";
import { config } from "./config";

// Import routes
import authRouter from "./routes/auth";
import reviewsRouter from "./routes/reviews";
import settingsRouter from "./routes/settings";
import dashboardRouter from "./routes/dashboard";
import integrationsRouter from "./routes/integrations";

const app = express();

app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: "10mb" }));

// API routes
app.use("/api/auth", authRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/integrations", integrationsRouter);

// Serve React frontend (production build)
const staticDir = path.join(__dirname, "../static");
try {
  const fs = require("fs");
  if (fs.existsSync(staticDir)) {
    app.use("/assets", express.static(path.join(staticDir, "assets")));
    app.get("*", (_req, res) => res.sendFile(path.join(staticDir, "index.html")));
  }
} catch {}

app.listen(config.port, () => {
  console.log(`\n🚀  Bart2 running at http://localhost:${config.port}`);
  console.log(`   API: http://localhost:${config.port}/api`);
  console.log(`   ANTHROPIC_API_KEY set: ${!!process.env.ANTHROPIC_API_KEY} (length: ${process.env.ANTHROPIC_API_KEY?.length ?? 0})`);
  console.log(`   DATABASE_PATH: ${process.env.DATABASE_PATH || '(not set, using default)'}`);
});
