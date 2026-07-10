import "dotenv/config";
import { app } from "./app";
import { env } from "./config/env";

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
