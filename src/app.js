import express from "express";
import session from "express-session";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openStore, SqliteSessions } from "./store.js";
import { categories } from "./content.js";
import {
  InputError,
  csrfToken,
  checkCsrf,
  verifyPassword,
  resourceInput,
  settingsInput,
} from "./security.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 20 },
});
const regenerate = (req) =>
  new Promise((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
const saveSession = (req) =>
  new Promise((resolve, reject) =>
    req.session.save((error) => (error ? reject(error) : resolve())),
  );

export function createApp({
  dataDir,
  secret,
  origin,
  production = false,
  trustProxy = 0,
}) {
  if (!secret || secret.length < 48)
    throw new Error("SESSION_SECRET must contain at least 48 characters.");
  const parsedOrigin = new URL(origin);
  if (
    !["http:", "https:"].includes(parsedOrigin.protocol) ||
    parsedOrigin.origin !== origin ||
    (production && parsedOrigin.protocol !== "https:")
  ) {
    throw new Error(
      "SITE_ORIGIN must be an HTTP(S) origin without a trailing slash, and use HTTPS in production.",
    );
  }
  if (![0, 1].includes(trustProxy))
    throw new Error("TRUST_PROXY must be 0 or 1.");
  const store = openStore(dataDir);
  const sessions = new SqliteSessions(store.db);
  const app = express();
  app.disable("x-powered-by");
  app.set("view engine", "ejs");
  app.set("views", path.join(root, "views"));
  app.set("trust proxy", trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));
  app.use(
    "/assets",
    express.static(path.join(root, "public"), {
      maxAge: production ? "1h" : 0,
      index: false,
      dotfiles: "deny",
    }),
  );
  app.use(
    "/uploads",
    express.static(path.join(dataDir, "uploads"), {
      maxAge: "1d",
      index: false,
      dotfiles: "deny",
    }),
  );
  app.get("/health", (req, res) => {
    const schema = store.db
      .prepare("SELECT version FROM migrations WHERE version = 1")
      .get();
    if (!schema) throw new Error("Database schema is not initialized.");
    res.json({ status: "ok" });
  });
  app.get("/", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.render("index", {
      settings: store.settings(),
      resources: store.resources(),
      categories,
      origin,
    });
  });
  app.get("/contact", (req, res) => res.redirect(301, "/#contact"));
  app.get("/robots.txt", (req, res) =>
    res
      .type("text")
      .send(
        `User-agent: *\nDisallow: /admin\nSitemap: ${origin}/sitemap.xml\n`,
      ),
  );
  app.get("/sitemap.xml", (req, res) =>
    res
      .type("xml")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</loc></url></urlset>`,
      ),
  );

  app.use(
    "/admin",
    (req, res, next) => {
      res.set({
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      });
      next();
    },
    session({
      name: "npo.sid",
      secret,
      store: sessions,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: production,
        sameSite: "strict",
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
    csrfToken,
  );

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).render("error", {
        title: "Too many attempts",
        message:
          "Too many sign-in attempts. Please wait 15 minutes before trying again.",
      }),
  });
  app.get("/admin/login", (req, res) => {
    res.render("login", { error: null });
  });
  app.post("/admin/login", loginLimiter, checkCsrf, async (req, res) => {
    const username =
      typeof req.body?.username === "string" ? req.body.username : "";
    const admin = store.admin(username);
    // Perform the same expensive check even when the username does not exist.
    const dummyHash = `${"0".repeat(32)}:${"0".repeat(128)}`;
    const valid = await verifyPassword(
      req.body?.password,
      admin?.password_hash ?? dummyHash,
    );
    if (!admin || !valid) {
      return res
        .status(401)
        .render("login", { error: "Incorrect username or password." });
    }
    await regenerate(req);
    req.session.admin = admin.username;
    req.session.adminVersion = admin.version;
    await saveSession(req);
    res.redirect(303, "/admin");
  });
  app.use("/admin", (req, res, next) => {
    const admin = req.session.admin && store.admin(req.session.admin);
    if (!admin || admin.version !== req.session.adminVersion) {
      return res.redirect(303, "/admin/login");
    }
    next();
  });
  app.post("/admin/logout", checkCsrf, (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie("npo.sid", {
        httpOnly: true,
        secure: production,
        sameSite: "strict",
      });
      res.redirect(303, "/admin/login");
    });
  });
  app.get("/admin", (req, res) =>
    res.render("admin", {
      resources: store.resources(true),
      settings: store.settings(),
      categories,
      notice:
        req.query.saved === "1"
          ? "Saved. Your changes are live on the public website."
          : null,
    }),
  );
  app.post("/admin/settings", checkCsrf, (req, res) => {
    const settings = settingsInput(req.body);
    const changed = store.db
      .prepare(
        "UPDATE settings SET content = ?, revision = revision + 1 WHERE id = 1 AND revision = ?",
      )
      .run(JSON.stringify(settings), revision(req.body.revision));
    if (!changed.changes) throw conflict();
    res.redirect(303, "/admin?saved=1#page-content");
  });
  app.get("/admin/resources/new", (req, res) =>
    res.render("resource", {
      resource: {
        name: "",
        description: "",
        category: categories[0],
        url: "",
        logo: "",
        position: (store.resources(true).at(-1)?.position ?? -10) + 10,
        visible: 1,
        featured: 0,
      },
      categories,
      error: null,
    }),
  );
  app.get("/admin/resources/:id", (req, res) => {
    const resource = getResource(req.params.id);
    res.render("resource", {
      resource,
      categories,
      error: null,
      notice:
        req.query.saved === "1"
          ? "Saved. Your changes are live on the public website."
          : null,
    });
  });
  app.post("/admin/resources", checkCsrf, (req, res) => {
    try {
      const r = resourceInput(req.body);
      const result = store.db
        .prepare(
          "INSERT INTO resources (name,description,category,url,position,visible,featured) VALUES (?,?,?,?,?,?,?)",
        )
        .run(
          r.name,
          r.description,
          r.category,
          r.url,
          r.position,
          r.visible,
          r.featured,
        );
      res.redirect(303, `/admin/resources/${result.lastInsertRowid}?saved=1`);
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      res.status(400).render("resource", {
        resource: submitted(req.body),
        categories,
        error: error.message,
      });
    }
  });
  app.post("/admin/resources/:id", checkCsrf, (req, res) => {
    const current = getResource(req.params.id);
    let r;
    try {
      r = resourceInput(req.body);
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      return res.status(400).render("resource", {
        resource: { ...current, ...submitted(req.body) },
        categories,
        error: error.message,
      });
    }
    const changed = store.db
      .prepare(
        "UPDATE resources SET name=?,description=?,category=?,url=?,position=?,visible=?,featured=?,revision=revision+1 WHERE id=? AND revision=?",
      )
      .run(
        r.name,
        r.description,
        r.category,
        r.url,
        r.position,
        r.visible,
        r.featured,
        current.id,
        revision(req.body.revision),
      );
    if (!changed.changes) throw conflict();
    res.redirect(303, "/admin?saved=1");
  });
  // Verify CSRF in a header before parsing any uploaded bytes.
  app.post(
    "/admin/resources/:id/logo",
    checkCsrf,
    upload.single("logo"),
    async (req, res) => {
      const current = getResource(req.params.id);
      const expectedRevision = revision(req.body.revision);
      if (expectedRevision !== current.revision) throw conflict();
      if (!req.file)
        throw new InputError("Choose a PNG, JPEG, or WebP logo up to 2 MB.");
      const bytes = req.file.buffer;
      const isPng = bytes
        .subarray(0, 8)
        .equals(Buffer.from("89504e470d0a1a0a", "hex"));
      const isJpeg =
        bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const isWebp =
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP";
      if (!isPng && !isJpeg && !isWebp)
        throw new InputError(
          "Only PNG, JPEG, and WebP image files are accepted.",
        );
      let image;
      try {
        const pipeline = sharp(req.file.buffer, {
          limitInputPixels: 16_000_000,
          animated: false,
        });
        const metadata = await pipeline.metadata();
        if (
          !["png", "jpeg", "webp"].includes(metadata.format) ||
          (metadata.pages ?? 1) > 1
        ) {
          throw new InputError(
            "Only single-frame PNG, JPEG, and WebP images are accepted.",
          );
        }
        image = await pipeline
          .rotate()
          .resize({
            width: 800,
            height: 400,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 90 })
          .toBuffer();
      } catch (error) {
        if (error instanceof InputError) throw error;
        console.warn("Logo decoding rejected:", error.message);
        throw new InputError(
          "The logo could not be decoded. Use a valid PNG, JPEG, or WebP image up to 16 megapixels.",
        );
      }
      const filename = `${randomUUID()}.webp`;
      const destination = path.join(dataDir, "uploads", filename);
      await writeFile(destination, image, { flag: "wx", mode: 0o600 });
      try {
        const result = store.db
          .prepare(
            "UPDATE resources SET logo=?,revision=revision+1 WHERE id=? AND revision=?",
          )
          .run(`/uploads/${filename}`, current.id, expectedRevision);
        if (!result.changes) throw conflict();
      } catch (error) {
        await unlink(destination);
        throw error;
      }
      res.json({
        message: "Logo saved. It is now live.",
        redirect: `/admin/resources/${current.id}?saved=1`,
      });
    },
  );
  app.post("/admin/resources/:id/remove-logo", checkCsrf, (req, res) => {
    const current = getResource(req.params.id);
    const result = store.db
      .prepare(
        "UPDATE resources SET logo=?,revision=revision+1 WHERE id=? AND revision=?",
      )
      .run("", current.id, revision(req.body.revision));
    if (!result.changes) throw conflict();
    res.redirect(303, `/admin/resources/${current.id}?saved=1`);
  });
  app.post("/admin/resources/:id/delete", checkCsrf, (req, res) => {
    const current = getResource(req.params.id);
    const result = store.db
      .prepare("DELETE FROM resources WHERE id=? AND revision=?")
      .run(current.id, revision(req.body.revision));
    if (!result.changes) throw conflict();
    res.redirect(303, "/admin?saved=1");
  });
  app.use((req, res) =>
    res.status(404).render("error", {
      title: "Page not found",
      message:
        "This page does not exist. Return home or use your browser’s Back button.",
    }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const uploadError = error instanceof multer.MulterError;
    const status = uploadError
      ? 400
      : [400, 403, 404, 409, 413].includes(error.status)
        ? error.status
        : 500;
    if (status === 500) console.error("Request failed:", error);
    const message = uploadError
      ? "Upload rejected. Choose one image up to 2 MB."
      : status === 500
        ? "Something went wrong. Your change may not have been saved. Reload and verify before retrying."
        : status === 413
          ? "This request is too large. Reduce its size and try again."
          : error.message;
    if (req.path.endsWith("/logo"))
      return res.status(status).json({ error: message });
    res.status(status).render("error", {
      title: status === 409 ? "Content changed" : "Unable to complete request",
      message,
    });
  });

  function getResource(id) {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
      throw Object.assign(new Error("Resource not found."), { status: 404 });
    const resource = store.resource(Number(id));
    if (!resource)
      throw Object.assign(new Error("Resource not found."), { status: 404 });
    return resource;
  }
  return {
    app,
    store,
    close() {
      sessions.close();
      store.close();
    },
  };
}

function revision(value) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1)
    throw new InputError(
      "Missing content revision. Reload this page and try again.",
    );
  return result;
}
function conflict() {
  return Object.assign(
    new Error(
      "Someone changed this content since you opened it. Reload before editing again; your newer content has not been overwritten.",
    ),
    { status: 409 },
  );
}
function submitted(body) {
  return {
    name: typeof body.name === "string" ? body.name : "",
    description: typeof body.description === "string" ? body.description : "",
    category: typeof body.category === "string" ? body.category : "",
    url: typeof body.url === "string" ? body.url : "",
    position: typeof body.position === "string" ? body.position : "",
    visible: body.visible === "on" ? 1 : 0,
    featured: body.featured === "on" ? 1 : 0,
  };
}
