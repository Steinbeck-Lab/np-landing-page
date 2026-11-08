import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import request from "supertest";
import sharp from "sharp";
import { createApp } from "../src/app.js";
import { hashPassword, verifyPassword } from "../src/security.js";

let fixture, agent, directory, csrf, passwordHash;
const config = {
  secret: "test-secret-".repeat(8),
  origin: "http://localhost:3000",
};
const password = "a-test-only-password-for-fixtures";
const fields = (r) => ({
  name: r.name,
  description: r.description,
  category: r.category,
  url: r.url,
  position: r.position,
  visible: r.visible ? "on" : "",
  featured: r.featured ? "on" : "",
  revision: r.revision,
  _csrf: csrf,
});
const token = (response) => {
  const found = response.text.match(/name="_csrf" value="([a-f0-9]+)"/);
  assert.ok(found, "form includes CSRF token");
  return found[1];
};
async function login() {
  agent = request.agent(fixture.app);
  const loginPage = await agent.get("/admin/login").expect(200);
  const loginCsrf = token(loginPage);
  await agent
    .post("/admin/login")
    .type("form")
    .send({ _csrf: loginCsrf, username: "editor", password })
    .expect(303)
    .expect("Location", "/admin");
  csrf = token(await agent.get("/admin").expect(200));
}

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "natural-products-test-"));
  fixture = createApp({ ...config, dataDir: directory });
  passwordHash = await hashPassword(password);
  fixture.store.db
    .prepare("INSERT INTO admins (username,password_hash) VALUES (?,?)")
    .run("editor", passwordHash);
  await login();
});
after(async () => {
  fixture.close();
  await rm(directory, { recursive: true, force: true });
});

test("public page renders all fifteen projects, updated branding, SEO and no visitor session", async () => {
  const response = await request(fixture.app).get("/").expect(200);
  assert.equal(
    (response.text.match(/class="resource-card"/g) ?? []).length,
    15,
  );
  assert.match(
    response.text,
    /<span class="hero-title-text">Natural<\/span>[\s\S]*<span class="hero-title-text">Products<\/span>[\s\S]*<span class="hero-title-text">Online<\/span>/,
  );
  assert.match(response.text, /Animated 2D structures of natural products/);
  assert.match(response.text, /\/assets\/logos\/natural-products.webp/);
  assert.match(response.text, /width="84" height="65"/);
  assert.match(response.text, /\/assets\/logos\/steinbeck-group.webp/);
  assert.doesNotMatch(
    response.text,
    /hero-actions|hero-credit|Built in the open|An initiative of/,
  );
  const databases = fixture.store
    .resources()
    .filter((r) => r.category === "Databases");
  assert.deepEqual(
    databases.map((r) => r.name),
    ["COCONUT", "LOTUS", "Watermelon", "nmrXiv"],
  );
  const nmrxiv = databases.find((r) => r.name === "nmrXiv");
  assert.equal(nmrxiv.url, "https://nmrxiv.org/");
  assert.equal(nmrxiv.logo, "/assets/logos/nmrxiv.webp");
  assert.match(response.text, /name="description"/);
  assert.match(response.text, /href="http:\/\/localhost:3000\/"/);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["set-cookie"], undefined);
  assert.match(
    response.headers["content-security-policy"],
    /object-src 'none'/,
  );
});
test("seeded local logos load and legacy contact redirects", async () => {
  await request(fixture.app)
    .get("/assets/logos/steinbeck-group.webp")
    .expect(200)
    .expect("Content-Type", /image\/webp/);
  for (const resource of fixture.store.resources()) {
    if (!resource.logo) continue; // newer cards use the initials fallback
    await request(fixture.app)
      .get(resource.logo)
      .expect(200)
      .expect("Content-Type", /image\/webp/);
  }
  await request(fixture.app)
    .get("/contact/")
    .expect(301)
    .expect("Location", "/#contact");
  await request(fixture.app)
    .get("/robots.txt")
    .expect(200)
    .expect(/Disallow: \/admin/);
  await request(fixture.app)
    .get("/sitemap.xml")
    .expect(200)
    .expect("Content-Type", /xml/);
  await request(fixture.app).get("/health").expect(200, { status: "ok" });
});
test("admin requires sign-in and private pages are not cached or indexed", async () => {
  await request(fixture.app)
    .get("/admin")
    .expect(303)
    .expect("Location", "/admin/login");
  const response = await agent.get("/admin").expect(200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["x-robots-tag"], "noindex, nofollow");
  assert.match(response.text, /COCONUT/);
});
test("password verification, unknown account and invalid credentials fail", async () => {
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword("wrong", passwordHash), false);
  const guest = request.agent(fixture.app);
  const t = token(await guest.get("/admin/login"));
  await guest
    .post("/admin/login")
    .type("form")
    .send({ _csrf: t, username: "unknown", password })
    .expect(401)
    .expect(/Incorrect username or password/);
  await guest
    .post("/admin/login")
    .type("form")
    .send({ _csrf: t, username: "editor", password: "wrong" })
    .expect(401);
});
test("missing and non-ASCII CSRF tokens reject safely without changing content", async () => {
  const current = fixture.store.resource(1);
  await agent
    .post("/admin/resources/1")
    .type("form")
    .send({ ...fields(current), _csrf: "" })
    .expect(403);
  await agent
    .post("/admin/resources/1")
    .type("form")
    .send({ ...fields(current), _csrf: "\u00e9".repeat(64) })
    .expect(403);
  assert.equal(fixture.store.resource(1).revision, current.revision);
});
test("resource name, website, description and ordering become live immediately", async () => {
  const current = fixture.store.resource(1);
  await agent
    .post("/admin/resources/1")
    .type("form")
    .send({
      ...fields(current),
      name: "COCONUT updated",
      url: "https://example.org/coconut",
      description: "A new live description.",
      position: 999,
    })
    .expect(303);
  const response = await request(fixture.app).get("/").expect(200);
  assert.match(response.text, /COCONUT updated/);
  assert.match(response.text, /https:\/\/example.org\/coconut/);
  assert.match(response.text, /A new live description/);
  assert.equal(fixture.store.resources().at(-1).name, "COCONUT updated");
});
test("stale resource revisions cannot overwrite newer edits", async () => {
  const current = fixture.store.resource(1);
  await agent
    .post("/admin/resources/1")
    .type("form")
    .send({
      ...fields(current),
      revision: current.revision - 1,
      name: "Stale content",
    })
    .expect(409);
  assert.equal(fixture.store.resource(1).name, current.name);
});
test("hiding and republishing resources affects only public visibility", async () => {
  await agent
    .post("/admin/resources/1")
    .type("form")
    .send({ ...fields(fixture.store.resource(1)), visible: "" })
    .expect(303);
  assert.doesNotMatch(
    (await request(fixture.app).get("/")).text,
    /COCONUT updated/,
  );
  assert.match((await agent.get("/admin")).text, /COCONUT updated/);
  await agent
    .post("/admin/resources/1")
    .type("form")
    .send({ ...fields(fixture.store.resource(1)), visible: "on" })
    .expect(303);
});
test("create, edit form, featured badge and delete resource", async () => {
  await agent.get("/admin/resources/new").expect(200);
  const response = await agent
    .post("/admin/resources")
    .type("form")
    .send({
      _csrf: csrf,
      name: "New project",
      description: "New project information.",
      url: "https://example.org",
      category: "Research tools",
      position: 2,
      visible: "on",
      featured: "on",
    })
    .expect(303);
  const location = response.headers.location.split("?")[0];
  await agent
    .get(location)
    .expect(200)
    .expect(/New project/);
  const created = fixture.store
    .resources(true)
    .find((r) => r.name === "New project");
  assert.equal(created.featured, 1);
  assert.match((await request(fixture.app).get("/")).text, /New project/);
  await agent
    .post(`${location}/delete`)
    .type("form")
    .send({ _csrf: csrf, revision: created.revision })
    .expect(303);
  assert.doesNotMatch(
    (await request(fixture.app).get("/")).text,
    /New project/,
  );
});
test("invalid resource values are rejected and submitted text is preserved", async () => {
  const current = fixture.store.resource(1);
  for (const invalid of [
    { url: "javascript:alert(1)" },
    { url: "https://user:pass@example.org" },
    { category: "Invalid" },
    { position: -1 },
    { name: "" },
  ]) {
    const response = await agent
      .post("/admin/resources/1")
      .type("form")
      .send({
        ...fields(current),
        description: "Unsaved entered text",
        ...invalid,
      })
      .expect(400);
    assert.match(response.text, /Unsaved entered text/);
    assert.equal(fixture.store.resource(1).revision, current.revision);
  }
});
test("script markup in content is escaped, not rendered", async () => {
  const current = fixture.store.resource(1);
  await agent
    .post("/admin/resources/1")
    .type("form")
    .send({ ...fields(current), description: '<script>alert("xss")</script>' })
    .expect(303);
  const response = await request(fixture.app).get("/");
  assert.match(response.text, /&lt;script&gt;/);
  assert.doesNotMatch(response.text, /<script>alert/);
});
test("page text, contact email and footer links update live", async () => {
  const settings = fixture.store.settings();
  await agent
    .post("/admin/settings")
    .type("form")
    .send({
      ...settings,
      _csrf: csrf,
      title: "Updated live headline",
      contactEmail: "contact@example.org",
      privacyUrl: "https://example.org/privacy",
      legalUrl: "https://example.org/legal",
    })
    .expect(303);
  const response = await request(fixture.app).get("/");
  assert.match(
    response.text
      .match(/<h1 id="hero-title">([\s\S]*?)<\/h1>/)[1]
      .replace(/<[^>]*>/g, ""),
    /Updated live headline/,
  );
  assert.match(response.text, /mailto:contact@example.org/);
  assert.match(response.text, /https:\/\/example.org\/privacy/);
  await agent
    .post("/admin/settings")
    .type("form")
    .send({ ...settings, _csrf: csrf })
    .expect(409);
  const latest = fixture.store.settings();
  await agent
    .post("/admin/settings")
    .type("form")
    .send({ ...latest, _csrf: csrf, contactEmail: "bad email" })
    .expect(400);
  await agent
    .post("/admin/settings")
    .type("form")
    .send({ ...latest, _csrf: csrf, groupUrl: "data:text/html,test" })
    .expect(400);
});
test("logo upload is re-encoded, stored locally and publicly visible immediately", async () => {
  const image = await sharp({
    create: { width: 1000, height: 500, channels: 4, background: "#99aa77" },
  })
    .png()
    .toBuffer();
  const current = fixture.store.resource(1);
  await agent
    .post("/admin/resources/1/logo")
    .set("x-csrf-token", csrf)
    .field("revision", current.revision)
    .attach("logo", image, "logo.png")
    .expect(200);
  const updated = fixture.store.resource(1);
  assert.match(updated.logo, /^\/uploads\/[\w-]+\.webp$/);
  const file = await readFile(path.join(directory, updated.logo));
  const metadata = await sharp(file).metadata();
  assert.equal(metadata.format, "webp");
  assert.ok(metadata.width <= 800 && metadata.height <= 400);
  await request(fixture.app)
    .get(updated.logo)
    .expect(200)
    .expect("Content-Type", /image\/webp/);
  assert.ok((await request(fixture.app).get("/")).text.includes(updated.logo));
});
test("logo routes reject CSRF, spoofed SVG, oversize and stale revisions", async () => {
  const current = fixture.store.resource(1);
  const before = await readdir(path.join(directory, "uploads"));
  await agent
    .post("/admin/resources/1/logo")
    .attach("logo", Buffer.from("fake"), "logo.png")
    .expect(403);
  await agent
    .post("/admin/resources/1/logo")
    .set("x-csrf-token", csrf)
    .field("revision", current.revision)
    .attach(
      "logo",
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ),
      "fake.png",
    )
    .expect(400);
  await agent
    .post("/admin/resources/1/logo")
    .set("x-csrf-token", csrf)
    .field("revision", current.revision)
    .attach("logo", Buffer.alloc(2 * 1024 * 1024 + 1), "big.png")
    .expect(400);
  await agent
    .post("/admin/resources/1/logo")
    .set("x-csrf-token", csrf)
    .field("revision", current.revision - 1)
    .attach("logo", Buffer.from("fake"), "logo.png")
    .expect(409);
  assert.deepEqual(await readdir(path.join(directory, "uploads")), before);
});
test("logo removal publishes a text fallback without breaking resource", async () => {
  const current = fixture.store.resource(1);
  await agent
    .post("/admin/resources/1/remove-logo")
    .type("form")
    .send({ _csrf: csrf, revision: current.revision })
    .expect(303);
  assert.equal(fixture.store.resource(1).logo, "");
  assert.match((await request(fixture.app).get("/")).text, /logo-fallback/);
});
test("malformed IDs, nonexistent pages and oversized form bodies fail explicitly", async () => {
  await agent.get("/admin/resources/0").expect(404);
  await agent.get("/admin/resources/nope").expect(404);
  await agent.get("/admin/resources/99999").expect(404);
  await request(fixture.app).get("/not-here").expect(404);
  await agent
    .post("/admin/settings")
    .type("form")
    .send({ title: "x".repeat(40000) })
    .expect(413);
});
test("content and administrator sessions persist across application restart", async () => {
  const current = fixture.store.resource(1);
  const response = await agent.get("/admin");
  const cookie = response.request.cookies;
  fixture.close();
  fixture = createApp({ ...config, dataDir: directory });
  assert.equal(fixture.store.resource(1).description, current.description);
  // Supertest agents retain their original application, so replay the cookie to the new app.
  await request(fixture.app).get("/admin").set("Cookie", cookie).expect(200);
  await login();
});
test("password reset invalidates existing authenticated sessions", async () => {
  fixture.store.db
    .prepare("UPDATE admins SET version=version+1 WHERE username=?")
    .run("editor");
  await agent.get("/admin").expect(303).expect("Location", "/admin/login");
  await login();
});
test("logout destroys authenticated session", async () => {
  await agent
    .post("/admin/logout")
    .type("form")
    .send({ _csrf: csrf })
    .expect(303);
  await agent.get("/admin").expect(303).expect("Location", "/admin/login");
});
test("login attempts are rate limited", async () => {
  const guest = request.agent(fixture.app);
  const t = token(await guest.get("/admin/login"));
  let limited = false;
  for (let i = 0; i < 12; i++) {
    const response = await guest
      .post("/admin/login")
      .type("form")
      .send({ _csrf: t, username: "unknown", password: "invalid" });
    if (response.status === 429) {
      limited = true;
      break;
    }
    assert.equal(response.status, 401);
  }
  assert.equal(limited, true);
});
test("production requires HTTPS and uses secure HttpOnly session cookies behind proxy", async () => {
  assert.throws(
    () => createApp({ ...config, dataDir: directory, secret: "" }),
    /SESSION_SECRET/,
  );
  assert.throws(
    () => createApp({ ...config, dataDir: directory, production: true }),
    /HTTPS/,
  );
  const prod = createApp({
    ...config,
    dataDir: directory,
    origin: "https://example.org",
    production: true,
    trustProxy: 1,
  });
  try {
    const response = await request(prod.app)
      .get("/admin/login")
      .set("X-Forwarded-Proto", "https")
      .expect(200);
    assert.match(response.headers["set-cookie"][0], /HttpOnly/);
    assert.match(response.headers["set-cookie"][0], /Secure/);
    assert.match(response.headers["set-cookie"][0], /SameSite=Strict/);
    assert.match(response.headers["strict-transport-security"], /max-age/);
  } finally {
    prod.close();
  }
});
test("backup script produces restorable SQLite content and logo files", async () => {
  const backupRoot = path.join(
    directory,
    "..",
    `${path.basename(directory)}-backups`,
  );
  try {
    execFileSync(process.execPath, ["scripts/backup.js", backupRoot], {
      env: { ...process.env, DATA_DIR: directory },
      stdio: "pipe",
    });
    const [backupName] = await readdir(backupRoot);
    const restored = createApp({
      ...config,
      dataDir: path.join(backupRoot, backupName),
    });
    try {
      assert.equal(
        restored.store.resource(1).description,
        fixture.store.resource(1).description,
      );
      assert.ok(
        (await readdir(path.join(backupRoot, backupName, "uploads"))).length,
      );
      await request(restored.app).get("/").expect(200);
    } finally {
      restored.close();
    }
  } finally {
    await rm(backupRoot, { recursive: true, force: true });
  }
});
