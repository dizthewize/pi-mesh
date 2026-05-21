import { describe, it } from "node:test";
import assert from "node:assert";
import { ReservationStore } from "./reservations.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "resv-test-"));
}

describe("ReservationStore", () => {
  it("reserves files", () => {
    const tmp = tmpDir();
    const store = new ReservationStore({ meshDir: tmp });
    const r = store.reserve("a1", "swift", ["src/a.ts", "src/b.ts"], 600_000);
    assert.deepStrictEqual(r.files, ["src/a.ts", "src/b.ts"]);
    assert.strictEqual(r.agentId, "a1");
  });

  it("throws on collision", () => {
    const tmp = tmpDir();
    const store = new ReservationStore({ meshDir: tmp });
    store.reserve("a1", "swift", ["src/a.ts"], 600_000);
    assert.throws(() => {
      store.reserve("a2", "bold", ["src/a.ts"], 600_000);
    }, /reserved by swift/);
  });

  it("releases all files for agent", () => {
    const tmp = tmpDir();
    const store = new ReservationStore({ meshDir: tmp });
    store.reserve("a1", "swift", ["src/a.ts"], 600_000);
    store.release("a1");
    assert.strictEqual(store.list().length, 0);
  });

  it("releases specific files only", () => {
    const tmp = tmpDir();
    const store = new ReservationStore({ meshDir: tmp });
    store.reserve("a1", "swift", ["src/a.ts", "src/b.ts"], 600_000);
    store.release("a1", ["src/a.ts"]);
    const remaining = store.list();
    assert.strictEqual(remaining.length, 1);
    assert.deepStrictEqual(remaining[0].files, ["src/b.ts"]);
  });

  it("prunes expired reservations", () => {
    const tmp = tmpDir();
    const store = new ReservationStore({ meshDir: tmp });
    store.reserve("a1", "swift", ["src/a.ts"], 1); // 1ms TTL
    // wait
    const start = Date.now();
    while (Date.now() - start < 50) {}
    const pruned = store.pruneExpired();
    assert.strictEqual(pruned, 1);
    assert.strictEqual(store.list().length, 0);
  });

  it("checkCollision finds existing reservation", () => {
    const tmp = tmpDir();
    const store = new ReservationStore({ meshDir: tmp });
    store.reserve("a1", "swift", ["src/a.ts"], 600_000);
    const collider = store.checkCollision(["src/a.ts"]);
    assert.ok(collider);
    assert.strictEqual(collider!.agentId, "a1");
    assert.strictEqual(store.checkCollision(["src/never.ts"]), null);
  });
});
