import "dotenv/config";
import { app } from "./app";
import { env } from "./config/env";
import { refreshSettings } from "./services/settings.service";

// Load portal setting overrides into the in-memory cache, then refresh
// periodically (also refreshed immediately after any save).
void refreshSettings();
setInterval(() => void refreshSettings(), 30_000);

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${env.PORT}`);
  console.log(`📝 Environment: ${env.NODE_ENV}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log("\n⏹  Shutting down...");
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
