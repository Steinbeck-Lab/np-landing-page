import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/security.js";

const directory = await mkdtemp(
  path.join(tmpdir(), "natural-products-browser-"),
);
const fixture = createApp({
  dataDir: directory,
  secret: randomBytes(48).toString("hex"),
  origin: "http://localhost:3000",
});
const password = randomBytes(32).toString("hex");
fixture.store.db
  .prepare("INSERT INTO admins (username,password_hash) VALUES (?,?)")
  .run("browser-check", await hashPassword(password));
const server = fixture.app.listen(0, "127.0.0.1");
let browser;
let page;
try {
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  const screenshotDirectory = process.env.SCREENSHOT_DIR;
  if (screenshotDirectory)
    await mkdir(screenshotDirectory, { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin);
    await page.locator(".resource-card").last().scrollIntoViewIfNeeded();
    assert.equal(await page.locator(".resource-card").count(), 15);
    assert.equal(
      await page
        .getByRole("heading", { name: "Natural Products Online", exact: true })
        .count(),
      1,
    );
    assert.equal(
      await page.locator(".site-header .brand img").getAttribute("src"),
      "/assets/logos/natural-products.webp",
    );
    assert.equal(await page.locator(".footer-github .github-icon").count(), 1);
    assert.equal(
      await page
        .getByRole("navigation", { name: "Footer", exact: true })
        .getByRole("link", { name: "GitHub", exact: false })
        .getAttribute("href"),
      fixture.store.settings().githubUrl,
    );
    assert.ok(
      (await page
        .locator(".site-footer > p")
        .evaluate((text) => parseFloat(getComputedStyle(text).fontSize))) >= 14,
    );
    assert.ok(
      (await page
        .locator(".footer-brand")
        .evaluate((text) => parseFloat(getComputedStyle(text).fontSize))) >= 16,
    );
    assert.equal(
      await page
        .locator(".site-header .brand img")
        .evaluate((image) => image.getBoundingClientRect().width),
      84,
    );
    assert.equal(await page.locator(".hero-actions, .hero-credit").count(), 0);
    const groupLogo = page.getByRole("img", {
      name: /Steinbeck Group — Cheminformatics and Computational Metabolomics/,
    });
    await groupLogo.scrollIntoViewIfNeeded();
    assert.equal(
      await groupLogo.evaluate(
        (image) => image.complete && image.naturalWidth > 0,
      ),
      true,
    );
    assert.equal(
      await groupLogo.locator("..").getAttribute("href"),
      fixture.store.settings().groupUrl,
    );
    if (width === 1440) {
      assert.equal(
        await page
          .getByRole("img", {
            name: "Caffeine chemical structure",
            exact: true,
          })
          .isVisible(),
        true,
      );
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `no overflow at ${width}px`,
    );
    const broken = await page
      .locator("img")
      .evaluateAll((images) =>
        images
          .filter((image) => !image.complete || !image.naturalWidth)
          .map((image) => image.src),
      );
    assert.deepEqual(broken, [], `all images load at ${width}px`);
    await page.getByRole("button", { name: "Databases", exact: true }).click();
    assert.equal(await page.locator(".resource-card:visible").count(), 4);
    const databaseNames = await page
      .locator(".resource-card:visible h3")
      .allTextContents();
    assert.deepEqual(databaseNames, [
      "COCONUT",
      "LOTUS",
      "Watermelon",
      "nmrXiv",
    ]);
    assert.equal(
      await page
        .getByRole("link", { name: "nmrXiv", exact: false })
        .getAttribute("href"),
      "https://nmrxiv.org/",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Databases", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.getByRole("button", { name: /All resources/ }).click();
    await checkAccessibility(page, `public ${width}px`);
    await page.evaluate(() => scrollTo(0, 0));
    if (screenshotDirectory && [1440, 390].includes(width)) {
      await page.locator("#hero-title").evaluate(async (heading) => {
        await Promise.all(
          heading
            .getAnimations({ subtree: true })
            .map((animation) => animation.finished),
        );
      });
      await page.screenshot({
        path: path.join(screenshotDirectory, `public-${width}.png`),
        fullPage: true,
      });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(origin);
    assert.equal(
      await page
        .locator(".hero-title-text")
        .evaluateAll((words) =>
          words.every(
            (word) =>
              getComputedStyle(word).animationName === "none" &&
              getComputedStyle(word).clipPath === "none",
          ),
        ),
      true,
    );
    assert.equal(
      await page
        .locator(".hero-title-word")
        .evaluateAll((words) =>
          words.every(
            (word) => getComputedStyle(word, "::after").display === "none",
          ),
        ),
      true,
    );
    assert.equal(
      await page
        .locator(".hero-title-logo")
        .evaluate((logo) => getComputedStyle(logo).animationName),
      "none",
    );
    assert.equal(
      await page
        .locator(".hero-title-logo")
        .evaluate((logo) => getComputedStyle(logo).opacity),
      "1",
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(origin);
    assert.equal(
      await page
        .locator(".hero-title-logo")
        .evaluate((logo) => getComputedStyle(logo).animationName),
      "logo-arrival",
    );
    assert.equal(
      await page
        .locator(".hero-title-logo")
        .evaluate((logo) => getComputedStyle(logo).animationDelay),
      "1.95s",
    );
    assert.equal(
      await page
        .locator(".hero-title-text")
        .first()
        .evaluate((word) => getComputedStyle(word).animationName),
      "title-reveal",
    );
    const cursorPositions = await page
      .locator(".hero-title-word")
      .evaluateAll((words) =>
        words.map((word) => {
          for (const animation of word.getAnimations({ subtree: true })) {
            animation.pause();
            animation.currentTime =
              Number(animation.effect.getTiming().delay) + 350;
          }
          const cursor = getComputedStyle(word, "::after");
          const text = getComputedStyle(word.querySelector(".hero-title-text"));
          return {
            fraction:
              parseFloat(cursor.left) / word.getBoundingClientRect().width,
            opacity: cursor.opacity,
            clip: text.clipPath,
          };
        }),
      );
    for (const cursor of cursorPositions) {
      assert.ok(
        Math.abs(cursor.fraction - 0.5) < 0.02,
        "cursor tracks halfway through each word",
      );
      assert.equal(cursor.opacity, "0.8");
      assert.match(cursor.clip, /50%/);
    }
    await page.locator("#hero-title").evaluate((heading) => {
      for (const animation of heading.getAnimations({ subtree: true }))
        animation.finish();
    });
    assert.equal(
      await page
        .locator(".hero-title-logo")
        .evaluate(
          (logo) =>
            logo.complete &&
            logo.naturalWidth > 0 &&
            getComputedStyle(logo).opacity === "1" &&
            new DOMMatrixReadOnly(getComputedStyle(logo).transform).isIdentity,
        ),
      true,
    );
    assert.equal(
      await page.locator(".hero-title-text").evaluateAll((words) =>
        words.every((word) => {
          const clip = getComputedStyle(word).clipPath;
          return (
            clip.startsWith("inset(") &&
            clip.match(/[\d.]+/g).every((value) => Number(value) === 0) &&
            word
              .getAnimations()
              .every((animation) => animation.playState === "finished")
          );
        }),
      ),
      true,
    );
    assert.equal(
      await page
        .locator(".hero-title-word")
        .evaluateAll((words) =>
          words.every(
            (word) => getComputedStyle(word, "::after").opacity === "0",
          ),
        ),
      true,
    );
    console.log("PASS finite headline animation and reduced-motion behavior");
    console.log(
      `PASS public page, filters, images, overflow, and automated accessibility at ${width}px`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/admin/login`);
  await checkAccessibility(page, "sign in");
  await page.getByLabel("Username", { exact: true }).fill("browser-check");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await page.waitForURL(`${origin}/admin`);
  await checkAccessibility(page, "admin dashboard");
  if (screenshotDirectory)
    await page.screenshot({
      path: path.join(screenshotDirectory, "admin-desktop.png"),
      fullPage: true,
    });
  await page.getByRole("link", { name: "Edit COCONUT", exact: true }).click();
  await checkAccessibility(page, "resource editor");
  await page
    .getByRole("textbox", { name: "Short description", exact: true })
    .fill("Browser-verified live content update.");
  await page
    .getByRole("button", { name: "Save resource", exact: false })
    .click();
  await page.waitForURL(`${origin}/admin?saved=1`);
  const visitor = await context.newPage();
  await visitor.goto(origin);
  assert.equal(
    await visitor
      .getByText("Browser-verified live content update.", { exact: true })
      .count(),
    1,
  );
  await page.getByRole("link", { name: "Edit COCONUT", exact: true }).click();
  const logo = await sharp({
    create: { width: 240, height: 100, channels: 4, background: "#153e35" },
  })
    .png()
    .toBuffer();
  await page.getByLabel("Choose a logo", { exact: true }).setInputFiles({
    name: "test-logo.png",
    mimeType: "image/png",
    buffer: logo,
  });
  await page
    .getByRole("button", { name: "Upload & publish logo", exact: true })
    .click();
  await page.waitForURL(/\/admin\/resources\/1\?saved=1$/);
  assert.equal(
    await page.locator(".logo-preview img").getAttribute("src"),
    fixture.store.resource(1).logo,
  );
  await visitor.reload();
  assert.equal(
    await visitor
      .locator(".resource-card")
      .first()
      .locator("img")
      .getAttribute("src"),
    fixture.store.resource(1).logo,
  );
  console.log(
    "PASS browser sign-in, text editing, immediate public updates, and real logo upload",
  );
  for (const route of ["/admin", "/admin/resources/1"]) {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${origin}${route}`);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${route} has no overflow at ${width}px`,
      );
      await checkAccessibility(page, `${route} ${width}px`);
    }
  }
  await page.goto(`${origin}/admin`);
  await page
    .getByRole("textbox", { name: "Introduction", exact: true })
    .fill("A browser-updated introduction to open natural products research.");
  await page
    .getByRole("button", { name: "Save page content", exact: false })
    .click();
  await page.waitForURL(/saved=1#page-content$/);
  await visitor.reload();
  assert.equal(
    await visitor
      .getByText(
        "A browser-updated introduction to open natural products research.",
        { exact: true },
      )
      .count(),
    1,
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL(`${origin}/admin/login`);
  assert.deepEqual(errors, [], "no browser script or HTTP errors");
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const fallback = await noJs.newPage();
  await fallback.goto(origin);
  assert.equal(await fallback.locator(".resource-card:visible").count(), 15);
  assert.equal(await fallback.locator(".filters:visible").count(), 0);
  await noJs.close();
  console.log(
    "PASS mobile admin, page-content editing, logout, and public no-JavaScript fallback",
  );
} catch (error) {
  if (page) {
    console.error("Browser check failed at:", page.url());
    console.error(await page.locator("main").ariaSnapshot());
  }
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  fixture.close();
  await rm(directory, { recursive: true, force: true });
}

async function checkAccessibility(page, label) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
    `automated accessibility: ${label}`,
  );
}
