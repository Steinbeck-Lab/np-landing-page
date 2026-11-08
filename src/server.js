import path from "node:path";
import { createApp } from "./app.js";

const production = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be between 1 and 65535.");
const { app, close } = createApp({
  dataDir: path.resolve(process.env.DATA_DIR ?? "./data"),
  secret: process.env.SESSION_SECRET,
  origin: process.env.SITE_ORIGIN ?? `http://localhost:${port}`,
  production,
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
});
const server = app.listen(port, process.env.HOST ?? "127.0.0.1", () => {
  console.log(
    `Natural Products Online listening on ${process.env.HOST ?? "127.0.0.1"}:${port}`,
  );
});
function shutdown() {
  server.close(() => {
    close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
