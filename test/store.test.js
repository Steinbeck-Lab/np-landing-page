import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { openStore } from "../src/store.js";

test("content migration updates an existing portal once without resetting other content", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "natural-products-migration-"),
  );
  let store;
  try {
    store = openStore(directory);
    const settings = {
      ...store.settings(),
      title: "Nature inspires.\nDiscovery starts here.",
      introduction: "An edited introduction.",
    };
    delete settings.revision;
    store.db
      .prepare("UPDATE settings SET content=?,revision=5 WHERE id=1")
      .run(JSON.stringify(settings));
    store.db
      .prepare(
        "UPDATE resources SET category='Research tools',description='An edited description.',logo='/uploads/custom.webp',visible=0,position=123,revision=7 WHERE name='Watermelon'",
      )
      .run();
    store.db.prepare("DELETE FROM resources WHERE name='nmrXiv'").run();
    store.db.prepare("DELETE FROM migrations WHERE version=2").run();
    store.close();
    store = openStore(directory);
    assert.equal(store.settings().title, "Natural Products Online");
    assert.equal(store.settings().introduction, "An edited introduction.");
    assert.equal(store.settings().revision, 6);
    const watermelon = store
      .resources(true)
      .find((r) => r.name === "Watermelon");
    assert.equal(watermelon.category, "Databases");
    assert.equal(watermelon.description, "An edited description.");
    assert.equal(watermelon.logo, "/uploads/custom.webp");
    assert.equal(watermelon.visible, 0);
    assert.equal(watermelon.position, 123);
    assert.equal(watermelon.revision, 8);
    assert.equal(
      store.resources(true).filter((r) => r.name === "nmrXiv").length,
      1,
    );
    assert.equal(
      store.resources().find((r) => r.name === "nmrXiv").logo,
      "/assets/logos/nmrxiv.webp",
    );
    const snapshot = store.resources(true);
    store.close();
    store = openStore(directory);
    assert.deepEqual(store.resources(true), snapshot);
    assert.equal(store.settings().revision, 6);
  } finally {
    store?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("content migration preserves a customized heading and existing nmrXiv entry", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "natural-products-custom-migration-"),
  );
  let store;
  try {
    store = openStore(directory);
    const settings = {
      ...store.settings(),
      title: "Our customized research portal",
    };
    delete settings.revision;
    store.db
      .prepare("UPDATE settings SET content=? WHERE id=1")
      .run(JSON.stringify(settings));
    store.db
      .prepare(
        "UPDATE resources SET name='NMRXIV',url='https://nmrxiv.org',description='A custom entry',logo='/uploads/custom.webp' WHERE name='nmrXiv'",
      )
      .run();
    store.db.prepare("DELETE FROM migrations WHERE version=2").run();
    store.close();
    store = openStore(directory);
    assert.equal(store.settings().title, settings.title);
    assert.equal(store.settings().revision, 1);
    const entries = store
      .resources(true)
      .filter((r) => r.name.toLowerCase() === "nmrxiv");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].description, "A custom entry");
    assert.equal(entries[0].logo, "/uploads/custom.webp");
  } finally {
    store?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
