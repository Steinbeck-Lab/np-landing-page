import { backup } from "node:sqlite";
import { mkdir, cp, writeFile, chmod, access } from "node:fs/promises";
import path from "node:path";
import { openStore } from "../src/store.js";

const dataDir = path.resolve(process.env.DATA_DIR ?? "./data");
const destination = path.resolve(
  process.argv[2] ?? "./backups",
  new Date().toISOString().replaceAll(":", "-"),
);
if (
  destination === dataDir ||
  destination.startsWith(`${dataDir}${path.sep}`)
) {
  throw new Error("Backups must be outside DATA_DIR.");
}
await access(path.join(dataDir, "site.sqlite"));
const store = openStore(dataDir);
try {
  await mkdir(destination, { recursive: true, mode: 0o700 });
  await backup(store.db, path.join(destination, "site.sqlite"));
  await chmod(path.join(destination, "site.sqlite"), 0o600);
  await cp(path.join(dataDir, "uploads"), path.join(destination, "uploads"), {
    recursive: true,
  });
  await writeFile(
    path.join(destination, "backup.json"),
    JSON.stringify({ created: new Date().toISOString(), schema: 1 }, null, 2),
    { mode: 0o600 },
  );
  console.log(`Backup created: ${destination}`);
} finally {
  store.close();
}
