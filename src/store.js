import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import session from "express-session";
import {
  extraResources,
  initialResources,
  initialSettings,
} from "./content.js";

export function openStore(dataDir) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  mkdirSync(path.join(dataDir, "uploads"), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dataDir, "site.sqlite"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY);
  `);
  if (!db.prepare("SELECT version FROM migrations WHERE version = 1").get()) {
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE resources (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
        category TEXT NOT NULL, url TEXT NOT NULL, logo TEXT NOT NULL DEFAULT '',
        position INTEGER NOT NULL, visible INTEGER NOT NULL DEFAULT 1,
        featured INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE settings (id INTEGER PRIMARY KEY CHECK(id = 1), content TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE admins (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE sessions (sid TEXT PRIMARY KEY, content TEXT NOT NULL, expires INTEGER NOT NULL);
      INSERT INTO migrations VALUES (1);
    `);
    try {
      db.prepare("INSERT INTO settings (id,content) VALUES (1,?)").run(
        JSON.stringify(initialSettings),
      );
      const insert = db.prepare(
        "INSERT INTO resources (name,description,category,url,logo,position,featured) VALUES (?,?,?,?,?,?,?)",
      );
      initialResources.forEach((r, i) =>
        insert.run(
          r.name,
          r.description,
          r.category,
          r.url,
          `/assets/logos/${r.slug}.webp`,
          i * 10,
          r.featured ? 1 : 0,
        ),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  if (!db.prepare("SELECT version FROM migrations WHERE version = 2").get()) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const settings = db
        .prepare("SELECT content FROM settings WHERE id = 1")
        .get();
      const content = JSON.parse(settings.content);
      if (content.title === "Nature inspires.\nDiscovery starts here.") {
        content.title = initialSettings.title;
        db.prepare(
          "UPDATE settings SET content = ?, revision = revision + 1 WHERE id = 1",
        ).run(JSON.stringify(content));
      }
      db.prepare(
        `UPDATE resources SET category = 'Databases', revision = revision + 1
        WHERE (rtrim(url, '/') = 'https://watermelon.naturalproducts.net' OR lower(name) = 'watermelon')
        AND category != 'Databases'`,
      ).run();
      const existing = db
        .prepare(
          "SELECT id FROM resources WHERE rtrim(url, '/') = ? OR lower(name) = ?",
        )
        .get("https://nmrxiv.org", "nmrxiv");
      if (!existing) {
        const resource = initialResources.find((r) => r.slug === "nmrxiv");
        const { position } = db
          .prepare(
            "SELECT COALESCE(MAX(position), -10) AS position FROM resources",
          )
          .get();
        db.prepare(
          `INSERT INTO resources (name, description, category, url, logo, position)
          VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          resource.name,
          resource.description,
          resource.category,
          resource.url,
          "/assets/logos/nmrxiv.webp",
          Math.min(position + 10, 10000),
        );
      }
      db.prepare("INSERT INTO migrations VALUES (2)").run();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  if (!db.prepare("SELECT version FROM migrations WHERE version = 4").get()) {
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const resource of extraResources) {
        const exists = db
          .prepare(
            "SELECT id FROM resources WHERE rtrim(url, '/') = ? OR lower(name) = ?",
          )
          .get(resource.url.replace(/\/$/, ""), resource.name.toLowerCase());
        if (exists) continue;
        const { position } = db
          .prepare(
            "SELECT COALESCE(MAX(position), -10) AS position FROM resources",
          )
          .get();
        db.prepare(
          `INSERT INTO resources (name, description, category, url, logo, position)
          VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          resource.name,
          resource.description,
          resource.category,
          resource.url,
          `/assets/logos/${resource.slug}.webp`,
          Math.min(position + 10, 10000),
        );
      }
      db.prepare("INSERT INTO migrations VALUES (4)").run();
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  return {
    db,
    resources: (all = false) =>
      db
        .prepare(
          `SELECT * FROM resources ${all ? "" : "WHERE visible = 1"} ORDER BY position, id`,
        )
        .all(),
    resource: (id) =>
      db.prepare("SELECT * FROM resources WHERE id = ?").get(id),
    settings() {
      const row = db.prepare("SELECT * FROM settings WHERE id = 1").get();
      return { ...JSON.parse(row.content), revision: row.revision };
    },
    admin: (username) =>
      db.prepare("SELECT * FROM admins WHERE username = ?").get(username),
    close: () => db.close(),
  };
}

export class SqliteSessions extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    this.timer = setInterval(
      () => {
        try {
          db.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
        } catch (error) {
          console.error("Session cleanup failed:", error);
        }
      },
      60 * 60 * 1000,
    ).unref();
  }
  get(sid, callback) {
    try {
      const row = this.db
        .prepare("SELECT content FROM sessions WHERE sid = ? AND expires > ?")
        .get(sid, Date.now());
      callback(null, row ? JSON.parse(row.content) : null);
    } catch (error) {
      callback(error);
    }
  }
  set(sid, value, callback = () => {}) {
    try {
      const expires = value.cookie.expires
        ? new Date(value.cookie.expires).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;
      this.db
        .prepare("INSERT OR REPLACE INTO sessions VALUES (?,?,?)")
        .run(sid, JSON.stringify(value), expires);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
  destroy(sid, callback = () => {}) {
    try {
      this.db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
  close() {
    clearInterval(this.timer);
  }
}
