import { withFlock, withFlockAsync, funlock } from "./flock.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { describe, it, expect } from "vitest";

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
      expect(result).toBe(1);
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
      expect(result).toBe(1);
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
      expect(r2).toBe(2);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("creates lock file if missing", () => {
    const tmp = tmpDir();
    try {
      const lockFile = path.join(tmp, ".lock");
      withFlock(lockFile, () => "ok");
      expect(fs.existsSync(lockFile)).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
