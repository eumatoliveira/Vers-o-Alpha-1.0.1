export { createHttpApp, findAvailablePort, startServer } from "./app";
import { startServer } from "./app";

// Hostinger (and any Linux host) sends SIGTERM to stop the process gracefully.
// Without handlers, the process exits with code 143 which may look like a crash.
function shutdown(signal: string) {
  console.log(`[Server] ${signal} received — shutting down gracefully`);
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

startServer().catch((err) => {
  console.error("[Fatal] Server failed to start:", err instanceof Error ? err.message : err);
  process.exit(1);
});
