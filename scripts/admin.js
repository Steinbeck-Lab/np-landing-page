import path from "node:path";
import { openStore } from "../src/store.js";
import { hashPassword } from "../src/security.js";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

const username = process.argv[2];
if (!username || !/^[a-zA-Z0-9._-]{3,60}$/.test(username)) {
  throw new Error(
    "Usage: npm run admin -- USERNAME (username: 3-60 letters, numbers, dots, underscores or hyphens).",
  );
}
let password = "";
if (process.stdin.isTTY) {
  const mutedOutput = new Writable({
    write(chunk, encoding, callback) {
      callback();
    },
  });
  const reader = createInterface({
    input: process.stdin,
    output: mutedOutput,
    terminal: true,
  });
  process.stderr.write("New password (14-200 characters, input hidden): ");
  try {
    password = await reader.question("");
    process.stderr.write("\nRepeat password: ");
    const confirmation = await reader.question("");
    process.stderr.write("\n");
    if (password !== confirmation) throw new Error("Passwords do not match.");
  } finally {
    reader.close();
  }
} else {
  for await (const chunk of process.stdin) {
    password += chunk;
    if (password.length > 202) throw new Error("Password input is too long.");
  }
  password = password.replace(/\r?\n$/, "");
}
const hash = await hashPassword(password);
const store = openStore(path.resolve(process.env.DATA_DIR ?? "./data"));
try {
  store.db
    .prepare(
      `INSERT INTO admins (username,password_hash) VALUES (?,?)
    ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash,version=version+1`,
    )
    .run(username, hash);
  console.log(
    `Administrator ${username} is ready. Existing sessions for this account are invalidated.`,
  );
} finally {
  store.close();
}
