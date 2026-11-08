import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, stat, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { openStore } from "../src/store.js";
import { verifyPassword } from "../src/security.js";

const root = fileURLToPath(new URL("../", import.meta.url));

test("setup creates a private secret configuration and refuses to replace it", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "natural-products-setup-"),
  );
  try {
    execFileSync(process.execPath, [path.join(root, "scripts/setup.js")], {
      cwd: directory,
    });
    const config = await readFile(path.join(directory, ".env"), "utf8");
    assert.match(config, /SESSION_SECRET=[a-f0-9]{96}\n/);
    assert.equal(
      (await stat(path.join(directory, ".env"))).mode & 0o777,
      0o600,
    );
    const repeated = spawnSync(
      process.execPath,
      [path.join(root, "scripts/setup.js")],
      { cwd: directory },
    );
    assert.notEqual(repeated.status, 0);
    assert.match(repeated.stderr.toString(), /not overwritten/);
    assert.equal(await readFile(path.join(directory, ".env"), "utf8"), config);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("administrator provisioning and password reset work without default accounts", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "natural-products-admin-"),
  );
  const env = { ...process.env, DATA_DIR: directory };
  try {
    const args = [path.join(root, "scripts/admin.js"), "editor"];
    execFileSync(process.execPath, args, {
      env,
      input: "a-unique-test-password\n",
    });
    let store = openStore(directory);
    try {
      assert.equal(
        await verifyPassword(
          "a-unique-test-password",
          store.admin("editor").password_hash,
        ),
        true,
      );
      assert.equal(store.admin("editor").version, 1);
    } finally {
      store.close();
    }
    execFileSync(process.execPath, args, {
      env,
      input: "a-new-unique-password\n",
    });
    store = openStore(directory);
    try {
      assert.equal(
        await verifyPassword(
          "a-new-unique-password",
          store.admin("editor").password_hash,
        ),
        true,
      );
      assert.equal(
        await verifyPassword(
          "a-unique-test-password",
          store.admin("editor").password_hash,
        ),
        false,
      );
      assert.equal(store.admin("editor").version, 2);
    } finally {
      store.close();
    }
    const invalid = spawnSync(process.execPath, args, {
      env,
      input: "short\n",
    });
    assert.notEqual(invalid.status, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("backups refuse a missing database instead of creating seed content", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "natural-products-missing-"),
  );
  try {
    const missing = path.join(directory, "not-installed");
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts/backup.js"), path.join(directory, "backups")],
      {
        env: { ...process.env, DATA_DIR: missing },
      },
    );
    assert.notEqual(result.status, 0);
    await assert.rejects(access(missing), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
