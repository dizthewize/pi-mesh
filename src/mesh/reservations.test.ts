import { ReservationStore } from "./reservations.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { describe, it, expect } from "vitest";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "resv-test-"));
}

describe("ReservationStore", () => {
  it("reserves files", () => {
    const tmp = tmpDir();
    const store = new ReservationStore({ meshDir: tmp });
    const r = store.reserve("a1", "swift", ["src/a.ts", "src/b.ts"], 600_000);
    expect(r.files).toStrictEqual(["src/a.ts", "src/b.ts"]);
    expect(r.agentId).toBe("a1");
  });

  it("throws on collision", () => {
    const tmp = tmpDir();
    const store = new ReservationStore({ meshDir: tmp });
    store.reserve("a1", "swift", ["src/a.ts"], 600_000);
    expect(() => {
      store.reserve("a2", "bold", ["src/a.ts"], 600_000);
    }).toThrow(/reserved by swift/);
  });

  it("releases all files for agent", () => {
    const tmp = tmpDir();
    const store = new ReservationStore({ meshDir: tmp });
    store.reserve("a1", "swift", ["src/a.ts"], 600_000);
    store.release("a1");
    expect(store.list().length).toBe(0);
  });

  it("releases specific files only", () => {
    const tmp = tmpDir();
    const store = new ReservationStore({ meshDir: tmp });
    store.reserve("a1", "swift", ["src/a.ts", "src/b.ts"], 600_000);
    store.release("a1", ["src/a.ts"]);
    const remaining = store.list();
    expect(remaining.length).toBe(1);
    expect(remaining[0].files).toStrictEqual(["src/b.ts"]);
  });

  it("prunes expired reservations", () => {
    const tmp = tmpDir();
    const store = new ReservationStore({ meshDir: tmp });
    store.reserve("a1", "swift", ["src/a.ts"], 1); // 1ms TTL
    // wait
    const start = Date.now();
    while (Date.now() - start < 50) {}
    const pruned = store.pruneExpired();
    expect(pruned).toBe(1);
    expect(store.list().length).toBe(0);
  });

  it("checkCollision finds existing reservation", () => {
    const tmp = tmpDir();
    const store = new ReservationStore({ meshDir: tmp });
    store.reserve("a1", "swift", ["src/a.ts"], 600_000);
    const collider = store.checkCollision(["src/a.ts"]);
    expect(collider).toBeTruthy();
    expect(collider!.agentId).toBe("a1");
    expect(store.checkCollision(["src/never.ts"])).toBe(null);
  });
});
