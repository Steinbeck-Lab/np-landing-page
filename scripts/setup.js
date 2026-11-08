import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const template = await readFile(
  new URL("../.env.example", import.meta.url),
  "utf8",
);
try {
  await writeFile(
    ".env",
    template.replace(
      "SESSION_SECRET=\n",
      `SESSION_SECRET=${randomBytes(48).toString("hex")}\n`,
    ),
    { mode: 0o600, flag: "wx" },
  );
} catch (error) {
  if (error.code === "EEXIST")
    throw new Error(
      ".env already exists. It was not overwritten. Edit it directly if configuration needs to change.",
    );
  throw error;
}
console.log(
  "Created .env with a new session secret. Next: npm run admin -- YOUR_USERNAME, then npm start.",
);
