import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { categories, initialSettings } from "./content.js";

const scrypt = promisify(scryptCallback);

export class InputError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

export async function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 14 ||
    password.length > 200
  ) {
    throw new InputError("Use a password between 14 and 200 characters.");
  }
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password, hash) {
  if (typeof password !== "string" || password.length > 200) return false;
  const [salt, encoded] = hash.split(":");
  const expected = Buffer.from(encoded, "hex");
  const actual = await scrypt(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function text(value, label, max, required = true) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  ) {
    throw new InputError(
      `${label} ${required ? "is required and " : ""}must be at most ${max} characters.`,
    );
  }
  return value.trim();
}

export function website(value, label, required = true) {
  const clean = text(value, label, 2048, required);
  if (!required && !clean) return "";
  let url;
  try {
    url = new URL(clean);
  } catch {
    throw new InputError(`${label} must be a complete HTTPS or HTTP URL.`);
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new InputError(
      `${label} must be an HTTPS or HTTP URL without credentials.`,
    );
  }
  return url.href;
}

export function resourceInput(body) {
  if (!body || typeof body !== "object")
    throw new InputError("Submit a valid resource form.");
  const category = text(body.category, "Category", 60);
  if (!categories.includes(category))
    throw new InputError("Choose an available category.");
  const position = Number(body.position);
  if (!Number.isSafeInteger(position) || position < 0 || position > 10000) {
    throw new InputError(
      "Display order must be a whole number between 0 and 10000.",
    );
  }
  return {
    name: text(body.name, "Name", 100),
    description: text(body.description, "Description", 600),
    category,
    url: website(body.url, "Website"),
    position,
    visible: body.visible === "on" ? 1 : 0,
    featured: body.featured === "on" ? 1 : 0,
  };
}

export function settingsInput(body) {
  if (!body || typeof body !== "object")
    throw new InputError("Submit a valid page-content form.");
  const result = {};
  for (const key of Object.keys(initialSettings)) {
    if (key.endsWith("Url")) {
      result[key] = website(
        body[key],
        key,
        !["legalUrl", "privacyUrl"].includes(key),
      );
    } else {
      const max = ["aboutText", "introduction", "address"].includes(key)
        ? 2000
        : 200;
      result[key] = text(body[key], key, max);
    }
  }
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.contactEmail) ||
    /[\r\n]/.test(result.contactEmail)
  ) {
    throw new InputError("Enter a valid contact email address.");
  }
  return result;
}

export function csrfToken(req, res, next) {
  req.session.csrf ??= randomBytes(32).toString("hex");
  res.locals.csrf = req.session.csrf;
  next();
}

export function checkCsrf(req, res, next) {
  const supplied = req.get("x-csrf-token") ?? req.body?._csrf;
  const expected = req.session.csrf;
  if (
    typeof supplied !== "string" ||
    typeof expected !== "string" ||
    !/^[a-f0-9]{64}$/.test(supplied) ||
    supplied.length !== expected.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  ) {
    return res.status(403).render("error", {
      title: "Request expired",
      message: "Your form has expired. Reload the page and try again.",
    });
  }
  next();
}
