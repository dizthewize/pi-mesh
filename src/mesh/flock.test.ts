import { describe, it } from "node:test";
import assert from "node:assert";
import { withFlock, withFlockAsync, funlock } from "./flock.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "flock-test-"));
}

describe("flock", () => {
  it("guards synchronous critical section", () => {
    const tmp = tmpDir();
    try {
      const lockFile = path.join(tmp, ".lock");
      let counter = 0;
      const result = withFlock(lockFile, () => {
        counter++;
        return counter;
      });
      assert.strictEqual(result, 1);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("guards async critical section", async () => {
    const tmp = tmpDir();
    try {
      const lockFile = path.join(tmp, ".lock");
      let counter = 0;
      const result = await withFlockAsync(lockFile, async () => {
        await new Promise((r) => setTimeout(r, 10));
        counter++;
        return counter;
      });
      assert.strictEqual(result, 1);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("two sequential locks work on same file", () => {
    const tmp = tmpDir();
    try {
      const lockFile = path.join(tmp, ".lock");
      withFlock(lockFile, () => 1);
      const r2 = withFlock(lockFile, () => 2);
      assert.strictEqual(r2, 2);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("creates lock file if missing", () => {
    const tmp = tmpDir();
    try {
      const lockFile = path.join(tmp, ".lock");
      withFlock(lockFile, () => "ok");
      assert.ok(fs.existsSync(lockFile));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
